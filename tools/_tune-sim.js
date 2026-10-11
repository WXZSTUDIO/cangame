/* cangame v2 · 平衡扫参器（tools/_tune-sim.js）
 * 用途：不改 config.js，直接在沙箱里覆盖 CONFIG 字段跑批量对局，快速比较候选方案。
 *
 * 用法：
 *   node tools/_tune-sim.js [N=200] [seedBase=1] '<JSON overrides>'
 * 例：
 *   node tools/_tune-sim.js 200 1 '{"PRODUCTION":{"blue":{"lifeMin":5,"lifeMax":7}}}'
 *   node tools/_tune-sim.js 200 1 '{"MAX_DAY":8,"INITIAL":{"white":{"won":32}}}'
 *
 * overrides 为深合并（对象递归合并），数组/标量直接替换。
 * 输出与 sim-balance.js 同格式表格，并给出 dominance 判定。
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const N = parseInt(process.argv[2], 10) || 200;
const SEED_BASE = parseInt(process.argv[3], 10) || 1;
let OVERRIDES = {};
if (process.argv[4]) {
  try { OVERRIDES = JSON.parse(process.argv[4]); }
  catch (e) { console.error('overrides JSON 解析失败：', e.message); process.exit(1); }
}

const ctx = {
  console, Math, JSON, Date, isNaN, parseInt, parseFloat, Number, String, Array, Object,
  window: { addEventListener() {} },
  document: { readyState: 'loading', addEventListener() {}, getElementById() { return null; },
    querySelectorAll() { return []; }, querySelector() { return null; },
    createElement() { return { style: {}, classList: { add() {}, remove() {} }, appendChild() {}, setAttribute() {}, addEventListener() {} }; },
    body: null, documentElement: null },
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  alert: function () {}
};
vm.createContext(ctx);

['assets/config.js', 'assets/rng.js', 'assets/state.js', 'assets/factions.js', 'assets/resource.js',
 'assets/ai.js', 'assets/leader.js', 'assets/production.js', 'assets/economy.js', 'assets/war.js',
 'assets/settle.js', 'assets/engine.js', 'assets/ui.js']
  .forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));

// —— 深合并覆盖 ——
function deepMerge(dst, src) {
  Object.keys(src || {}).forEach(k => {
    const v = src[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && dst[k] && typeof dst[k] === 'object' && !Array.isArray(dst[k])) deepMerge(dst[k], v);
    else dst[k] = v;
  });
  return dst;
}
const CFG = vm.runInContext('CONFIG', ctx);
deepMerge(CFG, OVERRIDES);

const M = vm.runInContext('({createGameState, advancePhase, endDay, CONFIG, PHASES})', ctx);
const FIDS = ['white', 'blue', 'red', 'black'];

const stat = {};
FIDS.forEach(id => { stat[id] = { wins: 0, survSum: 0, survN: 0, ppSum: 0, ppN: 0, fnElim: 0 }; });
let endedCount = 0, endDaySum = 0, whiteExtinct = 0;

function runOne(seed) {
  const s = M.createGameState(seed >>> 0);
  s.humanFactionId = null;
  const initPop = {}; FIDS.forEach(id => { initPop[id] = s.factions.find(f => f.id === id).popAlive; });
  let guard = 0;
  const survivalDay = {}; FIDS.forEach(id => { survivalDay[id] = null; });
  while (s.status === 'PLAYING' && guard < 1000) {
    const dayBefore = s.day;
    for (let i = 0; i < 4 && s.status === 'PLAYING'; i++) M.advancePhase(s);
    if (s.status !== 'PLAYING') break;
    M.endDay(s); guard++;
    const cd = dayBefore;
    if (cd === 1) FIDS.forEach(id => {
      const f = s.factions.find(x => x.id === id);
      if (f.popAlive < initPop[id]) stat[id].fnElim++;
    });
    FIDS.forEach(id => {
      const f = s.factions.find(x => x.id === id);
      if (!f.alive && survivalDay[id] == null) survivalDay[id] = cd;
    });
  }
  if (s.status !== 'ENDED') return;
  endedCount++;
  const r = s.result; endDaySum += (r.endedDay || s.day);
  FIDS.forEach(id => {
    const f = s.factions.find(x => x.id === id); const st = stat[id];
    if (r.winner === id) st.wins++;
    const sd = (survivalDay[id] != null) ? survivalDay[id] : (r.endedDay || s.day);
    st.survSum += sd; st.survN++;
    if (f.alive && f.popAlive > 0) { st.ppSum += (r.perPerson[id] || 0); st.ppN++; }
    if (id === 'white' && !f.alive) whiteExtinct++;
  });
}
for (let i = 0; i < N; i++) runOne(SEED_BASE + i * 2654435761);

const pct = (x, n) => n > 0 ? (100 * x / n).toFixed(1) + '%' : '—';
const avg = (x, n) => n > 0 ? (x / n).toFixed(1) : '—';
console.log('\n===== 扫参 N=' + N + '  overrides=' + JSON.stringify(OVERRIDES) + ' =====');
console.log('平均终局日=' + avg(endDaySum, endedCount) + '  白队灭绝=' + whiteExtinct + '/' + endedCount);
FIDS.forEach(id => {
  const st = stat[id];
  console.log('  ' + id.padEnd(6) + '胜率' + pct(st.wins, endedCount).padStart(7) +
    '  存活' + avg(st.survSum, st.survN).padStart(6) +
    '  人均' + avg(st.ppSum, st.ppN).padStart(8) +
    '  首夜淘汰' + pct(st.fnElim, endedCount).padStart(7));
});
const wr = FIDS.map(id => stat[id].wins / endedCount);
const maxWR = Math.max.apply(null, wr);
console.log('  → 最高=' + FIDS[wr.indexOf(maxWR)] + ' ' + (100 * maxWR).toFixed(1) + '%' + (maxWR > 0.40 ? ' ⚠' : ' ✓') +
  ' | 白队 ' + (100 * wr[0]).toFixed(1) + '%' + (wr[0] < 0.10 ? ' ⚠过低' : ' ✓'));
