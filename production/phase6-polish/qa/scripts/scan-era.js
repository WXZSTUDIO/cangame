/* =========================================================
 * 追加验证 A · 年代事件（era）重复与抽取逻辑扫描
 * 回答两个问题：
 *   1) 抽取是「窗口内必触发一个」还是「遍历全部匹配」—— 同年会不会双触发？
 *   2) 全量 era 事件里，哪些「同窗口多事件」构成重复内容？
 * 用法：node scan-era.js
 * 产出：out/era-scan.md / out/era-scan.json
 * 只读 assets/，不修改任何游戏源码。
 * ========================================================= */
const fs = require('fs');
const path = require('path');
const { loadEngine, exportApi, PERSONAS, rnd } = require('./reg-lib.js');
const { makeSim } = require('./reg-sim.js');

const OUT = path.join(__dirname, 'out');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const { ctx } = loadEngine();
const A = exportApi(ctx);
const sim = makeSim(A, ctx, PERSONAS);

const L = [];
const say = s => { L.push(s); console.log(s); };

/* ============ 1. 全量 era 事件清单 ============ */
const era = (A.EVENTS || []).filter(e => e.era);
const info = era.map(e => {
  const c = e.cond || {};
  return {
    id: e.id,
    y0: c.yearMin == null ? null : c.yearMin,
    y1: c.yearMax == null ? null : c.yearMax,
    age: (e.age || [0, 200]).join('-'),
    w: e.w || 5,
    once: !!e.once,
    need: c.need ? c.need.join(',') : '',
    needFlag: c.needFlag ? c.needFlag.join(',') : '',
    minMoney: c.min && c.min.MONEY ? c.min.MONEY : 0,
    hasChoices: !!(e.choices && e.choices.length),
    text: String(e.text || '').slice(0, 34)
  };
});

say('# 年代事件（era）扫描 · cangame v5.5.0');
say('');
say('## 1. 全量 era 事件清单（共 ' + era.length + ' 条）');
say('');
say('| # | id | 年份窗口 | 年龄 | 权重 | 前置 | 选项 | 文案前 34 字 |');
say('|---|---|---|---|---|---|---|---|');
info.forEach((e, i) => {
  say('| ' + (i + 1) + ' | `' + e.id + '` | ' + e.y0 + '-' + e.y1 + ' | ' + e.age + ' | ' + e.w +
    ' | ' + (e.need || e.needFlag || (e.minMoney ? 'MONEY>=' + e.minMoney : '—')) + ' | ' +
    (e.hasChoices ? '有' : '无') + ' | ' + e.text.replace(/\|/g, '/') + ' |');
});

/* ============ 2. 同窗口重叠分组 ============ */
say('');
say('## 2. 「同窗口多事件」全量重叠清单');
say('');
say('判定：两条 era 事件的 `[yearMin, yearMax]` 区间有非空交集即为一组重叠。');
say('');

// 并查集
const idx = {};
info.forEach((e, i) => { idx[e.id] = i; });
const par = info.map((_, i) => i);
const find = x => par[x] === x ? x : (par[x] = find(par[x]));
const uni = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) par[ra] = rb; };
const pairs = [];
for (let i = 0; i < info.length; i++) {
  for (let j = i + 1; j < info.length; j++) {
    const a = info[i], b = info[j];
    if (a.y0 == null || b.y0 == null) continue;
    const lo = Math.max(a.y0, b.y0), hi = Math.min(a.y1, b.y1);
    if (lo <= hi) { uni(i, j); pairs.push({ a: a.id, b: b.id, lo, hi, full: (a.y0 === b.y0 && a.y1 === b.y1) }); }
  }
}
const groups = {};
info.forEach((e, i) => { const r = find(i); (groups[r] || (groups[r] = [])).push(e); });
const groupList = Object.keys(groups).map(k => groups[k]).filter(g => g.length > 1);

say('### 2.1 重叠组一览（' + groupList.length + ' 组，涉及 ' +
  groupList.reduce((a, g) => a + g.length, 0) + ' 条事件）');
say('');
say('| 组 | 成员 | 各成员年份窗口 | 交集 | 是否完全同窗口 | 性质判定 |');
say('|---|---|---|---|---|---|');
groupList.forEach((g, gi) => {
  const lo = Math.max.apply(null, g.map(x => x.y0));
  const hi = Math.min.apply(null, g.map(x => x.y1));
  const full = g.every(x => x.y0 === g[0].y0 && x.y1 === g[0].y1);
  // 性质：链式设计（有 need/needFlag 依赖）不算重复
  const chained = g.some(x => x.need || x.needFlag);
  const kind = chained ? '链式设计（有前置依赖，不算重复）'
    : (full ? '**完全同窗口 → 同质重复**' : '部分重叠 → 相邻年可能重复');
  say('| G' + (gi + 1) + ' | ' + g.map(x => '`' + x.id + '`').join(' + ') + ' | ' +
    g.map(x => x.y0 + '-' + x.y1).join(' / ') + ' | ' + lo + '-' + hi + ' | ' +
    (full ? '是' : '否') + ' | ' + kind + ' |');
});

say('');
say('### 2.2 逐对明细（' + pairs.length + ' 对）');
say('');
say('| A | B | 交集年份 | 完全同窗口 | 是否都有「无选项」版本 | 文案对照 |');
say('|---|---|---|---|---|---|');
const txtOf = id => String((era.find(e => e.id === id) || {}).text || '').slice(0, 26).replace(/\|/g, '/');
pairs.forEach(p => {
  const a = info[idx[p.a]], b = info[idx[p.b]];
  const bothPlain = (!a.hasChoices && !b.hasChoices) ? '是（两条都无选项）' : (a.hasChoices !== b.hasChoices ? '一条有一无' : '两条都有');
  say('| `' + p.a + '` | `' + p.b + '` | ' + p.lo + '-' + p.hi + ' | ' + (p.full ? '**是**' : '否') +
    ' | ' + bothPlain + ' | ' + txtOf(p.a) + ' … / ' + txtOf(p.b) + ' … |');
});

/* ============ 3. 抽取逻辑实测：同年会不会双触发 ============ */
say('');
say('## 3. 抽取逻辑实测');
say('');
say('源码位置 `assets/engine.js:1051-1057`（`pickEvents`）：');
say('');
say('```js');
say('// 年代事件：窗口开启的年份必触发一个（每个出生年份都有自己独有的时代切片）');
say('const era = weighted.filter(x => x.ev.era);');
say('if (era.length) {');
say('  const e = era[randInt(0, era.length - 1)].ev;   // ← 随机取 1 条');
say('  picked.push(e);');
say('  weighted.splice(weighted.findIndex(x => x.ev === e), 1);');
say('}');
say('```');
say('');
say('**机制拆解（关键）**：');
say('');
say('1. era 事件有一个「保证位」——窗口开启的年份**必触发 1 条**（随机取）。');
say('2. 但被选中之后，代码只把**这一条**从候选池 `weighted` 里 splice 掉；');
say('   **同一窗口里的其它 era 事件仍然留在 `weighted` 里**。');
say('3. 而 `count = state.age <= 12 ? 1 : (chance(0.35) ? 2 : 1)`，');
say('   13 岁以上每年有 35% 概率抽第 2 条事件 —— **第 2 条有可能正好是另一条 era 事件**。');
say('');
say('> 所以准确答案是：**既不是「遍历全部匹配」，也不是「严格只触发一条」**；');
say('> 主路径是「保证 1 条」，但存在一条漏网路径导致同年双触发。实测见下。');
say('');

// 实测：扫遍 (startYear × age) 组合，看 pickEvents 一年返回的 era 条数
let maxEraPerPick = 0;
let samples = 0;
let multi = 0;
const dist = {};
for (let sy = 1950; sy <= 2010; sy += 2) {
  const st = A.createGame({ name: '扫描', gender: 'M', familyId: 'xiangong', talents: [], startYear: sy });
  st.stats.INT = 120; st.stats.NET = 120; st.stats.LOY = 90; st.stats.CHA = 80;
  st.stats.MONEY = 300000000;
  for (let age = 0; age <= 100; age++) {
    st.age = age;
    st.used = [];
    let picked = [];
    try { picked = A.pickEvents(st) || []; } catch (e) { continue; }
    const n = picked.filter(e => e && e.era).length;
    samples++;
    dist[n] = (dist[n] || 0) + 1;
    if (n > maxEraPerPick) maxEraPerPick = n;
    if (n > 1) multi++;
  }
}
say('### 3.1 `pickEvents()` 单次返回的 era 事件条数分布（' + samples + ' 次采样）');
say('');
say('| 单次返回 era 条数 | 次数 | 占比 |');
say('|---|---:|---:|');
Object.keys(dist).sort((a, b) => a - b).forEach(k =>
  say('| ' + k + ' | ' + dist[k] + ' | ' + (dist[k] / samples * 100).toFixed(2) + '% |'));
say('');
say('- 最大条数：**' + maxEraPerPick + '**；出现 ≥2 条的次数：**' + multi + ' / ' + samples +
  '（' + (multi / samples * 100).toFixed(2) + '%）**');
say('- 判定：' + (multi === 0
  ? '✅ 同年从不双触发'
  : '⚠ **同年双触发确实存在**，概率约 ' + (multi / samples * 100).toFixed(2) +
    '% —— 需要 `count=2`（13 岁以上 35%）且第 2 抽正好命中同窗口的另一条 era'));
say('');
say('**修复建议（1 处，2 行）**：选完 era 之后把候选池里剩余的 era 全部移出，只保留保证位那一条。');
say('');
say('```js');
say('const era = weighted.filter(x => x.ev.era);');
say('if (era.length) {');
say('  const e = era[randInt(0, era.length - 1)].ev;');
say('  picked.push(e);');
say('  // ↓ 原来只 splice 掉被选中那条；改为把所有 era 移出候选池');
say('  for (let i = weighted.length - 1; i >= 0; i--) if (weighted[i].ev.era) weighted.splice(i, 1);');
say('}');
say('```');

/* ============ 4. 跨年重复：相邻年触发同主题不同 id ============ */
say('');
say('## 4. 跨年重复实测（这才是真问题）');
say('');
say('逻辑：`used` 数组保证每个事件 id 一生只触发一次，但**窗口通常是 2 年**。');
say('于是第 1 年随机命中 A，第 2 年 A 已入 `used`，剩下的 B 仍在窗口内 → **第 2 年必触发 B**。');
say('');

// 构造「同一窗口内多条」的映射
const winMap = {};   // "y0-y1" -> [ids]
info.forEach(e => {
  if (e.y0 == null) return;
  const k = e.y0 + '-' + e.y1;
  (winMap[k] || (winMap[k] = [])).push(e.id);
});
const dupWindows = Object.keys(winMap).filter(k => winMap[k].length > 1);

// 跑真实人生，记录 era 事件触发序列
const N = 400;
const seq = [];          // {life, year, id}
const windowHit = {};    // 窗口 -> 该局命中了几条
for (let i = 0; i < N; i++) {
  const st = A.createGame({ name: '扫描', gender: 'M', familyId: 'xiangong', talents: [],
    startYear: 1955 + rnd(51) });
  let g = 0;
  const hits = {};
  const perYear = {};
  while (!st.finished && g++ < 4000) {
    const item = A.step(st);
    if (!item || item.type === 'end') break;
    if (item.type === 'exam') {
      st.pending = item;
      let q = 0;
      while (item.exam && item.exam.quiz && !item.exam.quiz.done && q++ < 20) A.answerExamQ(st, rnd(4));
      const o = (item.exam.options || []).map((x, idx) => ({ x, idx })).filter(z => !z.x.locked);
      if (o.length) A.resolveExam(st, o[rnd(o.length)].idx);
      st.pending = null;
    } else if (item.type === 'event') {
      const ev = item.ev;
      if (ev && ev.era) {
        const y = st.startYear + st.age;
        perYear[y] = (perYear[y] || []).concat([ev.id]);
        seq.push({ life: i, year: y, id: ev.id });
        const c = ev.cond || {};
        if (c.yearMin != null) {
          const k = c.yearMin + '-' + c.yearMax;
          (hits[k] || (hits[k] = {}))[ev.id] = 1;
        }
      }
      const list = A.eventChoices(st, ev) || [];
      A.resolveEvent(st, ev, list.length ? rnd(list.length) : -1);
    } else if (item.type === 'invest') {
      const cs = item.choices || [];
      if (cs.length) A.resolveInvest(st, cs[rnd(cs.length)]);
    }
  }
  Object.keys(hits).forEach(k => {
    (windowHit[k] || (windowHit[k] = [])).push(Object.keys(hits[k]).length);
  });
}

say('### 4.1 同一窗口内「一生实际触发了几条」（' + N + ' 局统计）');
say('');
say('| 窗口 | 窗口内事件 | 平均触发条数 | 触发 ≥2 条的局占比 | 判定 |');
say('|---|---|---:|---:|---|');
dupWindows.forEach(k => {
  const ids = winMap[k];
  const arr = windowHit[k] || [];
  if (!arr.length) { say('| ' + k + ' | ' + ids.join(' / ') + ' | — | — | 未命中 |'); return; }
  const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
  const multi = arr.filter(x => x >= 2).length / arr.length;
  const chained = ids.some(id => { const e = info[idx[id]]; return e && (e.need || e.needFlag); });
  say('| ' + k + ' | ' + ids.map(x => '`' + x + '`').join(' + ') + ' | ' + avg.toFixed(2) +
    ' | **' + (multi * 100).toFixed(0) + '%** | ' +
    (chained ? '链式设计（预期）' : (multi > 0.3 ? '**同质重复**' : '偶发')) + ' |');
});

// 相邻年重复
let adjacent = 0;
const adjSamples = {};
for (let i = 0; i < N; i++) {
  const mine = seq.filter(s => s.life === i).sort((a, b) => a.year - b.year);
  for (let j = 1; j < mine.length; j++) {
    if (mine[j].year - mine[j - 1].year <= 2) {
      const a = info[idx[mine[j - 1].id]], b = info[idx[mine[j].id]];
      if (a && b && a.y0 != null && b.y0 != null && a.y0 === b.y0 && a.y1 === b.y1 && mine[j - 1].id !== mine[j].id) {
        adjacent++;
        const k = mine[j - 1].id + ' → ' + mine[j].id;
        adjSamples[k] = (adjSamples[k] || 0) + 1;
      }
    }
  }
}
say('');
say('### 4.2 相邻两年触发「同窗口不同 id」的实测次数（' + N + ' 局）');
say('');
say('| 连续触发序列 | 次数 |');
say('|---|---:|');
Object.keys(adjSamples).sort((a, b) => adjSamples[b] - adjSamples[a])
  .forEach(k => say('| `' + k.replace(' → ', '` → `') + '` | ' + adjSamples[k] + ' |'));
say('');
say('合计：**' + adjacent + ' 次**（平均每局 ' + (adjacent / N).toFixed(2) + ' 次）');
say('');

/* ============ 5. 附带发现：童年期 era 事件会独占当年唯一名额 ============ */
say('## 5. 附带发现：童年期 era 事件独占当年唯一名额');
say('');
say('`pickEvents` 里 `count = state.age <= 12 ? 1 : (chance(0.35) ? 2 : 1)`，');
say('而 era 事件是**先于**普通事件被 push 进 `picked` 的，且计入 `count`。');
say('因此 **0-12 岁只要命中一条 era 事件，该年就不会再有其他事件**。');
say('');
let childEraYears = 0, childYears = 0, childEraOnly = 0;
for (let i = 0; i < 200; i++) {
  const st = A.createGame({ name: '扫描', gender: 'M', familyId: 'xiangong', talents: [], startYear: 1955 + rnd(51) });
  const byYear = {};
  let g = 0;
  while (st.age <= 12 && g++ < 400) {
    const item = A.step(st);
    if (!item || item.type === 'end') break;
    if (item.type === 'event') {
      byYear[st.age] = (byYear[st.age] || []).concat([item.ev && item.ev.era ? 'era' : 'normal']);
      const list = A.eventChoices(st, item.ev) || [];
      A.resolveEvent(st, item.ev, list.length ? 0 : -1);
    } else if (item.type === 'exam') {
      st.pending = item;
      let q = 0;
      while (item.exam && item.exam.quiz && !item.exam.quiz.done && q++ < 20) A.answerExamQ(st, rnd(4));
      const o = (item.exam.options || []).map((x, idx) => ({ x, idx })).filter(z => !z.x.locked);
      if (o.length) A.resolveExam(st, o[0].idx);
      st.pending = null;
    } else if (item.type === 'invest') {
      const cs = item.choices || [];
      if (cs.length) A.resolveInvest(st, cs[0]);
    }
  }
  Object.keys(byYear).forEach(y => {
    childYears++;
    const arr = byYear[y];
    if (arr.indexOf('era') >= 0) { childEraYears++; if (arr.length === 1) childEraOnly++; }
  });
}
say('- 0-12 岁有事件的年份采样数：' + childYears);
say('- 其中含 era 事件的年份：' + childEraYears);
say('- 其中**只有** era 事件（无其他事件）的年份：' + childEraOnly +
  '（占含 era 年份的 ' + (childEraYears ? (childEraOnly / childEraYears * 100).toFixed(0) : '0') + '%）');
say('');

fs.writeFileSync(path.join(OUT, 'era-scan.md'), L.join('\n'), 'utf8');
fs.writeFileSync(path.join(OUT, 'era-scan.json'), JSON.stringify({
  eraCount: era.length, info, groups: groupList.map(g => g.map(x => x.id)), pairs,
  maxEraPerPick, multi, dupWindows, winMap, adjacent, adjSamples,
  child: { childYears, childEraYears, childEraOnly }
}, null, 2), 'utf8');
console.log('\n已写出 out/era-scan.md 与 out/era-scan.json');
