/* 只读：把两处反转分开算，并逐项验证 E-12 / 1.06 各自的清除效果 */
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.join(__dirname,'..','..','..','..');
const ctx=vm.createContext({console,Math,JSON,Date});
['assets/data.js','assets/market.js','assets/engine.js','assets/school.js',
 'assets/career.js','assets/love.js','assets/loan.js'].forEach(f=>{
  vm.runInContext(fs.readFileSync(path.join(ROOT,f),'utf8'),ctx,{filename:f});
});
const out=[];const say=s=>{out.push(s);console.log(s);};
const UNIV=vm.runInContext('UNIVERSITIES',ctx);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const K={over:70,max:0.10};
const need=u=>Math.round((u.minScore||0)/100*700);
const sK=(u,g)=>1+clamp(Math.max(0,g-need(u))/K.over,0,1)*K.max;
const eff=(u,g)=>u.salaryK*sK(u,g);

/* opt: { yiben: 1.04|1.06, e12: 是否排除落榜档 } */
function scan(opt){
  const U=UNIV.map(u=>u.id==='u_yiben'?Object.assign({},u,{salaryK:opt.yiben}):u);
  const bad=[];
  for(let i=0;i<U.length-1;i++){
    const better=U[i], worse=U[i+1];
    if(opt.e12 && worse.id==='u_fail') continue;
    for(let g=0;g<=700;g++){
      if(g<need(better)) continue;
      if(eff(worse,g)>eff(better,g)+1e-9) bad.push({g,b:better.name,w:worse.name,bk:eff(better,g),wk:eff(worse,g)});
    }
  }
  return bad;
}
const fmt=b=>b.map(x=>'gao='+x.g+' ('+x.w+' '+x.wk.toFixed(3)+' > '+x.b+' '+x.bk.toFixed(3)+')').slice(0,3).join('\n    ');

say('# scoreK 反转精确扫描（逐项验证修复效果）');
say('');
say('生成时间：'+new Date().toISOString());
say('');
say('| 配置 | 反转点数 | 明细 |');
say('|---|---:|---|');
[['① 基线（一本1.04，落榜参与）',{yiben:1.04,e12:false}],
 ['② 仅应用 E-12（落榜不参与）',{yiben:1.04,e12:true}],
 ['③ 仅改一本 1.06',{yiben:1.06,e12:false}],
 ['④ E-12 + 一本 1.06（完整修复）',{yiben:1.06,e12:true}]
].forEach(([n,o])=>{
  const b=scan(o);
  say('| '+n+' | **'+b.length+'** | '+(b.length?'<br>'+b.map(x=>'gao '+x.g).join(', '):'—')+' |');
});
say('');

say('## 两处反转的细节');
say('');
const r1=scan({yiben:1.04,e12:true});
say('### 反转 A：二本 / 一本（design-strategist 发现的那个）');
say('');
if(r1.length){
  say('- 选择反转窗口：gao ∈ **['+r1[0].g+', '+r1[r1.length-1].g+']**（共 '+r1.length+' 分）');
  say('  → 这段里玩家**够得上一本**，但二本封顶的 '+r1[0].wk.toFixed(4)+' 更高');
  say('- 更广义的「分数提高反而变差」窗口：gao ∈ [462, '+r1[r1.length-1].g+']');
  say('  → 462 分起二本就吃满 0.95×1.10 = 1.0450；476 分能上一本了却只有 1.0400');
}else say('- 无');
say('');
const r0=scan({yiben:1.04,e12:false}).filter(x=>x.w.indexOf('落榜')>=0);
say('### 反转 B：落榜 / 专科（**E-12 要防的那个，我独立扫出来做了交叉验证**）');
say('');
if(r0.length){
  say('- 窗口：gao ∈ **['+r0[0].g+', '+r0[r0.length-1].g+']**（共 '+r0.length+' 分）');
  say('- 落榜档 `need`=0 → `over = gao − 0` → gao ≥ 70 就吃满 0.80×1.10 = **'+eff(UNIV.find(u=>u.id==='u_fail'),999).toFixed(3)+'**');
  say('- 专科压线（294 分）只有 0.8500，要考到 '+r0[r0.length-1].g+' 分才追平');
  say('- **→ 落榜比上专科更划算，与叙事语义完全相反。E-12 必须做，不是可选优化。**');
}
say('');

say('## 修复后的余量');
say('');
const yb=UNIV.find(u=>u.id==='u_yiben'), eb=UNIV.find(u=>u.id==='u_erben');
say('- 一本压线（gao=476）：1.06 × 1.000 = **'+(1.06).toFixed(4)+'**');
say('- 二本封顶（gao≥462）：0.95 × 1.100 = **'+eff(eb,999).toFixed(4)+'**');
say('- **余量 = '+((1.06/eff(eb,999)-1)*100).toFixed(2)+'%**');
say('');
say('> ⚠ 余量只有 1.4%。**这个修正是「刚好够」，不是「有富余」**：');
say('> 任何人以后把二本 `salaryK` 从 0.95 抬到 0.96（'+(eff(eb,999)/0.95*0.96>1.06?'就会再次反转':'仍在安全线内')+'），'
   + '或把一本 `minScore` 改了，反转会**静默回归**。');
say('> **所以必须配一条回归断言**：全档位单调性检查（下面 §3），否则这个 1.06 是个定时炸弹。');
say('');

say('## 建议的回归断言（可脚本化，零噪声）');
say('');
say('```js');
say('/* 不变量：任意 gao 下，「更差档的实际 salaryK」不得严格大于「更好档」 */');
say('function assertSalaryKMonotonic() {');
say('  for (let i = 0; i < UNIVERSITIES.length - 1; i++) {');
say('    const better = UNIVERSITIES[i], worse = UNIVERSITIES[i + 1];');
say('    if (worse.id === \'u_fail\') continue;              // E-12：落榜档不参与');
say('    for (let g = 0; g <= 700; g++) {');
say('      if (g < uniNeed(better)) continue;');
say('      if (salaryKFor(worse, g) > salaryKFor(better, g) + 1e-9) {');
say('        throw new Error(\'档位反转: gao=\' + g + \' \' + worse.name + \' > \' + better.name);');
say('      }');
say('    }');
say('  }');
say('}');
say('```');
say('');
say('- 当前（一本 1.04）实测：**FAIL**（'+scan({yiben:1.04,e12:true}).length+' 处反转）');
say('- 修复后（一本 1.06 + E-12）实测：**'+(scan({yiben:1.06,e12:true}).length===0?'PASS（0 处）':'FAIL')+'**');
say('- 建议挂进 `tools/` 回归，跟 `_verify-v5x` 一起跑；'
   + '这样以后谁改 `UNIVERSITIES` 的数值都会被立刻拦下');

fs.writeFileSync(path.join(__dirname,'scorek-verify2.out.txt'),out.join('\n')+'\n','utf8');
say('[已写出] scorek-verify2.out.txt');
