/* A-08 调查 · 第五步：确认 explorer@100 的 −4.1% 是真拐点还是噪声。
 * explorer 的 jobTarget 为空 → 职业全靠事件派发 → base 方差天然很大，
 * 中位数在 ~270 样本的分散分布上本来就会跳。加大样本复跑判定。 */
const path = require('path');
const fs = require('fs');
const vm = require('vm');

const QA = path.resolve(__dirname, '..', '..', 'qa', 'scripts');
const { loadEngine, exportApi, PERSONAS, median } = require(path.join(QA, 'reg-lib.js'));
const { makeSim } = require(path.join(QA, 'reg-sim.js'));

const lines = [];
const say = (s) => { lines.push(s); console.log(s); };

const { ctx } = loadEngine();
const A = exportApi(ctx);
const run = (src) => vm.runInContext(src, ctx);

let CAP = null;
const origIncome = A.careerIncome;
A.careerIncome = function (st) {
  if (st && st.age === 30 && CAP) {
    CAP.income = origIncome(st);
    CAP.parts = run('(function(s){ return careerIncomeParts(s); })')(st);
    CAP.job = st.job;
    CAP.career = st.career ? { id: st.career.id, level: st.career.level } : null;
  }
  return origIncome(st);
};
const sim = makeSim(A, ctx, PERSONAS);

/* 每格 1200 局，独立跑 3 轮，看三批之间是否稳定 */
const N = 400, ROUNDS = 3;
const CAPS = [0, 40, 60, 100];
const out = {};
CAPS.forEach(c => { out[c] = { totals: [], bases: [] }; });

for (let r = 0; r < ROUNDS; r++) {
  CAPS.forEach(cap => {
    const arr = [];
    for (let i = 0; i < N; i++) {
      CAP = {};
      let res = null;
      try { res = sim.playOne('explorer', PERSONAS.explorer, { cramCap: cap }); } catch (e) { CAP = null; continue; }
      if (!res || CAP.income == null) { CAP = null; continue; }
      arr.push(CAP); CAP = null;
    }
    out[cap].totals.push(median(arr.map(c => c.income)));
    out[cap].bases.push(median(arr.map(c => c.parts.base)));
  });
}

say('# A-08 调查 · 第五步：`explorer@100` 的 −4.1% 是真拐点还是噪声');
say('');
say('生成时间：' + new Date().toISOString());
say('每格 ' + N + ' 局 × ' + ROUNDS + ' 轮独立复跑（共 ' + (N * ROUNDS * CAPS.length) + ' 局）。');
say('');
say('| cramCap | 第1轮 total(亿) | 第2轮 | 第3轮 | 三轮区间 | base 第1轮 | 第2轮 | 第3轮 |');
say('|---:|---:|---:|---:|---|---:|---:|---:|');
CAPS.forEach(cap => {
  const t = out[cap].totals, b = out[cap].bases;
  say('| ' + cap + ' | ' + t.map(x => (x / 1e8).toFixed(2)).join(' | ') + ' | ' +
    ((Math.max.apply(null, t) - Math.min.apply(null, t)) / Math.min.apply(null, t) * 100).toFixed(1) + '% | ' +
    b.map(x => (x / 1e8).toFixed(2)).join(' | ') + ' |');
});
say('');
say('**判定**：若三轮之间的摆动幅度与「不同 cap 之间的差异」同量级，'
  + '则那个 −4.1% 是噪声，不存在「投过头反而亏」的拐点。');
say('');

/* 顺便给出 steady 的复跑，确认 +44% 稳定 */
say('## 附：`steady` 的同法复跑（确认 +44% 稳定）');
say('');
const sout = {};
[0, 40].forEach(c => { sout[c] = []; });
for (let r = 0; r < ROUNDS; r++) {
  [0, 40].forEach(cap => {
    const arr = [];
    for (let i = 0; i < N; i++) {
      CAP = {};
      let res = null;
      try { res = sim.playOne('steady', PERSONAS.steady, { cramCap: cap }); } catch (e) { CAP = null; continue; }
      if (!res || CAP.income == null) { CAP = null; continue; }
      arr.push(CAP); CAP = null;
    }
    sout[cap].push(median(arr.map(c => c.income)));
  });
}
say('| cramCap | 第1轮 | 第2轮 | 第3轮 | 相对 cap=0 |');
say('|---:|---:|---:|---:|---:|');
const b0 = sout[0].reduce((a, b) => a + b, 0) / ROUNDS;
[0, 40].forEach(cap => {
  const t = sout[cap];
  const m = t.reduce((a, b) => a + b, 0) / ROUNDS;
  say('| ' + cap + ' | ' + t.map(x => (x / 1e8).toFixed(2)).join(' | ') + ' | ' +
    (cap === 0 ? '—' : ((m / b0 - 1) * 100 >= 0 ? '+' : '') + ((m / b0 - 1) * 100).toFixed(1) + '%') + ' |');
});
say('');

fs.writeFileSync(path.join(__dirname, 'a08-tail-check.out.txt'), lines.join('\n') + '\n', 'utf8');
say('[已写出] a08-tail-check.out.txt');
