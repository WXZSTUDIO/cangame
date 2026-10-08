/* A-08 调查 · 第六步：把「补习 → 大学 → 专业 → 职业 → 收入」整条链打通。
 * 只读。 */
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
    CAP.uni = st.edu ? st.edu.uni : null;
    CAP.major = st.edu ? st.edu.major : null;
    CAP.majorCat = run('majorCatOf')(st);
    CAP.stats = { INT: st.stats.INT, CHA: st.stats.CHA };
    CAP.edu = { eduLevel: st.edu ? st.edu.eduLevel : null, salaryK: st.edu ? st.edu.salaryK : null };
  }
  return origIncome(st);
};
const sim = makeSim(A, ctx, PERSONAS);

const N = 400;
const cells = {};
['steady', 'explorer'].forEach(pn => [0, 40].forEach(cap => { cells[pn + '@' + cap] = []; }));
for (let i = 0; i < N; i++) {
  for (const pn of ['steady', 'explorer']) {
    for (const cap of [0, 40]) {
      CAP = {};
      let r = null;
      try { r = sim.playOne(pn, PERSONAS[pn], { cramCap: cap }); } catch (e) { CAP = null; continue; }
      if (!r || CAP.income == null) { CAP = null; continue; }
      const c = CAP; CAP = null;
      c.gaokao = r.gaokao;
      cells[pn + '@' + cap].push(c);
    }
  }
}

const UNI = run(`(function(){ var o={}; UNIVERSITIES.forEach(function(u){ o[u.id]={name:u.name, salaryK:u.salaryK, majors:u.major||[], need:Math.round(u.minScore/100*700)}; }); return o; })()`);

say('# A-08 调查 · 第六步：完整因果链');
say('');
say('生成时间：' + new Date().toISOString());
say('每格 ' + N + ' 局。');
say('');

say('## 1. 大学录取线（高考满分 700）');
say('');
say('| 学校 | 录取线 | salaryK | 学历档 | 专业池 |');
say('|---|---:|---:|---:|---|');
Object.keys(UNI).forEach(k => {
  const u = UNI[k];
  say('| ' + u.name + ' | ' + u.need + ' | ' + u.salaryK + ' | — | ' + (u.majors.length ? u.majors.join('、') : '（无）') + ' |');
});
say('');
say('> 换算：`need = Math.round(minScore / 100 × 700)`（`school.js:264`）。'
  + '平时分是 **sqrt 曲线**（`academicBase`，`school.js:307`）：'
  + '`round(sqrt(raw/ceil) × academicPart)`，raw 越高边际转换效率越低。');
say('');

say('## 2. 两组的落点');
say('');
say('| 画像 | cap | 高考分中位 | 大学分布 | 专业大类 | 主落点职业 | 30岁收入(亿) |');
say('|---|---|---:|---|---|---|---:|');
['steady', 'explorer'].forEach(pn => [0, 40].forEach(cap => {
  const arr = cells[pn + '@' + cap];
  const um = {}, mm = {}, jm = {};
  arr.forEach(c => {
    um[c.uni] = (um[c.uni] || 0) + 1;
    mm[c.majorCat] = (mm[c.majorCat] || 0) + 1;
    const k = c.career ? c.career.id : '(无)';
    jm[k] = (jm[k] || 0) + 1;
  });
  const top = (m) => Object.keys(m).sort((a, b) => m[b] - m[a]).slice(0, 3)
    .map(k => k + ' ' + (m[k] / arr.length * 100).toFixed(0) + '%').join('、');
  say('| ' + pn + ' | ' + cap + ' | ' + (median(arr.map(c => c.gaokao).filter(x => x != null)) || 0) +
    ' | ' + top(um) + ' | ' + top(mm) + ' | ' + top(jm) + ' | ' +
    (median(arr.map(c => c.income)) / 1e8).toFixed(2) + ' |');
}));
say('');

say('## 3. 关键职业的入职门槛');
say('');
const GATES = run(`(function(){
  return ['ai','finance','programmer','ecom','clerk','hacker'].map(function(id){
    var c = CAREERS.find(function(x){ return x.id === id; });
    return { id: id, name: c.name, need: c.need||{}, major: c.major||null, edu: c.edu,
             sal0: c.ladder[0].sal, sal3: c.ladder[3] ? c.ladder[3].sal : null };
  });
})()`);
say('| 职业 | 属性门槛 | 专业对口 | 学历门槛 | 0 级年薪(亿) | 3 级年薪(亿) |');
say('|---|---|---|---|---:|---:|');
GATES.forEach(g => {
  say('| ' + g.name + ' (' + g.id + ') | ' +
    (Object.keys(g.need).length ? Object.keys(g.need).map(k => k + '≥' + g.need[k]).join('、') : '无') + ' | ' +
    (g.major ? g.major.join('/') : '不限') + ' | ' + g.edu + ' | ' +
    (g.sal0 / 1e8).toFixed(2) + ' | ' + (g.sal3 ? (g.sal3 / 1e8).toFixed(2) : '—') + ' |');
});
say('');

fs.writeFileSync(path.join(__dirname, 'a08-chain.out.txt'), lines.join('\n') + '\n', 'utf8');
say('[已写出] a08-chain.out.txt');
