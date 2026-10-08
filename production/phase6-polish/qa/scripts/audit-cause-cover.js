/* F-01 同类风险排查：`endCause` 字段的覆盖率探针
 * 目的：给 REG-01 加一条「哨兵断言」—— 若哪天 ending.cause 不再被填充（重命名 / 移除 / 改结构），
 *       「熄灭占比」会再次静默归零、门再次假绿。覆盖率断言能在当天就红。 */
const { loadEngine, exportApi, PERSONAS } = require('./reg-lib.js');
const { makeSim } = require('./reg-sim.js');
const { ctx } = loadEngine();
const A = exportApi(ctx);
const sim = makeSim(A, ctx, PERSONAS);

const N = parseInt(process.argv[2] || '120', 10);
console.log('===== endCause 覆盖率探针（每画像 ' + N + ' 局）=====');
['aggressive', 'reckless', 'steady', 'explorer', 'baseline', 'slacker'].forEach(pn => {
  let n = 0, hasCause = 0;
  const causes = {};
  for (let i = 0; i < N; i++) {
    let r = null;
    try { r = sim.playOne(pn, PERSONAS[pn], {}); } catch (e) { continue; }
    if (!r) continue;
    n++;
    if (r.endCause) { hasCause++; causes[r.endCause] = (causes[r.endCause] || 0) + 1; }
  }
  console.log(pn.padEnd(11) + '覆盖率 ' + (hasCause / n).toFixed(3) +
    '   死因分布: ' + Object.keys(causes).map(k => k + '×' + causes[k]).join('  '));
});
