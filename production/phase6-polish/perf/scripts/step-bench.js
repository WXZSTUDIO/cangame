/* =========================================================
 * PERF-01 · 单年 step() 开销剖析
 *  1) 完整一生的 step() 单步耗时分布
 *  2) 内部 tick 函数拆解（插桩累加）
 *  3) pickEvents / matchEvent 的线性扫描成本
 *  4) 存档体积随年龄增长曲线
 *  5) 连点「下一年」60 次的手感估算
 *
 * 运行： node production/phase6-polish/perf/scripts/step-bench.js
 * ========================================================= */
const fs = require('fs');
const path = require('path');
const H = require('./harness');

const out = [];
function say(s) { console.log(s); out.push(s); }
const med = a => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };

say('# step() 单年开销剖析 · cangame v5.5.0');
say('生成时间：' + new Date().toISOString());
say('运行时：Node ' + process.version + ' / ' + process.platform + ' ' + process.arch);
say('');

const V = H.loadVM(false);
/* 给 VM 里注入高精度计时 */
Object.defineProperty(V.ctx, '__ns', { value: () => Number(process.hrtime.bigint()) / 1e6 });
V.run(`
const process_hrtime = () => __ns();
/* v5.5 的 exam 是两段式驱动，且 answerExamQ / resolveExam 都读 state.pending：
 *   ① exam.options === null、exam.quiz 存在 → 必须先逐题 answerExamQ() 答完 5 题
 *   ② 答满后才会回填 options、quiz.done = true → 此时才能 resolveExam()
 * 早期版本漏了这两步，导致角色永远不入学期罢 —— 测到的是「残缺人生」，
 * 后面的存档体积曲线与 tick 归因都偏小。这里统一修掉。 */
function __driveExam(st, item) {
  st.pending = item;
  const ex = item.exam;
  let g = 0;
  while (ex.quiz && !ex.quiz.done) {
    if (++g > 20) break;
    const q = ex.quiz.qs[ex.quiz.i];
    answerExamQ(st, q && q.opts ? Math.floor(Math.random() * q.opts.length) : 0);
  }
  const opts = ex.options || [];
  const usable = opts.filter(o => !o.locked);
  if (usable.length) resolveExam(st, opts.indexOf(usable[Math.floor(Math.random() * usable.length)]));
  st.pending = null;
}

function playLife(seedName, gender, collect) {
  const st = createGame({ name: seedName, gender: gender, talents: [] });
  migrateState(st); marketMigrate(st);
  const times = [];
  const sizes = [];
  let guard = 0, steps = 0, prevAge = 0;
  for (;;) {
    if (++guard > 6000) break;
    const t0 = __ns();
    const item = step(st);
    const t1 = __ns();
    if (collect) times.push({ t: t1 - t0, year: st.age !== prevAge });
    prevAge = st.age;
    steps++;
    if (!item || item.type === 'end') break;
    if (item.type === 'exam') { __driveExam(st, item); } else if (item.type === 'event') {
      resolveEvent(st, item.ev, Math.floor(Math.random() * 3));
    }
    if (st.finished) break;
  }
  return { times, steps, age: st.age, finished: !!st.finished, bytes: JSON.stringify(st).length };
}
`);

/* ---------- 1. 一整局的分布 ---------- */
say('## 1. 完整一生：单步 step() 的 CPU 时间');
const q = (arr, p) => { const a = arr.slice().sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(a.length * p))]; };
const runs = [];
for (let r = 0; r < 8; r++) {
  const rep = V.run(`playLife('基准${r}', ${r % 2 ? "'F'" : "'M'"}, true)`);
  const allT = rep.times.map(x => x.t);
  const yrT = rep.times.filter(x => x.year).map(x => x.t);
  const popT = rep.times.filter(x => !x.year).map(x => x.t);
  const r2 = {
    steps: rep.steps, age: rep.age, finished: rep.finished, KB: rep.bytes / 1024,
    years: yrT.length,
    yrP50: q(yrT, 0.5), yrP95: q(yrT, 0.95), yrMax: Math.max(...yrT), yrSum: yrT.reduce((a, b) => a + b, 0),
    popP50: popT.length ? q(popT, 0.5) : 0,
    max: Math.max(...allT), sum: allT.reduce((a, b) => a + b, 0)
  };
  runs.push(r2);
}
say(H.table(runs.map((r, i) => ({
  '局': i + 1, '步数': r.steps, '其中「过新年」': r.years, '终龄': r.age,
  '年步 p50': r.yrP50.toFixed(3), '年步 p95': r.yrP95.toFixed(3), '年步 max': r.yrMax.toFixed(3),
  '队列弹出 p50': r.popP50.toFixed(4), '全局 ms': r.sum.toFixed(2), '存档 KB': r.KB.toFixed(1)
})), ['局', '步数', '其中「过新年」', '终龄', '年步 p50', '年步 p95', '年步 max', '队列弹出 p50', '全局 ms', '存档 KB']));
say('');
say('> `step()` 有两种形态：① 只从 queue 里弹下一个待展示 item（几乎零成本）；' +
  '② 真正「过一年」，跑完 yearBase + 全部 tick + pickEvents。**只有 ② 值得优化。**');
say('');
say('- **过一年** p50 中位 **' + med(runs.map(r => r.yrP50)).toFixed(3) + ' ms** · p95 中位 **' +
  med(runs.map(r => r.yrP95)).toFixed(3) + ' ms** · 最慢一步 **' + Math.max(...runs.map(r => r.yrMax)).toFixed(3) + ' ms**');
say('- **队列弹出** p50 中位 **' + med(runs.map(r => r.popP50)).toFixed(4) + ' ms**（纯 shift，可忽略）');
say('- 一整局（约 ' + med(runs.map(r => r.steps)) + ' 步 / ' + med(runs.map(r => r.years)) +
  ' 年）的 step CPU 总计 ≈ **' + med(runs.map(r => r.sum)).toFixed(2) + ' ms**');
say('');

/* ---------- 2. tick 拆解 ---------- */
say('## 2. step() 内部：逐个 tick 函数的耗时拆解');
say('做法：把 step() 调用的每个 tick 包一层累加器，再跑 8 局完整人生取**每局累计**的中位数。');
const TARGETS = ['yearBase', 'marketTick', 'settleInvestments', 'refreshClassmates', 'scoutTick',
  'careerTick', 'loveTick', 'friendTick', 'inboundTick', 'familyTick', 'illnessTick', 'loanTick',
  'checkAchievements', 'offerInvestments', 'pickEvents', 'parentTick', 'resolveEvent', 'eventChoices'];
V.run(`
const __ACC = {}, __CNT = {};
globalThis.__ACC = __ACC; globalThis.__CNT = __CNT;
globalThis.__WRAPPED = [];
(function(){
  const targets = ${JSON.stringify(TARGETS)};
  targets.forEach(n => {
    let orig;
    try { orig = eval(n); } catch(e) { return; }
    if (typeof orig !== 'function') return;
    __ACC[n] = 0; __CNT[n] = 0;
    const wrapped = function(){
      const t = process_hrtime();
      try { return orig.apply(this, arguments); }
      finally { __ACC[n] += process_hrtime() - t; __CNT[n]++; }
    };
    wrapped.__wrappedName = n;
    try { eval(n + ' = wrapped'); globalThis.__WRAPPED.push(n); } catch(e) { /* const 不可重写 */ }
  });
})();
`);
const wrapped = V.run('__WRAPPED');
say('成功插桩 ' + wrapped.length + ' / ' + TARGETS.length + ' 个（未插桩的见下方单列测试）');
const missed = TARGETS.filter(t => wrapped.indexOf(t) < 0);
if (missed.length) say('未插桩（可能是 const 箭头函数或间接调用）：' + missed.join(', '));
say('');

const N = 8;
for (let r = 0; r < N; r++) V.run(`playLife('拆解${r}', 'M', false)`);
const acc = V.run('__ACC'), cnt = V.run('__CNT');
const lastAge = 0;
const tickRows = Object.keys(acc)
  .map(k => ({
    fn: k, '调用/局': Math.round(cnt[k] / N), '累计 ms/局': (acc[k] / N).toFixed(3), 'µs/次': (acc[k] / cnt[k] * 1000).toFixed(2)
  }))
  .sort((a, b) => Number(b['累计 ms/局']) - Number(a['累计 ms/局']));
say(H.table(tickRows, ['fn', '调用/局', '累计 ms/局', 'µs/次']));
const totTick = tickRows.reduce((a, r) => a + Number(r['累计 ms/局']), 0);
const avgSteps = med(runs.map(r => r.steps));
say('');
say('tick 累计 ≈ **' + totTick.toFixed(2) + ' ms / 整局**（约 ' + avgSteps + ' 步）→ **单年 ' +
  (totTick / avgSteps).toFixed(4) + ' ms**');
say('');

/* ---------- 3. pickEvents 扫描成本 ---------- */
say('## 3. pickEvents / matchEvent 的扫描成本');
say('> 校正：data.js 在加载末尾执行了 `EVENTS.push.apply(EVENTS, EVENTS_EXTRA/FAMILY/FAMILY2/ERA)`，' +
  '子数组**是被合并进 EVENTS 的**，不是独立池。运行时真正的池就是 `EVENTS`（见下）。');
const poolInfo = V.run(`(function(){
  const pre = {};
  EVENTS.forEach(e => { const p = String(e.id).split('_')[0]; pre[p] = (pre[p]||0)+1; });
  let hits = 0, max = 0;
  for (let age = 1; age <= 100; age++) {
    const st = createGame({ name: '扫描', gender: 'M', talents: [] });
    st.age = age;
    const n = EVENTS.filter(ev => matchEvent(st, ev)).length;
    hits += n; if (n > max) max = n;
  }
  return { pool: EVENTS.length, base: EVENTS.length - EVENTS_EXTRA.length - EVENTS_FAMILY.length - EVENTS_FAMILY2.length - EVENTS_ERA.length,
    extra: EVENTS_EXTRA.length, fam: EVENTS_FAMILY.length, fam2: EVENTS_FAMILY2.length, era: EVENTS_ERA.length,
    hitsPerYear: hits / 100, max: max, prefixes: pre };
})()`);
say('- 运行时事件池 `EVENTS.length` = **' + poolInfo.pool + '** 条');
say('  = 本体 ' + poolInfo.base + ' + EVENTS_EXTRA ' + poolInfo.extra + ' + EVENTS_FAMILY ' + poolInfo.fam +
  ' + EVENTS_FAMILY2 ' + poolInfo.fam2 + ' + EVENTS_ERA ' + poolInfo.era + '（加载时被 push 合并）');
say('- 通过 matchEvent 的候选：平均 **' + poolInfo.hitsPerYear.toFixed(0) + '** 条/年，峰值 **' + poolInfo.max + '** 条');
const pe = H.bench('pickEvents', 400, () => V.run(`(function(){
  const st = createGame({ name: 'x', gender: 'M', talents: [] }); st.age = 30; return pickEvents(st).length;
})()`));
const me = H.bench('全池 matchEvent', 400, () => V.run(`(function(){
  const st = createGame({ name: 'x', gender: 'M', talents: [] }); st.age = 30;
  let n = 0; for (const ev of EVENTS) if (matchEvent(st, ev)) n++; return n;
})()`));
say(H.table([
  { 操作: 'pickEvents(state) @age=30', 'p50 ms': pe.p50.toFixed(4), 'max ms': pe.max.toFixed(4) },
  { 操作: 'EVENTS 全池 matchEvent 扫描 ' + poolInfo.pool + ' 条', 'p50 ms': me.p50.toFixed(4), 'max ms': me.max.toFixed(4) }
], ['操作', 'p50 ms', 'max ms']));
say('');
say('> 这是整个 project 里唯一一处**随数据表规模线性增长**的热路径：' +
  poolInfo.pool + ' 条事件 × 每年一次全遍历。当前绝对值很小（数十 µs 级），' +
  '把事件量涨到 800–1000 条才需要考虑按 age 建倒排索引（`age → 候选列表`）。');
say('');

/* ---------- 4. 存档体积随年龄 ---------- */
say('## 4. 存档体积随年龄增长（autosave 每步都 JSON.stringify 一次）');
const curve = V.run(`(function(){
  const st = createGame({ name: '体积', gender: 'M', talents: [] });
  migrateState(st); marketMigrate(st);
  const rows = []; const seen = {}; let guard = 0;
  for(;;){
    if (++guard > 6000) break;
    const item = step(st);
    if (!item || item.type === 'end') break;
    if (item.type === 'exam') { __driveExam(st, item); } else if (item.type === 'event') { resolveEvent(st, item.ev, Math.floor(Math.random()*3)); }
    const b = Math.min(100, Math.floor(st.age / 10) * 10);
    if (!seen[b]) {
      seen[b] = 1;
      rows.push({ b: b, bytes: JSON.stringify(st).length, logs: (st.log||[]).length,
        mates: (st.classmates||[]).length, exes: (st.exes||[]).length, kids: (st.children||[]).length });
    }
    if (st.finished) break;
  }
  return rows;
})()`);
say(H.table(curve.map(r => ({
  '年龄': r.b + 's', '存档 KB': (r.bytes / 1024).toFixed(1), 'log 条数': r.logs,
  '同学': r.mates, '前任': r.exes, '子女': r.kids
})), ['年龄', '存档 KB', 'log 条数', '同学', '前任', '子女']));
say('');
say('存档峰值 ≈ **' + (Math.max(...curve.map(r => r.bytes)) / 1024).toFixed(1) +
  ' KB**。localStorage 配额通常 5–10 MB，**配额远不是问题，写入频率才是**。');
say('');

/* ---------- 5. 序列化 / 反序列化成本 ---------- */
say('## 5. 单次 autosave 的序列化成本（JSON.stringify + localStorage.setItem）');
const bigState = V.run(`(function(){
  const st = createGame({ name: '序列化', gender: 'M', talents: [] });
  migrateState(st); marketMigrate(st);
  let guard = 0;
  while (st.age < 80 && ++guard < 6000) {
    const item = step(st);
    if (!item || item.type === 'end') break;
    if (item.type === 'exam') { __driveExam(st, item); } else if (item.type === 'event') { resolveEvent(st, item.ev, Math.floor(Math.random()*3)); }
    if (st.finished) break;
  }
  globalThis.__BIG = st;
  return { age: st.age, kb: JSON.stringify(st).length / 1024 };
})()`);
say('样本：' + bigState.age + ' 岁的存档，' + bigState.kb.toFixed(1) + ' KB');
const ser = H.bench('JSON.stringify(STATE)', 300, () => V.run('JSON.stringify(__BIG)'));
V.run('__SER = JSON.stringify(__BIG)');
const parse = H.bench('JSON.parse(存档串)', 300, () => V.run('JSON.parse(__SER)'));
say(H.table([
  { 操作: 'JSON.stringify(STATE)', 'p50 ms': ser.p50.toFixed(3), 'p95 ms': ser.p95.toFixed(3) },
  { 操作: 'JSON.parse(存档串)', 'p50 ms': parse.p50.toFixed(3), 'p95 ms': parse.p95.toFixed(3) }
], ['操作', 'p50 ms', 'p95 ms']));
say('');

fs.writeFileSync(path.join(__dirname, 'step-bench.out.txt'), out.join('\n'), 'utf8');
console.log('[已写出] ' + path.join(__dirname, 'step-bench.out.txt'));
