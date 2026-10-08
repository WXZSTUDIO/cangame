/* 分数曲线标定探针 v2：用「完整人生」采样（会解析事件，属性会真长起来），
   再在若干参数组合下看 随机作答 / 认真作答 / 全对 三种玩家的录取分布 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const ctx = { console, Math, JSON, Date, isNaN, parseInt, parseFloat, Number, String, Array, Object };
vm.createContext(ctx);
['assets/data.js', 'assets/market.js', 'assets/engine.js', 'assets/school.js', 'assets/career.js', 'assets/love.js', 'assets/pet.js', 'assets/legacy.js', 'assets/loan.js']
  .forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));
const A = vm.runInContext(`({
  createGame, step, midExamScore, gaoExamScore, HIGH_SCHOOLS, UNIVERSITIES,
  FAMILIES, answerExamQ, resolveExam, resolveEvent, eventChoices, resolveInvest
})`, ctx);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const plans = [
  ['G 选定 20% sqrt ceil92/100', 0.20, 92, 100, 'sqrt'],
  ['B 20% sqrt ceil96/104', 0.20, 96, 104, 'sqrt'],
  ['C 25% sqrt ceil96/104', 0.25, 96, 104, 'sqrt'],
  ['D 20% 线性 ceil88/96', 0.20, 88, 96, 'linear'],
  ['E 15% sqrt ceil88/96', 0.15, 88, 96, 'sqrt'],
  ['F 20% sqrt ceil104/112', 0.20, 104, 112, 'sqrt']
];

function parts(full, w) {
  const perQ = Math.round(full * w / 5);
  const quizFull = perQ * 5;
  return { perQ, quizFull, aca: full - quizFull };
}
function scoreOf(raw, full, w, ceil, curve, hit) {
  const p = parts(full, w);
  let t = clamp(raw / ceil, 0, 1);
  if (curve === 'sqrt') t = Math.sqrt(t);
  return clamp(Math.round(t * p.aca) + Math.round(p.quizFull * hit), 0, full);
}
const pickTop = (list, score, full) => {
  const ok = list.filter(x => score >= Math.round(x.minScore / 100 * full));
  return ok.length ? ok[0].name : '（没有学校可去）';
};

/* ---------- 采样：完整人生，随机做选择（与 v5-test 一致的行为） ---------- */
const samples = [];
const famIds = A.FAMILIES.map(f => f.id);

function handle(s, item, collect) {
  if (!item) return;
  if (item.type === 'exam') {
    const k = item.exam.kind;
    const raw = k === 'mid' ? A.midExamScore(s) : A.gaoExamScore(s);
    collect[k === 'mid' ? 'midRaw' : 'gaoRaw'] = raw;
    s.pending = item;
    while (item.exam.quiz && !item.exam.quiz.done) A.answerExamQ(s, item.exam.quiz.qs[item.exam.quiz.i].a);
    const n = (item.exam.options || []).length;
    if (n) { s.pending = item; A.resolveExam(s, Math.floor(Math.random() * n)); }
    s.pending = null;
  } else if (item.type === 'event' && item.ev) {
    const list = A.eventChoices(s, item.ev);
    A.resolveEvent(s, item.ev, list && list.length ? Math.floor(Math.random() * list.length) : -1);
  } else if (item.type === 'invest' && item.choices) {
    const opts = item.choices.filter(c => !c.disabled && c.act === 'invest');
    if (opts.length) A.resolveInvest(s, opts[0]);
  }
}

for (let i = 0; i < 260; i++) {
  const s = A.createGame({
    name: 'T', gender: Math.random() < 0.5 ? 'M' : 'F',
    familyId: famIds[Math.floor(Math.random() * famIds.length)],
    priority: 'balance', talents: []
  });
  s.startYear = 1960 + Math.floor(Math.random() * 45);
  const rec = {};
  let guard = 0;
  while (s.age < 19 && guard++ < 80) {
    handle(s, A.step(s), rec);
    let inner = 0;
    while (s.queue && s.queue.length && !s.finished && s.age < 19 && inner++ < 40) {
      handle(s, s.queue.shift(), rec);
    }
  }
  if (rec.midRaw != null && rec.gaoRaw != null) samples.push(rec);
}

const q = (arr, p) => { const a = arr.slice().sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(a.length * p))]; };
const midR = samples.map(s => s.midRaw), gaoR = samples.map(s => s.gaoRaw);
console.log(`有效样本 ${samples.length}`);
console.log(`中考平时分 raw：中位 ${q(midR, .5)} / p25 ${q(midR, .25)} / p75 ${q(midR, .75)} / p95 ${q(midR, .95)} / max ${Math.max(...midR)}`);
console.log(`高考平时分 raw：中位 ${q(gaoR, .5)} / p25 ${q(gaoR, .25)} / p75 ${q(gaoR, .75)} / p95 ${q(gaoR, .95)} / max ${Math.max(...gaoR)}`);

plans.forEach(([name, w, ceilM, ceilG, curve]) => {
  console.log(`\n---- ${name} ----`);
  [['随机作答 25%', 0.25], ['认真作答 80%', 0.8], ['全对 100%', 1]].forEach(([tag, hit]) => {
    const h = {}, u = {};
    samples.forEach(s => {
      const hsk = pickTop(A.HIGH_SCHOOLS, scoreOf(s.midRaw, 400, w, ceilM, curve, hit), 400);
      h[hsk] = (h[hsk] || 0) + 1;
      const univ = pickTop(A.UNIVERSITIES, scoreOf(s.gaoRaw, 700, w, ceilG, curve, hit), 700);
      u[univ] = (u[univ] || 0) + 1;
    });
    const fmt = (o) => Object.keys(o).sort((a, b) => o[b] - o[a]).map(k => `${k} ${Math.round(o[k] / samples.length * 100)}%`).join(' | ');
    console.log(` [${tag}] 高中：${fmt(h)}`);
    console.log(`            大学：${fmt(u)}`);
  });
});
