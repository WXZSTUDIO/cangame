/* 统计各属性在人生终点的分布，用于 v6.4 数值重平衡（上限统一 100） */
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..');
const ctx = {
  console, Math, JSON, Date,
  window: { addEventListener() { }, __eval: null },
  document: { addEventListener() { }, getElementById() { return null }, querySelectorAll() { return [] } },
  localStorage: { getItem() { return null }, setItem() { }, removeItem() { } }
};
vm.createContext(ctx);
['data', 'market', 'engine', 'school', 'career', 'love', 'pet', 'legacy', 'loan', 'ui']
  .forEach(m => vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets', m + '.js'), 'utf8'), ctx, { filename: m }));

const KEYS = ['INT', 'STR', 'CHA', 'WILL', 'HP', 'STRESS', 'NET', 'FAME', 'LOY', 'ETH', 'MOOD', 'SEC', 'GROW', 'CUR', 'LOVE'];
const acc = {}; KEYS.forEach(k => acc[k] = []);
let deaths = 0, ages = [];
const FAM = ['nongcun', 'gongren', 'zhishi', 'fuyu', 'haomen', 'welfare'];
for (let i = 0; i < 300; i++) {
  const s = ctx.createGame({
    name: 'T' + i, gender: i % 2 ? 'M' : 'F', familyId: FAM[i % FAM.length],
    startYear: 1955 + (i % 50), priority: ['balance', 'study', 'money', 'health'][i % 4], talents: []
  });
  let guard = 0;
  while (!s.over && !s.finished && guard++ < 400) {
    let it;
    try { it = ctx.step(s); } catch (e) { break; }
    if (!it || it.type === 'end') break;
    if (it.type === 'event' && it.ev) {
      try { ctx.resolveEvent(s, it.ev, 0); } catch (e) { break; }
    } else if (it.type === 'invest') {
      try { ctx.resolveInvest && ctx.resolveInvest(s, it, 0); } catch (e) { }
    } else if (it.type === 'exam' || it.type === 'qa') {
      try { ctx.resolveEvent(s, it.ev || it, 0); } catch (e) { }
    }
  }
  ages.push(s.age);
  if (s.ending) deaths++;
  KEYS.forEach(k => acc[k].push(s.stats[k] || 0));
}
function pct(a, p) { a = a.slice().sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(a.length * p))]; }
console.log('局数 300  平均寿命', (ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(1));
console.log('key      min  p25  p50  p75  p90  p99  max   mean');
for (const k of KEYS) {
  const a = acc[k];
  const mean = a.reduce((x, y) => x + y, 0) / a.length;
  console.log(
    k.padEnd(7),
    String(Math.round(pct(a, 0))).padStart(5),
    String(Math.round(pct(a, .25))).padStart(4),
    String(Math.round(pct(a, .5))).padStart(4),
    String(Math.round(pct(a, .75))).padStart(4),
    String(Math.round(pct(a, .9))).padStart(4),
    String(Math.round(pct(a, .99))).padStart(4),
    String(Math.round(pct(a, 1))).padStart(5),
    mean.toFixed(1).padStart(7));
}
