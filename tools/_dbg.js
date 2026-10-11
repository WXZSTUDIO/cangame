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
const FIDS = ['white','blue','red','black'];

function apply(obj, ov){ Object.keys(ov).forEach(k=>{ if(obj[k]&&typeof obj[k]==='object'&&!Array.isArray(obj[k])&&ov[k]&&typeof ov[k]==='object'&&!Array.isArray(ov[k])) apply(obj[k],ov[k]); else obj[k]=ov[k]; }); }

const overrides = JSON.parse(process.argv[3] || '{}');
apply(M.CONFIG, overrides);
console.log('CONFIG override:', JSON.stringify(overrides));

// 汇总多局终态
const N = parseInt(process.argv[2]||'50',10);
const acc = {}; FIDS.forEach(id=>acc[id]={g:0,n:0,pp:0,alive:0,surv:0,survN:0});
let ended=0;
for(let i=0;i<N;i++){
  const s=M.createGameState((i*2654435761)>>>0); s.humanFactionId=null;
  const initPop={}; FIDS.forEach(id=>initPop[id]=s.factions.find(f=>f.id===id).popAlive);
  let guard=0; const sd={}; FIDS.forEach(id=>sd[id]=null);
  while(s.status==='PLAYING'&&guard<1000){
    const db=s.day; for(let k=0;k<4&&s.status==='PLAYING';k++)M.advancePhase(s);
    if(s.status!=='PLAYING')break; M.endDay(s); guard++;
    FIDS.forEach(id=>{const f=s.factions.find(x=>x.id===id); if(!f.alive&&sd[id]==null)sd[id]=db;});
  }
  if(s.status!=='ENDED')continue; ended++;
  FIDS.forEach(id=>{const f=s.factions.find(x=>x.id===id); const a=acc[id]; if(f.alive){a.alive++; a.g+=f.goods; a.n++; a.pp+=(s.result.perPerson[id]||0);} if(sd[id]!=null){a.surv+=sd[id];a.survN++;}});
}
console.log('N='+N+' ended='+ended);
FIDS.forEach(id=>{const a=acc[id]; console.log(id.padEnd(6)+' 存活率='+(100*a.alive/ended).toFixed(0)+'%  终货均='+(a.n?(a.g/a.n).toFixed(1):'-')+'  人均均='+(a.n?(a.pp/a.n).toFixed(0):'-')+'  灭绝日均='+(a.survN?(a.surv/a.survN).toFixed(1):'-'));});
