/* =========================================================
 * A-08 调查 · 补习为什么让 30 岁收入腰斩
 * ---------------------------------------------------------
 * 只读调查：复用 quality-lead 的实验装置（reg-lib / reg-sim），
 * 只在 careerIncome() 上挂一个探针，把 age===30 那一瞬间的
 * **整条收入公式**拆开读出来。
 *
 * careerIncome = base(salary) × kAge × kEdu × kInt × kNet × kLoy
 * 五个乘子哪个动了、动了多少，直接决定因果链在哪一环。
 * ========================================================= */
const path = require('path');
const fs = require('fs');

const QA = path.resolve(__dirname, '..', '..', 'qa', 'scripts');
const { loadEngine, exportApi, PERSONAS, median, mean } = require(path.join(QA, 'reg-lib.js'));
const { makeSim } = require(path.join(QA, 'reg-sim.js'));

const lines = [];
const say = (s) => { lines.push(s); console.log(s); };

/* ---------- 引擎 ---------- */
const { ctx } = loadEngine();
const A = exportApi(ctx);

/* ---------- 探针：抓住 age===30 那一刻的完整收入构成 ---------- */
let CAPTURE = null;
const origIncome = A.careerIncome;
A.careerIncome = function (st) {
  if (st && st.age === 30 && CAPTURE) {
    let parts = null;
    try { parts = ctx.eval ? null : null; } catch (e) { }
    // careerIncomeParts 在逻辑层里，通过 vm 上下文取
    const P = ctxRun('(function(s){ return careerIncomeParts(s); })');
    parts = P(st);
    CAPTURE.income = origIncome(st);
    CAPTURE.parts = parts;
    CAPTURE.stats = {
      INT: st.stats.INT, NET: st.stats.NET, LOY: st.stats.LOY,
      HP: st.stats.HP, STRESS: st.stats.STRESS, CHA: st.stats.CHA,
      MONEY: st.stats.MONEY, FAME: st.stats.FAME, WILL: st.stats.WILL
    };
    CAPTURE.edu = {
      eduLevel: st.edu ? st.edu.eduLevel : null,
      salaryK: st.edu ? st.edu.salaryK : null,
      uni: st.edu ? st.edu.uni : null,
      hs: st.edu ? st.edu.hs : null,
      gradAge: st.edu ? st.edu.gradAge : null,
      study: st.edu ? st.edu.study : null
    };
    CAPTURE.job = st.job;
    CAPTURE.career = st.career ? { id: st.career.id, level: st.career.level, years: st.career.years } : null;
    CAPTURE.netWorth = (typeof A.netWorth === 'function') ? A.netWorth(st) : null;
  }
  return origIncome(st);
};

function ctxRun(src) {
  // reg-lib 的 loadEngine 返回 { ctx }，用 vm.runInContext 取函数
  const vm = require('vm');
  return vm.runInContext(src, ctx);
}

const sim = makeSim(A, ctx, PERSONAS);

/* ---------- 实验：同画像、只改 cramCap ---------- */
const N = 600;
const pool = ['steady', 'explorer'];
const arms = { low: [], high: [] };

for (let i = 0; i < N; i++) {
  const pn = pool[i % pool.length];
  const cap = (i % 2 === 0) ? 0 : 40;          // 交替，避免先后漂移（与 REG-11 同设计）
  CAPTURE = {};
  let r = null;
  try { r = sim.playOne(pn, PERSONAS[pn], { cramCap: cap }); } catch (e) { CAPTURE = null; continue; }
  if (!r) { CAPTURE = null; continue; }
  if (!CAPTURE.parts) { CAPTURE = null; continue; }   // 没活到 30 岁
  const c = CAPTURE;
  CAPTURE = null;
  c.persona = pn;
  c.studyAt18 = r.studyAt18 || 0;
  c.gaokao = r.gaokao;
  (cap === 0 ? arms.low : arms.high).push(c);
}

/* ---------- 汇总 ---------- */
const med = (arr, f) => {
  const v = arr.map(f).filter(x => x != null && Number.isFinite(x));
  return v.length ? median(v) : null;
};
const meen = (arr, f) => {
  const v = arr.map(f).filter(x => x != null && Number.isFinite(x));
  return v.length ? mean(v) : null;
};

say('# A-08 调查 · 补习与 30 岁收入：因果链分解');
say('');
say('生成时间：' + new Date().toISOString());
say('装置：复用 `production/phase6-polish/qa/scripts/` 的 `reg-lib.js` + `reg-sim.js`，'
  + '与 REG-11 同设计（同画像 steady/explorer，仅 `cramCap` 0 vs 40 交替）。');
say('样本：' + N + ' 局 → 低投入 ' + arms.low.length + ' 局 / 高投入 ' + arms.high.length + ' 局');
say('探针：在 `careerIncome(st)` 上挂钩，抓住 `age===30` 那一刻的完整收入构成。');
say('');

const L = arms.low, H = arms.high;

say('## 1. 复现 quality-lead 的结论');
say('');
say('| 指标 | 不补习 (cramCap=0) | 补习到上限 (cramCap=40) | 变化 |');
say('|---|---:|---:|---:|');
const row = (name, f, fmt) => {
  const a = med(L, f), b = med(H, f);
  if (a == null || b == null) { say('| ' + name + ' | — | — | — |'); return; }
  const d = a === 0 ? null : (b - a) / a * 100;
  say('| ' + name + ' | ' + fmt(a) + ' | ' + fmt(b) + ' | ' +
    (d == null ? '—' : (d >= 0 ? '+' : '') + d.toFixed(1) + '%') + ' |');
};
const r0 = (x) => String(Math.round(x));
const r2 = (x) => x.toFixed(2);
const yi = (x) => (x / 1e8).toFixed(2) + ' 亿';

row('studyAt18 中位', c => c.studyAt18, r0);
row('高考分中位', c => c.gaokao, r0);
row('学历档中位 (eduLevel)', c => c.edu.eduLevel, r2);
row('**30 岁收入中位**', c => c.income, yi);
say('');

say('## 2. 收入公式逐项分解（这是判定因果链的关键）');
say('');
say('`careerIncome = base × kAge × kEdu × kInt × kNet × kLoy`');
say('');
say('| 因子 | 不补习 | 补习 | 变化 | 对总收入的贡献 |');
say('|---|---:|---:|---:|---:|');
const factors = [
  ['base（职称年薪基数）', c => c.parts.base],
  ['kAge（资历）', c => c.parts.kAge],
  ['kEdu（学历 salaryK）', c => c.parts.kEdu],
  ['kInt（智力）', c => c.parts.kInt],
  ['kNet（人脉）', c => c.parts.kNet],
  ['kLoy（忠诚）', c => c.parts.kLoy],
  ['**total（年薪）**', c => c.parts.total]
];
const ma = {}, mb = {};
factors.forEach(([name, f]) => {
  const a = med(L, f), b = med(H, f);
  ma[name] = a; mb[name] = b;
  if (a == null || b == null) { say('| ' + name + ' | — | — | — | — |'); return; }
  const d = (b - a) / a * 100;
  say('| ' + name + ' | ' + (name.indexOf('k') === 0 ? r2(a) : yi(a)) + ' | ' +
    (name.indexOf('k') === 0 ? r2(b) : yi(b)) + ' | ' +
    (d >= 0 ? '+' : '') + d.toFixed(1) + '% | ' +
    (Math.abs(d) >= 10 ? '**主导**' : (Math.abs(d) >= 3 ? '次要' : '可忽略')) + ' |');
});
say('');

say('## 3. 属性与职业状态');
say('');
say('| 项 | 不补习 | 补习 | 变化 |');
say('|---|---:|---:|---:|');
[['INT', c => c.stats.INT], ['NET', c => c.stats.NET], ['LOY', c => c.stats.LOY],
 ['HP', c => c.stats.HP], ['STRESS', c => c.stats.STRESS], ['CHA', c => c.stats.CHA],
 ['MONEY (亿)', c => c.stats.MONEY / 1e8]].forEach(([name, f]) => {
  const a = med(L, f), b = med(H, f);
  if (a == null || b == null) return;
  const d = a === 0 ? null : (b - a) / a * 100;
  say('| ' + name + ' | ' + r2(a) + ' | ' + r2(b) + ' | ' +
    (d == null ? '—' : (d >= 0 ? '+' : '') + d.toFixed(1) + '%') + ' |');
});
say('');

say('## 4. 学历与职业');
say('');
say('| 项 | 不补习 | 补习 |');
say('|---|---:|---:|');
[['eduLevel 中位', c => c.edu.eduLevel], ['salaryK 中位', c => c.edu.salaryK],
 ['gradAge 中位', c => c.edu.gradAge]].forEach(([name, f]) => {
  const a = med(L, f), b = med(H, f);
  say('| ' + name + ' | ' + (a == null ? '—' : r2(a)) + ' | ' + (b == null ? '—' : r2(b)) + ' |');
});
say('');

// 职业分布
function jobMix(arr) {
  const m = {};
  arr.forEach(c => {
    const k = c.career ? (c.career.id + '@' + c.career.level) : (c.job || 'null');
    m[k] = (m[k] || 0) + 1;
  });
  return Object.keys(m).sort((x, y) => m[y] - m[x]).slice(0, 8)
    .map(k => k + ' ' + (m[k] / arr.length * 100).toFixed(1) + '%');
}
say('**30 岁职业分布 Top8**');
say('');
say('- 不补习：' + jobMix(L).join('、'));
say('- 补习　：' + jobMix(H).join('、'));
say('');

// 无职业比例
const noCareer = (arr) => (arr.filter(c => !c.career).length / arr.length * 100).toFixed(1) + '%';
say('- `state.career === null` 的比例：不补习 **' + noCareer(L) + '** / 补习 **' + noCareer(H) + '**');
say('');

/* ---------- NET 敏感度曲线 ---------- */
say('## 5. NET 项敏感度：要让年薪掉 39%~52%，NET 得掉多少？');
say('');
const netL = med(L, c => c.stats.NET), netH = med(H, c => c.stats.NET);
say('`kNet = 1 + NET / 1000`（`CAREER_MULT.stats.NET = 1000`）。');
say('');
say('| NET | kNet | 相对 NET=' + Math.round(netL) + ' 的年薪变化 |');
say('|---:|---:|---:|');
if (netL != null) {
  const kNetL = 1 + netL / 1000;
  [netL, netL - 10, netL - 20, netL - 30, netL - 40, netL - 50, 0, -100, -200, -390].forEach(n => {
    const k = 1 + n / 1000;
    const d = (k / kNetL - 1) * 100;
    say('| ' + Math.round(n) + ' | ' + k.toFixed(3) + ' | ' + (d >= 0 ? '+' : '') + d.toFixed(1) + '% |');
  });
  say('');
  // 反解：要让年薪掉 target，NET 需要变化多少
  say('**反解**：`careerIncome` 里 NET 的权重只有 `1/(1000+NET)`。');
  [10, 20, 30, 39, 52].forEach(t => {
    // (1 + NET'/1000) / (1 + NET/1000) = 1 - t/100  →  NET' = (1-t/100)*(1000+NET) - 1000
    const need = (1 - t / 100) * (1000 + netL) - 1000;
    say('- 要让年薪掉 **' + t + '%**，NET 需从 ' + Math.round(netL) +
      ' 掉到 **' + Math.round(need) + '**（Δ = ' + Math.round(need - netL) + '）');
  });
  say('');
  say('- 实测 NET：不补习 **' + r2(netL) + '** → 补习 **' + r2(netH) + '**（Δ = ' +
    r2(netH - netL) + '）');
  const actualDrop = ((1 + netH / 1000) / (1 + netL / 1000) - 1) * 100;
  say('- 这个 ΔNET 让年薪变化 **' + actualDrop.toFixed(2) + '%**');
  say('');
}

fs.writeFileSync(path.join(__dirname, 'a08-cram-probe.out.txt'), lines.join('\n') + '\n', 'utf8');
say('[已写出] a08-cram-probe.out.txt');
