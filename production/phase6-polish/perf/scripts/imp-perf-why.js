/* IMP-01 性能归因：解释 before/after 的 p95 差异到底来自哪一项改动。
 *
 * 待验证假设：
 *   A-06 让更多角色真正进入职业阶梯 → `state.career !== null` 的年数变多
 *   → `careerTick()` / `careerIncome()` 从「每年早退」变成「每年实算」
 *   → 整局耗时上升。这不是性能退化，是修复生效后「算的东西变多了」。
 *
 * 对照组设计（全部跑在**改后代码**上，只开关变量）：
 *   ① 现状（A-06 开 + S-04 开）
 *   ② 关掉 A-06：把 JOB_ALIAS 清空，setJob 退化为直接赋值（等同改前行为）
 *   ③ 单独量 ENDINGS.find() 的单价（S-04 每局新增一次）
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const MODULES = ['data.js', 'market.js', 'engine.js', 'school.js', 'career.js', 'love.js', 'loan.js'];

const lines = [];
const say = (s) => { lines.push(s); console.log(s); };

function loadLogic() {
  const ctx = vm.createContext({
    console, setTimeout, clearTimeout, TextEncoder, TextDecoder,
    module: { exports: {} }, exports: {}
  });
  for (const m of MODULES) {
    new vm.Script(fs.readFileSync(path.join(ROOT, 'assets', m), 'utf8'), { filename: m }).runInContext(ctx);
  }
  // 统计「有职业的年数」：包一层 careerTick，只在真的有 career 时计数
  vm.runInContext(`
    var __careerYears = 0, __totalYears = 0;
    var __origTick = careerTick;
    careerTick = function (st) {
      __totalYears++;
      if (st && st.career) __careerYears++;
      return __origTick(st);
    };
    function __stat(){ return { c: __careerYears, t: __totalYears }; }
    function __reset(){ __careerYears = 0; __totalYears = 0; }
  `, ctx);
  return {
    run: (c) => vm.runInContext(c, ctx),
    reset: () => vm.runInContext('__reset()', ctx),
    stat: () => vm.runInContext('__stat()', ctx)
  };
}

const DRIVER = `
function __w_exam(st, item) {
  const ex = item && item.exam;
  if (!ex) return;
  st.pending = item;
  let g = 0;
  while (ex.quiz && !ex.quiz.done) {
    if (++g > 20) break;
    const q = ex.quiz.qs[ex.quiz.i];
    const n = q && q.opts ? q.opts.length : 0;
    answerExamQ(st, n ? Math.floor(Math.random() * n) : 0);
  }
  const opts = ex.options || [];
  const usable = opts.filter(o => !o.locked);
  if (usable.length) resolveExam(st, opts.indexOf(usable[Math.floor(Math.random() * usable.length)]));
  st.pending = null;
}
function __w_play(gender) {
  const st = createGame({ gender: gender, talents: [] });
  if (typeof migrateState === 'function') migrateState(st);
  if (typeof marketMigrate === 'function') marketMigrate(st);
  let guard = 0;
  for (;;) {
    if (++guard > 6000) break;
    const item = step(st);
    if (!item || item.type === 'end' || st.finished) break;
    if (item.type === 'exam') __w_exam(st, item);
    else if (item.type === 'event') resolveEvent(st, item.ev, Math.floor(Math.random() * 3));
    if (st.finished) break;
  }
  return { state: st, steps: guard };
}
`;

const V = loadLogic();
V.run(DRIVER);

/* ---------- ① 现状 ---------- */
function runBatch(label, patch, N) {
  if (patch) V.run(patch);
  for (let i = 0; i < 5; i++) V.run(`__w_play('M')`);
  V.reset();
  const per = [];
  for (let r = 0; r < N; r++) {
    const a = process.hrtime.bigint();
    V.run(`__w_play(${r % 2 ? "'F'" : "'M'"})`);
    per.push(Number(process.hrtime.bigint() - a) / 1e6);
  }
  const st = V.stat();
  const s = per.slice().sort((x, y) => x - y);
  return {
    组别: label,
    局数: N,
    'p50 (ms)': +s[Math.floor(N / 2)].toFixed(3),
    'p95 (ms)': +s[Math.floor(N * 0.95)].toFixed(3),
    '有职业年数占比': (st.t ? (st.c / st.t * 100).toFixed(1) : '0') + '%',
    'careerTick 总调用': st.t,
    '其中真有职业': st.c
  };
}

const N = 300;
say('# IMP-01 · 性能归因（p95 +36% 是哪一项改动带来的）');
say('');
say('生成时间：' + new Date().toISOString());
say('样本：每组 ' + N + ' 局，全部跑在**改后代码**上，只开关变量。');
say('');

const rows = [];
rows.push(runBatch('① 现状（A-06 开 · S-04 开）', null, N));
rows.push(runBatch('② 关掉 A-06（清空 JOB_ALIAS，setJob 退化为直接赋值）', `
  Object.keys(JOB_ALIAS).forEach(function (k) { delete JOB_ALIAS[k]; });
`, N));

const cols = ['组别', '局数', 'p50 (ms)', 'p95 (ms)', 'careerTick 总调用', '其中真有职业', '有职业年数占比'];
say('| ' + cols.join(' | ') + ' |');
say('|' + cols.map(() => '---').join('|') + '|');
rows.forEach(r => say('| ' + cols.map(c => r[c]).join(' | ') + ' |'));
say('');

/* ---------- ③ ENDINGS.find() 单价 ---------- */
say('## S-04 新增开销的单价');
say('');
const unit = V.run(`(function(){
  var st = createGame({ gender: 'M', talents: [] });
  if (typeof migrateState === 'function') migrateState(st);
  st.age = 70;
  var t0, t1, n = 2000, i;
  ENDINGS.find(function (x) { return x.cond(st); });          // 预热
  t0 = Date.now();
  for (i = 0; i < n; i++) ENDINGS.find(function (x) { return x.cond(st); });
  t1 = Date.now();
  return { perCallMs: (t1 - t0) / n, n: n };
})()`);
say('- `ENDINGS.find()` 单次调用 **' + unit.perCallMs.toFixed(4) + ' ms**（' + unit.n + ' 次平均）');
say('- S-04 每局新增 1 次（死亡时判定一次）→ 每局摊 **' + unit.perCallMs.toFixed(4) + ' ms**');
say('- 对照整局 p50 约 ' + rows[0]['p50 (ms)'] + ' ms → 占比 **' +
  (unit.perCallMs / rows[0]['p50 (ms)'] * 100).toFixed(2) + '%**');
say('');

const dP95 = (rows[0]['p95 (ms)'] - rows[1]['p95 (ms)']) / rows[1]['p95 (ms)'] * 100;
const dCareer = rows[0]['有职业年数占比'];
const dCareer2 = rows[1]['有职业年数占比'];
say('## 结论');
say('');
say('- 关掉 A-06 后，p95 从 **' + rows[0]['p95 (ms)'] + ' ms** 回到 **' + rows[1]['p95 (ms)'] +
  ' ms**（差 ' + (dP95 >= 0 ? '+' : '') + dP95.toFixed(1) + '%）');
say('- 同期「有职业的年数占比」从 **' + dCareer + '** 降到 **' + dCareer2 + '**');
say('');
say(dP95 > 25
  ? '→ **p95 的差异主要由 A-06 贡献**：修复后更多角色真正进入职业阶梯，'
    + '`careerTick()` 与 `careerIncome()` 从「每年早退」变成「每年实算」，'
    + '算的量变多了，而不是单次变慢了。这是修复生效的预期代价，不是性能退化。'
    + '若后续要压回，正确的做法不是回滚 A-06，而是照 O-01 / O-02 / O-03 去优化渲染与存档路径。'
  : '→ p95 差异不能由 A-06 单独解释，需要进一步拆分。');

fs.writeFileSync(path.join(__dirname, 'imp-perf-why.out.txt'), lines.join('\n') + '\n', 'utf8');
say('');
say('[已写出] imp-perf-why.out.txt');
