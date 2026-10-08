/* =========================================================
 * 年度 STRESS 流入 `I` 实测探针 · probe-stress-inflow
 * ---------------------------------------------------------
 * 需求来自 design-strategist（stress-respec.md §3.0 v1.2）：
 *   `I` = 一年里 **所有** STRESS 增量之和（事件 eff.STRESS、scaleEff 的 risk3 覆盖 +4、
 *        疾病、工作、晚年事件等），**不含**恢复项。
 *   它决定 STRESS_DAMP_Q 能不能落 —— 先测 I，再定恢复参数。
 *
 * 测量方式（**不改游戏源码**）：
 *   1) 给 `state.stats.STRESS` 装 getter/setter，捕获**每一次写入**（含引擎内部直接写，
 *      不只是 applyEffects —— grief / MOOD / yearBase 都是直接写 stats）；
 *   2) 用 `new Error().stack` 解析出**写入发生在哪个文件的哪一行**，从而把「恢复项」
 *      （engine.js:1493 的 −7、:1499 住院 −8）与真正的流入区分开；
 *   3) 包一层 `A.step`，在 age 变化时收口这一年的账（与 reg-sim 的年份边界一致）；
 *   4) 包一层 `A.resolveEvent`，顺带统计每年触发了几次 **risk3**（每次固定 +4，
 *      次数 × 4 是 I 里最稳定的一块，用来交叉验证 I 是否可信）。
 *
 * 输出的四种口径（定义有歧义，请 design-strategist 指定一种）：
 *   I_gross        一年里**所有正向增量**之和（最贴近「所有增量之和」的字面定义）
 *   I_net          一年的净变化（含恢复项）→ 即 ΔS
 *   I_noRecovery   净变化 **加回**恢复项（:1493 的 −7）→ 稳态模型里的真实流入
 *   I_noRecNoHosp  再剔除 :1499 住院 −8（住院也算恢复，口径更严）
 *
 * 用法：
 *   node probe-stress-inflow.js --n=200
 * 只读 assets/，不修改任何游戏源码。
 * ========================================================= */
const fs = require('fs');
const path = require('path');

const { loadEngine, exportApi, PERSONAS } = require('./reg-lib.js');
const { makeSim } = require('./reg-sim.js');

const argv = process.argv.slice(2);
const arg = (k, d) => {
  const m = argv.find(s => s.startsWith('--' + k + '='));
  return m ? m.split('=')[1] : d;
};
const N = parseInt(arg('n', '200'), 10);
const OUT = path.join(__dirname, 'out');

const TARGETS = ['aggressive', 'reckless', 'steady', 'explorer', 'slacker', 'baseline'];

/* ---------------- 引擎装载 ---------------- */
const { ctx } = loadEngine();
const A = exportApi(ctx);

/* ---------------- 1. STRESS 写入拦截 ---------------- */
let REC = null;          // 当前局累加器
let CUR_YEAR = null;     // 当前年累加器
let CUR_PERSONA = '?';
let GLOBAL_LINE = {};    // 全样本：写入点 -> { pos, neg, n }

/* ⚠️ 恢复项的行号**不要写死**。
 * 第一版我按 `engine.js:1493` 写死，结果完全没命中（真实是 **1494**）——
 * 于是「剔除恢复项」的口径静默退化成了「净变化」，I_noRecovery 全错。
 * 现在改为**标定**：先用少量局找出「每年一次、恒为负、均值 ≈ −7」的那个写入点。 */
let RECOVERY_KEY = null;
let HOSP_KEY = null;

const SELF = path.basename(__filename);
function callerKey() {
  const stack = new Error().stack;
  if (!stack) return '?:0';
  const fr = stack.split('\n');
  // frame0='Error'  frame1=callerKey  frame2=setter —— 前两帧都在本文件里，必须跳过，
  // 否则归因会全部落到自己身上（第一版就踩了这个坑）。
  for (let i = 2; i < Math.min(fr.length, 10); i++) {
    const m = fr[i].match(/([A-Za-z0-9_.-]+\.js):(\d+):\d+/);
    if (!m) continue;
    if (m[1] === SELF) continue;
    return m[1] + ':' + m[2];
  }
  return '?:0';
}

function bump(bucket, d) {
  bucket = bucket || (GLOBAL_LINE['?:0'] = GLOBAL_LINE['?:0'] || { pos: 0, neg: 0, n: 0 });
  bucket.n++;
  if (d > 0) bucket.pos += d; else bucket.neg += d;
}

function installProbe(st) {
  if (!st || !st.stats || typeof st.stats.STRESS !== 'number') return;
  let v = st.stats.STRESS;
  Object.defineProperty(st.stats, 'STRESS', {
    configurable: true, enumerable: true,
    get() { return v; },
    set(nv) {
      nv = Number(nv);
      const old = v;
      v = nv;
      if (!REC) return;
      const d = nv - old;
      if (!Number.isFinite(d)) { REC.nanHits++; return; }
      if (d === 0) return;
      const key = callerKey();
      REC.all += d;
      if (d > 0) REC.gross += d;
      if (CUR_YEAR) {
        CUR_YEAR.all += d;
        if (d > 0) CUR_YEAR.gross += d;
        if (key === RECOVERY_KEY) CUR_YEAR.recovery += d;   // 恢复 −7（标定得出）
        if (key === HOSP_KEY) CUR_YEAR.hospital += d;       // 住院 −8（标定得出）
      }
      bump(GLOBAL_LINE[key] = GLOBAL_LINE[key] || { pos: 0, neg: 0, n: 0 }, d);
    }
  });
}

/* ---------------- 2. 年边界收口 ---------------- */
const YEARS = [];

function freshYear(age) {
  return { persona: CUR_PERSONA, age, gross: 0, all: 0, recovery: 0, hospital: 0, risk3: 0, events: 0 };
}
function closeYear(age) {
  if (CUR_YEAR) YEARS.push(CUR_YEAR);
  CUR_YEAR = freshYear(age);
}

/* ---------------- 3. 挂钩 ---------------- */
const origCreateGame = A.createGame;
A.createGame = function (cfg) {
  const st = origCreateGame(cfg);
  installProbe(st);
  REC = { all: 0, gross: 0, recovery: 0, hospital: 0, nanHits: 0 };
  CUR_YEAR = freshYear(st.age);
  return st;
};

const origStep = A.step;
A.step = function (st) {
  const before = st.age;
  const r = origStep(st);
  if (st.age !== before) closeYear(st.age);
  return r;
};

const origResolveEvent = A.resolveEvent;
A.resolveEvent = function (st, ev, idx) {
  if (CUR_YEAR) {
    CUR_YEAR.events++;
    try {
      const list = A.eventChoices(st, ev) || [];
      const c = list[idx];
      if (c && c.risk === 3) CUR_YEAR.risk3++;
    } catch (e) { /* 童年返回 null / 越界，忽略 */ }
  }
  return origResolveEvent(st, ev, idx);
};

const sim = makeSim(A, ctx, PERSONAS);

/* ---------------- 4. B-10 规避：清共享缓存 ---------------- */
const EVENT_ARRAYS = [];
['EVENTS', 'EVENTS_EXTRA'].forEach(k => { if (Array.isArray(A[k])) EVENT_ARRAYS.push(A[k]); });
function resetChoiceCache() {
  EVENT_ARRAYS.forEach(arr => arr.forEach(e => { if (e && e._ct) delete e._ct; }));
}

/* ---------------- 5. 标定：找出「恢复项」的写入点 ---------------- */
let CRASHED = 0;
function runGames(pn, n) {
  for (let i = 0; i < n; i++) {
    CUR_PERSONA = pn;
    resetChoiceCache();
    try { sim.playOne(pn, PERSONAS[pn], {}); } catch (e) { CRASHED++; }
    CUR_PERSONA = '?';
  }
}

console.log('================ 年度 STRESS 流入 I 实测 ================');
console.log('每组样本量 N = ' + N + ' 局；样本单位是**人-年**');
console.log('拦截：state.stats.STRESS 的每一次写入（含引擎内部直接写），按文件:行号归因');
console.log('');

['aggressive', 'steady'].forEach(pn => runGames(pn, 25));
const cand = Object.keys(GLOBAL_LINE)
  .map(k => ({ k, g: GLOBAL_LINE[k], mean: (GLOBAL_LINE[k].pos + GLOBAL_LINE[k].neg) / GLOBAL_LINE[k].n }))
  .filter(o => o.g.n > 20 && o.mean >= -9.5 && o.mean <= -5.5)
  .sort((a, b) => b.g.n - a.g.n);
if (cand[0]) RECOVERY_KEY = cand[0].k;
if (cand[1]) HOSP_KEY = cand[1].k;
console.log('  [标定] 恢复项写入点 = ' + RECOVERY_KEY +
  (cand[0] ? '（n=' + cand[0].g.n + '，均值 ' + cand[0].mean.toFixed(2) + '）' : '（未找到！口径会退化）'));
console.log('  [标定] 住院写入点   = ' + HOSP_KEY +
  (cand[1] ? '（n=' + cand[1].g.n + '，均值 ' + cand[1].mean.toFixed(2) + '）' : '（未找到）'));
console.log('');

/* 标定数据不计入正式样本 */
GLOBAL_LINE = {};
YEARS.length = 0;
CRASHED = 0;

TARGETS.forEach(pn => {
  runGames(pn, N);
  console.log('  已完成 ' + pn + ' × ' + N + ' 局');
});
const crashed = CRASHED;
if (crashed) console.log('  ⚠️ 崩溃局数 ' + crashed + '（不计入样本）');

/* ---------------- 6. 统计 ---------------- */
const median = a => { if (!a.length) return 0; const b = a.slice().sort((x, y) => x - y); const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
const pct = (a, q) => { if (!a.length) return 0; const b = a.slice().sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(b.length * q))]; };
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const f1 = v => v.toFixed(1);
const f2 = v => v.toFixed(2);

function stats(arr) {
  return {
    n: arr.length, mean: mean(arr), med: median(arr),
    p75: pct(arr, 0.75), p90: pct(arr, 0.90), p95: pct(arr, 0.95), p99: pct(arr, 0.99),
    max: arr.length ? Math.max.apply(null, arr) : 0
  };
}

const byP = {};
YEARS.forEach(y => { (byP[y.persona] = byP[y.persona] || []).push(y); });

const L = [];
L.push('# 年度 STRESS 流入 `I` 实测（probe-stress-inflow）');
L.push('');
L.push('- 样本量：每画像 ' + N + ' 局；样本单位是**人-年**（不是局）');
L.push('- 拦截：`state.stats.STRESS` 的每一次写入，按 `文件:行号` 归因；**未修改游戏源码**');
L.push('- 崩溃局 ' + crashed + ' 不计入');
L.push('');

function block(title, filter, note) {
  L.push('## ' + title);
  L.push('');
  L.push('> ' + note);
  L.push('');
  L.push('| 画像 | 人-年数 | 平均 | 中位 | P75 | **P90** | P95 | P99 | 最大 |');
  L.push('|---|---|---|---|---|---|---|---|---|');
  const out = {};
  TARGETS.forEach(pn => {
    const ys = (byP[pn] || []).filter(filter);
    const s = stats(ys.map(y => y.gross));
    const sNR = stats(ys.map(y => y.all - y.recovery));
    const sNRH = stats(ys.map(y => y.all - y.recovery - y.hospital));
    const sNet = stats(ys.map(y => y.all));
    const share = (arr, th) => arr.length ? arr.filter(v => v > th).length / arr.length : 0;
    const arrG = ys.map(y => y.gross), arrN = ys.map(y => y.all - y.recovery);
    out[pn] = {
      s, sNR, sNRH, sNet,
      risk3: mean(ys.map(y => y.risk3)), ev: mean(ys.map(y => y.events)),
      shG304: share(arrG, 30.4), shG34: share(arrG, 34),
      shN304: share(arrN, 30.4), shN34: share(arrN, 34)
    };
    L.push('| ' + pn + ' | ' + s.n + ' | ' + f1(s.mean) + ' | ' + f1(s.med) + ' | ' + f1(s.p75) +
      ' | **' + f1(s.p90) + '** | ' + f1(s.p95) + ' | ' + f1(s.p99) + ' | ' + f1(s.max) + ' |');
  });
  L.push('');
  L.push('同一批样本的另外三个口径（确认口径用）+ risk3 交叉验证：');
  L.push('');
  L.push('| 画像 | I_gross 中位/P90 | I_gross 均值 | I_noRecovery 中位/P90 | I_noRecovery 均值 | I_net(ΔS) 中位/均值 | risk3 次/年 | 事件次/年 |');
  L.push('|---|---|---|---|---|---|---|---|---|');
  TARGETS.forEach(pn => {
    const o = out[pn];
    L.push('| ' + pn + ' | ' + f1(o.s.med) + ' / ' + f1(o.s.p90) + ' | ' + f1(o.s.mean) +
      ' | ' + f1(o.sNR.med) + ' / ' + f1(o.sNR.p90) + ' | ' + f1(o.sNR.mean) +
      ' | ' + f1(o.sNet.med) + ' / ' + f1(o.sNet.mean) +
      ' | ' + f2(o.risk3) + ' | ' + f2(o.ev) + ' |');
  });
  L.push('');
  L.push('**阻尼触发占比**（`I > 30.4` 与 `I > 34` 的人-年比例 —— 直接决定阻尼参数影响多少人）：');
  L.push('');
  L.push('| 画像 | I_gross > 30.4 | I_gross > 34 | I_noRecovery > 30.4 | I_noRecovery > 34 |');
  L.push('|---|---|---|---|---|');
  TARGETS.forEach(pn => {
    const o = out[pn];
    L.push('| ' + pn + ' | ' + (o.shG304 * 100).toFixed(1) + '% | ' + (o.shG34 * 100).toFixed(1) + '% | ' +
      (o.shN304 * 100).toFixed(1) + '% | ' + (o.shN34 * 100).toFixed(1) + '% |');
  });
  L.push('');
  return out;
}

const allB = block('一、全部年龄段（所有人-年）', () => true,
  '`I_gross` = 一年里所有正向增量之和（不含任何恢复）。这是「所有 STRESS 增量之和」的字面口径。');
const adultB = block('二、仅 18 岁及以上', y => y.age >= 18,
  '压力失控发生在成年后；阻尼参数针对的是这一段。**建议以这一块为准。**');
const primeB = block('三、仅 22–60 岁（职业期）', y => y.age >= 22 && y.age <= 60,
  '最窄的口径：职业期是 risk3 与工作压力的主场。');

/* 归因 */
/* 行号以 `grep -n` 为准（Read 工具对本文件有 1 行偏移，别拿 Read 的行号写断言） */
const NOTE = {
  'engine.js:872': '`applyEffects` 的 `s[k] += v` —— 事件 / 选择 / 天赋 / 投资 / 疾病的 `eff.STRESS` **全走这一行**',
  'engine.js:877': '`applyEffects` 结尾的 `clamp(0,120)` —— **会把超出的流入截断**（正增量被削掉的那部分记在这里的负侧）',
  'engine.js:1158': '`addGrief`：亲人 / 宠物离世 `STRESS += round(a/3)`',
  'engine.js:1483': '`yearBase`：悲伤期内 `STRESS += 2`',
  'engine.js:1489': '`yearBase`：`MOOD < 32` 时 `STRESS += 4`',
  'engine.js:1490': '`yearBase`：`MOOD > 78` 时 `STRESS -= 1`（不计入流入）',
  'engine.js:1461': '`priority=balance` 的 `−2`（不计入流入）',
  'engine.js:583': '`createGame` 后的 `clamp(0,100)` —— 初始化，不是流入',
  'engine.js:1494': '**恢复 −7**（不计入流入 · 由标定自动识别）',
  'engine.js:1500': '**住院 −8**（不计入流入 · 由标定自动识别）',
  'engine.js:1021': 'risk3 选项的构造（本身不写 stats；它的 +4 经 872 落账）'
};
L.push('## 四、流入来源归因（正向增量 Top 写入点 · 全画像合计）');
L.push('');
L.push('| 写入点 | 总正向增量 | 总负向增量 | 写入次数 | 含义 |');
L.push('|---|---|---|---|---|');
Object.keys(GLOBAL_LINE).sort((a, b) => GLOBAL_LINE[b].pos - GLOBAL_LINE[a].pos)
  .slice(0, 16).forEach(k => {
    const g = GLOBAL_LINE[k];
    L.push('| `' + k + '` | ' + f1(g.pos) + ' | ' + f1(g.neg) + ' | ' + g.n + ' | ' + (NOTE[k] || '—') + ' |');
  });
L.push('');

fs.writeFileSync(path.join(OUT, 'stress-inflow.md'), L.join('\n'), 'utf8');
fs.writeFileSync(path.join(OUT, 'stress-inflow.json'), JSON.stringify({
  n: N, crashed, personYears: YEARS.length,
  byPersona: Object.keys(byP).reduce((o, k) => { o[k] = byP[k].length; return o; }, {}),
  globalLine: GLOBAL_LINE
}, null, 2), 'utf8');

console.log('');
console.log('================ 结论（I_gross · 18 岁及以上）===============');
console.log('  画像          人-年    中位     P90      P95    risk3/年   事件/年');
TARGETS.forEach(pn => {
  const o = adultB[pn];
  console.log('  ' + pn.padEnd(12) + String(o.s.n).padStart(6) + f1(o.s.med).padStart(9) + f1(o.s.p90).padStart(9) +
    f1(o.s.p95).padStart(9) + f2(o.risk3).padStart(10) + f2(o.ev).padStart(10));
});
console.log('');
console.log('================ 全部年龄段（I_gross）===============');
console.log('  画像          人-年    中位     P90');
TARGETS.forEach(pn => {
  const o = allB[pn];
  console.log('  ' + pn.padEnd(12) + String(o.s.n).padStart(6) + f1(o.s.med).padStart(9) + f1(o.s.p90).padStart(9));
});
console.log('');
console.log('已写出 out/stress-inflow.md / out/stress-inflow.json');
