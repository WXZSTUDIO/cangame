/* v5.2 专项验证：考试满分 / 同学常驻 / 恋爱节奏 / 学工互斥 / 新出身新天赋 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const ctx = { console, Math, JSON, Date, isNaN, parseInt, parseFloat, Number, String, Array, Object };
vm.createContext(ctx);
['assets/data.js', 'assets/market.js', 'assets/engine.js', 'assets/school.js', 'assets/career.js', 'assets/love.js', 'assets/loan.js']
  .forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));

const A = vm.runInContext(`({
  TALENTS, FAMILIES, TALENT_IDS: TALENTS.map(t=>t.id),
  createGame, step, resolveExam, makeExamEvent, answerExamQ,
  schoolStageOf, stageCn, isEnrolled, dropOut, quitForSchool, enrolledText,
  classmateAct, loveInit, meetByMatchmaker, meetByChance, loveAct, propose, LOVE_META,
  jobOffers, applyJob, careerById, EXAM_META, HIGH_SCHOOLS, UNIVERSITIES
})`, ctx);

let fail = 0;
const ok = (cond, name, extra) => {
  if (cond) console.log('  ✓', name, extra == null ? '' : extra);
  else { console.log('  ✗', name, extra == null ? '' : extra); fail++; }
};

console.log('== 1. 数据完整性 ==');
ok(A.TALENTS.length === 124, '天赋总数 124', A.TALENTS.length);
ok(A.FAMILIES.length === 24, '出身总数 24', A.FAMILIES.length);
const dupTal = A.TALENT_IDS.filter((x, i) => A.TALENT_IDS.indexOf(x) !== i);
ok(dupTal.length === 0, '天赋 id 无重复', dupTal.join(','));
ok(A.TALENTS.every(t => typeof t.cost === 'number' && !!t.name && !!t.desc), '天赋字段完整');
ok(A.TALENTS.filter(t => t.cost < 0).length >= 15, '负面天赋够多', A.TALENTS.filter(t => t.cost < 0).length);

console.log('== 2. 每种出身都能开局 ==');
A.FAMILIES.forEach(f => {
  try {
    const s = A.createGame({ name: 'T', gender: 'M', familyId: f.id, priority: 'balance', talents: [] });
    const alive = !!s.stats && s.age === 0;
    if (!alive) { ok(false, '出身 ' + f.id); }
  } catch (e) { ok(false, '出身 ' + f.id + ' 抛错', e.message); }
});
ok(true, '全部出身开局通过');

console.log('== 3. 全部天赋可装配 ==');
let talErr = 0;
A.TALENTS.forEach(t => {
  try {
    const s = A.createGame({ name: 'T', gender: 'F', familyId: 'jiaoshi', priority: 'balance', talents: [t.id] });
    if (s.talents.length !== 1) talErr++;
  } catch (e) { talErr++; console.log('   天赋异常', t.id, e.message); }
});
ok(talErr === 0, '逐个天赋装配无异常', talErr);

console.log('== 4. 中考 / 高考满分可达 ==');
function mkExam(kind, boost) {
  const s = A.createGame({ name: 'T', gender: 'M', familyId: 'keyan', priority: 'study', talents: [] });
  s.startYear = 2000; s.age = kind === 'mid' ? 15 : 18;
  s.stats.INT = 200; s.stats.WILL = 200; s.stats.HP = 120; s.stats.STRESS = 0;
  s.edu.study = 100;
  if (kind === 'gao') { s.edu.hs = 'hs_key'; }
  s.family = { assets: 500000000, debt: 0 };
  const item = A.makeExamEvent(s, kind);
  return { s, item };
}
[['mid', 400], ['gao', 700]].forEach(([kind, full]) => {
  const { s, item } = mkExam(kind);
  s.pending = item;
  ok(item.exam.full === full, `${kind} 满分 ${full}`, item.exam.full);
  let best = 0;
  for (let round = 0; round < 200; round++) {
    const { s: st, item: it } = mkExam(kind);
    st.pending = it;
    for (let i = 0; i < 5; i++) A.answerExamQ(st, it.exam.quiz.qs[i].a);
    best = Math.max(best, it.exam.score);
  }
  ok(best === full, `${kind} 全答对且天资顶格 → 满分`, best);
});

console.log('== 5. 计分构成 ==');
{
  const { s, item } = mkExam('mid');
  const ex = item.exam;
  ok(ex.perQ * 5 + ex.academicFull === ex.full, '中考 常识+平时 = 满分', `${ex.perQ * 5} + ${ex.academicFull} = ${ex.full}`);
  const { s: s2, item: it2 } = mkExam('gao');
  ok(it2.exam.perQ * 5 + it2.exam.academicFull === it2.exam.full, '高考 常识+平时 = 满分', `${it2.exam.perQ * 5} + ${it2.exam.academicFull} = ${it2.exam.full}`);
}

console.log('== 6. 同学毕业后仍在通讯录 ==');
{
  const s = A.createGame({ name: 'T', gender: 'M', familyId: 'jiaoshi', priority: 'balance', talents: [] });
  s.startYear = 1995;
  let guard = 0;
  while (s.age < 24 && guard++ < 60) {
    const item = A.step(s);
    if (item && item.type === 'exam') {
      s.pending = item;
      while (item.exam.quiz && !item.exam.quiz.done) A.answerExamQ(s, item.exam.quiz.qs[item.exam.quiz.i].a);
      const n = (item.exam.options || []).length;
      if (n) A.resolveExam(s, Math.min(1, n - 1));
    } else if (item && item.type === 'event' && item.ev && item.ev.choices) {
      vm.runInContext('resolveEvent', ctx)(s, item.ev, Math.floor(Math.random() * item.ev.choices.length));
    }
  }
  const mates = s.classmates || [];
  ok(mates.length > 0, '毕业后同学仍在', mates.length + ' 人');
  ok(mates.every(c => !!c.stage), '每位同学都标了阶段', mates.map(c => A.stageCn(c.stage)).join('/'));
  const before = mates[0].affinity;
  const r = A.classmateAct(s, 0);
  ok(r.ok, '毕业后还能约老同学', `${Math.round(before)} → ${Math.round(s.classmates[0].affinity)}`);
}

console.log('== 7. 恋爱：一年可见多次 ==');
{
  const s = A.createGame({ name: 'T', gender: 'M', familyId: 'shangren', priority: 'balance', talents: [] });
  s.age = 24; s.stats.MONEY = 300000000; s.stats.CHA = 60;
  const m = A.meetByMatchmaker(s);
  ok(m.ok, '相亲成功', m.ok ? '' : m.msg);
  const lv = A.loveInit(s);
  const start = lv.candidates[0].affinity;
  let cnt = 0;
  for (let i = 0; i < 5; i++) if (A.loveAct(s, 0, 'chat').ok) cnt++;
  ok(cnt === A.LOVE_META.touchesPerYear, `一年最多 ${A.LOVE_META.touchesPerYear} 次`, cnt);
  ok(lv.candidates[0].affinity > start, '一年内多次互动能推好感', `${Math.round(start)} → ${Math.round(lv.candidates[0].affinity)}`);
  // 推到求婚线需要几年
  let years = 0;
  while (lv.candidates[0].affinity < A.LOVE_META.marryAffinity && years < 8) {
    years++; s.age++;
    lv.candidates[0].lastTouch = -1; lv.candidates[0].touches = 0;
    for (let i = 0; i < A.LOVE_META.touchesPerYear; i++) A.loveAct(s, 0, 'chat');
  }
  ok(years <= 4, `专心追求 ${years} 年内可到求婚线（${A.LOVE_META.marryAffinity}%）`, years);
}

console.log('== 8. 上学 / 工作互斥 ==');
{
  const s = A.createGame({ name: 'T', gender: 'M', familyId: 'chengzhongcun', priority: 'balance', talents: [] });
  s.startYear = 1990; s.age = 14; s.job = '初中生';
  ok(A.isEnrolled(s), '在读判定正确', A.enrolledText(s));
  A.dropOut(s, '服务员');
  ok(!A.isEnrolled(s) && s.edu.stopped, '退学后不再算在读');
  const beforeH = s.edu.hs;
  let pushedExam = false;
  s.age = 15;
  const item = A.step(s);
  const q = s.queue || [];
  q.forEach(i => { if (i.type === 'exam') pushedExam = true; });
  ok(!pushedExam, '退学后 15 岁不再触发中考');
  // 反向：工作时辞职读书
  const s2 = A.createGame({ name: 'T2', gender: 'F', familyId: 'xiangong', priority: 'balance', talents: [] });
  s2.age = 22; s2.job = '外卖骑手'; s2.edu = { hs: 'hs_none', uni: 'u_fail', eduLevel: 1, study: 0 };
  s2.career = { id: 'waimai', level: 0, years: 2 };
  A.quitForSchool(s2, '研究生');
  ok(!s2.career && s2.job === '待业', '辞职读书后 job/career 清空', s2.job);
}

console.log(fail === 0 ? '\n全部通过 ✅' : `\n失败 ${fail} 项 ❌`);
process.exit(fail ? 1 : 0);
