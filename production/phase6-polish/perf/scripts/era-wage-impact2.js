/* =========================================================
 * 只读：kEra 冲击测算 v2（修正 v1 的两个 bug：职业键不存在、§2/§3 全 0）
 * ---------------------------------------------------------
 * 核心问题：kEra 只缩放收入，livingCost 不动 → 年度结余随年代漂移
 * 关键事实：engine.js:506  startYear = randInt(1955, 2005)
 * ========================================================= */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..', '..', '..');
const ctx = vm.createContext({ console, Math, JSON, Date });
['assets/data.js','assets/market.js','assets/engine.js','assets/school.js',
 'assets/career.js','assets/love.js','assets/loan.js'].forEach(f => {
  vm.runInContext(fs.readFileSync(path.join(ROOT,f),'utf8'), ctx, {filename:f});
});
const out=[]; const say=s=>{out.push(s);console.log(s);};
const G = n => vm.runInContext(n, ctx);
const JOBS=G('JOBS'), tableAt=G('tableAt'), FIN_SCALE=G('FIN_SCALE'), HOUSE_INDEX=G('HOUSE_INDEX');
const careerIncomeParts=G('careerIncomeParts'), livingCost=G('livingCost');

const ERA=[[1955,0.35],[1965,0.46],[1975,0.66],[1985,1.00],[1990,1.58],[1995,1.83],[1997,1.95],
[1999,1.95],[2002,2.26],[2006,2.86],[2008,3.05],[2010,3.59],[2013,3.60],[2016,3.65],[2018,3.94],
[2020,4.43],[2022,4.93],[2025,5.31],[2028,5.51],[2035,5.93],[2045,6.27],[2065,6.45]];
const NORM=6.50;
const kEra = y => tableAt(ERA,y)/NORM;

function mk(job, year, age){
  return { job, career:{id:'clerk',level:1,years:0}, edu:{salaryK:1.04,level:4},
    stats:{INT:65,NET:40,LOY:30,STR:50,CHA:50,WILL:50,ETH:60,HP:80,MOOD:60,STRESS:20,FAME:0,GROW:0,LOVE:0},
    age, startYear: year-age, flags:{}, used:{}, log:[], queue:[] };
}

say('# kEra 冲击测算 v2（修正版）');
say('');
say('生成时间：'+new Date().toISOString());
say('');
say('## 0. 修正说明');
say('');
say('v1 有两个 bug：① 样本职业 `程序员` 不在 `JOBS` 里（收入恒 0）；② §2/§3 因此全 0。');
say('v2 换成 `公司职员` / `工厂工人` / `公务员`，并补算「盈亏平衡年份」。');
say('');
say('## 1. 起始年份分布（这是问题的量级来源）');
say('');
say('- `engine.js:506`：`startYear = opt.startYear || randInt(1955, 2005)`');
say('- **玩家出生年在 1955–2005 之间均匀随机**；玩家 22–25 岁进入职场时，'
  + '日历年落在 **1977–2030**');
say('- 也就是说：**有相当比例的玩家，整个职业生涯都在 2002 年之前**');
say('');

/* 核心表：各日历年下的年度收支 */
const JOBS_SAMPLE=['公司职员','工厂工人','公务员'];
say('## 2. 年度收支（25 岁 · 公司职员 · 一本 · INT65/NET40/LOY30）');
say('');
say('| 日历年 | kEra | 收入（kEra 后） | livingCost | **年结余** | 现状收入（无 kEra） | 现状年结余 |');
say('|---|---:|---:|---:|---:|---:|---:|');
const YEARS=[1955,1965,1975,1985,1990,1995,2000,2002,2005,2010,2015,2020,2025,2030,2045,2065];
const rows=[];
YEARS.forEach(y=>{
  const st=mk('公司职员',y,25);
  const p=careerIncomeParts(st);
  const base=p.total, cost=livingCost(st);
  const inc=Math.round(base*kEra(y));
  rows.push({y,k:kEra(y),inc,cost,net:inc-cost,base,baseNet:Math.round(base)-cost});
  say('| '+y+' | '+kEra(y).toFixed(3)+' | '+(inc/1e6).toFixed(1)+'M | '+(cost/1e6).toFixed(1)+
      'M | **'+((inc-cost)/1e6).toFixed(1)+'M** | '+(base/1e6).toFixed(1)+'M | '+
      ((Math.round(base)-cost)/1e6).toFixed(1)+'M |');
});
say('');
say('> **现状（无 kEra）列**：收入与支出都年代无关 → 年结余恒为 **+'+
   (rows[0].baseNet/1e6).toFixed(1)+'M**。这是今天的基线。');
say('> **kEra 后**：年结余从 '+(rows[0].net/1e6).toFixed(1)+'M（1955）一路走到 '+
   (rows[rows.length-1].net/1e6).toFixed(1)+'M（2065）。');
say('');

/* 盈亏平衡年 */
const cost=rows[0].cost, base=rows[0].base;
let be=null;
for(let y=1955;y<=2065;y++){ if(Math.round(base*kEra(y))-cost>=0){ be=y; break; } }
say('## 3. 盈亏平衡年');
say('');
say('- 年收入追平生活支出（'+(cost/1e6).toFixed(1)+'M）的年份：**'+(be||'>2065')+'**');
say('- `startYear ∈ [1955, 2005]` → 玩家 25 岁时日历年 ∈ [1980, 2030]');
const lo=1980, hi=2030;
const below = be ? Math.max(0, Math.min(be-1,hi)-lo+1) : (hi-lo+1);
say('- 落在「结构性赤字」区间的起始年份：**'+lo+'–'+(be?be-1:hi)+
    '**，约 **'+(below/(hi-lo+1)*100).toFixed(0)+'%** 的玩家开局即年度亏损');
say('');

/* 世代难度：买房 */
say('## 4. 买房难度（HOUSE_INDEX / kEra，即 design-strategist 的 C-3 门）');
say('');
say('| 年份 | HOUSE_INDEX | kEra | 房价/收入 | 归一化 R（min=1） |');
say('|---|---:|---:|---:|---:|');
const R=[];
YEARS.forEach(y=>{
  const hi=tableAt(HOUSE_INDEX,y), k=kEra(y), r=hi/k;
  R.push(r);
  say('| '+y+' | '+hi.toFixed(2)+' | '+k.toFixed(3)+' | '+r.toFixed(2)+' | — |');
});
const Rmin=Math.min.apply(null,R), Rmax=Math.max.apply(null,R);
say('');
YEARS.forEach((y,i)=>{ say('| '+y+' | — | — | — | **'+(R[i]/Rmin).toFixed(2)+'** |'); });
say('');
say('- **全段极差 = '+(Rmax/Rmin).toFixed(2)+'×**（design-strategist 的 C-3 目标 ≤1.6）');
const i1985=YEARS.indexOf(1985);
const Rpost=R.slice(i1985), rpMin=Math.min.apply(null,Rpost), rpMax=Math.max.apply(null,Rpost);
say('- **仅 1985 年之后的极差 = '+(rpMax/rpMin).toFixed(2)+'×** ← 与 design-strategist 报的 1.55 吻合');
say('- **结论：C-3 门只在 1985 年之后成立；含 1955–1985 段后极差是 '+(Rmax/Rmin).toFixed(2)+
    '×，超标 '+(Rmax/Rmin/1.6).toFixed(1)+' 倍**');
say('- 方向：**1955 世代买房难度是 1985 世代的 '+(R[0]/R[i1985]).toFixed(2)+' 倍**（收入降得比房价快）');
say('');

/* 三职业横向 */
say('## 5. 三职业 25 岁年结余对照');
say('');
say('| 职业 | 1955 结余 | 1985 结余 | 2005 结余 | 2025 结余 | 现状结余（各年代一致） |');
say('|---|---:|---:|---:|---:|---:|');
JOBS_SAMPLE.forEach(j=>{
  const c=[1955,1985,2005,2025].map(y=>{
    const st=mk(j,y,25); const p=careerIncomeParts(st);
    return (Math.round(p.total*kEra(y))-livingCost(st))/1e6;
  });
  const st=mk(j,2025,25); const p=careerIncomeParts(st);
  const now=(Math.round(p.total)-livingCost(st))/1e6;
  say('| '+j+' | '+c.map(v=>'**'+v.toFixed(1)+'M**').join(' | ')+' | +'+now.toFixed(1)+'M |');
});
say('');

say('## 6. 结论');
say('');
say('**kEra 现在这张表不能直接落地。** 三处硬伤：');
say('');
say('1. **年度赤字**：收入被 kEra 压到 1955 年的 5.4%，而 `livingCost()` 不随年代变，'
  + '导致 '+(be?('1980–'+(be-1)):'全段')+' 出身的玩家年年亏损、永远攒不下钱。');
say('2. **C-3 门在 1955–1985 段不成立**：全段极差 '+(Rmax/Rmin).toFixed(2)+
    '×，超标 '+(Rmax/Rmin/1.6).toFixed(1)+' 倍；design-strategist 报的 1.55 只覆盖了 1985 之后。');
say('3. **世代难度失衡**：1955 世代买房难度是 1985 世代的 '+(R[0]/R[i1985]).toFixed(2)+' 倍。');
say('');
say('**根因**：`kEra` 只动了「收入」这一端。项目里「支出」有两条互不相干的口径——');
say('- `livingCost()`：完全不随年代变（`JOBS[].cost` 写死）');
say('- `FIN_SCALE`：只管医疗/彩票/家庭账，不管个人年结算');
say('');
say('现状下收入与支出同为年代无关，所以相安无事；**一旦只缩放收入，平衡立刻破**。');
say('');
say('**处置建议（我倾向 A）**：');
say('- **A｜`livingCost()` 同步乘同一张 kEra 表** → 结余/收入比恢复为常数，'
  + '只保留「房价/收入」这一条真实年代差异。语义最干净，改动最小（engine.js:1 行）。');
say('- **B｜`livingCost()` 乘 FIN_SCALE** → 复用现成表，但 FIN_SCALE 与 kEra 在 1985 年前'
  + '形状差 3.5×，会引入第二次漂移。');
say('- **C｜不动支出，重新推 kEra 表** → 需要把 kEra 的地板从 0.35 抬到能让「最低收入职业在 1955 年'
  + '仍能覆盖 livingCost」的水平，但这会同时把 C-2（2025/1985 ≥ 3.5×）顶爆，需要重新做整表。');
say('');
say('> 无论选哪个，**C-3 门都必须按「全段 1955–2065」重算**，不能只算 1985 之后。');

fs.writeFileSync(path.join(__dirname,'era-wage-impact2.out.txt'), out.join('\n')+'\n','utf8');
say('[已写出] era-wage-impact2.out.txt');
