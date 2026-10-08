/* =========================================================
 * 只读：验证 design-strategist 的 P0 主张
 *   ① 「二本 1.045 > 一本 1.04」的主导策略反转是否成立
 *   ② 改成 1.06 之后是否真的解决、余量多少
 *   ③ **全部相邻档**是否还有别的反转（他只查了二本/一本）
 *   ④ 提取 bestSalaryKFor 的参考实现 + 单调性断言
 * ========================================================= */
const fs=require('fs'), path=require('path'), vm=require('vm');
const ROOT=path.join(__dirname,'..','..','..','..');
const ctx=vm.createContext({console,Math,JSON,Date});
['assets/data.js','assets/market.js','assets/engine.js','assets/school.js',
 'assets/career.js','assets/love.js','assets/loan.js'].forEach(f=>{
  vm.runInContext(fs.readFileSync(path.join(ROOT,f),'utf8'),ctx,{filename:f});
});
const out=[]; const say=s=>{out.push(s);console.log(s);};
const G=n=>vm.runInContext(n,ctx);
const UNIV=G('UNIVERSITIES');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

const SCORE_K={over:70,max:0.10};
const needOf=u=>Math.round((u.minScore||0)/100*700);
const scoreKFor=(u,gao)=>1+clamp(Math.max(0,(gao||0)-needOf(u))/SCORE_K.over,0,1)*SCORE_K.max;
const effK=(u,gao)=>u.salaryK*scoreKFor(u,gao);

say('# scoreK 档内连续化 · 主导策略反转验证');
say('');
say('生成时间：'+new Date().toISOString());
say('');
say('## 0. 前提确认');
say('');
say('- `SCORE_K` / `scoreKFor` 在 `assets/` 里**尚不存在**（grep 无命中）');
say('- `applySchool`（school.js:418）现在是 `e.salaryK = u.salaryK;` —— **平档，无档内连续化**');
say('- 所以本脚本验的是 **spec 提出的新机制**，不是已发布代码的 bug。'
  + 'design-strategist 说的是「我刚算出来的 BUG」，指的是**新机制下的**反转，成立。');
say('');
say('| 档位 | minScore | need = round(minScore/100×700) | salaryK |');
say('|---|---:|---:|---:|');
UNIV.forEach(u=>say('| '+u.name+' | '+u.minScore+' | '+needOf(u)+' | '+u.salaryK+' |'));
say('');

/* ① 反转是否成立 */
say('## 1. 验证主张：二本 1.045 > 一本 1.04');
say('');
const erben=UNIV.find(u=>u.id==='u_erben'), yiben=UNIV.find(u=>u.id==='u_yiben');
say('- 二本 `need`='+needOf(erben)+'，封顶分 = '+needOf(erben)+'+'+SCORE_K.over+' = '+(needOf(erben)+SCORE_K.over)
   +' → 封顶后 `salaryK` = '+erben.salaryK+' × '+(1+SCORE_K.max)+' = **'+effK(erben,999).toFixed(3)+'**');
say('- 一本 `need`='+needOf(yiben)+'，压线 `salaryK` = **'+effK(yiben,needOf(yiben)).toFixed(3)+'**');
say('- 判定：**'+(effK(erben,999)>effK(yiben,needOf(yiben))?'反转成立 ✓':'不成立 ✗')+'**'
   +'（'+effK(erben,999).toFixed(3)+' > '+effK(yiben,needOf(yiben)).toFixed(3)+'）');
say('- 受影响分数段：gao ∈ ['+(needOf(erben)+SCORE_K.over)+', '+(needOf(yiben)-1)+']');
say('  → 这段里玩家**只能上二本**（一本还差 '+((needOf(yiben))-(needOf(erben)+SCORE_K.over))+' 分），'
   + '拿到 '+effK(erben,999).toFixed(3)+'；');
say('  → 一旦考到 '+needOf(yiben)+' 分能上一本了，反而只剩 '+effK(yiben,needOf(yiben)).toFixed(3)+'。');
say('  → **考得更好、拿得更少，主导策略反转 — 他的判断是对的。**');
say('');

/* ② 全部相邻档体检 */
function scan(patch){
  const U=UNIV.map(u=>Object.assign({},u, patch&&patch[u.id]?{salaryK:patch[u.id]}:{}));
  const bad=[];
  for(let i=0;i<U.length-1;i++){
    const lo=U[i], hi=U[i+1];               // U 按 minScore 降序：985 在前
    const better=U[i], worse=U[i+1];        // 对玩家而言 U[i] 是更好的档
    for(let g=0;g<=700;g++){
      if(g<needOf(worse)) continue;          // 玩家还够不到更低的档？跳过
      // 玩家能上 better 时，不应该有 worse 档更划算
      if(g>=needOf(better) && effK2(worse,g)>effK2(better,g)+1e-9){
        bad.push({g,better:better.name,worse:worse.name,
                  b:effK2(better,g),w:effK2(worse,g)});
      }
    }
  }
  function effK2(u,gao){
    const need=needOf(u);
    return u.salaryK*(1+clamp(Math.max(0,gao-need)/SCORE_K.over,0,1)*SCORE_K.max);
  }
  return bad;
}
say('## 2. 全档位体检（**他只查了二本/一本，我把所有相邻档都扫了**）');
say('');
say('扫描规则：对任意 gao，若玩家够得到「更好的档」，'
   + '则「较差档的 salaryK×scoreK」不得严格大于「较好档的」。');
say('');
const before=scan(null);
say('### 2.1 现状（一本 1.04）');
say('');
if(!before.length){ say('- 无反转'); }
else{
  say('| 反转 gao | 较好档 | 较差档 | 较好档 K | 较差档 K |');
  say('|---|---|---|---:|---:|');
  // 只打印每个「较差档」的第一个与最后一个反转点
  const seen={};
  before.forEach(b=>{
    const k=b.worse;
    if(!seen[k]){ seen[k]={first:b,last:b}; } else { seen[k].last=b; }
  });
  Object.keys(seen).forEach(k=>{
    const f=seen[k].first, l=seen[k].last;
    say('| '+f.g+' – '+l.g+' | '+f.better+' | '+f.worse+' | '+f.b.toFixed(3)+' | '+f.w.toFixed(3)+' |');
  });
  say('');
  say('- 反转点总数：**'+before.length+' / 701**（每个 gao 一个）');
}
say('');
const after=scan({'u_yiben':1.06});
say('### 2.2 应用修复（一本 1.04 → 1.06）');
say('');
if(!after.length){
  say('- **全部档位无反转 ✓ 修复有效**');
  const m=effK(yiben,needOf(yiben))*(1.06/1.04);
  say('- 临界余量：一本压线 '+m.toFixed(4)+' vs 二本封顶 '+effK(erben,999).toFixed(4)
     +' → **余量 '+((m/effK(erben,999)-1)*100).toFixed(2)+'%**');
} else {
  say('- 仍有 '+after.length+' 个反转点：');
  after.slice(0,10).forEach(b=>say('  - gao='+b.g+' '+b.worse+'('+b.w.toFixed(3)+') > '+b.better+'('+b.b.toFixed(3)+')'));
}
say('');

/* ③ 参考实现 + 单调性断言 */
say('## 3. `bestSalaryKFor(gao)` 参考实现（可直接抄进 school.js）');
say('');
say('```js');
say('/* 档内连续化：超线每 70 分 +10% 起薪，封顶 +10%（SCORE_K） */');
say('const SCORE_K = { over: 70, max: 0.10 };');
say('function uniNeed(u) { return Math.round((u.minScore || 0) / 100 * 700); }');
say('function scoreKFor(u, gao) {');
say('  return 1 + clamp(Math.max(0, (gao || 0) - uniNeed(u)) / SCORE_K.over, 0, 1) * SCORE_K.max;');
say('}');
say('function salaryKFor(u, gao) { return u.salaryK * scoreKFor(u, gao); }');
say('/* 纯函数：QA 直接注入整数分直读，绕开 11 年随机过程 */');
say('function bestSalaryKFor(gao) {');
say('  let best = null;');
say('  UNIVERSITIES.forEach(u => {');
say('    if ((gao || 0) < uniNeed(u)) return;              // 够不到');
say('    if (u.id === \'u_fail\') return;                    // E-12：落榜档不参与连续化');
say('    const k = salaryKFor(u, gao);');
say('    if (!best || k > best.k) best = { uni: u.id, k: k };');
say('  });');
say('  return best;   // { uni, k } 或 null');
say('}');
say('```');
say('');
say('`applySchool`（school.js:418）改为：');
say('```js');
say('e.salaryK = (u.id === \'u_fail\') ? u.salaryK : salaryKFor(u, e.gao);');
say('```');
say('');
say('### 3.1 QA 可写的确定性断言（零噪声）');
say('');
say('| 断言 | 期望 |');
say('|---|---|');
say('| `bestSalaryKFor(475).uni` | `u_erben`（一本还差 1 分）|');
say('| `bestSalaryKFor(476).uni` | `u_yiben`（压线上一本）|');
say('| `bestSalaryKFor(476).k > bestSalaryKFor(475).k` | **true** ← D-1 主导策略单调性 |');
say('| 全段 gao ∈ [0,700]，`bestSalaryKFor` 的 `.k` 单调不减 | **true** |');
say('| `bestSalaryKFor(0)` | `null`（连落榜档都不参与）|');
say('');
/* 实测单调性 */
let mono=true, firstBreak=null;
let prev=-1;
for(let g=0;g<=700;g++){
  let best=null;
  UNIV.forEach(u=>{
    if(u.id==='u_fail') return;
    if(g<needOf(u)) return;
    const k=u.salaryK*(1+clamp(Math.max(0,g-needOf(u))/SCORE_K.over,0,1)*SCORE_K.max);
    if(!best||k>best.k) best={uni:u.id,k:k};
  });
  const cur=best?best.k:0;
  if(cur<prev-1e-9){ mono=false; if(firstBreak===null) firstBreak={g,prev,cur}; }
  prev=cur;
}
say('- 单调性实测（一本=1.04）：**'+(mono?'通过':'失败')+'**');
if(!mono) say('  - 首个断点 gao='+firstBreak.g+'：'+firstBreak.prev.toFixed(4)+' → '+firstBreak.cur.toFixed(4));
say('');

/* ④ P90 clamp 余量 */
say('## 4. `salaryK` 上限与 ERA 叠加后的余量');
say('');
say('- `assets/` 里**目前没有任何对 salaryK 的 clamp**（grep `clamp(salaryK` 无命中）');
say('- `economy-respec.md` U-5 的 `clamp(salaryK, 0.8, 1.60)` 是**尚未实现的提案**');
say('');
const top=UNIV[0];
const k985=top.salaryK*(1+SCORE_K.max);
say('| 情形 | salaryK | 距 1.60 余量 |');
say('|---|---:|---:|');
say('| 985 压线 | '+top.salaryK.toFixed(3)+' | '+((1.60/top.salaryK-1)*100).toFixed(1)+'% |');
say('| 985 超线封顶（×'+ (1+SCORE_K.max) +'） | **'+k985.toFixed(3)+'** | **'+((1.60/k985-1)*100).toFixed(1)+'%** |');
say('| 985 考研上岸（`Math.max(k, 1.45)`） | '+Math.max(k985,1.45).toFixed(3)
   +' | '+((1.60/Math.max(k985,1.45)-1)*100).toFixed(1)+'% |');
say('');
say('> design-strategist 说「最高到 1.562，距 1.60 只差 4%」。实测：'
   +'985 压线 1.42 × 封顶 1.10 = **'+k985.toFixed(3)+'**，距 1.60 余量 **'
   +((1.60/k985-1)*100).toFixed(1)+'%**。');
say('> 他报的 1.562 应该是 1.42 × 1.10 = 1.562 —— **对得上 ✓**（我这里是 1.5620）。');
say('');

/* ⑤ 顺带发现 */
say('## 5. 顺带发现：`考研上岸` 有两个不同的下限值');
say('');
say('| 位置 | 触发路径 | 取值 |');
say('|---|---|---:|');
say('| `school.js:459` | 校内活动 `a_kaoyan` | `Math.max(salaryK, 1.4)` | **1.40** |');
say('| `engine.js:2101` | 毕业选择 `grad_at_*` | `Math.max(salaryK, 1.45)` | **1.45** |');
say('| `engine.js:2129` | 再考一次 `kaoyan2_at_*` | `Math.max(salaryK, 1.45)` | **1.45** |');
say('');
say('**同一个「考研上岸」语义，两个下限。** 985 生（salaryK 1.42）走不同路径结果不同：');
say('- 走校内考研活动：`Math.max(1.42, 1.4)` = **1.42**（不变）');
say('- 走毕业选择考研：`Math.max(1.42, 1.45)` = **1.45**（+2.1%）');
say('- `career.js:571` 的注释里两个值都记了（「或考研上岸后的 1.4 / 1.45」），说明这个不一致是**已知的、但没统一**');
say('');
say('这不在你 E-11 的范围里（E-11 说的是「考研与 scoreK 无冲突」，那条我认同，'
   + '`Math.max` 取下限不是相乘，确实不用改）。但**两个值不一致**是另一回事，建议顺手统一。');

fs.writeFileSync(path.join(__dirname,'scorek-verify.out.txt'), out.join('\n')+'\n','utf8');
say('');
say('[已写出] scorek-verify.out.txt');
