/* v5.4 专项验证：15 条 bug 修复
 * 1 恩师年龄 / 2 专业扩充与对口 / 3 毕业不自动找工作 / 4 婚后好感能涨
 * 5 亲友主动互动 / 6 基层薪资下调 / 7 星探与 idol / 8 dock 返回人生
 * 9 道德可提升 / 10 全部学校与拒绝理由 / 11 艺术高中与表演系
 * 12 外遇偷情 / 12b 研究生同学 / 13 韩式头像 / 14 措施降价 / 15 被表白
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const ctx = { console, Math, JSON, Date, isNaN, parseInt, parseFloat, Number, String, Array, Object };
vm.createContext(ctx);
['assets/data.js', 'assets/market.js', 'assets/engine.js', 'assets/school.js', 'assets/career.js', 'assets/love.js', 'assets/loan.js']
  .forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));

const A = vm.runInContext(`({
  createGame, step, resolveEvent, loveInit, loveAct, loveIntimate, loveTick, marry, propose,
  socialAct, friendGrowth, friendTick, inboundTick, makeInboundEvent, applyInbound,
  autoEmploy, jobOffers, applyJob, careerById, CAREERS, majorCatOf, MAJOR_LABEL,
  makeGradEvent, makeKaoyanFailEvent, makeScoutEvent, scoutTick, signAsIdol,
  meetOutside, startAffair, endAffair, confessTick, makeConfessEvent,
  doGoodDeed, GOOD_DEEDS, schoolLockReason, resolveExam, schoolStageOf, stageCn, refreshClassmates,
  HIGH_SCHOOLS, UNIVERSITIES, EDU_LEVELS, makeMajorEvent, answerExamQ, makeExamEvent,
  FRIEND_TYPES, LOVE_META, fmtMoney, livingCost, careerIncome, JOBS
})`, ctx);

let fail = 0;
const ok = (cond, name, extra) => {
  if (cond) console.log('  ✓', name, extra == null ? '' : extra);
  else { console.log('  ✗', name, extra == null ? '' : extra); fail++; }
};
const mk = (o) => A.createGame(Object.assign({
  name: 'T', gender: 'M', familyId: 'zhigong', priority: 'balance', talents: []
}, o || {}));

console.log('== 1. 恩师年纪要比你大一辈 ==');
{
  let teacher = null, peers = [];
  for (let i = 0; i < 400 && !teacher; i++) {
    const s = mk(); s.age = 12; s.friends = [];
    for (let y = 0; y < 6; y++) { A.friendGrowth(s); s.age++; }
    const t = (s.friends || []).find(f => f.key === 'teacher');
    if (t) teacher = { age: t.age, me: s.age };
    (s.friends || []).forEach(f => { if (f.key !== 'teacher') peers.push(f.age - s.age); });
  }
  ok(!!teacher, '能遇到恩师');
  ok(teacher && (teacher.age - teacher.me) >= 14, '恩师至少比你大 14 岁',
    teacher ? `你 ${teacher.me} / 恩师 ${teacher.age}` : '');
  const t = A.FRIEND_TYPES.find(x => x.key === 'teacher');
  ok(t && t.ageGap && t.ageGap[0] >= 16, 'FRIEND_TYPES 里恩师有年龄差配置', t ? JSON.stringify(t.ageGap) : '');
}

console.log('== 2. 专业扩充 + 与职业对口 ==');
{
  const majors = Object.keys(A.MAJOR_LABEL);
  ok(majors.length >= 45, '专业数量 ≥ 45', majors.length + ' 个');
  const cats = {};
  majors.forEach(m => cats[A.MAJOR_LABEL[m]] = 1);
  ok(Object.keys(cats).length >= 8, '专业方向 ≥ 8 类', Object.keys(cats).join('/'));
  const withMajor = A.CAREERS.filter(c => c.major && c.major.length);
  ok(withMajor.length >= 14, '有专业要求的职业 ≥ 14 个', withMajor.length + ' 个');
  // 有专业的职业，其 major 必须都是合法方向
  const valid = {}; majors.forEach(m => valid[A.MAJOR_LABEL[m]] = 1);
  const badJob = withMajor.find(c => c.major.some(x => !valid[x]));
  ok(!badJob, '职业的专业要求在方向表里都存在', badJob ? badJob.id : '');
  // 学校专业都必须能归类
  const bad = [];
  A.UNIVERSITIES.forEach(u => (u.major || []).forEach(m => { if (!A.MAJOR_LABEL[m]) bad.push(u.id + ':' + m); }));
  ok(bad.length === 0, '每个大学专业都能归到方向', bad.join(','));
  // 专业对口优先：理工出身应优先落到理工类岗位
  let hit = 0, n = 0;
  for (let i = 0; i < 60; i++) {
    const s = mk(); s.age = 22; s.stats.INT = 68; s.stats.CHA = 40; s.stats.NET = 40;
    s.edu.eduLevel = 4; s.edu.major = '计算机'; s.edu.uni = 'u_211'; s.edu.salaryK = 1.2;
    s.flags.uni_211 = true;
    A.autoEmploy(s);
    if (s.career) { n++; const c = A.careerById(s.career.id); if (c.major && c.major.indexOf('理工') >= 0) hit++; }
  }
  ok(n > 0 && hit / n >= 0.8, '理工出身优先落到理工岗位', `${hit}/${n}`);
}

console.log('== 3. 毕业不再自动被安排工作 ==');
{
  const s = mk(); s.age = 22;
  s.edu = Object.assign(s.edu || {}, { uni: 'u_211', eduLevel: 4, gradAge: 22, major: '会计学', salaryK: 1.2, hs: 'hs_ord' });
  s.job = '大学生'; s.stats.INT = 60;
  // 走一次 yearBase：应产生毕业三选一，且当年 job 不被塞成某个职业
  s.flags.uni_211 = true;
  const it0 = A.step(s);
  const bag = (s.queue || []).concat(s.extraQueue || []).concat(it0 ? [it0] : []);
  const hasGrad = bag.some(x => x.ev && String(x.ev.id).indexOf('grad_at_') === 0);
  ok(hasGrad, '毕业弹出三选一');
  ok(!s.career, '毕业当年没有被自动安排工作', s.job);
  // 选「考研」落榜 → 不再直接塞工作，而是弹出二战/就业二选一
  const g = A.makeGradEvent(s);
  ok(g.choices.length === 3 && String(g.choices[0].text).indexOf('考研') === 0, '第一选项是考研', g.choices[0].text);
  const kf = A.makeKaoyanFailEvent(s);
  ok(kf && kf.choices.length === 2, '落榜后是二战 / 就业二选一', kf.choices.map(c => c.text).join(' | '));
  // 选「放弃考研」才真的找工作
  const s2 = mk(); s2.age = 22;
  s2.edu = Object.assign(s2.edu || {}, { uni: 'u_211', eduLevel: 4, major: '会计学', hs: 'hs_ord' });
  s2.flags.uni_211 = true; s2.stats.INT = 55;
  A.resolveEvent(s2, g, 1);
  ok(!!s2.career, '选了「放弃考研，投简历」才有工作', s2.job);
}

console.log('== 4. 婚后好感能涨回来 ==');
{
  const s = mk(); s.age = 28; s.stats.MONEY = 600000000; s.stats.CHA = 50;
  const l = A.makeLover ? null : null;
  A.meetOutside && null;
  // 手动结婚
  s.spouse = { name: '林静', age: 27, affinity: 50, alive: true, since: 28 };
  s.flags.married = true; s.spouseName = '林静';
  const a0 = s.spouse.affinity;
  A.socialAct(s, 'spouse', 0);
  ok(s.spouse.affinity > a0, '陪伴后感情真的涨了', `${a0} → ${Math.round(s.spouse.affinity)}`);
  s.socialTouch = {};
  const a1 = s.spouse.affinity;
  A.socialAct(s, 'spouse', 1);
  ok(s.spouse.affinity > a1, '约会后感情继续涨', `${Math.round(a1)} → ${Math.round(s.spouse.affinity)}`);
  s.socialTouch = {};
  const a2 = s.spouse.affinity;
  A.socialAct(s, 'spouse', 2);
  ok(s.spouse.affinity > a2, '送礼后感情继续涨', `${Math.round(a2)} → ${Math.round(s.spouse.affinity)}`);
  // 一年冷落只掉一点，互动能补回来
  let drop = 0;
  for (let i = 0; i < 20; i++) { const b = s.spouse.affinity; s.socialTouch = {}; s.age++; A.loveTick(s); drop += (b - s.spouse.affinity); }
  ok(drop / 20 <= 2.2, '冷落一年的掉幅收窄到 ≤2.2/年', (drop / 20).toFixed(2));
}

console.log('== 5. 亲友会主动来找你 ==');
{
  let got = 0, kinds = {};
  for (let i = 0; i < 300; i++) {
    const s = mk(); s.age = 25; s.stats.MONEY = 200000000;
    s.friends = [{ key: 'colleague', name: '王磊', gender: 'M', affinity: 40, alive: true, age: 26 }];
    s.classmates = [{ key: 'nerd', name: '赵敏', gender: 'F', affinity: 30, stage: 'uni', age: 25, charm: 60 }];
    s.inboundYear = -1;
    A.inboundTick(s);
    const ev = (s.extraQueue || [])[0];
    if (ev && ev.ev && ev.ev.ib) { got++; kinds[ev.ev.ib.kind] = (kinds[ev.ev.ib.kind] || 0) + 1; }
  }
  ok(got > 20, '每年有机会被主动找上门', `${got}/300 次`);
  ok(Object.keys(kinds).length >= 2, '来源不止一种', Object.keys(kinds).join('/'));
  // 接受邀约会真的涨那个人好感
  const s = mk(); s.age = 30;
  s.friends = [{ key: 'neighbor', name: '陈叔', gender: 'M', affinity: 40, alive: true, age: 52 }];
  const ev = A.makeInboundEvent(s, 'friend');
  ok(!!ev && ev.choices.length === 3, '邀约有 3 个选项', ev ? ev.choices.map(c => c.text).join(' | ') : '');
  A.applyInbound(s, ev.ib, ev.choices[0].ibGain);
  ok(s.friends[0].affinity > 40, '答应邀约后对方好感上涨', Math.round(s.friends[0].affinity));
  const s2 = mk(); s2.age = 30;
  s2.spouse = { name: '林静', age: 29, affinity: 40, alive: true };
  s2.flags.married = true;
  const ev2 = A.makeInboundEvent(s2, 'spouse');
  A.applyInbound(s2, ev2.ib, ev2.choices[0].ibGain);
  ok(s2.spouse.affinity > 40, '配偶主动邀约后感情上涨', Math.round(s2.spouse.affinity));
}

console.log('== 6. 基层工作薪资下调 ==');
{
  const pick = (id) => A.careerById(id).ladder[0].sal;
  const rider = pick('rider'), waiter = pick('waiter'), guard = pick('guard');
  ok(rider <= 8500000, '外卖骑手起薪已下调', A.fmtMoney(rider) + '/年');
  ok(waiter <= 6500000, '服务员起薪已下调', A.fmtMoney(waiter) + '/年');
  ok(guard <= 10000000, '保安起薪已下调', A.fmtMoney(guard) + '/年');
  ok(pick('extra') <= 5500000, '群演起薪已下调', A.fmtMoney(pick('extra')) + '/年');
  ok(pick('cook') <= 9000000, '厨师学徒起薪已下调', A.fmtMoney(pick('cook')) + '/年');
  // 但还是要能活下去：收入 > 生活成本
  const s = mk(); s.age = 24; s.stats.INT = 45; s.stats.NET = 30; s.stats.LOY = 40;
  A.applyJob(s, 'rider');
  ok(A.careerIncome(s) > A.livingCost(s) * 0.9, '骑手收入仍能覆盖基本生活',
    `${A.fmtMoney(A.careerIncome(s))} vs 支出 ${A.fmtMoney(A.livingCost(s))}`);
}

console.log('== 7. 星探：初高中被发掘，可放弃学业签约 ==');
{
  const s = mk(); s.age = 15; s.stats.CHA = 62;
  s.edu = Object.assign(s.edu || {}, { hs: 'hs_ord', uni: null });
  let fired = 0;
  for (let i = 0; i < 200; i++) { s.scoutYear = -1; s.extraQueue = []; A.scoutTick(s); if ((s.extraQueue || []).length) fired++; }
  ok(fired > 10, '高颜值初高中生会被星探拦下', `${fired}/200`);
  const low = mk(); low.age = 15; low.stats.CHA = 20;
  low.edu = Object.assign(low.edu || {}, { hs: 'hs_ord' });
  let fired2 = 0;
  for (let i = 0; i < 200; i++) { low.scoutYear = -1; low.extraQueue = []; A.scoutTick(low); if ((low.extraQueue || []).length) fired2++; }
  ok(fired2 === 0, '颜值不够不会被拦下', `${fired2}/200`);
  const ev = A.makeScoutEvent(s);
  ok(ev.choices.length === 3, '星探有 3 个选项', ev.choices.map(c => c.text).join(' | '));
  A.resolveEvent(s, ev, 0);
  ok(s.flags.idol_signed && s.edu.stopped, '签约后真的退学了', `job=${s.job}`);
  ok(s.career && s.career.id === 'idol', '进入了 idol 线', s.career ? s.career.id : '无');
  const need = A.careerById('idol').need;
  ok(need.CHA >= 48, 'idol 门槛按颜值设置', 'CHA ≥ ' + need.CHA);
}

console.log('== 9. 道德可以主动提升 ==');
{
  const s = mk(); s.age = 25; s.stats.MONEY = 100000000; s.stats.ETH = 40;
  ok(A.GOOD_DEEDS.length >= 6, '善事条目 ≥ 6', A.GOOD_DEEDS.length + ' 项');
  const d = A.GOOD_DEEDS.find(x => !x.cost);
  const e0 = s.stats.ETH;
  A.doGoodDeed(s, d.id);
  ok(s.stats.ETH > e0, '做件好事道德会涨', `${e0} → ${Math.round(s.stats.ETH)}`);
  const r2 = A.doGoodDeed(s, d.id);
  ok(!r2.ok, '同一件好事一年只能做一次', r2.msg || '');
  const pay = A.GOOD_DEEDS.find(x => x.cost > 0);
  const m0 = s.stats.MONEY;
  A.doGoodDeed(s, pay.id);
  ok(s.stats.MONEY < m0, '捐款真的花钱', `${A.fmtMoney(m0)} → ${A.fmtMoney(s.stats.MONEY)}`);
  const young = mk(); young.age = 8;
  ok(!A.doGoodDeed(young, 'g_teach').ok, '年纪太小做不了支教');
}

console.log('== 10. 放榜列出所有学校，进不去的说明理由 ==');
{
  const s = mk(); s.age = 15;
  s.edu = Object.assign(s.edu || {}, { hs: null, uni: null });
  const item = A.makeExamEvent(s, 'mid');
  s.pending = item;
  for (let i = 0; i < 5; i++) A.answerExamQ(s, 0);
  const opts = item.exam.options;
  ok(opts.length === A.HIGH_SCHOOLS.length, '中考列出全部学校', `${opts.length}/${A.HIGH_SCHOOLS.length}`);
  const locked = opts.filter(o => o.locked);
  ok(locked.length > 0, '有进不去的学校被标出来', locked.length + ' 所');
  ok(locked.every(o => !!o.lockReason), '每所都写了原因', locked.map(o => o.name + '：' + o.lockReason).join(' / '));
  ok(locked.some(o => o.lockReason.indexOf('分数不够') >= 0), '分数不够会说差多少分');
  ok(opts.some(o => !o.locked), '至少有一条路能走');
  const why = A.schoolLockReason(s, A.HIGH_SCHOOLS.find(h => h.id === 'hs_art'), 0, 400);
  ok(String(why).indexOf('分') >= 0, '艺术高中也能给出拒绝理由', why);
  // 高考：表演系存在
  const hasPerf = A.UNIVERSITIES.some(u => (u.major || []).indexOf('表演') >= 0);
  ok(hasPerf, '本科有表演系');
  ok(A.HIGH_SCHOOLS.some(h => h.id === 'hs_art'), '有艺术高中');
}

console.log('== 12. 外遇 / 偷情 / 被表白 ==');
{
  const s = mk(); s.age = 30; s.stats.MONEY = 300000000; s.stats.CHA = 55;
  s.spouse = { name: '林静', age: 29, affinity: 60, alive: true };
  s.flags.married = true;
  const r = A.meetOutside(s);
  ok(r.ok, '已婚也能在外面认识人（外遇）');
  const l = A.loveInit(s).candidates[0];
  ok(l.outside === true, '标记为婚外认识的人');
  const eth0 = s.stats.ETH;
  l.affinity = 70;
  const r2 = A.startAffair(s, 0);
  ok(r2.ok, '可以发展为长期偷情');
  ok(A.loveInit(s).candidates[0].secret === true, '升级为偷情关系');
  ok(s.stats.ETH < eth0, '道德受损', eth0 + ' → ' + Math.round(s.stats.ETH));
  let caught = 0;
  for (let i = 0; i < 400; i++) {
    const t = mk(); t.age = 32; t.flags.married = true;
    t.spouse = { name: 'X', age: 31, affinity: 60, alive: true };
    A.loveInit(t).candidates = [{ name: 'Y', gender: 'F', age: 28, affinity: 70, alive: true, secret: true, affairSince: 30, outside: true }];
    t.extraQueue = [];
    A.loveTick(t);
    if ((t.extraQueue || []).some(x => x.ev && String(x.ev.id).indexOf('affair_at_') === 0)) caught++;
  }
  ok(caught > 40, '偷情每年都有被发现的风险', `${caught}/400 年被撞破`);
  const e = A.endAffair(s, 0);
  ok(e.ok && !A.loveInit(s).candidates[0].secret, '可以收手结束这段关系');
  // 被动表白
  let conf = 0;
  for (let i = 0; i < 400; i++) {
    const t = mk(); t.age = 24; t.confessYear = -1; t.extraQueue = [];
    A.confessTick(t);
    if ((t.extraQueue || []).some(x => x.ev && String(x.ev.id).indexOf('confess_at_') === 0)) conf++;
  }
  ok(conf > 20, '单身时会有人主动表白', `${conf}/400`);
  let conf2 = 0;
  for (let i = 0; i < 400; i++) {
    const t = mk(); t.age = 34; t.confessYear = -1; t.extraQueue = [];
    t.flags.married = true; t.spouse = { name: 'Z', age: 33, affinity: 60, alive: true };
    A.confessTick(t);
    if ((t.extraQueue || []).some(x => x.ev && String(x.ev.id).indexOf('confess_at_') === 0)) conf2++;
  }
  ok(conf2 > 5, '已婚也会有人来表白（性质不同）', `${conf2}/400`);
  const ce = A.makeConfessEvent(s, { name: '苏晴' });
  ok(ce.choices.length === 3, '表白有 3 种回应', ce.choices.map(c => c.text).join(' | '));
}

console.log('== 12b. 研究生同学 ==');
{
  ok(A.stageCn('grad') === '研究生', '阶段名有研究生', A.stageCn('grad'));
  const s = mk(); s.age = 22;
  s.edu = Object.assign(s.edu || {}, { uni: 'u_211', eduLevel: 5, gradAge: 25, hs: 'hs_ord', major: '教育学' });
  s.flags.kaoyan_ok = true;
  ok(A.schoolStageOf(s) === 'grad', '考研上岸后阶段变为研究生', A.schoolStageOf(s));
  s.classmates = [];
  A.refreshClassmates(s);
  const grads = (s.classmates || []).filter(c => c.stage === 'grad');
  ok(grads.length > 0, '读研会认识新的一批同学', grads.length + ' 人');
  ok(grads.every(c => c.age >= s.age - 1), '研究生同学年纪更大', grads.map(c => c.age).join(','));
}

console.log('== 14. 做好措施不再贵得离谱 ==');
{
  ok(A.LOVE_META.safeCost <= 30000, '措施成本已下调', A.fmtMoney(A.LOVE_META.safeCost));
  const s = mk(); s.age = 24; s.stats.MONEY = 5000000;
  A.loveInit(s).candidates = [{ name: '苏晴', gender: 'F', age: 23, affinity: 80, alive: true, look: 70, tp: 'warm', bg: 'mid', src: '偶遇', touches: 0, lastTouch: -1, pregnant: false }];
  const m0 = s.stats.MONEY;
  const r = A.loveIntimate(s, 0, true);
  ok(r.ok, '用得起措施');
  ok(m0 - s.stats.MONEY === A.LOVE_META.safeCost, '扣的就是措施的钱', A.fmtMoney(m0 - s.stats.MONEY));
}

console.log('== 15. 综合：跑完整人生不报错 ==');
{
  let deaths = 0, err = null;
  try {
    for (let g = 0; g < 30; g++) {
      const s = mk({ familyId: ['zhigong', 'nongcun', 'shangren', 'jiaoshi', 'tizhinei'][g % 5], gender: g % 2 ? 'F' : 'M' });
      let guard = 0;
      while (!s.finished && guard++ < 2000) {
        const it = A.step(s);
        if (!it) break;
        if (it.type === 'event' && it.ev) {
          s.pending = it;
          const ch = (it.ev.choices && it.ev.choices.length) ? 0 : undefined;
          if (it.ev.id && String(it.ev.id).indexOf('grad_at_') === 0) A.resolveEvent(s, it.ev, 1);
          else if (it.ev.id && String(it.ev.id).indexOf('kaoyan2_at_') === 0) A.resolveEvent(s, it.ev, 1);
          else A.resolveEvent(s, it.ev, ch);
          s.pending = null;
        } else if (it.type === 'exam') {
          s.pending = it;
          if (it.exam.quiz && !it.exam.quiz.done) { while (it.exam.quiz && !it.exam.quiz.done) A.answerExamQ(s, 0); }
          if (it.exam.options && it.exam.options.length) {
            const i = it.exam.options.findIndex(o => !o.locked);
            if (i >= 0) A.resolveExam(s, i);
            s.pending = null;
          }
        }
      }
      if (s.finished) deaths++;
    }
  } catch (e) { err = e; }
  ok(!err, '30 局完整人生无异常', err ? (err.message + '\n' + String(err.stack).split('\n')[1]) : '');
  ok(deaths >= 25, '绝大多数人生能正常走到结局', deaths + '/30');
}

console.log(fail === 0 ? '\n全部通过 ✅' : `\n失败 ${fail} 项 ❌`);
process.exit(fail ? 1 : 0);
