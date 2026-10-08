/* 14 门全表审计 · 附探针：结局分布 & 各门观测量是否结构性归零（只读） */
const { loadEngine, exportApi, PERSONAS, median, mean } = require('./reg-lib.js');
const { makeSim } = require('./reg-sim.js');
const { ctx } = loadEngine();
const A = exportApi(ctx);
const sim = makeSim(A, ctx, PERSONAS);

const N = parseInt(process.argv[2] || '120', 10);

function tally(pn, n) {
  const byId = {}, bySrc = {};
  for (let i = 0; i < n; i++) {
    let r = null;
    try { r = sim.playOne(pn, PERSONAS[pn], {}); } catch (e) { continue; }
    if (!r) continue;
    byId[r.endId] = (byId[r.endId] || 0) + 1;
    bySrc[r.endSource] = (bySrc[r.endSource] || 0) + 1;
  }
  return { byId, bySrc, n };
}

console.log('============ 结局分布探针（各 ' + N + ' 局）============');
['aggressive', 'reckless', 'steady', 'explorer', 'baseline', 'slacker'].forEach(pn => {
  const t = tally(pn, N);
  console.log('\n[' + pn + ']  endSource: ' + JSON.stringify(t.bySrc));
  const ids = Object.keys(t.byId).sort((a, b) => t.byId[b] - t.byId[a]);
  console.log('  endId 分布: ' + ids.map(k => k + '×' + t.byId[k]).join('  '));
  console.log('  end_dead 占比 = ' + (((t.byId['end_dead'] || 0) / t.n)).toFixed(3));
});

console.log('\n============ ENDINGS 表（data.js）============');
const E = A.ENDINGS || [];
console.log('条数 = ' + E.length + '  ids: ' + E.map(e => e.id).join(', '));
const dead = E.find(e => e.id === 'end_dead');
console.log('\nend_dead 定义 = ' + JSON.stringify(dead && { id: dead.id, name: dead.name, cond: dead.cond || dead.when || '(见源码)' }));
