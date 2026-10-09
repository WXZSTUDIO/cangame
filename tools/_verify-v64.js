/* v6.4.0 验收：① 上限统一 100 ② 数值重平衡 ③ 婚后配偶资产负债 ④ 外界评价 ⑤ 导演收入 bug */
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..');
const A = f => fs.readFileSync(path.join(ROOT, 'assets', f), 'utf8');

const ctx = {
  console, Math, JSON, Date,
  window: { addEventListener() { }, __eval: null },
  document: { addEventListener() { }, getElementById() { return null }, querySelectorAll() { return [] } },
  localStorage: { getItem() { return null }, setItem() { }, removeItem() { } }
};
vm.createContext(ctx);
['data', 'market', 'engine', 'school', 'career', 'love', 'pet', 'legacy', 'loan', 'ui']
  .forEach(m => vm.runInContext(A(m + '.js'), ctx, { filename: m }));

let pass = 0, fail = 0;
const ok = (c, msg, extra) => {
  if (c) { pass++; console.log('  ✓ ' + msg); }
  else { fail++; console.log('  ✗ ' + msg + (extra !== undefined ? '  → ' + extra : '')); }
};
const sec = t => console.log('\n== ' + t + ' ==');
const R = code => vm.runInContext('(function(){' + code + '})()', ctx);

/* ---------- 1. 上限统一 100 ---------- */
sec('1 · 所有属性上限 100');
const CAPKEYS = ['INT', 'STR', 'CHA', 'WILL', 'HP', 'STRESS', 'NET', 'FAME', 'LOY', 'CUR', 'LOVE', 'SEC', 'AUTO', 'GROW', 'ETH', 'MOOD'];
const r1 = R(`
  const s = createGame({name:'上',gender:'M',familyId:'zhishi',startYear:1990,priority:'balance',talents:[]});
  applyEffects(s, {INT:9999,STR:9999,CHA:9999,WILL:9999,HP:9999,STRESS:9999,NET:9999,FAME:9999,LOY:9999,
                   CUR:9999,LOVE:9999,SEC:9999,AUTO:9999,GROW:9999,ETH:9999,MOOD:9999});
  const hi = {}; ${JSON.stringify(CAPKEYS)}.forEach(k=>hi[k]=s.stats[k]);
  applyEffects(s, {INT:-9999,STR:-9999,CHA:-9999,WILL:-9999,HP:-9999,NET:-9999,FAME:-9999,LOY:-9999,MOOD:-9999});
  const lo = {}; ${JSON.stringify(CAPKEYS)}.forEach(k=>lo[k]=s.stats[k]);
  return {hi:hi, lo:lo};
`);
ok(CAPKEYS.every(k => r1.hi[k] <= 100.001), '全部属性封顶 ≤ 100', JSON.stringify(r1.hi));
ok(CAPKEYS.every(k => r1.lo[k] >= -0.001), '全部属性封底 ≥ 0（体魄不再为负）', JSON.stringify(r1.lo));
ok(CAPKEYS.every(k => r1.hi[k] === 100), '顶格都正好是 100',
  CAPKEYS.filter(k => r1.hi[k] !== 100).map(k => k + '=' + r1.hi[k]).join(','));

/* 老存档迁移 */
const r1b = R(`
  const s = createGame({name:'旧',gender:'M',familyId:'zhishi',startYear:1990,priority:'balance',talents:[]});
  s._capV = 0; s.stats.INT = 160; s.stats.HP = 115; s.stats.FAME = 90; s.stats.LOY = -20;
  statCapMigrate(s);
  return {INT:s.stats.INT, HP:s.stats.HP, FAME:s.stats.FAME, LOY:s.stats.LOY};
`);
ok(r1b.INT === 80 && r1b.HP === 96, '老存档按比例折算（INT 160→80 / HP 115→96）', JSON.stringify(r1b));
ok(r1b.LOY === 15, '口碑旧区间 -50..150 折算到 0..100（-20→15）', r1b.LOY);

/* ---------- 2. 数值重平衡（成长量按新尺度缩放） ---------- */
sec('2 · 数值重平衡');
const r2 = R(`
  const s = createGame({name:'平',gender:'M',familyId:'zhishi',startYear:1990,priority:'balance',talents:[]});
  const before = s.stats.INT;
  applyEffects(s, {INT: 10});          // 旧尺度 +10 → 新尺度 +5
  const after = s.stats.INT;
  const h0 = s.stats.HP; applyEffects(s, {HP: 12});   // 120 尺度 → 100 尺度：+10
  return {before:before, after:after, hpGain: s.stats.HP - h0};
`);
ok(Math.abs((r2.after - r2.before) - 5) < 0.01, '智力成长量 ×0.5（+10 → +5）', (r2.after - r2.before));
ok(Math.abs(r2.hpGain - 10) < 0.01, '健康成长量 ×100/120（+12 → +10）', r2.hpGain);
const r2b = R(`
  const astro = CAREERS.find(c=>c.id==='astronaut');
  const dir = CAREERS.find(c=>c.id==='director');
  return {astro:astro.need, dir:dir.need, allNeedOk: CAREERS.every(c=>{
    if(!c.need) return true;
    for(const k in c.need) if(c.need[k] > 100 || c.need[k] < 0) return false;
    return true;
  })};
`);
ok(r2b.astro.INT === 36 && r2b.astro.HP === 67, '职业门槛同步缩放（宇航员 INT 72→36 / HP 80→67）', JSON.stringify(r2b.astro));
ok(r2b.allNeedOk, '所有职业门槛都在 0–100 内');

/* 300 局分布体检 */
const dist = R(`
  const KEYS=['INT','STR','CHA','WILL','HP','STRESS','NET','FAME','LOY','MOOD','LOVE'];
  const acc={}; KEYS.forEach(k=>acc[k]=[]);
  const FAM=['nongcun','gongren','zhishi','fuyu','haomen','welfare'];
  let ages=[];
  for(let i=0;i<160;i++){
    const s=createGame({name:'T'+i,gender:i%2?'M':'F',familyId:FAM[i%6],startYear:1955+(i%50),
      priority:['balance','career','relation','success'][i%4],talents:[]});
    let g=0;
    while(!s.over && !s.finished && g++<400){
      let it; try{ it=step(s);}catch(e){break;}
      if(!it||it.type==='end')break;
      if(it.type==='event'&&it.ev){ try{resolveEvent(s,it.ev,0);}catch(e){break;} }
    }
    ages.push(s.age); KEYS.forEach(k=>acc[k].push(s.stats[k]||0));
  }
  const out={life: ages.reduce((a,b)=>a+b,0)/ages.length, over:[], under:[]};
  KEYS.forEach(k=>{
    const a=acc[k];
    if(a.some(v=>v>100.5)) out.over.push(k+':'+Math.max.apply(null,a).toFixed(1));
    if(a.some(v=>v<-0.5)) out.under.push(k+':'+Math.min.apply(null,a).toFixed(1));
  });
  const avg=k=>acc[k].reduce((a,b)=>a+b,0)/acc[k].length;
  out.avgINT=avg('INT'); out.avgHP=avg('HP'); out.avgMOOD=avg('MOOD'); out.avgSTRESS=avg('STRESS');
  return out;
`);
ok(dist.over.length === 0, '160 局终局属性无一越界 100', dist.over.join(','));
ok(dist.under.length === 0, '160 局终局属性无一为负', dist.under.join(','));
ok(dist.life > 62 && dist.life < 92, '平均寿命落在 62–92 之间（实测 ' + dist.life.toFixed(1) + '）');
ok(dist.avgINT > 25 && dist.avgINT < 85, '智力均值不再顶格（' + dist.avgINT.toFixed(1) + '）');
ok(dist.avgMOOD < 95, '心情不再恒定顶格（' + dist.avgMOOD.toFixed(1) + '）');

/* ---------- 3. 导演收入 bug ---------- */
sec('3 · 导演（及全部后加职业）收入修复');
const r3 = R(`
  const zero = CAREERS.filter(c=>c.ladder.every(l=>!JOBS[l.title])).map(c=>c.id);
  const s = createGame({name:'导',gender:'M',familyId:'zhishi',startYear:1990,priority:'balance',talents:[]});
  s.age=32; s.career={id:'director',level:1,years:3,joinedAge:28}; s.job='新锐导演';
  const inc = careerIncome(s);
  const s2 = createGame({name:'飞',gender:'M',familyId:'zhishi',startYear:1990,priority:'balance',talents:[]});
  s2.age=32; s2.career={id:'pilot',level:0,years:2,joinedAge:28}; s2.job=CAREERS.find(c=>c.id==='pilot').ladder[0].title;
  return {zero:zero, dirIncome:inc, pilotIncome:careerIncome(s2)};
`);
ok(r3.zero.length === 0, '全部 ' + '职业阶梯都已注册进工资表', r3.zero.join(','));
ok(r3.dirIncome > 0, '导演有收入（年薪 ' + r3.dirIncome + '）', r3.dirIncome);
ok(r3.pilotIncome > 0, '飞行员有收入（年薪 ' + r3.pilotIncome + '）', r3.pilotIncome);

/* ---------- 4. 婚后配偶资产 / 负债 ---------- */
sec('4 · 婚后并入配偶资产 / 负债');
const r4 = R(`
  const s = createGame({name:'婚',gender:'M',familyId:'zhishi',startYear:2000,priority:'balance',talents:[]});
  s.age = 30; s.flags.married = false;
  const lv = loveInit(s);
  const l = makeLover(s, '相亲');
  l.bg = 'rich'; l.age = 28; l.fin = makeSpouseFin(s, 'rich', 28);
  const fin = l.fin;
  marry(s, l);
  const h0 = JSON.parse(JSON.stringify(s.household));
  // 结算几年
  for (let i=0;i<5;i++){ s.age++; spouseFinTick(s); }
  const h1 = JSON.parse(JSON.stringify(s.household));
  return {
    fin: fin, h0: h0, h1: h1,
    spouseHasFin: !!(s.spouse && s.spouse.fin),
    grewJoint: (h1.joint||0) > 0,
    incomeGrew: (h1.spIncome||0) >= (h0.spIncome||0)
  };
`);
ok(r4.spouseHasFin, '配偶带着自己的资产负债表进门');
ok(r4.fin.assets > 0 && r4.fin.income > 0, '「条件优渥」的对象有资产与年收入', JSON.stringify(r4.fin));
ok(r4.h0.spAssets === r4.fin.assets && r4.h0.spDebt === r4.fin.debt, '结婚时婚前资产/负债并入家庭账簿');
ok(r4.grewJoint, '婚后逐年累积共同储蓄（5 年后 ' + r4.h1.joint + '）');
ok(r4.incomeGrew, '配偶年收入随年份增长');

/* 净资产口径 */
const r4b = R(`
  const s = createGame({name:'净',gender:'M',familyId:'zhishi',startYear:2000,priority:'balance',talents:[]});
  s.age=30; s.stats.MONEY = 100000000;
  const base = netWorth(s);
  s.household = {spAssets: 500000000, spDebt: 100000000, spIncome: 0, joint: 0, since: 30};
  const withSp = netWorth(s);
  return {base:base, withSp:withSp, delta: withSp-base};
`);
ok(r4b.delta === 400000000, '净资产计入配偶名下资产并扣除其债务（+4 亿）', r4b.delta);

/* 离婚清算 */
const r4c = R(`
  const s = createGame({name:'离',gender:'M',familyId:'zhishi',startYear:2000,priority:'balance',talents:[]});
  s.age=40; s.stats.MONEY=100000000; s.flags.married=true;
  s.spouse={name:'阿珍',age:38,affinity:40,alive:true,since:30,look:70,tp:'calm',bg:'mid'};
  s.spouseName='阿珍';
  s.household={spAssets:300000000, spDebt:50000000, spIncome:20000000, joint:200000000, since:30};
  const before = s.stats.MONEY;
  const d = divorce(s, '过不下去了');
  return {ok:d.ok, got:d.hset?d.hset.got:0, joint:d.hset?d.hset.joint:0,
          spAssets:s.household.spAssets, spDebt:s.household.spDebt, before:before, after:s.stats.MONEY};
`);
ok(r4c.ok && r4c.got === 100000000, '离婚：共同积累 2 亿对半分，拿回 1 亿', r4c.got);
ok(r4c.spAssets === 0 && r4c.spDebt === 0, '离婚：配偶婚前资产与债务都随 TA 走');

/* 身故限定继承 */
const r4d = R(`
  const s = createGame({name:'鳏',gender:'M',familyId:'zhishi',startYear:2000,priority:'balance',talents:[]});
  s.age=60; s.stats.MONEY=0;
  s.household={spAssets:200000000, spDebt:500000000, spIncome:0, joint:50000000, since:30};
  const hs = settleHouseholdOnDeath(s);
  return {hs:hs, money:s.stats.MONEY};
`);
ok(r4d.hs && r4d.hs.limited === true && r4d.hs.got === 0,
  '身故：债务 5 亿 > 遗产 2.5 亿 → 限定继承，你一分不用替还', JSON.stringify(r4d.hs));

/* ---------- 5. 外界评价 ---------- */
sec('5 · 外界对自己的评价');
const r5 = R(`
  const s = createGame({name:'评',gender:'M',familyId:'zhishi',startYear:1990,priority:'balance',talents:[]});
  s.age=55; s.stats.LOY=60; s.stats.FAME=80; s.stats.NET=70; s.stats.LOVE=80; s.stats.ETH=70;
  s.flags.own_house=true; s.flags.charity=true;
  const i = publicImage(s);
  const s2 = createGame({name:'囚',gender:'M',familyId:'nongcun',startYear:1990,priority:'balance',talents:[]});
  s2.age=55; s2.stats.LOY=5; s2.stats.FAME=5; s2.stats.NET=5; s2.stats.LOVE=10; s2.stats.ETH=15;
  s2.flags.ex_prisoner=true; s2.flags.divorced=true;
  const i2 = publicImage(s2);
  return {hi:i, lo:i2, html:(typeof publicImageHtml==='function')?publicImageHtml(s).length:0};
`);
ok(r5.hi.groups.length === 6, '评价分六组（家人/同事/邻居/朋友/圈内/舆论）');
ok(r5.hi.groups.every(g => g.score >= 0 && g.score <= 100 && g.text && g.text.length > 4), '每组都有 0–100 分与一句评价');
ok(r5.hi.score > r5.lo.score, '功成名就者评价高于前科离异者（' + r5.hi.score + ' vs ' + r5.lo.score + '）');
ok(r5.hi.score >= 60 && r5.lo.score <= 45, '两端分数区分明显');
ok(r5.hi.headline && r5.hi.headline.length > 8, '有一句总评：' + r5.hi.headline);
ok(r5.html > 200, 'UI 片段可渲染');

/* ---------- 6. 版本串 ---------- */
sec('6 · 版本与资源串');
/* 发版铁律：每次发版所有资源串同步递增。这里守「不低于当初写这条断言时的版本」，
 * 免得后续版本（如 6.5.0）一升级就永久变红；当前版本的精确校验由 _verify-v65.js 负责。 */
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const m = html.match(/\?v=(\d+)\.(\d+)\.(\d+)/);
const cur = m ? [+m[1], +m[2], +m[3]] : [0, 0, 0];
const atLeast = (a, b) => a[0] !== b[0] ? a[0] > b[0] : (a[1] !== b[1] ? a[1] > b[1] : a[2] >= b[2]);
ok(atLeast(cur, [6, 4, 0]), '资源串不低于 6.4.0（当前 ' + cur.join('.') + '）', cur.join('.'));
const n = (html.match(/\?v=/g) || []).length;
ok(n >= 11, '全部 ' + n + ' 个资源都带版本号（发版同步递增）', n);

console.log('\n' + (fail ? '✗ ' : '✓ ') + 'v6.4.0：' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
