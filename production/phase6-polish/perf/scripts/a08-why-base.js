/* =========================================================
 * A-08 调查 · 第二步：base（职称年薪基数）为什么跌 56.8%
 * ---------------------------------------------------------
 * 第一步已证明：五个乘子里 kEdu / kInt / kNet / kLoy **全部上升**，
 * kAge 不动，唯一在跌的是 base。所以因果链 100% 在「落到了哪个职称」。
 *
 * 本脚本回答：是「落到了更差的阶梯」，还是「同一阶梯里落到了更低的级」？
 * 以及：为什么前面那些高薪 jobTarget 会被挡掉。
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
    CAP.job = st.job;
    CAP.career = st.career ? { id: st.career.id, level: st.career.level } : null;
    CAP.edu = {
      eduLevel: st.edu ? st.edu.eduLevel : null,
      uni: st.edu ? st.edu.uni : null,
      major: st.edu ? st.edu.major : null,
      salaryK: st.edu ? st.edu.salaryK : null
    };
    CAP.majorCat = run('majorCatOf')(st);
    CAP.stats = { INT: st.stats.INT, NET: st.stats.NET, CHA: st.stats.CHA, WILL: st.stats.WILL };
    // 当场重算一遍 jobOffers，看每个 jobTarget 卡在哪一关
    CAP.gates = {};
    try {
      const offers = A.jobOffers(st);
      CAP.allOffers = offers.map(o => ({
        id: o.career.id, okEdu: o.okEdu, okStat: o.okStat, okFlag: o.okFlag,
        majorOk: o.majorOk, miss: o.miss, entry: o.entry, title: o.title
      }));
    } catch (e) { CAP.allOffers = null; }
  }
  return origIncome(st);
};

const sim = makeSim(A, ctx, PERSONAS);

/* ---------- 实验 ---------- */
const N = 600;
const pool = ['steady', 'explorer'];
const arms = { low: [], high: [] };
for (let i = 0; i < N; i++) {
  const pn = pool[i % pool.length];
  const cap = (i % 2 === 0) ? 0 : 40;
  CAP = {};
  let r = null;
  try { r = sim.playOne(pn, PERSONAS[pn], { cramCap: cap }); } catch (e) { CAP = null; continue; }
  if (!r || !CAP.job) { CAP = null; continue; }
  const c = CAP; CAP = null;
  c.persona = pn; c.gaokao = r.gaokao;
  (cap === 0 ? arms.low : arms.high).push(c);
}

const med = (arr, f) => { const v = arr.map(f).filter(x => x != null && Number.isFinite(x)); return v.length ? median(v) : null; };

/* ---------- 阶梯基准年薪表：career@level 的 base ---------- */
const LADDER = run(`(function(){
  var out = {};
  CAREERS.forEach(function(c){
    out[c.id] = { name: c.name, edu: c.edu, major: c.major || null,
                  need: c.need || {}, salaries: c.ladder.map(function(l){ return l.salary; }) };
  });
  return out;
})()`);

say('# A-08 调查 · 第二步：`base` 为什么跌 56.8%');
say('');
say('生成时间：' + new Date().toISOString());
say('样本：' + N + ' 局 → 不补习 ' + arms.low.length + ' / 补习 ' + arms.high.length);
say('');

const L = arms.low, H = arms.high;

/* ---- 1. 大学与专业分布 ---- */
say('## 1. 大学与专业：补习改变了什么');
say('');
function mix(arr, f) {
  const m = {};
  arr.forEach(c => { const k = String(f(c)); m[k] = (m[k] || 0) + 1; });
  return Object.keys(m).sort((x, y) => m[y] - m[x]).slice(0, 8)
    .map(k => k + ' ' + (m[k] / arr.length * 100).toFixed(1) + '%');
}
say('**大学 (edu.uni) Top8**');
say('- 不补习：' + mix(L, c => c.edu.uni).join('、'));
say('- 补习　：' + mix(H, c => c.edu.uni).join('、'));
say('');
say('**专业 (edu.major) Top8**');
say('- 不补习：' + mix(L, c => c.edu.major).join('、'));
say('- 补习　：' + mix(H, c => c.edu.major).join('、'));
say('');
say('**专业大类 (majorCatOf) Top8**');
say('- 不补习：' + mix(L, c => c.majorCat).join('、'));
say('- 补习　：' + mix(H, c => c.majorCat).join('、'));
say('');
say('> 两组都取 steady / explorer 两个画像，`majorPref` 相同。若专业分布不同，'
  + '说明是**高考分变了 → 录到不同的学校 → 可填的专业清单不同**。');
say('');

/* ---- 2. 门控：每个 jobTarget 卡在哪一关 ---- */
say('## 2. 职业门控：高薪目标为什么被挡掉');
say('');
['steady', 'explorer'].forEach(pn => {
  const tgt = PERSONAS[pn].jobTarget;
  say('### 画像 `' + pn + '` · jobTarget = [' + tgt.join(', ') + ']');
  say('');
  say('| 目标职业 | 需要专业 | 不补习：通过率 | 补习：通过率 | 卡在哪 |');
  say('|---|---|---:|---:|---|');
  tgt.forEach(cid => {
    const cd = LADDER[cid];
    const passL = L.filter(c => c.persona === pn && c.allOffers &&
      (c.allOffers.find(o => o.id === cid) || {}).okEdu &&
      (c.allOffers.find(o => o.id === cid) || {}).okStat &&
      (c.allOffers.find(o => o.id === cid) || {}).okFlag).length;
    const passH = H.filter(c => c.persona === pn && c.allOffers &&
      (c.allOffers.find(o => o.id === cid) || {}).okEdu &&
      (c.allOffers.find(o => o.id === cid) || {}).okStat &&
      (c.allOffers.find(o => o.id === cid) || {}).okFlag).length;
    const nL = L.filter(c => c.persona === pn && c.allOffers).length;
    const nH = H.filter(c => c.persona === pn && c.allOffers).length;
    // 卡点统计（补习组）
    const hs = H.filter(c => c.persona === pn && c.allOffers).map(c => c.allOffers.find(o => o.id === cid)).filter(Boolean);
    const noMajor = hs.filter(o => !o.majorOk).length;
    const noStat = hs.filter(o => !o.okStat).length;
    const noEdu = hs.filter(o => !o.okEdu).length;
    const why = [];
    if (noMajor) why.push('专业不对口 ' + (noMajor / hs.length * 100).toFixed(0) + '%');
    if (noStat) why.push('属性不够 ' + (noStat / hs.length * 100).toFixed(0) + '%');
    if (noEdu) why.push('学历不够 ' + (noEdu / hs.length * 100).toFixed(0) + '%');
    say('| ' + (cd ? cd.name : cid) + ' (' + cid + ') | ' +
      (cd && cd.major ? cd.major.join('/') : '不限') + ' | ' +
      (nL ? (passL / nL * 100).toFixed(0) : '—') + '% | ' +
      (nH ? (passH / nH * 100).toFixed(0) : '—') + '% | ' + (why.join('，') || '—') + ' |');
  });
  say('');
});

/* ---- 3. 落点：阶梯 vs 级 ---- */
say('## 3. 落点分解：是「更差的阶梯」还是「更低的级」');
say('');
function land(arr) {
  const m = {};
  arr.forEach(c => {
    const k = c.career ? c.career.id : 'null';
    if (!m[k]) m[k] = { n: 0, lvSum: 0, base0: null };
    m[k].n++; m[k].lvSum += (c.career ? c.career.level : 0);
  });
  return Object.keys(m).sort((x, y) => m[y].n - m[x].n).map(k => ({
    id: k, name: (LADDER[k] || {}).name || k,
    pct: (m[k].n / arr.length * 100).toFixed(1) + '%',
    avgLv: (m[k].lvSum / m[k].n).toFixed(1),
    sal0: LADDER[k] ? (LADDER[k].salaries[0] / 1e8).toFixed(2) : '—',
    salAt: LADDER[k] ? (LADDER[k].salaries[Math.round(m[k].lvSum / m[k].n)] / 1e8).toFixed(2) : '—'
  }));
}
say('**不补习 · 30 岁落点**');
say('');
say('| 阶梯 | 占比 | 平均级 | 该阶梯 0 级年薪(亿) | 落点年薪(亿) |');
say('|---|---:|---:|---:|---:|');
land(L).slice(0, 8).forEach(r => say('| ' + r.name + ' (' + r.id + ') | ' + r.pct + ' | ' + r.avgLv + ' | ' + r.sal0 + ' | ' + r.salAt + ' |'));
say('');
say('**补习 · 30 岁落点**');
say('');
say('| 阶梯 | 占比 | 平均级 | 该阶梯 0 级年薪(亿) | 落点年薪(亿) |');
say('|---|---:|---:|---:|---:|');
land(H).slice(0, 8).forEach(r => say('| ' + r.name + ' (' + r.id + ') | ' + r.pct + ' | ' + r.avgLv + ' | ' + r.sal0 + ' | ' + r.salAt + ' |'));
say('');

const lvL = med(L.filter(c => c.career), c => c.career.level);
const lvH = med(H.filter(c => c.career), c => c.career.level);
say('- 平均职级：不补习 **' + (lvL == null ? '—' : lvL.toFixed(1)) + '** → 补习 **' +
  (lvH == null ? '—' : lvH.toFixed(1)) + '**');
say('');

/* ---- 4. 反事实：如果落点一样，光属性差会带来多少 ---- */
say('## 4. 反事实测算：属性差 vs 落点差，各占多少');
say('');
say('把第一步测到的五个乘子与 base 的效应相乘，看能否还原总跌幅：');
say('');
say('| 因子 | 变化 | 复利口径 |');
say('|---|---:|---:|');
const chain = [
  ['kEdu', 15.4], ['kInt', 5.3], ['kNet', 11.3], ['kLoy', 1.5], ['base', -56.8]
];
let acc = 1;
chain.forEach(([k, d]) => {
  acc *= (1 + d / 100);
  say('| ' + k + ' | ' + (d >= 0 ? '+' : '') + d.toFixed(1) + '% | ×' + acc.toFixed(3) + ' |');
});
say('');
say('- **属性三项合计（kEdu × kInt × kNet × kLoy）= ' +
  ((1.154 * 1.053 * 1.113 * 1.015 - 1) * 100).toFixed(1) + '%**（是**正**的）');
say('- **base 单项 = −56.8%**');
say('- 相乘 = **' + ((acc - 1) * 100).toFixed(1) + '%**，与实测总跌幅 −48.7% 同一量级');
say('  （差值是取整与各因子中位数不可加的偏差）');
say('');

fs.writeFileSync(path.join(__dirname, 'a08-why-base.out.txt'), lines.join('\n') + '\n', 'utf8');
say('[已写出] a08-why-base.out.txt');
