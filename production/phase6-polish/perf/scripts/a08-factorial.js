/* =========================================================
 * A-08 调查 · 第三步（决定性）：2×2 因子实验
 * ---------------------------------------------------------
 * 命题：REG-11 的循环里
 *     const pn  = pool[i % pool.length];     // pool.length === 2
 *     const cap = (i % 2 === 0) ? 0 : 40;
 *   → i 为偶数：pn = pool[0] = 'steady'  , cap = 0
 *   → i 为奇数：pn = pool[1] = 'explorer', cap = 40
 *   **pn 与 cap 完全共线** ⇒ 所谓「补习组 vs 不补习组」实际上是
 *   **steady 画像 vs explorer 画像**，测到的是画像差，不是补习效应。
 *
 * 证伪方式：跑真正的 2×2（每画像 × 每 cap），看
 *   ① 主效应（同画像内 cramCap 0 vs 40）
 *   ② 画像效应（同 cap 内 steady vs explorer）
 * 谁才是收入差的来源。
 * ========================================================= */
const path = require('path');
const fs = require('fs');
const vm = require('vm');

const QA = path.resolve(__dirname, '..', '..', 'qa', 'scripts');
const { loadEngine, exportApi, PERSONAS, median, mean } = require(path.join(QA, 'reg-lib.js'));
const { makeSim } = require(path.join(QA, 'reg-sim.js'));

const lines = [];
const say = (s) => { lines.push(s); console.log(s); };

const { ctx } = loadEngine();
const A = exportApi(ctx);
const run = (src) => vm.runInContext(src, ctx);

/* ---------- 探针 ---------- */
let CAP = null;
const origIncome = A.careerIncome;
A.careerIncome = function (st) {
  if (st && st.age === 30 && CAP) {
    CAP.income = origIncome(st);
    CAP.parts = run('(function(s){ return careerIncomeParts(s); })')(st);
    CAP.job = st.job;
    CAP.career = st.career ? { id: st.career.id, level: st.career.level } : null;
    CAP.stats = {
      INT: st.stats.INT, NET: st.stats.NET, LOY: st.stats.LOY,
      CHA: st.stats.CHA, HP: st.stats.HP, STRESS: st.stats.STRESS
    };
    CAP.edu = {
      eduLevel: st.edu ? st.edu.eduLevel : null,
      salaryK: st.edu ? st.edu.salaryK : null,
      uni: st.edu ? st.edu.uni : null, major: st.edu ? st.edu.major : null
    };
  }
  return origIncome(st);
};
const sim = makeSim(A, ctx, PERSONAS);

/* ---------- 画像差异（静态，先摆出来） ---------- */
const lines0 = [];
['steady', 'explorer'].forEach(k => {
  const p = PERSONAS[k];
  lines0.push('- `' + k + '`（' + p.cn + '）：jobTarget = [' + (p.jobTarget.length ? p.jobTarget.join(',') : '**空**') +
    ']，social = **' + p.social + '**，market = ' + p.market + '，cram = ' + p.cram);
});

/* ---------- 2×2 实验 ---------- */
const N = 400;                       // 每格 400 局
const PERSONA = ['steady', 'explorer'];
const CAPS = [0, 40];
const cells = {};
PERSONA.forEach(pn => CAPS.forEach(cap => { cells[pn + '@' + cap] = []; }));

for (let i = 0; i < N; i++) {
  for (const pn of PERSONA) {
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
const pctd = (a, b) => (a == null || b == null || a === 0) ? '—' : ((b - a) / a * 100 >= 0 ? '+' : '') + ((b - a) / a * 100).toFixed(1) + '%';

say('# A-08 调查 · 第三步：2×2 因子实验（决定性）');
say('');
say('生成时间：' + new Date().toISOString());
say('每格 ' + N + ' 局，共 ' + (N * 4) + ' 局。四个格子用**同一个随机序列**推进，' +
  '唯一差异是画像与 `cramCap`。');
say('');

say('## 1. 先摆事实：两个画像差在哪');
say('');
lines0.forEach(l => say(l));
say('');
say('`jobTarget` 为空 ⇒ `doPlayerActions` 里 `p.jobTarget && p.jobTarget.length` 为假 ⇒ '
  + '**从不主动应聘**，职业全靠事件系统派发。');
say('`social: \'full\'` ⇒ 每年调 `doUniActivity()` + `classmateAct()`，`classmateAct` 每次 +2 NET。');
say('`social: \'moderate\'` ⇒ 这两个都**一次都不调**。');
say('');

say('## 2. 四格实测（30 岁中位）');
say('');
say('| 画像 | cramCap | 局数 | studyAt18 | 高考分 | 30 岁收入 | 职业 |');
say('|---|---|---:|---:|---:|---:|---|');
PERSONA.forEach(pn => CAPS.forEach(cap => {
  const arr = cells[pn + '@' + cap];
  const top = {};
  arr.forEach(c => { const k = c.career ? c.career.id : '(无)'; top[k] = (top[k] || 0) + 1; });
  const top1 = Object.keys(top).sort((a, b) => top[b] - top[a])[0];
  say('| ' + pn + ' | ' + cap + ' | ' + arr.length + ' | ' +
    (med(arr, c => c.studyAt18) == null ? '—' : Math.round(med(arr, c => c.studyAt18))) + ' | ' +
    (med(arr, c => c.gaokao) == null ? '—' : Math.round(med(arr, c => c.gaokao))) + ' | ' +
    (med(arr, c => c.income) == null ? '—' : yi(med(arr, c => c.income)) + ' 亿') + ' | ' +
    (top1 || '—') + ' |');
}));
say('');

say('## 3. 主效应 vs 画像效应');
say('');
say('| 对比 | 口径 | 收入变化 |');
say('|---|---|---:|');
PERSONA.forEach(pn => {
  const a = med(cells[pn + '@0'], c => c.income), b = med(cells[pn + '@40'], c => c.income);
  say('| **同画像内** `cramCap 0 → 40`（`' + pn + '`） | 真正的补习效应 | ' + pctd(a, b) + ' |');
});
CAPS.forEach(cap => {
  const a = med(cells['steady@' + cap], c => c.income), b = med(cells['explorer@' + cap], c => c.income);
  say('| **同 cap 内** `steady → explorer`（cap=' + cap + '） | 画像效应 | ' + pctd(a, b) + ' |');
});
say('| **原 REG-11 口径**（steady@0 vs explorer@40） | 画像+补习混在一起 | ' +
  pctd(med(cells['steady@0'], c => c.income), med(cells['explorer@40'], c => c.income)) + ' |');
say('');

say('## 4. 属性：NET 到底是谁拉动的');
say('');
say('| 画像 | cramCap | NET 中位 | CHA 中位 | INT 中位 | STRESS 中位 |');
say('|---|---|---:|---:|---:|---:|');
PERSONA.forEach(pn => CAPS.forEach(cap => {
  const arr = cells[pn + '@' + cap];
  say('| ' + pn + ' | ' + cap + ' | ' +
    f2(med(arr, c => c.stats.NET)) + ' | ' + f2(med(arr, c => c.stats.CHA)) + ' | ' +
    f2(med(arr, c => c.stats.INT)) + ' | ' + f2(med(arr, c => c.stats.STRESS)) + ' |');
}));
function f2(x) { return x == null ? '—' : x.toFixed(1); }
say('');
say('**关键**：`cramSchool()` 的效应是 `{INT: +2~4, HP: -3, STRESS: +5, GROW: +2}` —— '
  + '**完全不含 NET**。`school.js:479` 原文可查。');
say('所以 NET 的任何差异都不可能来自补习，只能来自 `social` 画像开关。');
say('');

say('## 5. base 分解：职业落点');
say('');
say('| 画像 | cramCap | base 中位(亿) | 有 career 比例 | 主落点 |');
say('|---|---|---:|---:|---|');
PERSONA.forEach(pn => CAPS.forEach(cap => {
  const arr = cells[pn + '@' + cap];
  const top = {};
  arr.forEach(c => { const k = c.career ? c.career.id : '(无)'; top[k] = (top[k] || 0) + 1; });
  const top1 = Object.keys(top).sort((a, b) => top[b] - top[a]).slice(0, 2)
    .map(k => k + ' ' + (top[k] / arr.length * 100).toFixed(0) + '%').join('、');
  say('| ' + pn + ' | ' + cap + ' | ' + (med(arr, c => c.parts.base) == null ? '—' : yi(med(arr, c => c.parts.base))) + ' | ' +
    (arr.filter(c => c.career).length / arr.length * 100).toFixed(0) + '% | ' + top1 + ' |');
}));
say('');

fs.writeFileSync(path.join(__dirname, 'a08-factorial.out.txt'), lines.join('\n') + '\n', 'utf8');
say('[已写出] a08-factorial.out.txt');
