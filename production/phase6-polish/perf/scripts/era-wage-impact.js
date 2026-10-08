/* =========================================================
 * 只读：年代薪资项 kEra 的年结算冲击测算
 * ---------------------------------------------------------
 * 把 design-strategist 的 era.table 套进 careerIncomeParts，
 * 看「收入 − 生活支出」这条日常账在各年代还剩多少。
 * 背景：engine.js 年结算 income = careerIncome(state)，
 *       cost  = livingCost(state)  ← 实测**不乘** FIN_SCALE
 * 目的：验证 kEra 只动了收入、没动支出会带来什么后果。
 * ========================================================= */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..', '..', '..');
const ctx = vm.createContext({ console, Math, JSON, Date });
['assets/data.js', 'assets/market.js', 'assets/engine.js', 'assets/school.js',
 'assets/career.js', 'assets/love.js', 'assets/loan.js'].forEach(f => {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
});
const out = []; const say = s => { out.push(s); console.log(s); };

const G = n => vm.runInContext(n, ctx);
const JOBS = G('JOBS'), CAREER_MULT = G('CAREER_MULT');
const careerIncomeParts = G('careerIncomeParts'), freelanceIncome = G('freelanceIncome');
const tableAt = G('tableAt'), FIN_SCALE = G('FIN_SCALE'), HOUSE_INDEX = G('HOUSE_INDEX');

/* design-strategist 交付的表（era-wage-table.md v1.0 主干版） */
const ERA_TABLE = [
  [1955, 0.35], [1965, 0.46], [1975, 0.66],
  [1985, 1.00], [1990, 1.58], [1995, 1.83], [1997, 1.95], [1999, 1.95],
  [2002, 2.26], [2006, 2.86], [2008, 3.05], [2010, 3.59], [2013, 3.60],
  [2016, 3.65], [2018, 3.94], [2020, 4.43], [2022, 4.93], [2025, 5.31],
  [2028, 5.51], [2035, 5.93], [2045, 6.27], [2065, 6.45]
];
const NORM = 6.50;

say('# 年代薪资项 kEra · 年结算冲击测算');
say('');
say('生成时间：' + new Date().toISOString());
say('');
say('## 0. 已确认的事实');
say('');
say('- `engine.js:1547` 年结算：`income = careerIncome(state)`；`cost = livingCost(state)`');
say('- `livingCost()`（engine.js:1423）= `JOBS[].cost` + 固定加项，**实测不乘 FIN_SCALE、不随年代变化**');
say('- `FIN_SCALE`（data.js:352）只作用于：家庭账 / 医疗 / 彩票 / 家庭要钱，**不作用于个人年结算**');
say('- 结论：**收入要被 kEra 缩放，支出不动** —— 日常结余会随年代漂移');
say('');

/* 构造一个固定玩家：一本 programmer lv1 / INT65 NET40 LOY30 */
function mkState(year) {
  return {
    job: '程序员', career: { id: 'clerk', level: 1, years: 0 },
    edu: { salaryK: 1.04, level: 4 },
    stats: { INT: 65, NET: 40, LOY: 30, STR: 50, CHA: 50, WILL: 50, ETH: 60, HP: 80, MOOD: 60, STRESS: 20, FAME: 0, GROW: 0, LOVE: 0 },
    age: 25, startYear: year - 25, flags: {}, used: {}, log: [], queue: []
  };
}

say('## 1. 关键比值：收入曲线 vs 物价曲线 vs 支出曲线');
say('');
say('| 年份 | kEra/norm（收入） | FIN_SCALE（医疗/彩票/家庭账） | HOUSE_INDEX（房价） | **收入 / FIN_SCALE** | **收入 / 房价** |');
say('|---|---:|---:|---:|---:|---:|');
const YEARS = [1955, 1965, 1975, 1985, 1995, 2005, 2015, 2025, 2045, 2065];
const ratioFS = [], ratioHI = [];
YEARS.forEach(y => {
  const kEra = tableAt(ERA_TABLE, y) / NORM;
  const fs_ = tableAt(FIN_SCALE, y);
  const hi = tableAt(HOUSE_INDEX, y);
  const r1 = kEra / fs_, r2 = hi / kEra;
  ratioFS.push(r1); ratioHI.push(r2);
  say('| ' + y + ' | ' + kEra.toFixed(3) + ' | ' + fs_.toFixed(2) + ' | ' + hi.toFixed(2) +
      ' | **' + r1.toFixed(2) + '** | **' + r2.toFixed(2) + '** |');
});
const rng = a => (Math.max.apply(null, a) / Math.min.apply(null, a));
say('');
say('- 收入/FIN_SCALE 极差：**' + rng(ratioFS).toFixed(2) + '×**'
    + '（越大说明「医疗费等按 FIN_SCALE 计价的项目」相对收入越贵）');
say('- 房价/收入 极差：**' + rng(ratioHI).toFixed(2) + '×**（即 design-strategist 的 C-3 门，目标 ≤1.6）');
say('');

say('## 2. 日常年结余：收入 − livingCost（**支出不随年代变**）');
say('');
say('| 年份 | 收入（kEra 后） | livingCost | 年结余 | 结余/收入 |');
say('|---|---:|---:|---:|---:|');
const JOBS_SAMPLE = ['程序员', '公司职员', '工厂工人', '公务员'];
const first = JOBS_SAMPLE[0];
YEARS.forEach(y => {
  const st = mkState(y);
  st.job = first;
  const p = careerIncomeParts(st);
  const kEra = tableAt(ERA_TABLE, y) / NORM;
  const income = Math.round(p.total * kEra);
  const cost = vm.runInContext('livingCost', ctx)(st);
  say('| ' + y + ' | ' + (income / 1e6).toFixed(1) + 'M | ' + (cost / 1e6).toFixed(1) +
      'M | **' + ((income - cost) / 1e6).toFixed(1) + 'M** | ' +
      ((income - cost) / income * 100).toFixed(1) + '% |');
});
say('');

say('## 3. 对照：kEra 之前的现状（收入与支出都是"年代无关"的）');
say('');
say('| 年份 | 收入（现状） | livingCost | 年结余 | 结余/收入 |');
say('|---|---:|---:|---:|---:|');
YEARS.slice(0, 3).concat([2025]).forEach(y => {
  const st = mkState(y); st.job = first;
  const p = careerIncomeParts(st);
  const income = Math.round(p.total);
  const cost = vm.runInContext('livingCost', ctx)(st);
  say('| ' + y + ' | ' + (income / 1e6).toFixed(1) + 'M | ' + (cost / 1e6).toFixed(1) +
      'M | **' + ((income - cost) / 1e6).toFixed(1) + 'M** | ' +
      ((income - cost) / income * 100).toFixed(1) + '% |');
});
say('');
say('> 现状下每年结余/收入是常数（与年代无关），这是今天的基线行为。');
say('');

say('## 4. 各职业首年结余（2025 vs 1955，看世代难度差）');
say('');
say('| 职业 | 1955 收入 | 1955 结余 | 2025 收入 | 2025 结余 | 2025/1955 结余比 |');
say('|---|---:|---:|---:|---:|---:|');
JOBS_SAMPLE.forEach(j => {
  const cells = [1955, 2025].map(y => {
    const st = mkState(y); st.job = j;
    if (!JOBS[j]) return null;
    const p = careerIncomeParts(st);
    const kEra = tableAt(ERA_TABLE, y) / NORM;
    const income = Math.round(p.total * kEra);
    const cost = vm.runInContext('livingCost', ctx)(st);
    return { income, net: income - cost };
  });
  if (!cells[0] || !cells[1]) return;
  say('| ' + j + ' | ' + (cells[0].income / 1e6).toFixed(1) + 'M | ' + (cells[0].net / 1e6).toFixed(1) +
      'M | ' + (cells[1].income / 1e6).toFixed(1) + 'M | ' + (cells[1].net / 1e6).toFixed(1) +
      'M | **' + (cells[1].net / cells[0].net).toFixed(1) + '×** |');
});
say('');

say('## 5. 散工口径（freelanceIncome，CAREER_MULT.freelance 路径）');
say('');
say('| 年份 | 散工收入（现状） | 散工收入（乘 kEra 后） |');
say('|---|---:|---:|');
[1955, 1985, 2025, 2065].forEach(y => {
  const st = mkState(y); st.job = '待业'; st.career = null;
  const raw = freelanceIncome(st);
  const kEra = tableAt(ERA_TABLE, y) / NORM;
  say('| ' + y + ' | ' + (raw / 1e6).toFixed(1) + 'M | ' + (raw * kEra / 1e6).toFixed(1) + 'M |');
});
say('');

say('## 6. 结论');
say('');
say('1. **kEra 只缩放收入，不缩放 `livingCost`** —— 日常结余/收入比从「常数」'
   + '变成「随年代单调变化」，见 §2 / §3 对照。');
say('2. **出生年代会成为难度旋钮**：见 §4，1955 与 2025 世代的年度结余差距以倍计。');
say('3. 这不是 kEra 表的错，是 **`livingCost()` 从来没跟年代挂钩** 这个既有事实被暴露了。');
say('   现状下收入与支出同为年代无关，所以相安无事；一旦只动一端，平衡就破了。');
say('');
say('**处置选项（需 design-strategist 拍板）**：');
say('- **A｜给 `livingCost()` 也乘同一张 kEra 表** —— 日常结余/收入比恢复为常数，'
   + '只保留「房价/收入」这条真实年代差异。改动最小、语义最干净。');
say('- **B｜给 `livingCost()` 乘 FIN_SCALE** —— 复用现成表，但 FIN_SCALE 与 kEra 在 1985 年前'
   + '形状差 3.5×（见 §1），会引入第二次漂移。');
say('- **C｜不动 `livingCost()`，接受世代难度差** —— 需要在设计上明确「1955 世代就是更难/更容易」，'
   + '且要重跑 playtest 标定。');
say('');
say('> 我倾向 **A**：`kEra` 是「名义薪资水平」，`livingCost` 是「名义物价水平」，'
   + '两者同表缩放才是「通胀 = 名义量同步膨胀、实际购买力不变」的正确建模；'
   + '真正应该随年代变化的只有「房价/收入」这一个比值（也就是 C-3 门在管的那件事）。');

fs.writeFileSync(path.join(__dirname, 'era-wage-impact.out.txt'), out.join('\n') + '\n', 'utf8');
say('[已写出] era-wage-impact.out.txt');
