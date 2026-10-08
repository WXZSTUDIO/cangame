/* v5.5 专项验证：6 条 bug 修复
 * 1 父亲同姓 / 2 分手 / 3 运动员 / 4 子女有名字 / 5 前任互动与复婚 / 6 新版头像
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const ctx = { console, Math, JSON, Date, isNaN, parseInt, parseFloat, Number, String, Array, Object,
  window: { addEventListener() {} }, document: { addEventListener() {}, getElementById() { return null; }, querySelectorAll() { return []; } },
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} } };
vm.createContext(ctx);
['assets/data.js', 'assets/market.js', 'assets/engine.js', 'assets/school.js', 'assets/career.js', 'assets/love.js', 'assets/pet.js', 'assets/legacy.js', 'assets/loan.js', 'assets/ui.js']
  .forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));

const A = vm.runInContext(`({
  createGame, step, resolveEvent, loveInit, loveAct, loveIntimate, loveTick, marry, propose, divorce,
  breakup, exList, exChat, rekindle, remarryEx, addChild, childAge, tryBaby,
  autoEmploy, jobOffers, applyJob, careerById, CAREERS, careerTick, answerExamQ, resolveExam,
  migrateState, LOVE_META, portraitSVG, personAvatar, hashStr
})`, ctx);

let fail = 0;
const ok = (cond, name, extra) => {
  if (cond) console.log('  ✓', name, extra == null ? '' : extra);
  else { console.log('  ✗', name, extra == null ? '' : extra); fail++; }
};
const mk = (o) => A.createGame(Object.assign({
  name: 'T', gender: 'M', familyId: 'zhigong', priority: 'balance', talents: []
}, o || {}));

console.log('== 1. 父亲和你同姓 ==');
{
  let hit = 0, n = 0, dadSeen = 0;
  for (let i = 0; i < 200; i++) {
    const s = mk({ name: '赵' + '思远' });
    if (s.parents && s.parents.father) {
      dadSeen++;
      n++;
      if (s.parents.father.name[0] === s.name[0]) hit++;
    }
  }
  ok(dadSeen > 150, '绝大多数家庭有父亲', dadSeen + '/200');
  ok(n > 0 && hit === n, `有父亲的场合全部同姓（${hit}/${n}）`);
  ok(hit > 0 && mk({ name: '欧阳铁柱' }).parents.father.name[0] === '欧', '复姓取第一个字也能对上');
  // 老存档迁移补的父母也要同姓
  const old = { stats: { MONEY: 0 }, age: 30, name: '周建国', flags: { parents_alive: true }, familyId: 'zhigong' };
  A.migrateState(old);
  ok(old.parents && old.parents.father.name[0] === '周', '老存档补出的父亲也随姓', old.parents.father.name);
}

console.log('== 2. 分手 ==');
{
  const s = mk({ gender: 'M' }); s.age = 24;
  const lv = A.loveInit(s);
  const l = { name: '林小雨', gender: 'F', age: 23, look: 60, charm: 60, tp: 'warm', bg: 'mid', src: '偶遇',
    affinity: 40, alive: true, lastTouch: -1, touches: 0, met: 22, pregnant: false };
  lv.candidates.push(l); lv.partner = l; s.flags.dating = true; s.flags.in_love = true;
  const r = A.breakup(s, 0);
  ok(r.ok, '能分手');
  ok(!s.flags.dating && !s.flags.in_love && lv.partner === null && lv.candidates.length === 0, '恋爱状态被清干净');
  ok(A.exList(s).length === 1 && A.exList(s)[0].name === '林小雨' && A.exList(s)[0].wasSpouse === false, 'TA 进了前任名单（非前配偶）');
  const eff = s.stats.LOVE; ok(eff < 60, '分手掉感情属性');
  // 已婚的人不能走分手，要走离婚
  const s2 = mk({ gender: 'M' }); s2.age = 30; s2.flags.married = true;
  s2.spouse = { name: '王芳', age: 29, affinity: 60, alive: true, since: 26 };
  s2.spouseName = '王芳';
  const lv2 = A.loveInit(s2);
  lv2.candidates.push({ name: '别人', gender: 'F', age: 28, affinity: 70, alive: true });
  lv2.partner = lv2.candidates[0];
  const r2 = A.breakup(s2, 0);
  ok(r2.ok, '已婚时情人可以断掉（不是配偶不走离婚）');
  ok(s2.flags.married, '婚姻不受影响');
}

console.log('== 3. 职业运动员 ==');
{
  const ath = A.CAREERS.find(c => c.id === 'athlete');
  ok(!!ath, '有运动员职业');
  ok(ath && ath.ladder.length >= 5, '有成长阶梯', ath.ladder.map(x => x.title).join('→'));
  ok(ath && ath.ladder[0].sal >= 8000000 && ath.ladder[4].sal >= 100000000, '薪资曲线合理（青训→传奇）');
  const s = mk({ gender: 'M' }); s.age = 17; s.job = '无业'; s.stats.STR = 45; s.stats.HP = 80;
  const off = A.jobOffers(s).find(o => o.career.id === 'athlete');
  ok(!!off && off.okEdu && off.okStat, '身体好的高中生能应聘');
  const r = A.applyJob(s, 'athlete');
  ok(r.ok && s.job === '青训队员', '入职成为青训队员', s.job);
  // 身体不行进不去
  const s2 = mk({ gender: 'M' }); s2.age = 17; s2.stats.STR = 10; s2.stats.HP = 60;
  const r2 = A.applyJob(s2, 'athlete');
  ok(!r2.ok, '体格不够进不了', r2.msg);
  // 体育专业毕业起步更高
  const s3 = mk({ gender: 'M' }); s3.age = 22; s3.stats.STR = 45; s3.stats.HP = 85;
  s3.edu.eduLevel = 4; s3.edu.major = '体育'; s3.edu.uni = 'u_211'; s3.flags.uni_211 = true;
  const r3 = A.applyJob(s3, 'athlete');
  ok(r3.ok && A.careerById(s3.career.id).id === 'athlete', '体育生能入职');
  ok(s3.job === '职业球员', '高学历起步职级更高', s3.job);
}

console.log('== 4. 子女有名字 ==');
{
  const s = mk({ gender: 'M', name: '陈志远' }); s.age = 28;
  s.flags.married = true; s.spouseName = '林梅'; s.spouse = { name: '林梅', age: 27, affinity: 70, alive: true, since: 26 };
  let baby = null;
  try {
    for (let i = 0; i < 120 && !baby; i++) { const r = A.tryBaby(s); if (r && r.baby) baby = r; }
  } catch (e) { console.log('  tryBaby 崩了:', e.message); }
  ok(!!baby, '已婚能生孩子');
  ok((s.children || []).length === s.childCount && s.children.length >= 1, '孩子有独立列表');
  const c = s.children[0];
  ok(c.name[0] === '陈' && c.name.length >= 2, '孩子随父姓', c.name);
  ok((c.gender === 'M' || c.gender === 'F') && typeof c.born === 'number', '有性别和出生年份');
  ok(A.childAge(s, c) === 0, '刚出生 0 岁');
  s.age = 40;
  ok(A.childAge(s, c) === 12, '12 年后孩子 12 岁', A.childAge(s, c));
  // 老存档：只有数量没有列表 → 迁移补名字
  const old = { stats: { MONEY: 0 }, age: 45, name: '王国安', childCount: 2, flags: {}, familyId: 'zhigong' };
  A.migrateState(old);
  ok(old.children.length === 2 && old.children.every(x => x.name[0] === '王'), '老存档的孩子补出名字', old.children.map(x => x.name).join('/'));
  // 离婚孩子数量会减，列表跟着减
  s.age = 41; s.stats.MONEY = 50000000; s.family = s.family || { debt: 0, assets: 0 };
  const dr = A.divorce(s, '合不来');
  ok(dr.ok, '能离婚');
  ok(s.children.length === s.childCount, '离婚后孩子列表与数量一致', `${s.children.length}/${s.childCount}`);
  ok(A.exList(s).length === 1 && A.exList(s)[0].wasSpouse === true, '前配偶进了前任名单');
}

console.log('== 5. 前任：联系 / 复合 / 复婚 ==');
{
  const s = mk({ gender: 'M', name: '李长安' }); s.age = 35;
  s.flags.married = true; s.spouseName = '周琳'; s.spouse = { name: '周琳', age: 34, affinity: 70, alive: true, since: 30 };
  s.stats.MONEY = 60000000; s.family = { debt: 0, assets: 0 };
  A.divorce(s, '过不下去了');
  ok(A.exList(s)[0].name === '周琳' && A.exList(s)[0].wasSpouse, '离婚后前任在名单里');
  const e0 = A.exList(s)[0];
  const aff0 = e0.affinity;
  const r = A.exChat(s, 0);
  ok(r.ok, '能和前妻联系');
  ok(e0.affinity > aff0 && e0.lastTouch === s.age, '联系涨好感，一年一次');
  const r2 = A.exChat(s, 0);
  ok(!r2.ok, '同一年不能再聊', r2.msg);
  // 复婚：好感拉满
  e0.affinity = 85;
  let rem = null;
  for (let i = 0; i < 60 && !(rem && rem.ok); i++) {
    e0.affinity = 85;
    rem = A.remarryEx(s, 0);
  }
  ok(rem && rem.ok, '感情足够就能复婚（有成功率）');
  ok(s.flags.married && s.spouse && s.spouse.name === '周琳', '复婚后恢复配偶', s.spouseName);
  ok(A.exList(s).length === 0, '她离开了前任名单');
  // 复合：非配偶前任 → 变回恋人
  const s2 = mk({ gender: 'F' }); s2.age = 27;
  s2.exes = [{ name: '张远', gender: 'M', age: 28, met: 22, at: 25, reason: '分手', wasSpouse: false, affinity: 70, look: 60, lastTouch: -1 }];
  let rk = null;
  // QA 修复（原为裸调 60 次）：rekindle() 失败会扣 10 点好感（love.js:463），
  // affinity 70 → 60 → 50，两次失败就跌破 55 阈值 → 之后恒返「感情还不够」，剩余 58 次全是无效重试。
  // 实测失败率 26%，与「连输两次」的概率 24.8% 吻合。
  // 每次尝试前重置好感，与上面 remarryEx 那段（每次都重置 e0.affinity）写法保持一致。
  for (let i = 0; i < 60 && !(rk && rk.ok); i++) {
    const e = A.exList(s2)[0]; if (e) e.affinity = 70;
    rk = A.rekindle(s2, 0);
  }
  ok(rk && rk.ok, '前任能复合');
  const lv = A.loveInit(s2);
  ok(!!s2.flags.dating && lv.partner && lv.partner.name === '张远', '复合后是恋人关系');
  ok(A.exList(s2).length === 0, '离开了前任名单');
  // 好感不够会被拒
  const s3 = mk({ gender: 'M' }); s3.age = 30;
  s3.exes = [{ name: '前女友', gender: 'F', age: 29, wasSpouse: false, affinity: 30, look: 60, lastTouch: -1 }];
  const r3 = A.rekindle(s3, 0);
  ok(!r3.ok, '好感不够复合被拒', r3.msg);
  const r4 = A.remarryEx(s3, 0);
  ok(!r4.ok, '没结过婚谈不上复婚', r4.msg);
}

console.log('== 6. 新版头像 ==');
{
  const a = A.portraitSVG('金智媛', 'F', 25, {});
  ok(/^<svg viewBox="0 0 100 100"/.test(a), '标准 SVG');
  ok(a.indexOf('fill-rule="evenodd"') >= 0, '用了发圈剪裁');
  ok(a.indexOf('radialGradient') >= 0, '皮肤用了柔光渐变');
  ok(a.indexOf('NaN') < 0 && a.indexOf('undefined') < 0, '无 NaN / undefined');
  const b = A.portraitSVG('金智媛', 'F', 25, {});
  ok(a === b, '同名同脸（确定性）');
  const names = ['王磊', '李淑芬', '张伟', '刘思远', '陈嘉怡', '赵敏', '孙浩然', '周雨薇'];
  let clean = 0, total = 0;
  names.forEach(nm => ['F', 'M'].forEach(g => [4, 9, 15, 22, 30, 44, 60, 76, 88].forEach(age => {
    total++;
    const s = A.portraitSVG(nm, g, age, {});
    if (s.indexOf('NaN') < 0 && s.indexOf('undefined') < 0 && /^<svg /.test(s) && s.endsWith('</svg>')) clean++;
  })));
  ok(clean === total, `全组合干净（${clean}/${total}）`);
  const young = A.portraitSVG('王磊', 'M', 9, {});
  const old = A.portraitSVG('王磊', 'M', 70, {});
  ok(young !== old, '年龄变化脸会变');
  ok(old.indexOf('#D9D5CE') >= 0, '老年白发');
  const f = A.portraitSVG('李娜', 'F', 25, {});
  ok(f.indexOf('fill="#FFFFFF" opacity=".32"') >= 0 || f.indexOf('opacity=".32"') >= 0, '女性有唇彩高光');
  // 每个人都能包进 rel-ava
  ok(A.personAvatar('测试', 'F', 30, '').indexOf('<svg') > 0, 'personAvatar 正常');
}

console.log('== 7. 完整人生 30 局：父亲同姓 + 无崩溃 ==');
{
  const pickChoice = (st, n) => Math.floor(Math.random() * n);
  let full = 0, same = 0, crash = 0, named = 0, withKid = 0, didMarry = 0;
  for (let i = 0; i < 30; i++) {
    try {
      const s = mk({ name: '测试者' + i });
      if (s.parents && s.parents.father && s.parents.father.name[0] === s.name[0]) same++;
      let guard = 0;
      while (s.age < 95 && guard++ < 3000) {
        const it = A.step(s);
        if (!it || it.type === 'end') break;
        // 考试：把卷子答完（主 item 与 pending 两处都要答）
        if (it.type === 'exam' || (s.pending && s.pending.qz)) {
          let g2 = 0;
          while (s.pending && s.pending.qz && !s.pending.qz.done && g2++ < 20) {
            A.answerExamQ(s, Math.floor(Math.random() * 4));
          }
        }
        if (s.pending && s.pending.ev && s.pending.ev.options) {
          A.resolveEvent(s, s.pending.ev, pickChoice(s, s.pending.ev.options.length));
        } else if (s.pending && s.pending.qz) {
          let g3 = 0;
          while (s.pending && s.pending.qz && !s.pending.qz.done && g3++ < 20) {
            A.answerExamQ(s, Math.floor(Math.random() * 4));
          }
        } else if (s.pending && s.pending.schools) {
          A.resolveExam(s, 0);
        }
        // 随机人生很少自然结婚 → 成年后撮合一下，顺便验证生育链路
        if (s.age >= 24 && !s.flags.married && Math.random() < 0.25) {
          const lv = A.loveInit(s);
          const cand = (lv.candidates || []).filter(c => c && c.alive !== false);
          if (cand.length) {
            const l = cand[Math.floor(Math.random() * cand.length)];
            l.affinity = 78;
            s.stats.MONEY = Math.max(s.stats.MONEY, 30000000);
            if (A.marry(s, l).ok) didMarry++;
          }
        }
        if (s.flags.married && Math.random() < 0.5) A.tryBaby(s);
      }
      if (s.age >= 90) full++;
      if ((s.childCount || 0) > 0) {
        withKid++;
        const kids = s.children || [];
        if (kids.length === s.childCount && kids.every(c => c && c.name && c.name[0] === s.name[0])) named++;
      }
    } catch (e) { crash++; console.log('  crash:', e.message); }
  }
  ok(crash === 0, '30 局无崩溃', 'crash=' + crash);
  ok(same === 30, '每一局父亲都同姓', same + '/30');
  ok(withKid > 0, '随机人生里走到了生育', `${withKid} 局有孩子（结婚 ${didMarry} 次）`);
  ok(named === withKid, '有子女的人局：每个孩子都有姓有名', `${named}/${withKid}`);
}

console.log(fail === 0 ? '\n全部通过 ✅' : `\n${fail} 处失败 ❌`);
process.exit(fail === 0 ? 0 : 1);
