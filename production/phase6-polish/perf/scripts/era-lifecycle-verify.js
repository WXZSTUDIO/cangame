/* =========================================================
 * 只读：验证 design-strategist 的「livingCost 同步乘 kEra_eff」方案
 *   ① 结余/收入比是否真的恢复为常数
 *   ② 攒够首付需要几年（按年代，看世代差距还剩多少）
 *   ③ C-3 全段极差是否仍然超标（尺度不变量 → 预计仍在）
 *   ④ **同步缩放后的新风险：写死的绝对金额项**
 * ========================================================= */
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.join(__dirname,'..','..','..','..');
const ctx=vm.createContext({console,Math,JSON,Date});
['assets/data.js','assets/market.js','assets/engine.js','assets/school.js',
 'assets/career.js','assets/love.js','assets/loan.js'].forEach(f=>{
  vm.runInContext(fs.readFileSync(path.join(ROOT,f),'utf8'),ctx,{filename:f});
});
const out=[];const say=s=>{out.push(s);console.log(s);};
const G=n=>vm.runInContext(n,ctx);
const tableAt=G('tableAt'), HOUSE_INDEX=G('HOUSE_INDEX'), FIN_SCALE=G('FIN_SCALE');
const careerIncomeParts=G('careerIncomeParts'), livingCost=G('livingCost');

const ERA=[[1955,0.35],[1965,0.46],[1975,0.66],[1985,1.00],[1990,1.58],[1995,1.83],[1997,1.95],
[1999,1.95],[2002,2.26],[2006,2.86],[2008,3.05],[2010,3.59],[2013,3.60],[2016,3.65],[2018,3.94],
[2020,4.43],[2022,4.93],[2025,5.31],[2028,5.51],[2035,5.93],[2045,6.27],[2065,6.45]];
const NORM=6.50;
const kEra=y=>tableAt(ERA,y)/NORM;

function mk(job,year,age,flags){
  return {job,career:{id:'clerk',level:1,years:0},edu:{salaryK:1.04,level:4},
    stats:{INT:65,NET:40,LOY:30,STR:50,CHA:50,WILL:50,ETH:60,HP:80,MOOD:60,STRESS:20,FAME:0,GROW:0,LOVE:0},
    age,startYear:year-age,flags:flags||{},used:{},log:[],queue:[]};
}

say('# 「livingCost 同步乘 kEra_eff」方案验证');
say('');
say('生成时间：'+new Date().toISOString());
say('');
say('## 1. 结余/收入比是否恢复为常数');
say('');
say('| 年份 | kEra | 收入 | 支出(同步缩放后) | **年结余** | 结余/收入 | 现状结余/收入 |');
say('|---|---:|---:|---:|---:|---:|---:|');
const YEARS=[1955,1965,1975,1985,1995,2002,2005,2015,2025,2045,2065];
const ratios=[];
YEARS.forEach(y=>{
  const st=mk('公司职员',y,25);
  const base=careerIncomeParts(st).total, cost0=livingCost(st), k=kEra(y);
  const inc=Math.round(base*k), cost=Math.round(cost0*k), net=inc-cost;
  ratios.push(net/inc);
  say('| '+y+' | '+k.toFixed(3)+' | '+(inc/1e6).toFixed(1)+'M | '+(cost/1e6).toFixed(1)+'M | **'
     +(net/1e6).toFixed(1)+'M** | '+(net/inc*100).toFixed(2)+'% | 64.86% |');
});
say('');
say('- 结余/收入比极差：**'+((Math.max.apply(null,ratios)/Math.min.apply(null,ratios)-1)*100).toFixed(3)+'%**'
   +' → **恢复为常数 ✓**（残差只是取整噪声）');
say('- design-strategist 的推导正确：`结余 = kEra × (收入 − 支出)`，比值与今天完全一致');
say('');

say('## 2. ⚠️ 但攒钱买房的世代差距**没有被解决**（尺度不变量）');
say('');
say('`housePrice = base × HOUSE_INDEX(y) × jitter`，年结余 ∝ kEra(y)');
say('→ **攒够首付的年数 ∝ HOUSE_INDEX / kEra**，与 livingCost 缩放**无关**');
say('');
say('| 年份 | HOUSE_INDEX | kEra | 房价/年结余（相对 1985=1） | 攒够 `h_apt_gangbuk`(base 78M) 需几年 |');
say('|---|---:|---:|---:|---:|');
const R=[];
YEARS.forEach(y=>{
  const st=mk('公司职员',y,25);
  const base=careerIncomeParts(st).total, cost0=livingCost(st), k=kEra(y);
  const net=Math.round(base*k)-Math.round(cost0*k);
  const price=78000000*tableAt(HOUSE_INDEX,y);
  R.push(tableAt(HOUSE_INDEX,y)/k);
  say('| '+y+' | '+tableAt(HOUSE_INDEX,y).toFixed(2)+' | '+k.toFixed(3)+' | **'
     +(tableAt(HOUSE_INDEX,y)/k/(tableAt(HOUSE_INDEX,1985)/kEra(1985))).toFixed(2)
     +'** | '+(price/net).toFixed(1)+' 年 |');
});
const Rmin=Math.min.apply(null,R), Rmax=Math.max.apply(null,R);
say('');
say('- **全段 1955–2065 极差 = '+(Rmax/Rmin).toFixed(2)+'×**，C-3 门目标 ≤1.6 → **仍然超标 '+(Rmax/Rmin/1.6).toFixed(2)+' 倍**');
const i85=YEARS.indexOf(1985);
say('- 1955 世代攒钱买房耗时 = 1985 世代的 **'+(R[0]/R[i85]).toFixed(2)+' 倍**');
say('- **这是「尺度不变量」，同步缩放动不了它。** 要压它只能改 `kEra` 表的形状或 `HOUSE_INDEX` 的形状。');
say('');

say('## 3. ⚠️ 同步缩放引入的新风险：**写死的绝对金额项**');
say('');
say('收入与支出都被压到 1955 年的 5.4%，但**事件里 `eff.MONEY` 是写死的绝对值，不随年代缩放**。');
say('');
const EVENTS=G('EVENTS');
const mags=[];
EVENTS.forEach(ev=>{
  const walk=o=>{
    if(o===null||typeof o!=='object') return;
    if(typeof o.MONEY==='number'&&o.MONEY!==0) mags.push(Math.abs(o.MONEY));
    Object.keys(o).forEach(k=>walk(o[k]));
  };
  walk(ev);
});
mags.sort((a,b)=>b-a);
const med=mags[Math.floor(mags.length/2)];
const p90=mags[Math.floor(mags.length*0.1)];
say('- 事件 `eff.MONEY` 绝对值：共 '+mags.length+' 处，中位数 **'+(med/1e6).toFixed(1)+'M**，'
   +'P10（大额端）**'+(p90/1e6).toFixed(1)+'M**，最大 **'+(mags[0]/1e6).toFixed(1)+'M**');
say('');
say('| 年份 | 年结余（同步缩放后） | 一笔中位事件款 = 年薪的几倍 | 一笔大额事件款 = 年薪的几倍 |');
say('|---|---:|---:|---:|');
YEARS.forEach(y=>{
  const st=mk('公司职员',y,25);
  const base=careerIncomeParts(st).total, cost0=livingCost(st), k=kEra(y);
  const net=Math.round(base*k)-Math.round(cost0*k);
  say('| '+y+' | '+(net/1e6).toFixed(1)+'M | '+(med/net).toFixed(2)+' 年 | '+(p90/net).toFixed(2)+' 年 |');
});
say('');
say('> **1955 年：一笔中位数的事件款 ≈ '+(med/(Math.round(careerIncomeParts(mk('公司职员',1955,25)).total*kEra(1955))-Math.round(livingCost(mk('公司职员',1955,25))*kEra(1955)))).toFixed(1)
   +' 年的结余**，而 2025 年只有 '
   +(med/(Math.round(careerIncomeParts(mk('公司职员',2025,25)).total*kEra(2025))-Math.round(livingCost(mk('公司职员',2025,25))*kEra(2025)))).toFixed(2)+' 年。');
say('> **随机事件的影响力在早期被放大到荒谬的量级** —— 这跟「早期年年赤字」一样是硬伤，'
   +'只是方向相反（一个是攒不下钱，一个是随便中个事件就能翻身）。');
say('');
say('**处置选项**：');
say('- **A｜事件 `eff.MONEY` 也按 `kEra` 缩放** —— 一致，但 241 条事件全要过一遍，'
   + '且 `eff` 里还有 `MONEY` 之外的东西需要判断；改动量大。');
say('- **B｜缩放交给统一的 `applyEffects()` 出口** —— 在 `applyEffects` 里对 `MONEY` 乘 `kEra`，'
   + '**一处改动覆盖全部 241 条事件 + 职业/家庭/市场**。我倾向这个。');
say('- **C｜不动** —— 接受「早期随机事件决定一切」。');
say('');
say('> ⚠️ B 有个坑要先确认：`applyEffects` 也会处理**存档里的历史金额**与**UI 直接展示的金额**。'
   + '另外 `FIN_SCALE` 已经在管医疗/彩票，别让同一笔钱被缩放两次。**这个我还没实测，'
   + '要落 B 之前必须先扫一遍 `applyEffects` 的全部调用点。**');
say('');

say('## 4. 另一个同步缩放后才暴露的问题：`FIN_SCALE` 与 `kEra` 双轨');
say('');
say('| 年份 | FIN_SCALE | kEra raw(1985=1) | 差值 |');
say('|---|---:|---:|---:|');
[1955,1975,1985,1995,2005,2015,2025,2060].forEach(y=>{
  const f=tableAt(FIN_SCALE,y), k=tableAt(ERA,y);
  say('| '+y+' | '+f.toFixed(2)+' | '+k.toFixed(2)+' | '+((k/f-1)*100).toFixed(0)+'% |');
});
say('');
say('- 个人收支走 `kEra`、家庭收支走 `FIN_SCALE`、医疗/彩票走 `FIN_SCALE`');
say('- 1985–2015 段误差 ≤6%（design-strategist 说得对），**但 1955 段差 250%**');
say('- 观感分裂风险：**1955 年玩家本人年薪 3M，家里年收入却是 FIN_SCALE 0.10 缩放后的值**');
say('  → 需要确认两者量级是否协调，否则会出现「家里很有钱但本人很穷」或反之。');
say('  → **这一条要实测家庭收入与个人收入的实际数值对比，我还没做。**');
say('');

say('## 5. 结论');
say('');
say('| 问题 | 同步缩放后 |');
say('|---|---|');
say('| ① 早期年度赤字（45% 玩家） | **✅ 解决**（结余/收入比恢复常数）|');
say('| ② C-3 全段极差 2.86×（超标 1.8 倍）| **❌ 未解决**（尺度不变量，只能改表形状）|');
say('| ③ 事件绝对金额在早期被放大 | **⚠️ 新引入**，需 B 方案（统一在 `applyEffects` 缩放）|');
say('| ④ FIN_SCALE / kEra 双轨观感 | **⚠️ 待实测**家庭 vs 个人收入量级 |');

fs.writeFileSync(path.join(__dirname,'era-lifecycle-verify.out.txt'),out.join('\n')+'\n','utf8');
say('[已写出] era-lifecycle-verify.out.txt');
