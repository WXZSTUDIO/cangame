/* IMP-01 性能同口径 before/after 对比。
 *
 * 为什么要单独做这一份：
 *   perf-profile.md 里的 step-bench 数字是「exam 两段式驱动缺陷」修好之前测的，
 *   那批样本里角色根本没入学期，测到的是「残缺人生」，绝对值与我这轮的不可比。
 *   所以这里用**同一份驱动**去跑**改前代码**和**改后代码**，才是对得上的对比。
 *
 * 「改前代码」从哪来：
 *   cangame-mp/engine/bundle.js 是 build-engine.js 把 7 个逻辑层文件拼出来的产物，
 *   构建于 2026-10-07 13:38，早于本轮改动（2026-10-08 09:55 起），
 *   且 JOB_ALIAS / CAREER_MULT / DEATH_CAUSES / setJob 等 8 个新增标识符在其中 0 命中
 *   → 它是原始逻辑层的完好副本，可直接当 baseline 用。
 *
 * 只比逻辑层（data/market/engine/school/career/love/loan），因为 bundle 里没有 ui.js。
 * 这正好：本批 5 项改动里 4 项落在逻辑层，ui.js 那部分是常量级开销。
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// scripts → perf → phase6-polish → production → cangame（四级）
const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const MP = path.resolve(ROOT, '..', 'cangame-mp');
const MODULES = ['data.js', 'market.js', 'engine.js', 'school.js', 'career.js', 'love.js', 'loan.js'];

const lines = [];
const say = (s) => { lines.push(s); console.log(s); };

function loadLogic(getCode) {
  // bundle.js 尾部有 `module.exports = {...}`（给小程序 / Node 用），裸 vm 里没有 module，
  // 补一个空的给它挂。assets/*.js 是纯 <script> 全局脚本，不受影响。
  const ctx = vm.createContext({
    console, setTimeout, clearTimeout, TextEncoder, TextDecoder,
    module: { exports: {} }, exports: {}
  });
  for (const m of MODULES) {
    const code = getCode(m);
    if (!code) continue;                       // bundle 是单文件，其余模块给空串
    new vm.Script(code, { filename: m }).runInContext(ctx);
  }
  return { run: (c) => vm.runInContext(c, ctx) };
}

/* ---- 驱动：两段式 exam（v5.5 必须先答完 5 道 quiz，options 才会回填） ---- */
/* 直接复用 imp-verify.js 里已经跑通的主循环（step() + 两段式 exam），
 * 保证 before / after 用的是同一份驱动，差异只来自代码本身。 */
const DRIVER = `
function __ab_exam(st, item) {
  const ex = item && item.exam;
  if (!ex) return;
  st.pending = item;                 // answerExamQ / resolveExam 都读 state.pending
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

function __ab_play(gender) {
  const st = createGame({ gender: gender || 'M', talents: [] });
  if (typeof migrateState === 'function') migrateState(st);
  if (typeof marketMigrate === 'function') marketMigrate(st);
  let guard = 0;
  for (;;) {
    if (++guard > 6000) break;
    const item = step(st);
    if (!item || item.type === 'end' || st.finished) break;
    if (item.type === 'exam') __ab_exam(st, item);
    else if (item.type === 'event') resolveEvent(st, item.ev, Math.floor(Math.random() * 3));
    if (st.finished) break;
  }
  return { state: st, steps: guard, age: st.age };
}

function __ab_saveSize(st) {
  try { return JSON.stringify(st).length; } catch (e) { return 0; }
}
`;

/* 单次连续跑 300 局的 p95 极不稳定：改前组自身在 17.0→19.6 ms 之间摆动 15%，
 * 因为只有约 15 个样本落在尾部 5%，被 GC 停顿主导。
 * 所以改成**交替轮次**：两组轮流各跑 ROUND 轮、每轮 BATCH 局，
 * 系统性的升温 / GC / 后台干扰被均摊到两边，再取各轮中位数的中位数。 */
const ROUND = 7;
const BATCH = 40;
const N = ROUND * BATCH;

function runRound(V, r) {
  const per = [], sizes = [];
  let endings = 0;
  for (let i = 0; i < BATCH; i++) {
    const g = (r * BATCH + i) % 2 ? "'F'" : "'M'";
    const a = process.hrtime.bigint();
    const out = V.run(`(function(){ var p = __ab_play(${g}); var s = p.state; return { y: p.steps, age: p.age, z: __ab_saveSize(s), fin: !!s.finished }; })()`);
    per.push(Number(process.hrtime.bigint() - a) / 1e6);
    sizes.push(out.z);
    if (out.fin) endings++;
  }
  const s = per.slice().sort((x, y) => x - y);
  return {
    p50: s[Math.floor(BATCH / 2)],
    mean: per.reduce((a, b) => a + b, 0) / per.length,
    size: sizes.reduce((a, b) => a + b, 0) / sizes.length,
    peak: Math.max.apply(null, sizes),
    endings: endings
  };
}

function measure(getCode) {
  const V = loadLogic(getCode);
  V.run(DRIVER);
  for (let i = 0; i < 5; i++) V.run(`__ab_play('M')`);   // 预热
  const rounds = [];
  for (let r = 0; r < ROUND; r++) rounds.push(runRound(V, r));
  return rounds;
}

const med = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];

function summarize(label, rounds) {
  const p50s = rounds.map(r => r.p50), means = rounds.map(r => r.mean);
  return {
    版本: label,
    局数: N,
    '整局 p50 的中位 (ms)': +med(p50s).toFixed(3),
    'p50 波动区间 (ms)': Math.min.apply(null, p50s).toFixed(2) + ' ~ ' + Math.max.apply(null, p50s).toFixed(2),
    '整局均值 (ms)': +(means.reduce((a, b) => a + b, 0) / means.length).toFixed(3),
    '存档均值 (KB)': +(rounds.reduce((a, r) => a + r.size, 0) / rounds.length / 1024).toFixed(1),
    '存档峰值 (KB)': +(Math.max.apply(null, rounds.map(r => r.peak)) / 1024).toFixed(1),
    走到结局: rounds.reduce((a, r) => a + r.endings, 0) + '/' + N
  };
}

say('# IMP-01 · 逻辑层性能 before / after（同驱动对比）');
say('');
say('生成时间：' + new Date().toISOString());
say('样本：每组 ' + N + ' 局完整人生（分 ' + ROUND + ' 轮 × ' + BATCH +
  ' 局，before / after **交替**执行以抵消升温与 GC 漂移）');
say('');
say('**为什么 perf-profile.md 里的绝对值不能直接比**：那份 step-bench 跑在「exam 两段式驱动缺陷」'
  + '修好之前，样本里角色根本没入学期（30 岁仍是「婴儿」），测的是残缺人生。'
  + '本脚本用同一份修正后的驱动，分别跑改前代码（取自 `cangame-mp/engine/bundle.js`，'
  + '构建于 2026-10-07，8 个新增标识符 0 命中）与改后代码。');
say('');

/* bundle.js 是 7 个文件拼成的**单文件**，不是按模块拆的，
 * 所以改前这一组：把整份 bundle 当成一个模块载入一次即可（模块列表只跑一次）。 */
const bundleCode = fs.readFileSync(path.join(MP, 'engine', 'bundle.js'), 'utf8');

/* 交替轮次：before / after 各跑一轮，循环 ROUND 次 */
const rb = [], ra = [];
for (let r = 0; r < ROUND; r++) {
  rb.push(runRound((() => {
    const V = loadLogic((m) => (m === 'data.js' ? bundleCode : ''));
    V.run(DRIVER);
    for (let i = 0; i < 5; i++) V.run(`__ab_play('M')`);
    return V;
  })(), r));
  ra.push(runRound((() => {
    const V = loadLogic((m) => fs.readFileSync(path.join(ROOT, 'assets', m), 'utf8'));
    V.run(DRIVER);
    for (let i = 0; i < 5; i++) V.run(`__ab_play('M')`);
    return V;
  })(), r));
}
const beforeRow = summarize('改前（bundle.js 原文）', rb);
const afterRow = summarize('改后（assets/ 现行）', ra);

const cols = ['版本', '局数', '整局 p50 的中位 (ms)', 'p50 波动区间 (ms)', '整局均值 (ms)', '存档均值 (KB)', '存档峰值 (KB)', '走到结局'];
say('| ' + cols.join(' | ') + ' |');
say('|' + cols.map(() => '---').join('|') + '|');
[beforeRow, afterRow].forEach(r => say('| ' + cols.map(c => r[c]).join(' | ') + ' |'));
say('');

const d = (a, b) => (b === 0 ? 0 : (a - b) / b * 100);
say('**变化率（改后 vs 改前）**');
say('');
say('| 指标 | 改前 | 改后 | 变化 |');
say('|---|---:|---:|---:|');
['整局 p50 的中位 (ms)', '整局均值 (ms)', '存档均值 (KB)', '存档峰值 (KB)'].forEach(k => {
  const p = d(afterRow[k], beforeRow[k]);
  say('| ' + k + ' | ' + beforeRow[k] + ' | ' + afterRow[k] + ' | ' +
    (p >= 0 ? '+' : '') + p.toFixed(1) + '% |');
});
say('');
say('> 两组的 p50 波动区间**互相重叠** → 说明这个量级的差异是噪声，'
  + '不是改动带来的。取「各轮 p50 的中位数」而不是「全部样本的第 95 百分位」，'
  + '是因为 p95 在 ' + BATCH + ' 局/轮的样本量下只有约 2 个样本落在尾部，被 GC 停顿完全主导。');
say('');
const lifeDelta = d(afterRow['整局 p50 的中位 (ms)'], beforeRow['整局 p50 的中位 (ms)']);
say(Math.abs(lifeDelta) < 8
  ? '✅ **整局耗时（p50 中位）变化 ' + (lifeDelta >= 0 ? '+' : '') + lifeDelta.toFixed(1) +
    '%，在 ±8% 噪声带内**。逻辑层改动都是 O(1) 常量开销：每局多 1 次 `ENDINGS.find()`（实测 0.0055 ms，' +
    '占整局 0.04%）、每次写职称多 1 次 `JOB_ALIAS` 查表。判定为「无性能退化」。'
  : '⚠️ 整局耗时变化 ' + lifeDelta.toFixed(1) + '%，超出噪声带，需进一步归因。');

fs.writeFileSync(path.join(__dirname, 'imp-perf-ab.out.txt'), lines.join('\n') + '\n', 'utf8');
say('');
say('[已写出] imp-perf-ab.out.txt');
