/* v5 专项测试：升学 / 职业晋升 / 恋爱婚姻 / 贷款 / 亲人离世 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const ctx = { console, Math, JSON, Date, isNaN, parseInt, Number };
vm.createContext(ctx);
['assets/data.js', 'assets/market.js', 'assets/engine.js',
 'assets/school.js', 'assets/career.js', 'assets/love.js', 'assets/pet.js', 'assets/legacy.js', 'assets/loan.js'].forEach(f => {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
});

const A = vm.runInContext(`({
  createGame, step, resolveEvent, resolveExam, answerExamQ, finish, scoreOf, eventChoices, fmtMoney,
  FAMILIES, TALENTS, EVENTS, netWorth, EDU_LEVELS, UNIVERSITIES, HIGH_SCHOOLS, CAREERS,
  jobOffers, applyJob, careerTick, careerIncome, loveInit, meetByMatchmaker, loveAct,
  loveIntimate, propose, marry, tryBaby, borrow, loanTick, loanTotal, repayLoan,
  parentTick, addGrief, socialAct, socialActAll, classmateAct, cramSchool, doUniActivity,
  makeClassmates, schoolStageOf, loanProducts
})`, ctx);

const stat = {};
const bump = (k) => { stat[k] = (stat[k] || 0) + 1; };
const num = (k, v) => { (stat[k] = stat[k] || []).push(v); };
const avg = (k) => { const a = stat[k] || []; return a.length ? (a.reduce((x, y) => x + y, 0) / a.length) : 0; };

function play(i) {
  const st = A.createGame({
    name: '测试' + i, gender: Math.random() < 0.5 ? 'M' : 'F',
    familyId: A.FAMILIES[Math.floor(Math.random() * A.FAMILIES.length)].id,
    talents: []
  });
  let guard = 0;
  while (!st.finished && guard++ < 600) {
    const item = A.step(st);
    if (!item || item.type === 'end') break;
    if (item.type === 'exam') {
      st.pending = item;
      while (item.exam.quiz && !item.exam.quiz.done) {
        A.answerExamQ(st, Math.floor(Math.random() * 4));
      }
      A.resolveExam(st, Math.floor(Math.random() * item.exam.options.length));
    } else if (item.type === 'event') {
      const list = A.eventChoices(st, item.ev);
      A.resolveEvent(st, item.ev, list && list.length ? Math.floor(Math.random() * list.length) : -1);
    } else if (item.type === 'invest') {
      const opts = item.choices.filter(c => !c.disabled && c.act === 'invest');
      if (opts.length) vm.runInContext('resolveInvest', ctx)(st, opts[0]);
    }
    while (st.queue && st.queue.length && !st.finished) {
      const q = st.queue.shift();
      if (q.type === 'exam') {
        st.pending = q;
        while (q.exam.quiz && !q.exam.quiz.done) A.answerExamQ(st, Math.floor(Math.random() * 4));
        A.resolveExam(st, 0);
      }
      else if (q.type === 'event') {
        const list = A.eventChoices(st, q.ev);
        A.resolveEvent(st, q.ev, list && list.length ? Math.floor(Math.random() * list.length) : -1);
      }
    }

    // —— 玩家行为模拟 ——
    if (st.age < 18 && st.age >= 8 && Math.random() < 0.6) A.cramSchool(st);
    if (A.schoolStageOf(st) && (st.classmates || []).length && Math.random() < 0.5) {
      A.socialActAll(st, 'classmate');
    }
    if (A.schoolStageOf(st) === 'uni' && Math.random() < 0.7) {
      const acts = ['a_study', 'a_drink', 'a_club', 'a_intern', 'a_parttime', 'a_sport', 'a_love'];
      A.doUniActivity(st, acts[Math.floor(Math.random() * acts.length)]);
    }
    if (st.age >= 22 && !st.flags.married && Math.random() < 0.35) {
      const lv = A.loveInit(st);
      if (!lv.candidates.length && st.stats.MONEY > 8000000) A.meetByMatchmaker(st);
      if (lv.candidates.length) {
        const idx = 0;
        A.loveAct(st, idx, Math.random() < 0.5 ? 'date' : 'gift');
        if (lv.candidates[idx] && lv.candidates[idx].affinity >= 70) A.loveIntimate(st, idx);
        if (lv.candidates[idx] && lv.candidates[idx].affinity >= 80 && st.age >= 22) A.propose(st, idx);
      }
    }
    if (st.flags.married && st.childCount < 2 && Math.random() < 0.3) A.tryBaby(st);
    if (st.age >= 24 && Math.random() < 0.12) {
      const ps = A.loanProducts(st).filter(x => x.avail && x.p.danger < 3);
      if (ps.length) A.borrow(st, ps[0].p.id, Math.round(ps[0].max * 0.3));
    }
    if (st.loans && st.loans.length && Math.random() < 0.2) A.repayLoan(st, 0, Math.round(st.loans[0].left * 0.5));
    if (st.parents) { if (st.parents.father && st.parents.father.alive) A.socialAct(st, 'father'); if (st.parents.mother && st.parents.mother.alive) A.socialAct(st, 'mother'); }
    if ((st.friends || []).length && Math.random() < 0.4) A.socialActAll(st, 'friend');
    if (st.age === 40) bump('job40:' + st.job);
    if (st.age === 30) bump('job30:' + st.job);
  }
  if (!st.finished) A.finish(st);
  return st;
}

let err = 0;
const N = 150;
for (let i = 0; i < N; i++) {
  try {
    const st = play(i);
    if (isNaN(st.stats.MONEY)) throw new Error('现金 NaN');
    if (isNaN(A.netWorth(st))) throw new Error('净资产 NaN');
    if (st.stats.ETH === undefined || isNaN(st.stats.ETH)) throw new Error('道德 NaN');
    if (st.stats.MOOD === undefined || isNaN(st.stats.MOOD)) throw new Error('心情 NaN');
    // 升学
    const e = st.edu || {};
    if (e.mid != null) { num('mid', e.mid); bump('mid_done'); }
    if (e.gao != null) { num('gao', e.gao); bump('gao_done'); }
    if (e.hs) bump('hs:' + e.hs);
    if (e.uni) bump('uni:' + e.uni);
    num('eduLevel', e.eduLevel || 0);
    num('deathAge', st.age);
    if (st.career) bump('career:' + st.career.id);
    else bump('job:' + st.job);
    num('careerLevel', st.career ? st.career.level : -1);
    if (st.flags.married) bump('married');
    num('children', st.childCount || 0);
    if (st.childCount) bump('has_child');
    num('loans', (st.loans || []).length);
    if (A.loanTotal(st) > 0) bump('in_debt');
    num('credit', st.credit == null ? 100 : st.credit);
    if (st.flags.widowed) bump('widowed');
    if (!st.flags.parents_alive) bump('parents_dead');
    if (st.grief) bump('grieving');
    num('score', A.scoreOf(st));
    num('life60', st.age >= 60 ? 1 : 0);
    num('life90', st.age >= 90 ? 1 : 0);
  } catch (ex) {
    err++;
    if (err <= 3) console.error('第 ' + i + ' 局异常：' + ex.message + '\n' + ex.stack.split('\n')[1]);
  }
}

const pct = (k) => ((stat[k] || 0) / N * 100).toFixed(1) + '%';
console.log('\n=== v5 升学 / 职业 / 家庭 / 贷款 统计（' + N + ' 局）===');
console.log('失败局数：' + err);
console.log('中考完成率 ' + pct('mid_done') + '，平均分 ' + avg('mid').toFixed(1));
console.log('高考完成率 ' + pct('gao_done') + '，平均分 ' + avg('gao').toFixed(1));
console.log('平均学历等级 ' + avg('eduLevel').toFixed(2) + ' / 5，平均寿命 ' + avg('deathAge').toFixed(1) + ' 岁');
console.log('\n高中分布：');
['hs_key', 'hs_ord', 'hs_vo', 'hs_none'].forEach(k => {
  const h = A.HIGH_SCHOOLS.find(x => x.id === k);
  console.log('  ' + (h ? h.name : k) + '：' + (stat['hs:' + k] || 0));
});
console.log('大学分布：');
A.UNIVERSITIES.forEach(u => console.log('  ' + u.name + '：' + (stat['uni:' + u.id] || 0)));
console.log('\n结婚率 ' + pct('married') + '，有子女 ' + pct('has_child') + '，平均子女 ' + avg('children').toFixed(2));
console.log('丧偶 ' + pct('widowed') + '，父母已故 ' + pct('parents_dead') + '，处于悲伤 ' + pct('grieving'));
console.log('结束时仍有贷款 ' + pct('in_debt') + '，平均信用分 ' + avg('credit').toFixed(1));
console.log('平均评分 ' + avg('score').toFixed(1));
console.log('活到 60 岁 ' + (avg('life60') * 100).toFixed(0) + '% · 活到 90 岁 ' + (avg('life90') * 100).toFixed(0) + '%');
console.log('\n职业分布（结束时）：');
Object.keys(stat).filter(k => k.indexOf('career:') === 0 || k.indexOf('job:') === 0)
  .sort((a, b) => stat[b] - stat[a]).slice(0, 14)
  .forEach(k => console.log('  ' + k.replace('career:', '').replace('job:', '') + '：' + stat[k]));
console.log('\n平均职级（在职者）' + avg('careerLevel').toFixed(2));

// —— 单元验证 ——
const s2 = A.createGame({ name: '单元', gender: 'M', familyId: 'jiaoshi', talents: [] });
const okJobs = A.jobOffers(s2).filter(o => o.okEdu && o.okStat && o.okFlag).length;
console.log('\n[单元] 16 岁无学历可应聘岗位数：' + okJobs);
s2.age = 22; s2.edu.eduLevel = 5; s2.flags.uni_985 = true; s2.stats.INT = 70; s2.stats.CHA = 50; s2.stats.MONEY = 50000000;
const r = A.applyJob(s2, 'programmer');
console.log('[单元] 985 应聘程序员：' + JSON.stringify(r) + ' → ' + s2.job);
for (let i = 0; i < 8; i++) A.careerTick(s2);
console.log('[单元] 8 年后职级：' + s2.job + '（level ' + s2.career.level + '，在职 ' + s2.career.years + ' 年）');
console.log('[单元] 年收入：' + A.fmtMoney(A.careerIncome(s2)));
A.meetByMatchmaker(s2);
const lv = A.loveInit(s2);
console.log('[单元] 相亲得到：' + (lv.candidates[0] ? lv.candidates[0].name + ' 好感' + lv.candidates[0].affinity : '无'));
lv.candidates[0].affinity = 90;
const pr = A.propose(s2, 0);
console.log('[单元] 求婚：' + JSON.stringify({ ok: pr.ok, p: pr.p ? pr.p.toFixed(2) : 0 }) + ' → 已婚 ' + !!s2.flags.married);
s2.stats.LOY = 40;
const br = A.borrow(s2, 'credit', 20000000);
console.log('[单元] 信用贷：' + JSON.stringify({ ok: br.ok }) + '，贷款总额 ' + A.fmtMoney(A.loanTotal(s2)));
A.loanTick(s2);
console.log('[单元] 一年后贷款余额 ' + A.fmtMoney(A.loanTotal(s2)) + '，信用分 ' + Math.round(s2.credit));
A.addGrief(s2, '测试', 20);
console.log('[单元] 悲伤后心情 ' + Math.round(s2.stats.MOOD) + '，grief=' + JSON.stringify(s2.grief));
