/* 一次性验证：朋友按年龄生成 + 毕业考研/找工作弹窗 + 专业选择 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = { console, Math, JSON, Date, isNaN, parseInt, Number };
vm.createContext(ctx);
['assets/data.js', 'assets/market.js', 'assets/engine.js',
 'assets/school.js', 'assets/career.js', 'assets/love.js', 'assets/loan.js'].forEach(f => {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
});
const A = vm.runInContext(`({
  createGame, step, resolveEvent, answerExamQ, resolveExam, eventChoices, finish,
  FRIEND_TYPES, jobOffers, applyJob, majorCatOf, makeGradEvent, UNIVERSITIES, HIGH_SCHOOLS
})`, ctx);

const st = A.createGame({ name: '验证', gender: 'M', familyId: 'chengzhongcun', talents: [] });
console.log('[出生] 朋友数 =', (st.friends || []).length, '（应为 0）');

let sawExam = 0, gradEvent = null, majorEvent = null, friendLog = [];
let guard = 0;
while (!st.finished && guard++ < 600) {
  const item = A.step(st);
  const handle = (it) => {
    if (!it) return;
    if (it.type === 'exam' && it.exam.quiz) {
      st.pending = it;
      while (it.exam.quiz && !it.exam.quiz.done) A.answerExamQ(st, it.exam.quiz.qs[it.exam.quiz.i].a); // 全答对
      A.resolveExam(st, 0);
      sawExam++;
    } else if (it.type === 'event') {
      const id = String(it.ev.id || '');
      if (id.indexOf('grad_at_') === 0) gradEvent = it.ev;
      if (id.indexOf('major_at_') === 0) {
        majorEvent = it.ev;
        A.resolveEvent(st, it.ev, 0); // 选第一个专业
      } else {
        const list = A.eventChoices(st, it.ev);
        A.resolveEvent(st, it.ev, list && list.length ? 1 : -1);
      }
    }
  };
  handle(item);
  while (st.queue && st.queue.length && !st.finished) handle(st.queue.shift());
  if (st.age === 20) {
    console.log('[20岁] 朋友：', (st.friends || []).map(f => f.key + '(' + f.age + '岁)').join(', ') || '无');
  }
}
console.log('[终局] ', st.age, '岁 ·', st.edu.uni, '· 专业', st.edu.major, '· 学历', st.edu.eduLevel, '· 职业', st.job);
console.log('[考试] 答题放榜次数 =', sawExam, '（应为 2：中考+高考，全答对场景）');
console.log('[志愿弹窗]', majorEvent ? '出现 ✓' : '未出现 ✗');
console.log('[毕业弹窗]', gradEvent ? ('出现 ✓ 考研成功率 ' + Math.round((gradEvent.kaoyanP || 0) * 100) + '%') : '未出现（未上大学或测试路径未触发）');
console.log('[专业归类]', A.majorCatOf(st));

// 专业对口验证：医学专业当不了程序员
const st2 = A.createGame({ name: '对口', gender: 'F', familyId: 'jiaoshi', talents: [] });
st2.age = 23; st2.edu.eduLevel = 4; st2.edu.major = '临床医学'; st2.stats.INT = 80;
const off = A.jobOffers(st2).find(o => o.career.id === 'programmer');
console.log('[对口] 医学专业应聘程序员 okFlag =', off.okFlag, 'majorOk =', off.majorOk, '（应 false / false）');
const off2 = A.jobOffers(st2).find(o => o.career.id === 'doctor');
console.log('[对口] 医学专业应聘医生 okFlag =', off2.okFlag, '（应 true）');
