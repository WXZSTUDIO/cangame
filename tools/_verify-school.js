/* 教育与职业入口 Spec v1.3 专项验证
 * ---------------------------------------------------------
 * ED-5  全档位单调性：任意 gao 下，较差档的实际起薪系数不得大于较好档
 *       （违反 = 出现「考得更好、拿得更少」的主导策略反转）
 * ED-6  bestSalaryKFor 确定性断言：注入整数分直读结果，绕开 11 年随机过程
 *        —— quality-lead 卡在「收入复跑摆动 40%、符号翻转、模拟测不了」，
 *           这几个纯函数没有那个问题，可以直接断言。
 *
 * 这两条是「手工推导的常数必须有机器守着」的落地：
 *   一本 salaryK 1.04 → 1.06 这个修正是手工推的，余量只有 1.44%。
 *   没有这条回归，任何人动 UNIVERSITIES 的数值都会让反转静默回归。
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const ctx = { console, Math, JSON, Date, isNaN, parseInt, parseFloat, Number, String, Array, Object };
vm.createContext(ctx);
['assets/data.js', 'assets/market.js', 'assets/engine.js', 'assets/school.js',
 'assets/career.js', 'assets/love.js', 'assets/pet.js', 'assets/legacy.js', 'assets/loan.js']
  .forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));

const A = vm.runInContext(`({
  UNIVERSITIES, SCORE_K, KAOYAN_FLOOR,
  uniNeed, scoreKFor, salaryKFor, bestSalaryKFor, assertSalaryKMonotonic
})`, ctx);

let fail = 0;
const ok = (cond, name, extra) => {
  if (cond) console.log('  ✓', name, extra == null ? '' : extra);
  else { console.log('  ✗', name, extra == null ? '' : extra); fail++; }
};

console.log('== 1. 数据基线 ==');
ok(A.UNIVERSITIES.length === 6, '大学档位数 6', A.UNIVERSITIES.length);
ok(A.SCORE_K && A.SCORE_K.over === 70 && A.SCORE_K.max === 0.10,
   'SCORE_K = { over: 70, max: 0.10 }', JSON.stringify(A.SCORE_K));
ok(A.KAOYAN_FLOOR === 1.45, 'KAOYAN_FLOOR = 1.45', A.KAOYAN_FLOOR);

const need = {};
A.UNIVERSITIES.forEach(u => { need[u.id] = A.uniNeed(u); });
console.log('  录取线 need：', A.UNIVERSITIES.map(u => u.id + '=' + need[u.id]).join(' '));
ok(need.u_985 === 616 && need.u_211 === 546 && need.u_yiben === 476 &&
   need.u_erben === 392 && need.u_zhuanke === 294 && need.u_fail === 0,
   '六档录取线与 spec 一致');

console.log('\n== 2. ED-5：全档位单调性（主导策略不反转）==');
const bad = A.assertSalaryKMonotonic();
ok(bad.length === 0, '全档扫描 gao∈[0,700] 无反转', bad.length ? bad.length + ' 处' : '0 处');
if (bad.length) bad.slice(0, 10).forEach(b => console.log('      ' + b));

/* 两处已知的反转点，各自单独立一个断言，将来谁回退了能立刻指名 */
const yiben = A.UNIVERSITIES.find(u => u.id === 'u_yiben');
const erben = A.UNIVERSITIES.find(u => u.id === 'u_erben');
const zhuanke = A.UNIVERSITIES.find(u => u.id === 'u_zhuanke');
const ufail = A.UNIVERSITIES.find(u => u.id === 'u_fail');

/* 反转 A：二本封顶 vs 一本压线 —— 这就是 1.04→1.06 要修的那个 */
let invA = 0;
for (let g = need.u_yiben; g <= need.u_yiben + 20; g++) {
  if (A.salaryKFor(erben, g) > A.salaryKFor(yiben, g) + 1e-9) invA++;
}
ok(invA === 0, '反转A：一本可达区间内 二本 ≤ 一本', invA + ' 处反转');
console.log('      二本封顶 ' + A.salaryKFor(erben, 999).toFixed(4) +
            ' vs 一本压线 ' + A.salaryKFor(yiben, need.u_yiben).toFixed(4) +
            ' → 余量 ' + ((A.salaryKFor(yiben, need.u_yiben) / A.salaryKFor(erben, 999) - 1) * 100).toFixed(2) + '%');
ok(yiben.salaryK === 1.06, '一本 salaryK = 1.06（P0 修复）', yiben.salaryK);

/* 反转 B：落榜 vs 专科 —— E-12 要防的那个（need=0 会让 over 直接等于 gao） */
let invB = 0;
for (let g = need.u_zhuanke; g <= 700; g++) {
  if (A.salaryKFor(ufail, g) > A.salaryKFor(zhuanke, g) + 1e-9) invB++;
}
ok(invB === 0, '反转B：专科可达区间内 落榜档 ≤ 专科', invB + ' 处反转');
ok(A.bestSalaryKFor(999).uni !== 'u_fail', 'E-12：落榜档不参与 bestSalaryKFor',
   A.bestSalaryKFor(999).uni);

console.log('\n== 3. ED-6：bestSalaryKFor 确定性断言 ==');
ok(A.bestSalaryKFor(0) === null, 'bestSalaryKFor(0) = null（连落榜档都不参与）',
   JSON.stringify(A.bestSalaryKFor(0)));
ok(A.bestSalaryKFor(475).uni === 'u_erben', 'bestSalaryKFor(475).uni = u_erben',
   A.bestSalaryKFor(475).uni);
ok(A.bestSalaryKFor(476).uni === 'u_yiben', 'bestSalaryKFor(476).uni = u_yiben',
   A.bestSalaryKFor(476).uni);
ok(A.bestSalaryKFor(546).uni === 'u_211', 'bestSalaryKFor(546).uni = u_211',
   A.bestSalaryKFor(546).uni);
ok(A.bestSalaryKFor(616).uni === 'u_985', 'bestSalaryKFor(616).uni = u_985',
   A.bestSalaryKFor(616).uni);

/* D-1 主导策略单调性：这是最要紧的一条 —— 分高必定拿得多 */
ok(A.bestSalaryKFor(476).k > A.bestSalaryKFor(475).k,
   'D-1 主导策略单调性：476 分 > 475 分',
   A.bestSalaryKFor(476).k.toFixed(4) + ' > ' + A.bestSalaryKFor(475).k.toFixed(4));

/* 全段单调不减 */
let mono = true, firstBreak = null, prevK = -1;
for (let g = 0; g <= 700; g++) {
  const b = A.bestSalaryKFor(g);
  const k = b ? b.k : 0;
  if (k < prevK - 1e-9) { mono = false; if (!firstBreak) firstBreak = { g, prevK, k }; }
  prevK = k;
}
ok(mono, '全段 gao∈[0,700] 最优起薪系数单调不减',
   mono ? '通过' : ('断点 gao=' + firstBreak.g + ' ' + firstBreak.prevK.toFixed(4) + ' → ' + firstBreak.k.toFixed(4)));

console.log('\n== 4. 档内连续化的行为 ==');
ok(A.scoreKFor(yiben, need.u_yiben) === 1, '压线 = 无加成', A.scoreKFor(yiben, need.u_yiben));
ok(Math.abs(A.scoreKFor(yiben, need.u_yiben + A.SCORE_K.over) - (1 + A.SCORE_K.max)) < 1e-9,
   '超线 SCORE_K.over 分 = 吃满 +10%', A.scoreKFor(yiben, need.u_yiben + A.SCORE_K.over));
ok(A.scoreKFor(yiben, need.u_yiben + A.SCORE_K.over * 5) === 1 + A.SCORE_K.max,
   '超线再多也不超过上限（封顶）', A.scoreKFor(yiben, need.u_yiben + A.SCORE_K.over * 5));
ok(A.salaryKFor(yiben, need.u_yiben + A.SCORE_K.over) === yiben.salaryK * (1 + A.SCORE_K.max),
   '实际起薪 = 档位基准 × 档内加成', A.salaryKFor(yiben, need.u_yiben + A.SCORE_K.over).toFixed(4));
/* 未传 gao（老存档）不应炸 */
ok(A.salaryKFor(yiben, undefined) === yiben.salaryK, 'gao 缺失时退化为档位基准（老存档安全）',
   A.salaryKFor(yiben, undefined));

console.log('\n== 5. 与 career 侧的耦合 ==');
/* salaryK 会进入 careerTick 的晋升分 (salaryK-1)*22，
 * 985 超线封顶 1.562 相比 1.42 会多 +3.1 分 —— 记下来，回归时看晋升节奏（E-14） */
const k985max = A.UNIVERSITIES[0].salaryK * (1 + A.SCORE_K.max);
console.log('  985 超线封顶 salaryK = ' + k985max.toFixed(3) +
            '（晋升分比压线多 +' + ((k985max - A.UNIVERSITIES[0].salaryK) * 22).toFixed(1) + '）');
ok(k985max < 1.60, '985 超线封顶 < salaryK 上限 1.60（U-5 提案）', k985max.toFixed(3));
ok(k985max > A.KAOYAN_FLOOR, '985 超线档考研无收益（设计意图，UI 需提示）',
   k985max.toFixed(3) + ' > ' + A.KAOYAN_FLOOR);

console.log(fail === 0 ? '\n全部通过 ✅' : `\n失败 ${fail} 项 ❌`);
process.exit(fail ? 1 : 0);
