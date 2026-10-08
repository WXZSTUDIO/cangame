/* =========================================================
 * A-08 交叉核对 · 只读 · 严守真（quality-lead）
 * ---------------------------------------------------------
 * 背景：我的 REG-11 读出「30 岁收入比 0.36~0.61（补习有害）」，
 *       工程负责人的 a08-cram-investigation.md 读出「补习主效应 +25%（补习有益）」。
 *       两份结论不能同时成立，主理人要求逐项对照并判断差异性质。
 *
 * 本脚本不修改任何游戏代码，只做三件事：
 *   ① 正交 2×2（画像 × 补习）复现他的设计，用我自己的 harness（reg-lib + reg-sim）；
 *   ② 年龄扫描：把收入观测点从 30 岁摊到 22/25/30/35/40/50/60，检验「观测年龄」假说；
 *   ③ 资金挤占：比较 18 岁净资产，检验「cramCap=40 有现金流出 → 家底差异」假说。
 *
 * 用法： node a08-crosscheck.js --per=200       （每格 200 局，共 800 局）
 * ========================================================= */
const path = require('path');
const fs = require('fs');
const { loadEngine, exportApi, PERSONAS, median, fmtNum } = require('./reg-lib.js');
const { makeSim } = require('./reg-sim.js');

const { ctx } = loadEngine();
const A = exportApi(ctx);
const sim = makeSim(A, ctx, PERSONAS);

const PER = parseInt((process.argv.slice(2).find(s => s.startsWith('--per=')) || '--per=200').split('=')[1], 10);
const AGES = [22, 25, 30, 35, 40, 50, 60];
const POOL = ['steady', 'explorer'];
const CAPS = [0, 40];

const OUT = path.join(__dirname, 'out');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const cells = {};
const K = (pn, cap) => pn + '|' + cap;

for (const pn of POOL) {
  for (const cap of CAPS) {
    const arr = [];
    for (let i = 0; i < PER; i++) {
      let r = null;
      try { r = sim.playOne(pn, PERSONAS[pn], { cramCap: cap }); } catch (e) { continue; }
      if (r) arr.push(r);
    }
    cells[K(pn, cap)] = arr;
  }
}

const vals = (arr, f) => arr.map(f).filter(x => x != null && Number.isFinite(x));
const med = (arr, f) => { const v = vals(arr, f); return v.length ? median(v) : null; };
const incAt = (arr, age) => med(arr, r => (r.salaries || {})[age]);
const ratio = (a, b) => (a != null && b != null && a > 0) ? (b / a) : null;
const pct = x => (x == null) ? '—' : ((x - 1) * 100).toFixed(1) + '%';

const lines = [];
const P = s => { lines.push(s); console.log(s); };

P('================ A-08 交叉核对 ================');
P('每格 ' + PER + ' 局 × ' + POOL.length + ' 画像 × ' + CAPS.length + ' 剂量 = ' + (PER * POOL.length * CAPS.length) + ' 局');
P('');

/* ---------- ① 2×2 单元格 ---------- */
P('【① 正交 2×2 单元格】');
P('画像      剂量  studyAt18  高考   学历档  30岁收入      18岁净资产    终局净资产');
for (const pn of POOL) {
  for (const cap of CAPS) {
    const c = cells[K(pn, cap)];
    const s = med(c, r => r.studyAt18 || 0);
    const g = med(c, r => (r.gaokao != null ? r.gaokao : null));
    const e = med(c, r => (r.eduLevel != null ? r.eduLevel : null));
    const i = incAt(c, 30);
    const n18 = med(c, r => r.netAt18);
    const nf = med(c, r => r.finalNet);
    P(pad(pn, 9) + pad(String(cap), 5) + pad(s == null ? '—' : s.toFixed(0), 10) +
      pad(g == null ? '—' : g.toFixed(0), 7) + pad(e == null ? '—' : e.toFixed(1), 8) +
      pad(i == null ? '—' : fmtNum(i), 14) + pad(n18 == null ? '—' : fmtNum(n18), 14) +
      pad(nf == null ? '—' : fmtNum(nf), 14));
  }
}
P('');

/* ---------- ② 年龄扫描：画像内补习效应 ---------- */
P('【② 补习主效应（画像内 cap 0 → 40）· 按观测年龄】');
P('年龄   steady 比   explorer 比   判定');
for (const age of AGES) {
  const rs = ratio(incAt(cells[K('steady', 0)], age), incAt(cells[K('steady', 40)], age));
  const re = ratio(incAt(cells[K('explorer', 0)], age), incAt(cells[K('explorer', 40)], age));
  let verdict = '';
  if (rs != null && re != null) {
    if (rs >= 1 && re >= 1) verdict = '两臂同向为正 → 补习有益';
    else if (rs < 1 && re < 1) verdict = '两臂同向为负 → 补习有害';
    else verdict = '⚠️ 两臂反向 → 存在交互作用';
  }
  P(pad(String(age), 6) + pad(rs == null ? '—' : rs.toFixed(3) + '× (' + pct(rs) + ')', 13) +
    pad(re == null ? '—' : re.toFixed(3) + '× (' + pct(re) + ')', 15) + verdict);
}
P('');

/* ---------- ③ 年龄扫描：画像效应 ---------- */
P('【③ 画像效应（同剂量内 steady → explorer）· 按观测年龄】');
P('年龄   cap=0 比     cap=40 比');
for (const age of AGES) {
  const r0 = ratio(incAt(cells[K('steady', 0)], age), incAt(cells[K('explorer', 0)], age));
  const r40 = ratio(incAt(cells[K('steady', 40)], age), incAt(cells[K('explorer', 40)], age));
  P(pad(String(age), 6) + pad(r0 == null ? '—' : r0.toFixed(3) + '× (' + pct(r0) + ')', 13) +
    pad(r40 == null ? '—' : r40.toFixed(3) + '× (' + pct(r40) + ')', 13));
}
P('');

/* ---------- ④ REG-11 实际口径（steady@0 vs explorer@40） ---------- */
P('【④ REG-11 的实际口径（steady@0 vs explorer@40）· 按观测年龄】');
P('（REG-11 循环里 pn = pool[i%2] 与 cap = (i%2===0)?0:40 共线，所以这就是 REG-11 真正在比的东西）');
for (const age of AGES) {
  const r = ratio(incAt(cells[K('steady', 0)], age), incAt(cells[K('explorer', 40)], age));
  P(pad(String(age), 6) + (r == null ? '—' : r.toFixed(3) + '× (' + pct(r) + ')'));
}
P('');

/* ---------- ⑤ 交叉验证：两效应相乘能否还原 REG-11 口径 ---------- */
P('【⑤ 交叉验证 · 30 岁】');
const rs30 = ratio(incAt(cells[K('steady', 0)], 30), incAt(cells[K('steady', 40)], 30));
const re30 = ratio(incAt(cells[K('explorer', 0)], 30), incAt(cells[K('explorer', 40)], 30));
const pe0 = ratio(incAt(cells[K('steady', 0)], 30), incAt(cells[K('explorer', 0)], 30));
const pe40 = ratio(incAt(cells[K('steady', 40)], 30), incAt(cells[K('explorer', 40)], 30));
const conf = ratio(incAt(cells[K('steady', 0)], 30), incAt(cells[K('explorer', 40)], 30));
const prod = (rs30 != null && pe40 != null) ? rs30 * pe40 : null;
P('  补习主效应（steady 臂）   ' + pct(rs30));
P('  补习主效应（explorer 臂） ' + pct(re30));
P('  画像效应（cap=0）         ' + pct(pe0));
P('  画像效应（cap=40）        ' + pct(pe40));
P('  相乘（补习 × 画像）       ' + (prod == null ? '—' : prod.toFixed(4) + '× (' + pct(prod) + ')'));
P('  REG-11 口径实测           ' + (conf == null ? '—' : conf.toFixed(4) + '× (' + pct(conf) + ')'));
P('  两者之差                  ' + ((prod != null && conf != null) ? (Math.abs(prod - conf)).toFixed(4) + '（越小说明归因越完整）' : '—'));
P('');

/* ---------- ⑥ 资金挤占检验 ---------- */
P('【⑥ 资金挤占检验 · 18 岁净资产（补习若有现金流出，这里会掉）】');
for (const pn of POOL) {
  const a = med(cells[K(pn, 0)], r => r.netAt18);
  const b = med(cells[K(pn, 40)], r => r.netAt18);
  P('  ' + pad(pn, 9) + 'cap=0 ' + pad(a == null ? '—' : fmtNum(a), 14) +
    'cap=40 ' + pad(b == null ? '—' : fmtNum(b), 14) +
    '比值 ' + (ratio(a, b) == null ? '—' : ratio(a, b).toFixed(3) + '×'));
}
P('  源码依据：cramSchool() 的 applyEffects 只有 INT/HP/STRESS/GROW，无 MONEY 项；reg-sim 里也没有扣钱。');
P('');

/* ---------- ⑦ REG-11 当前代码的共线性实证 ---------- */
P('【⑦ REG-11 当前取样循环的共线性（代码级）】');
P('  regression-run.js:370-372');
P('    const pn  = pool[i % pool.length];        // pool.length === 2  → pn = pool[i%2]');
P('    const cap = (i % 2 === 0) ? 0 : 40;       // 同一个 i%2');
P('  ⇒ i 偶 → (steady, 0)；i 奇 → (explorer, 40)。pn 与 cap 严格一一对应，自由度 = 0。');
P('');

fs.writeFileSync(path.join(OUT, 'a08-crosscheck.txt'), lines.join('\n'), 'utf8');
console.log('\n已写出 out/a08-crosscheck.txt');

function pad(s, n) { s = String(s); while (s.length < n) s += ' '; return s; }
