/* =========================================================
 * 只读：**修正上一版 era-lifecycle-verify 的算法错误**
 * ---------------------------------------------------------
 * 上一版算的「攒够需几年」= price(y) / net(y)，即
 *   「假设年结余永远停在 y 年的水平」。
 * 这是错的：玩家会变老，kEra 随日历年增长（1955→1985 涨 2.86×），
 * 早期年结余不是常数。
 * 正确算法：从 22 岁起逐年累加真实结余，看几岁买得起。
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
const tableAt=G('tableAt'), HOUSE_INDEX=G('HOUSE_INDEX');
const careerIncomeParts=G('careerIncomeParts'), livingCost=G('livingCost');

const ERA=[[1955,0.35],[1965,0.46],[1975,0.66],[1985,1.00],[1990,1.58],[1995,1.83],[1997,1.95],
[1999,1.95],[2002,2.26],[2006,2.86],[2008,3.05],[2010,3.59],[2013,3.60],[2016,3.65],[2018,3.94],
[2020,4.43],[2022,4.93],[2025,5.31],[2028,5.51],[2035,5.93],[2045,6.27],[2065,6.45]];
const NORMS=[['6.50（设计侧原案）',6.50],['5.31（team-lead 裁定）',5.31]];

const HOUSE_MINYEAR=1993;      // h_apt_gangbuk
const HOUSE_BASE=78000000;

function mk(job,age,startYear){
  return {job,career:{id:'clerk',level:1,years:0},edu:{salaryK:1.04,level:4},
    stats:{INT:65,NET:40,LOY:30,STR:50,CHA:50,WILL:50,ETH:60,HP:80,MOOD:60,STRESS:20,FAME:0,GROW:0,LOVE:0},
    age,startYear,flags:{},used:{},log:[],queue:[]};
}

say('# 攒钱买房年数 · 修正版（逐年累加真实结余）');
say('');
say('生成时间：'+new Date().toISOString());
say('');
say('## 0. 上一版错在哪');
say('');
say('- 上一版：`年数 = price(y) / net(y)`，假设结余永远停在 y 年水平');
say('- 但玩家会变老 → 日历年前进 → `kEra` 增长（1955→1985 涨 2.86×）→ 结余逐年变多');
say('- 1955 世代「攒 39.2 年」是**错误结论**，真实值远小于此');
say('');

NORMS.forEach(([nname,NORM])=>{
  const kEra=y=>tableAt(ERA,y)/NORM;
  say('## norm = '+nname);
  say('');
  say('| 出生年 | 22 岁起攒 | 可购房最早年（minYear 1993）| 攒够时年龄 | 攒够时年份 | **耗时** | 相对 1985 世代 |');
  say('|---|---:|---:|---:|---:|---:|---:|');
  const res={};
  [1955,1965,1975,1985,1995,2005].forEach(B=>{
    let save=0, hitAge=null, hitYear=null;
    for(let age=22; age<=80; age++){
      const y=B+age;
      const st=mk('公司职员',age,B);
      const inc=careerIncomeParts(st).total*kEra(y);
      const cost=livingCost(st)*kEra(y);      // 同步缩放后
      save+=Math.max(0,inc-cost);
      const price=HOUSE_BASE*tableAt(HOUSE_INDEX,y);
      if(y>=HOUSE_MINYEAR && save>=price && hitAge===null){ hitAge=age; hitYear=y; }
    }
    res[B]={hitAge,hitYear,years:hitAge===null?null:hitAge-22};
    say('| '+B+' | '+(B+22)+' 年 | '+Math.max(HOUSE_MINYEAR,B+22)+' 年 | '
       +(hitAge===null?'—':hitAge+' 岁')+' | '+(hitYear===null?'—':hitYear)+' 年 | **'
       +(res[B].years===null?'买不起':res[B].years+' 年')+'** | — |');
  });
  const base=res[1985].years;
  say('');
  say('- 相对 1985 世代（'+base+' 年）：');
  say('');
  say('| 出生年 | 耗时 | 相对 1985 |');
  say('|---|---:|---:|');
  Object.keys(res).forEach(B=>{
    if(res[B].years===null) return;
    say('| '+B+' | '+res[B].years+' 年 | **'+(res[B].years/base).toFixed(2)+'×** |');
  });
  const ys=Object.keys(res).map(k=>res[k].years).filter(x=>x!==null);
  say('');
  say('- **全段极差 = '+(Math.max.apply(null,ys)/Math.min.apply(null,ys)).toFixed(2)+'×**'
     +' ← 这才是「攒钱买房」这条玩家真实体感指标的极差');
  say('');
});

say('## 与「静态比值」指标的对照');
say('');
say('| 指标 | 1955/1985 | 说明 |');
say('|---|---:|---|');
say('| `HOUSE_INDEX/kEra`（design-strategist 的 C-3）| 2.86× | 静态比值，尺度不变量 |');
say('| **攒够买房的年数（真实体感）** | 见上表 | **逐年累加，被 minYear 与 kEra 增长共同压缩** |');
say('');
say('> **两个指标不是一回事。** C-3 的 2.86× 是「同一年的房价/年薪」；');
say('> 玩家体感是「从我 22 岁起攒，几岁买得起」—— 后者同时受');
say('> ① `minYear` 物理门禁 ② `kEra` 随年代增长 ③ 攒钱期跨越多段曲线 三重影响。');
say('> **真实极差远小于 2.86×。**');

fs.writeFileSync(path.join(__dirname,'era-saveup-sim.out.txt'),out.join('\n')+'\n','utf8');
say('');
say('[已写出] era-saveup-sim.out.txt');
