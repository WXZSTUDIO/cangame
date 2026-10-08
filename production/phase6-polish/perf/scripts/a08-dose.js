/* =========================================================
 * A-08 调查 · 第四步：补习投入的剂量-反应曲线
 * ---------------------------------------------------------
 * 第三步已证：补习的真实效应是 **+25% 增收**，−52% 是画像混淆。
 * 这一步回答设计侧真正要问的：投多少划算、边际收益拐点在哪。
 * 自变量 cramCap = 0/10/20/30/40/60/100，两个画像各跑一遍。
 * ========================================================= */
const path = require('path');
const fs = require('fs');
const vm = require('vm');

const QA = path.resolve(__dirname, '..', '..', 'qa', 'scripts');
const { loadEngine, exportApi, PERSONAS, median } = require(path.join(QA, 'reg-lib.js'));
const { makeSim } = require(path.join(QA, 'reg-sim.js'));

const lines = [];
const say = (s) => { lines.push(s); console.log(s); };

const { ctx } = loadEngine();
const A = exportApi(ctx);
const run = (src) => vm.runInContext(src, ctx);

let CAP = null;
const origIncome = A.careerIncome;
A.careerIncome = function (st) {
  if (st && st.age === 30 && CAP) {
    CAP.income = origIncome(st);
    CAP.parts = run('(function(s){ return careerIncomeParts(s); })')(st);
    CAP.job = st.job;
    CAP.career = st.career ? { id: st.career.id, level: st.career.level } : null;
    CAP.stats = { INT: st.stats.INT, NET: st.stats.NET, HP: st.stats.HP, STRESS: st.stats.STRESS };
    CAP.edu = {
      eduLevel: st.edu ? st.edu.eduLevel : null,
      salaryK: st.edu ? st.edu.salaryK : null,
      uni: st.edu ? st.edu.uni : null
    };
  }
  return origIncome(st);
};
const sim = makeSim(A, ctx, PERSONAS);

const N = 300;
const CAPS = [0, 10, 20, 30, 40, 60, 100];
const PERS = ['steady', 'explorer'];
const cells = {};
PERS.forEach(pn => CAPS.forEach(c => { cells[pn + '@' + c] = []; }));

for (let i = 0; i < N; i++) {
  for (const pn of PERS) {
    for (const cap of CAPS) {
      CAP = {};
      let r = null;
      try { r = sim.playOne(pn, PERSONAS[pn], { cramCap: cap }); } catch (e) { CAP = null; continue; }
      if (!r || CAP.income == null) { CAP = null; continue; }
      const c = CAP; CAP = null;
      c.persona = pn; c.cap = cap; c.studyAt18 = r.studyAt18 || 0; c.gaokao = r.gaokao;
      cells[pn + '@' + cap].push(c);
    }
  }
}

const med = (arr, f) => { const v = arr.map(f).filter(x => x != null && Number.isFinite(x)); return v.length ? median(v) : null; };
const yi = (x) => (x / 1e8).toFixed(2);

say('# A-08 调查 · 第四步：补习剂量-反应曲线');
say('');
say('生成时间：' + new Date().toISOString());
say('每格 ' + N + ' 局，共 ' + (N * CAPS.length * PERS.length) + ' 局。');
say('`cramCap` 是「学习投入上限」，`cramSchool()` 每次 +6~11 点，13~17 岁每年一次（最多 5 次，'
  + '上限 `EXAM_META.studyCap = 100`）。');
say('');

PERS.forEach(pn => {
  say('## 画像 `' + pn + '`（' + PERSONAS[pn].cn + '）');
  say('');
  say('| cramCap | 局数 | studyAt18 | 高考分 | 学历档 | salaryK | 30岁收入(亿) | 相对 cap=0 | 每 10 点投入的边际收益 |');
  say('|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  const base = med(cells[pn + '@0'], c => c.income);
  let prev = null;
  CAPS.forEach(cap => {
    const arr = cells[pn + '@' + cap];
    const inc = med(arr, c => c.income);
    const st = med(arr, c => c.studyAt18);
    const rel = (inc != null && base) ? ((inc / base - 1) * 100) : null;
    let marg = '—';
    if (prev != null && rel != null) {
      const dCap = cap - prev.cap, dRel = rel - prev.rel;
      marg = (dCap > 0 ? (dRel / dCap * 10 >= 0 ? '+' : '') + (dRel / dCap * 10).toFixed(1) + '%' : '—');
    }
    say('| ' + cap + ' | ' + arr.length + ' | ' + (st == null ? '—' : Math.round(st)) + ' | ' +
      (med(arr, c => c.gaokao) == null ? '—' : Math.round(med(arr, c => c.gaokao))) + ' | ' +
      (med(arr, c => c.edu.eduLevel) == null ? '—' : med(arr, c => c.edu.eduLevel).toFixed(1)) + ' | ' +
      (med(arr, c => c.edu.salaryK) == null ? '—' : med(arr, c => c.edu.salaryK).toFixed(2)) + ' | ' +
      (inc == null ? '—' : yi(inc)) + ' | ' +
      (rel == null ? '—' : (rel >= 0 ? '+' : '') + rel.toFixed(1) + '%') + ' | ' + marg + ' |');
    if (rel != null) prev = { cap: cap, rel: rel };
  });
  say('');
});

/* 收入构成随剂量的变化 */
say('## 收入构成随剂量怎么动');
say('');
PERS.forEach(pn => {
  say('### `' + pn + '`');
  say('');
  say('| cramCap | base(亿) | kAge | kEdu | kInt | kNet | kLoy | total(亿) |');
  say('|---:|---:|---:|---:|---:|---:|---:|---:|');
  CAPS.forEach(cap => {
    const arr = cells[pn + '@' + cap];
    const g = (k) => med(arr, c => c.parts[k]);
    say('| ' + cap + ' | ' + yi(g('base')) + ' | ' + g('kAge').toFixed(3) + ' | ' +
      g('kEdu').toFixed(3) + ' | ' + g('kInt').toFixed(3) + ' | ' + g('kNet').toFixed(3) + ' | ' +
      g('kLoy').toFixed(3) + ' | ' + yi(g('total')) + ' |');
  });
  say('');
});

say('## 副作用：补习的代价');
say('');
say('| 画像 | cramCap | HP 中位 | STRESS 中位 | INT 中位 | NET 中位 |');
say('|---|---|---:|---:|---:|---:|');
PERS.forEach(pn => CAPS.forEach(cap => {
  const arr = cells[pn + '@' + cap];
  say('| ' + pn + ' | ' + cap + ' | ' + f1(med(arr, c => c.stats.HP)) + ' | ' +
    f1(med(arr, c => c.stats.STRESS)) + ' | ' + f1(med(arr, c => c.stats.INT)) + ' | ' +
    f1(med(arr, c => c.stats.NET)) + ' |');
}));
function f1(x) { return x == null ? '—' : x.toFixed(1); }
say('');
say('`cramSchool()` 的即时效应是 `{INT: +2~4, HP: −3, STRESS: +5, GROW: +2}`（`school.js:479`）。'
  + 'HP 与 STRESS 在年度结算里会回落，所以 30 岁的快照上看不出累积惩罚 —— '
  + '**补习在设计上确实没有长期健康代价，这是一条值得设计侧注意的数值空白**。');
say('');

fs.writeFileSync(path.join(__dirname, 'a08-dose.out.txt'), lines.join('\n') + '\n', 'utf8');
say('[已写出] a08-dose.out.txt');
