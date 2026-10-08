/* 静态经济数据快照：职业阶梯 / 房价曲线 / 年代指数 / 医疗与教育成本 / 贷款
 * 用法：node dump-static.js  ->  out/static.md
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..', '..', '..');
const OUT = path.join(__dirname, 'out');

const ctx = {
  console, Math, JSON, Date, isNaN, isFinite, parseInt, parseFloat, Number, String, Array, Object, Boolean, RegExp, Error, Map, Set,
  setTimeout, clearTimeout,
  window: { addEventListener() {} },
  document: { addEventListener() {}, getElementById() { return null; }, querySelectorAll() { return []; }, querySelector() { return null; }, createElement() { return { style: {}, setAttribute() {}, appendChild() {} }; }, body: { appendChild() {}, classList: { add() {}, remove() {} } } },
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} }
};
vm.createContext(ctx);
['assets/data.js', 'assets/market.js', 'assets/engine.js', 'assets/school.js',
  'assets/career.js', 'assets/love.js', 'assets/loan.js', 'assets/ui.js']
  .forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));

const A = vm.runInContext(`({
  createGame, careerIncome, livingCost, housePrice, goodPrice, carPrice, tableAt, rateAt,
  illTreatCost, CAREERS, HOUSES, CARS, GOODS, STOCKS, JOBS, FAMILIES, FAMILY_FIN,
  FIN_SCALE, HOUSE_INDEX, CAR_INDEX, RATE_TABLE, ILLNESS, LOAN_PRODUCTS, MARKET_META,
  CNY_RATE, INVESTMENTS, ENDINGS, EVENTS, UNIVERSITIES, HIGH_SCHOOLS, EDU_LEVELS, EXAM_META,
  CAREER_META, GAME_META
})`, ctx);

const R = A.CNY_RATE;
const f = v => {
  const n = (v || 0) * R; const s = n < 0 ? '-' : ''; const a = Math.abs(n);
  if (a >= 1e8) return s + (a / 1e8).toFixed(2) + '亿';
  if (a >= 1e4) return s + (a / 1e4).toFixed(1) + '万';
  return s + Math.round(a) + '元';
};
const L = []; const w = s => L.push(s);

w('# 静态经济数据快照（v5.5.0，已换算为人民币元）\n');
w('换算率 CNY_RATE = 1/180（引擎内部金额 ÷ 180 = 显示的人民币）\n');

/* 1 职业阶梯 */
w('\n## 1. 25 种职业的收入阶梯（首级 / 顶级；年收入与年生活成本均为人民币）\n');
w('| 职业 | 方向 | 学历门槛 | 属性门槛 | 风险 | 首级职称 | 首级年薪 | 首级年支出 | **首级年结余** | 顶级职称 | 顶级年薪 | 顶级年结余 | 级差倍数 |');
w('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
const rows = A.CAREERS.map(c => {
  const l0 = c.ladder[0], ln = c.ladder[c.ladder.length - 1];
  const need = Object.keys(c.need || {}).map(k => `${k}≥${c.need[k]}`).join(' ') || '—';
  return {
    name: c.name, cat: c.cat, edu: A.EDU_LEVELS[c.edu] || c.edu, need: need, risk: c.risk,
    l0: l0.title, s0: l0.sal, c0: l0.cost, net0: l0.sal - l0.cost,
    ln: ln.title, sn: ln.sal, cn: ln.cost, netn: ln.sal - ln.cost,
    k: (ln.sal / l0.sal), net0r: l0.sal - l0.cost
  };
}).sort((a, b) => a.net0r - b.net0r);
rows.forEach(r => w(`| ${r.name} | ${r.cat} | ${r.edu} | ${r.need} | ${r.risk} | ${r.l0} | ${f(r.s0)} | ${f(r.c0)} | **${f(r.net0)}** | ${r.ln} | ${f(r.sn)} | ${f(r.netn)} | ${r.k.toFixed(1)}× |`));
const neg = rows.filter(r => r.net0 < 0);
w(`\n**首级年结余为负的职业：${neg.length} 个 → ${neg.map(r => r.name + '(' + f(r.net0) + ')').join('、')}**`);

/* 2 房价曲线 */
w('\n\n## 2. 房价曲线（按公历年份，人民币）\n');
const YEARS = [1985, 1990, 1995, 2000, 2005, 2010, 2015, 2020, 2025, 2035, 2045, 2060];
w('| 房产 | 1985基准 | ' + YEARS.slice(1).join(' | ') + ' |');
w('|---|' + YEARS.map(() => '---').join('|') + '|');
const probe = { market: { drift: {} }, startYear: 1985, age: 0 };
A.HOUSES.forEach(h => {
  const row = YEARS.map(y => {
    probe.startYear = y; probe.age = 0; probe.market.drift[h.id] = 0;
    return f(h.base * A.tableAt(A.HOUSE_INDEX, y));
  });
  w(`| ${h.name} | ${row.join(' | ')} |`);
});
w('\n注：housePrice = base × HOUSE_INDEX(年份) × (1+drift)；上表 drift=0。\n');
w('\nHOUSE_INDEX 采样：' + YEARS.map(y => `${y}=${A.tableAt(A.HOUSE_INDEX, y).toFixed(2)}`).join(' · '));
w('\nFIN_SCALE 采样：' + YEARS.map(y => `${y}=${A.tableAt(A.FIN_SCALE, y).toFixed(2)}`).join(' · '));

/* 3 房价收入比 */
w('\n\n## 3. 房价 / 收入比（分子=当年「市区老破小」总价；分母=该职业首级/顶级年薪，均不随年代缩放）\n');
const h = A.HOUSES.find(x => x.id === 'h_apt_gangbuk');
w('| 年份 | 老破小总价 | 骑手(首级) | 骑手(顶级) | 程序员(首级) | 程序员(顶级) | 投行(顶级) | 服务员(首级) |');
w('|---|---|---|---|---|---|---|---|');
const sal = id => { const c = A.CAREERS.find(x => x.id === id); return c ? [c.ladder[0].sal, c.ladder[c.ladder.length - 1].sal] : [0, 0]; };
YEARS.forEach(y => {
  const p = h.base * A.tableAt(A.HOUSE_INDEX, y);
  const r = sal('rider'), pg = sal('programmer'), fi = sal('finance'), wt = sal('waiter');
  w(`| ${y} | ${f(p)} | ${(p / r[0]).toFixed(1)}× | ${(p / r[1]).toFixed(1)}× | ${(p / pg[0]).toFixed(1)}× | ${(p / pg[1]).toFixed(1)}× | ${(p / fi[1]).toFixed(1)}× | ${(p / wt[0]).toFixed(1)}× |`);
});

/* 4 资产与车 */
w('\n\n## 4. 其它资产与汽车（1985 基准价 / 年化 / 波动）\n');
w('| 类别 | 名称 | 基准价 | 年化增长 | 波动率 | 维护费率 | 租金率 | 最早年份 |');
w('|---|---|---|---|---|---|---|---|');
A.GOODS.forEach(g => w(`| 资产 | ${g.name} | ${f(g.base)} | ${(g.growth * 100).toFixed(1)}% | ${(g.vol * 100).toFixed(0)}% | ${((g.upkeep || 0) * 100).toFixed(1)}% | ${((g.rent || 0) * 100).toFixed(1)}% | ${g.minYear} |`));
A.CARS.forEach(c => w(`| 汽车 | ${c.name} | ${f(c.base)} | 折旧 ${(c.dep * 100).toFixed(0)}% | — | ${((c.upkeep || 0) * 100).toFixed(0)}% | — | ${c.minYear} |`));

/* 5 股票 */
w('\n\n## 5. 股票（年化增长 / 波动 / 分红；实际年化 = growth × 0.75 阻尼 + 时代冲击 + 正态波动）\n');
w('| 名称 | 板块 | 基准股价 | 名义年化 | 阻尼后年化 | 波动率 | 分红率 | 上市年 |');
w('|---|---|---|---|---|---|---|---|');
A.STOCKS.forEach(s => w(`| ${s.name} | ${s.sector} | ${f(s.base)} | ${(s.growth * 100).toFixed(1)}% | ${(s.growth * A.MARKET_META.growthDamp * 100).toFixed(1)}% | ${(s.vol * 100).toFixed(0)}% | ${((s.div || 0) * 100).toFixed(1)}% | ${s.minYear} |`));

/* 6 医疗 */
w('\n\n## 6. 疾病治疗成本（人民币；按年代 FIN_SCALE 缩放，下表为 1985/2005/2025 三档 × 病程 1~4 期）\n');
w('| 疾病 | 严重度 | 慢性 | 诊所·初期(1985) | 住院·初期(1985) | 住院·危重(2005) | 住院·危重(2025) |');
w('|---|---|---|---|---|---|---|');
const st = { stats: {}, startYear: 1985, age: 0, familyId: 'xiangong', flags: {} };
A.ILLNESS.forEach(ill => {
  const cell = (y, stage, lv) => { st.startYear = y; st.age = 0; return f(A.illTreatCost(st, ill, stage, lv)); };
  w(`| ${ill.name} | ${ill.sev} | ${ill.chronic ? '是' : '否'} | ${cell(1985, 1, 'clinic')} | ${cell(1985, 1, 'hospital')} | ${cell(2005, 4, 'hospital')} | ${cell(2025, 4, 'hospital')} |`);
});
w('\n**医疗成本 / 年收入 对照（1985 年，重感冒住院 = 8.7万）：**');
w('\n| 职业（首级） | 年薪 | 一次「重感冒住院」占年收入 | 一次「肿瘤·危重住院(2025)」占年收入 |');
w('|---|---|---|---|');
['rider', 'waiter', 'factory', 'clerk', 'teacher', 'programmer', 'finance', 'ai'].forEach(id => {
  const c = A.CAREERS.find(x => x.id === id);
  const s0 = c.ladder[0].sal;
  st.startYear = 1985; st.age = 0; const c1 = A.illTreatCost(st, { sev: 1 }, 1, 'hospital');
  st.startYear = 2025; st.age = 0; const c2 = A.illTreatCost(st, { sev: 3 }, 4, 'hospital');
  w(`| ${c.name}（${c.ladder[0].title}） | ${f(s0)} | ${(c1 / s0).toFixed(1)} 年 | ${(c2 / s0).toFixed(1)} 年 |`);
});

/* 7 教育成本 */
w('\n\n## 7. 教育 / 成长阶段年支出（由家庭账簿承担，18 岁前个人不背债）\n');
w('| 阶段 | 年支出（人民币，1985 基准，未缩放） |');
w('|---|---|');
['婴儿', '小学生', '初中生', '高中生', '大学生', '待业', '无业', '退休'].forEach(j => {
  const v = A.JOBS[j]; if (v) w(`| ${j} | ${f(v.cost)}（收入 ${f(v.salary || 0)}） |`);
});
w('\n额外年支出：已婚 +' + f(12000000) + '；每个子女 +' + f(6000000) + '；离婚后每个子女抚养费 +' + f(3000000) + '；宠物 +' + f(1500000) + '\n');

/* 8 贷款 */
w('\n\n## 8. 贷款产品（额度 = 年收入 × mult × 征信系数；利率 = 当年基准利率 × rateK）\n');
w('| 产品 | 最低年龄 | 期限 | 利率系数 | 额度倍数 | 危险等级 | 附加条件 |');
w('|---|---|---|---|---|---|---|');
A.LOAN_PRODUCTS.forEach(p => w(`| ${p.name} | ${p.minAge} | ${p.years}年 | ×${p.rateK} | ×${p.mult} | ${p.danger} | ${p.need ? JSON.stringify(p.need) : (p.needJob ? p.needJob.join('/') : (p.needFlag ? '需房产' : (p.needEduStage ? '在校大学生' : '—')))} |`));
w('\n基准利率采样：' + YEARS.map(y => `${y}=${(A.rateAt(y) * 100).toFixed(1)}%`).join(' · '));

/* 9 投资机会 */
w('\n\n## 9. 一次性投资机会（INVESTMENTS）\n');
w('| 名称 | 投入 | 回报倍数基准 | 波动 | 周期 |');
w('|---|---|---|---|---|');
(A.INVESTMENTS || []).forEach(i => w(`| ${i.name} | ${f(i.amount || i.cost || 0)} | ×${i.base} | ±${(i.vol || 0).toFixed(2)} | ${i.years}年 |`));

/* 10 出身家底 */
w('\n\n## 10. 24 种出身的初始家底（1985 基准，实际按出生年 FIN_SCALE 缩放）\n');
w('| 出身 | 家庭资产 | 家庭负债 | 净值 |');
w('|---|---|---|---|');
A.FAMILIES.forEach(fam => {
  const fin = A.FAMILY_FIN[fam.id] || { assets: 30000000, debt: 30000000 };
  w(`| ${fam.name} | ${f(fin.assets)} | ${f(fin.debt)} | ${f(fin.assets - fin.debt)} |`);
});

/* 11 结局门槛 */
w('\n\n## 11. 结局判定门槛（按 ENDINGS 顺序，命中即停）\n');
w('| # | 结局 | 等级 | 条件摘要 |');
w('|---|---|---|---|');
const condSrc = fs.readFileSync(path.join(ROOT, 'assets', 'data.js'), 'utf8');
const blk = condSrc.slice(condSrc.indexOf('const ENDINGS'), condSrc.indexOf('/* ====', condSrc.indexOf('const ENDINGS')));
const parts = blk.split(/\{ id: '/).slice(1);
parts.forEach((p, i) => {
  const id = p.slice(0, p.indexOf("'"));
  const rank = (p.match(/rank: '([^']+)'/) || [])[1] || '';
  const title = (p.match(/title: '([^']+)'/) || [])[1] || '';
  const cond = (p.match(/cond: ([^\n]+)/) || [])[1] || '';
  w(`| ${i + 1} | ${title} | ${rank} | \`${cond.replace(/\s+/g, ' ')}\` |`);
});

fs.writeFileSync(path.join(OUT, 'static.md'), L.join('\n'), 'utf8');
console.log('written static.md', L.length, 'lines');
