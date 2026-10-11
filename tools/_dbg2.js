const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const ctx = { console, Math, JSON, Date, isNaN, parseInt, parseFloat, Number, String, Array, Object,
  window: { addEventListener() {} }, document: { readyState: 'loading', addEventListener() {}, getElementById() { return null; },
    querySelectorAll() { return []; }, querySelector() { return null; },
    createElement() { return { style: {}, classList: { add() {}, remove() {} }, appendChild() {}, setAttribute() {}, addEventListener() {} }; }, body: null, documentElement: null },
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} }, alert: function () {} };
vm.createContext(ctx);
['assets/config.js','assets/rng.js','assets/state.js','assets/factions.js','assets/resource.js',
 'assets/ai.js','assets/leader.js','assets/production.js','assets/economy.js','assets/war.js',
 'assets/settle.js','assets/engine.js','assets/ui.js']
  .forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));
const M = vm.runInContext('({createGameState, advancePhase, endDay, CONFIG})', ctx);
const ov = JSON.parse(process.argv[3]||'{}');
function apply(o,a){Object.keys(a).forEach(k=>{if(o[k]&&typeof o[k]==='object'&&!Array.isArray(o[k])&&a[k]&&typeof a[k]==='object'&&!Array.isArray(a[k]))apply(o[k],a[k]);else o[k]=a[k];});}
apply(M.CONFIG, ov);
const seed = parseInt(process.argv[2]||'1',10);
const s = M.createGameState(seed>>>0); s.humanFactionId=null;
function line(tag){ const w=s.factions.find(f=>f.id==='white'); console.log('day'+s.day+' '+tag+' W pop='+w.popAlive+' life='+w.life+' goods='+w.goods+' won='+w.won); }
line('start');
let guard=0;
while(s.status==='PLAYING'&&guard<30){
  const db=s.day;
  for(let k=0;k<4&&s.status==='PLAYING';k++)M.advancePhase(s);
  if(s.status!=='PLAYING')break;
  line('preEndDay');
  M.endDay(s); guard++;
  line('postSettle');
}
console.log('WINNER=', s.result && s.result.winner, 'endedDay=', s.result && s.result.endedDay);
// 统计 white 挂单/成交
const trades = s.market.trades.filter(t=>t.buyerId==='white'||t.sellerId==='white');
console.log('white trades:', trades.length, JSON.stringify(trades.slice(0,8).map(t=>({gt:t.goodsType,q:t.qty,p:t.price,by:t.buyerId}))));
