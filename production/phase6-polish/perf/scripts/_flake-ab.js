/* 判定 tools/ 里那两个 flake（`_verify-v53` 疾病、`_verify-v55` 复合）
 * 是**既有**的还是 IMP-01 引入的。
 *
 * 办法：把两个失败场景各跑 N 遍，分别挂在「改前代码」(cangame-mp/engine/bundle.js)
 * 和「改后代码」(assets/) 上，比对失败率。
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const MP = path.resolve(ROOT, '..', 'cangame-mp');
const MODULES = ['data.js', 'market.js', 'engine.js', 'school.js', 'career.js', 'love.js', 'loan.js'];

const lines = [];
const say = (s) => { lines.push(s); console.log(s); };

function loadLogic(getCode) {
  const ctx = vm.createContext({
    console, setTimeout, clearTimeout, TextEncoder, TextDecoder,
    module: { exports: {} }, exports: {}
  });
  for (const m of MODULES) {
    const code = getCode(m);
    if (!code) continue;
    new vm.Script(code, { filename: m }).runInContext(ctx);
  }
  return { run: (c) => vm.runInContext(c, ctx) };
}

const bundleCode = fs.readFileSync(path.join(MP, 'engine', 'bundle.js'), 'utf8');
const BEFORE = loadLogic((m) => (m === 'data.js' ? bundleCode : ''));
const AFTER = loadLogic((m) => fs.readFileSync(path.join(ROOT, 'assets', m), 'utf8'));

const N = 300;

/* ---- 场景 1：_verify-v53「未能触发疾病用于治疗验证」 ---- */
const ILL = `(function(){
  var miss = 0, ages = [];
  for (var i = 0; i < ${N}; i++) {
    var s = createGame({ name: 'T3', gender: 'M', familyId: 'yiliao', priority: 'balance', talents: [] });
    s.startYear = 2000; s.age = 45; s.stats.HP = 60; s.stats.MONEY = 5000000000;
    var g = 0;
    while (!s.ill && g++ < 60) { s.age++; illnessTick(s); }
    if (!s.ill) { miss++; ages.push(s.age); }
  }
  return { miss: miss, n: ${N}, maxAge: ages.length ? Math.max.apply(null, ages) : 0 };
})()`;

/* ---- 场景 2：_verify-v55「前任能复合」 ----
 * 严格照抄 tools/_verify-v55.js:151-155：
 *   造一个 27 岁女性、预置一个 affinity=70 的非配偶前任，
 *   然后**最多重试 60 次** rekindle，只要成功一次就算过。 */
const REKINDLE = `(function(){
  var miss = 0, msgs = {}, tries = [];
  for (var i = 0; i < ${N}; i++) {
    var s = createGame({ name: 'T', gender: 'F', familyId: 'zhigong', priority: 'balance', talents: [] });
    s.age = 27;
    s.exes = [{ name: '张远', gender: 'M', age: 28, met: 22, at: 25, reason: '分手',
                wasSpouse: false, affinity: 70, look: 60, lastTouch: -1 }];
    var rk = null, used = 0;
    for (var k = 0; k < 60 && !(rk && rk.ok); k++) { rk = rekindle(s, 0); used++; }
    tries.push(used);
    if (!(rk && rk.ok)) { miss++; var m = String((rk && rk.msg) || '?'); msgs[m] = (msgs[m] || 0) + 1; }
  }
  tries.sort(function(a,b){ return a-b; });
  return { miss: miss, n: ${N}, msgs: msgs, medTry: tries[Math.floor(tries.length/2)], maxTry: tries[tries.length-1] };
})()`;

const rIllB = BEFORE.run(ILL), rIllA = AFTER.run(ILL);
const rRekB = BEFORE.run(REKINDLE), rRekA = AFTER.run(REKINDLE);

say('# tools/ 两个 flake：既有 or IMP-01 引入？');
say('');
say('生成时间：' + new Date().toISOString());
say('样本：每个场景 ' + N + ' 次；「改前」= `cangame-mp/engine/bundle.js`（2026-10-07 构建），'
  + '「改后」= `assets/` 现行。');
say('');

say('## 1. `_verify-v53` · 「未能触发疾病用于治疗验证」');
say('');
say('| 版本 | 60 年内没触发疾病的次数 | 失败率 | 未触发时角色最终年龄 |');
say('|---|---:|---:|---:|');
say('| 改前（bundle.js） | ' + rIllB.miss + ' / ' + rIllB.n + ' | ' +
  (rIllB.miss / rIllB.n * 100).toFixed(1) + '% | ' + (rIllB.maxAge || '—') + ' |');
say('| 改后（assets/） | ' + rIllA.miss + ' / ' + rIllA.n + ' | ' +
  (rIllA.miss / rIllA.n * 100).toFixed(1) + '% | ' + (rIllA.maxAge || '—') + ' |');
say('');

say('## 2. `_verify-v55` · 「前任能复合」');
say('');
say('| 版本 | 复合失败次数 | 失败率 |');
say('|---|---:|---:|');
say('| 改前（bundle.js） | ' + rRekB.miss + ' / ' + rRekB.n + ' | ' +
  (rRekB.miss / rRekB.n * 100).toFixed(1) + '% |');
say('| 改后（assets/） | ' + rRekA.miss + ' / ' + rRekA.n + ' | ' +
  (rRekA.miss / rRekA.n * 100).toFixed(1) + '% |');
say('');
const msgA = Object.keys(rRekA.msgs || {}).map(k => k + ' ×' + rRekA.msgs[k]).join('；');
const msgB = Object.keys(rRekB.msgs || {}).map(k => k + ' ×' + rRekB.msgs[k]).join('；');
say('- 改前失败原因分布：' + (msgB || '无'));
say('- 改后失败原因分布：' + (msgA || '无'));
say('- 成功所需尝试次数中位数：改前 **' + rRekB.medTry + '** 次 / 改后 **' + rRekA.medTry +
  '** 次（上限 60）');
say('');

const illPre = rIllB.miss / rIllB.n * 100, illPost = rIllA.miss / rIllA.n * 100;
const rekPre = rRekB.miss / rRekB.n * 100, rekPost = rRekA.miss / rRekA.n * 100;

say('## 结论');
say('');
say('- **疾病触发**：改前失败率 ' + illPre.toFixed(1) + '% → 改后 ' + illPost.toFixed(1) + '%');
say('- **前任复合**：改前失败率 ' + rekPre.toFixed(1) + '% → 改后 ' + rekPost.toFixed(1) + '%');
say('');
[
  ['疾病触发', illPre, illPost],
  ['前任复合', rekPre, rekPost]
].forEach(([name, pre, post]) => {
  if (pre > 0.5) say('  - `' + name + '`：**改前就已经会失败（' + pre.toFixed(1) +
    '%）** → 这是**既有 flake**，不是 IMP-01 引入的。');
  else if (post > 0.5) say('  - ⚠️ `' + name + '`：改前几乎不失败（' + pre.toFixed(1) +
    '%），改后 ' + post.toFixed(1) + '% → **IMP-01 引入，需要修**。');
  else say('  - `' + name + '`：两边都稳定（' + pre.toFixed(1) + '% / ' + post.toFixed(1) + '%）。');
});

fs.writeFileSync(path.join(__dirname, '_flake-ab.out.txt'), lines.join('\n') + '\n', 'utf8');
say('');
say('[已写出] _flake-ab.out.txt');
