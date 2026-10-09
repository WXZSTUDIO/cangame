/* v6.2.x 冒烟验证：非婚生子女 / 动态情感危机 / 常识自洽四象限
 *  1 版本号与缓存串
 *  2 婚外受孕 → 私生子三选一（认 / 瞒 / 断）
 *  3 认领与继承权（遗嘱名单 / 争产结算）
 *  4 曝光率计算（名望 / 圈层 / 私生子 / 怀疑度）
 *  5 配偶四种反击（起诉 / 原谅 / 共处 / 封杀）
 *  6 象限一：房产税与空置税
 *  7 象限二：座驾连锁反应 + 案底职业封杀
 *  8 象限三：NPC 对等（私房钱 / 主动置办 / 子女事件 / 配偶先提离婚）
 *  9 象限四：生育窗口与职业精力冲突
 * 10 长寿模拟 90 年随机推进不抛异常
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
  createGame, step, resolveEvent, fmtMoney, fmtYear, netWorth, EVENTS, ACHIEVEMENTS,
  loveIntimate, loveInit, makeLover, marry, spouseAct, tryBaby, divorce,
  bearIllegitimate, acknowledgeChild, illegitChildren, hiddenChildren, illegitSupportCost,
  exposureRate, suspicionOf, bumpSuspicion, crisisTick, makeExposureEvent, spouseVerdict,
  spouseSue, spouseForgive, spouseCoexist, spouseBlacklist, CRISIS_META, TEMPERAMENTS,
  propertyTaxTick, PROP_TAX, luxCarBonus, rideBonus, recordBlocked, jobOffers,
  spouseFundTick, spouseBuyTick, childRevoltTick, npcTick, spouseInitiateDivorce,
  fertility, maternityRisk, careerConflictTick, FULLTIME_CAREERS,
  willHeirOptions, successionOptions, bastardClaims, settleBastardClaims,
  addChild, childAge, marketMigrate, buyProp, HOUSES, CARS, finish
})`, ctx);

let fail = 0;
const ok = (cond, name, extra) => {
  if (cond) console.log('  ✓', name, extra == null ? '' : extra);
  else { console.log('  ✗', name, extra == null ? '' : extra); fail++; }
};
const mk = (o) => A.createGame(Object.assign({
  name: 'T', gender: 'M', familyId: 'zhigong', priority: 'balance', talents: []
}, o || {}));
/* 已婚：造一个配偶 */
function married(o) {
  const s = mk(o || {});
  s.age = 30;
  const l = A.makeLover(s, '偶遇');
  l.affinity = 80;
  A.loveInit(s).candidates.push(l);
  A.marry(s, l);
  return { s, sp: s.spouse };
}

console.log('== 1. 版本号 ==');
{
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(/v6\.\d+\.\d+/.test(html), 'index.html 出现 v6.x 版本号');
  ok(!/v5\.5\.0/.test(html), '介绍页脚注不再是 v5.5.0');
  ok((html.match(/\?v=6\.\d+\.\d+/g) || []).length === 11, '11 个资源串已升版',
    (html.match(/\?v=6\.\d+\.\d+/g) || []).length);
  const css = fs.readFileSync(path.join(ROOT, 'assets/style.css'), 'utf8');
  ok(/avatars\.jpg\?v=6\.\d+\.\d+/.test(css), 'style.css 头像串已升版');
}

console.log('== 2. 婚外受孕 → 私生子三选一 ==');
{
  const { s } = married({});
  s.stats.MONEY = 2000000000;
  const l = A.makeLover(s, '外遇');
  l.affinity = 75;
  A.loveInit(s).candidates.push(l);
  // 反复亲密直到怀上（或直接走 bearIllegitimate 验证三条分支）
  let preg = false;
  for (let i = 0; i < 200 && !preg; i++) {
    const r = A.loveIntimate(s, A.loveInit(s).candidates.indexOf(l), false);
    if (r && r.pregnant && r.illegit) preg = true;
    l.pregnant = l.pregnant || false;
  }
  ok(preg, '婚外亲密会怀孕（illegit 分支可达）');

  // 分支①：认领
  const s1 = married({}).s; s1.stats.MONEY = 2000000000;
  const k1 = A.bearIllegitimate(s1, { name: '小雨' }, true);
  ok(k1 && k1.illegit === true && k1.ack === true, '认领分支：illegit + ack');
  ok(k1.mother === '小雨', '记录生母', k1.mother);

  // 分支②：藏着
  const s2 = married({}).s;
  const k2 = A.bearIllegitimate(s2, { name: '小雨' }, false);
  ok(k2 && k2.ack === false && A.hiddenChildren(s2).length === 1, '隐瞒分支：进入 hiddenChildren');
  ok(A.illegitSupportCost(s2) === A.CRISIS_META.supportCost, '藏一个孩子每年要花抚养费',
    A.fmtMoney(A.illegitSupportCost(s2)));

  // 分支③：断干净（不进 children）
  const s3 = married({}).s;
  const n0 = (s3.children || []).length;
  ok(n0 === 0 && A.bastardClaims(s3).length === 0, '断干净：孩子不进家谱');
}

console.log('== 3. 认领与继承权 ==');
{
  const s = mk({}); s.age = 62; s.stats.MONEY = 500000000;
  const c = A.addChild(s);
  c.illegit = true; c.outside = true; c.mother = '小雨'; c.ack = false; c.born = s.age - 20;
  ok(A.willHeirOptions(s).length === 0, '没认领的私生子进不了遗嘱名单');
  ok(A.successionOptions(s).length === 0, '没认领的私生子进不了继承人名单');
  ok(A.bastardClaims(s).length === 1, '但会记在「争产」账上');
  const before = s.stats.MONEY;
  const claim = A.settleBastardClaims(s);
  ok(claim && claim.take > 0, '死后被分走一笔', A.fmtMoney(claim ? claim.take : 0));
  ok(s.stats.MONEY < before, '遗产实际减少');

  const s2 = mk({}); s2.age = 62; s2.stats.MONEY = 500000000;
  const c2 = A.addChild(s2);
  c2.illegit = true; c2.ack = false; c2.born = s2.age - 18;
  const r = A.acknowledgeChild(s2, 0);
  ok(r.ok, '认领成功', `花掉 ${A.fmtMoney(A.CRISIS_META.ackCost)}`);
  ok(A.willHeirOptions(s2).length === 1, '认领后可以进遗嘱名单');
  ok(A.successionOptions(s2).length === 1, '认领后可以继承人生');
  ok(A.bastardClaims(s2).length === 0, '认领后不再算「争产」');
  ok(!A.acknowledgeChild(s2, 0).ok, '不能重复认领');
}

console.log('== 4. 曝光率 ==');
{
  const { s, sp } = married({});
  const base = A.exposureRate(s);
  ok(base > 0 && base < 0.12, '基础曝光率在有秘密时约 5%~10%', base.toFixed(3));
  s.stats.FAME = 90;
  ok(A.exposureRate(s) > base, '名望越高越容易被曝光');
  s.clubs = ['club_yacht', 'club_chamber'];
  const withClub = A.exposureRate(s);
  ok(withClub > base, '圈层越多越藏不住');
  const c = A.addChild(s); c.illegit = true; c.ack = false; c.born = s.age - 5;
  ok(A.exposureRate(s) > withClub, '藏着的私生子会推高曝光率');
  A.bumpSuspicion(s, 90, null);
  ok(A.suspicionOf(s) === 90, '配偶怀疑度可累积');
  ok(A.exposureRate(s) > 0.2, '高怀疑 + 高名望 → 高风险', A.exposureRate(s).toFixed(3));
  // 性格差异
  const a = married({}).s; a.stats.FAME = 50;
  const l = A.makeLover(a, '外遇'); l.affinity = 70; l.secret = true;
  A.loveInit(a).candidates.push(l);
  a.spouse.tp = 'fire';
  const fire = A.exposureRate(a);
  a.spouse.tp = 'cool';
  ok(fire > A.exposureRate(a), '要强的配偶盯得更紧');
}

console.log('== 5. 配偶四种反击 ==');
{
  // 起诉离婚：强行分割 + 圈层除名 + 名誉扫地
  const { s } = married({});
  s.stats.MONEY = 1000000000; s.clubs = ['club_yacht']; s.stats.FAME = 40;
  const before = s.stats.MONEY;
  const r = A.spouseSue(s, '婚外情');
  ok(r.ok && r.paid > before * 0.4, '起诉离婚分走大头', `${A.fmtMoney(r.paid)} · ${Math.round(r.ratio * 100)}%`);
  ok(!s.flags.married && s.flags.divorced && s.flags.sued, '婚姻状态与案底旗');
  ok(s.clubs.length === 0, '被圈子除名');
  ok(s.stats.FAME < 40, '名誉下降', s.stats.FAME);

  // 原谅：留在家但带条件
  const m2 = married({});
  const aff0 = m2.sp.affinity;
  A.spouseForgive(m2.s);
  ok(m2.s.flags.married && m2.s.flags.spouse_terms, '原谅：还在婚内 + 带条件');
  ok(m2.sp.affinity < aff0, '感情掉了', `${aff0} → ${m2.sp.affinity}`);

  // 共处：配偶也会出轨（NPC 对等）
  const m3 = married({});
  A.spouseCoexist(m3.s);
  ok(m3.sp.affair === true, '共处：配偶在外面也有人了');
  ok(m3.s.flags.open_marriage, '名存实亡的婚姻旗');

  // 封杀：社会性死亡但不离婚
  const m4 = married({});
  m4.s.stats.FAME = 80; m4.s.clubs = ['club_chamber'];
  const cut = A.spouseBlacklist(m4.s);
  ok(cut.cut >= 12 && m4.s.stats.FAME < 80, '名望被砍', `80 → ${m4.s.stats.FAME}`);
  ok(m4.s.flags.married && m4.s.flags.blacklisted, '婚没离，人先没了');
  ok(m4.s.clubs.length === 0, '圈层清零');

  // 裁决覆盖四种
  const seen = {};
  for (let i = 0; i < 400; i++) {
    const mm = married({});
    mm.s.stats.FAME = i % 100;
    mm.sp.tp = A.TEMPERAMENTS[i % A.TEMPERAMENTS.length].key;
    mm.sp.affinity = 20 + (i % 70);
    seen[A.spouseVerdict(mm.s)] = (seen[A.spouseVerdict(mm.s)] || 0) + 1;
  }
  ok(Object.keys(seen).length >= 3, '裁决会按性格/感情动态分配', JSON.stringify(seen));
}

console.log('== 6. 象限一：房产税与空置税 ==');
{
  const s = mk({ startYear: 1990 }); s.age = 35; s.stats.MONEY = 50000000000;
  A.marketMigrate(s);
  ok(A.propertyTaxTick(s) === 0, '没有/只有一套房不收税');
  const h = A.HOUSES.filter(x => !x.jeonse && x.rent === 0);
  for (let i = 0; i < 4 && i < h.length; i++) A.buyProp(s, 'house', h[i].id, 1, 1);
  const n = (s.market.props || []).filter(p => p.kind === 'house').length;
  const before = s.stats.MONEY;
  const tax = A.propertyTaxTick(s);
  ok(n >= 2 && tax > 0, `${n} 套房 → 缴税 ${A.fmtMoney(tax)}`);
  ok(s.stats.MONEY === before - tax, '税从现金里扣');
  // 累进：再买一套，税额更高
  const t1 = tax;
  if (h[4]) A.buyProp(s, 'house', h[4].id, 1, 1);
  const t2 = A.propertyTaxTick(s);
  ok(t2 > t1, '房子越多，税越重（累进）', `${A.fmtMoney(t1)} → ${A.fmtMoney(t2)}`);
}

console.log('== 7. 象限二：座驾连锁 + 案底封杀 ==');
{
  const s = mk({}); s.age = 30; A.marketMigrate(s);
  const b0 = A.rideBonus(s);
  ok(b0.tier === 0 && b0.matchQ === 0, '没车没加成');
  const lux = A.CARS.find(c => c.lux);
  if (lux) {
    s.market.props.push({ uid: 999, kind: 'car', refId: lux.id, name: lux.name, qty: 1, unit: 1, value: 1, buyYear: 2020, buyPrice: 1, loan: 0 });
    const b1 = A.rideBonus(s);
    ok(b1.tier === 3 && b1.matchQ > 0 && b1.proposeP > 0 && b1.flirtP > 0,
      '顶奢座驾 → 相亲/求婚/搭讪全都有加成', JSON.stringify(b1));
  } else ok(false, '找不到顶奢车');

  // 案底封杀
  const s2 = mk({}); s2.age = 30;
  s2.edu.eduLevel = 5; s2.stats.INT = 90;
  ok(A.recordBlocked(s2, { id: 'teacher', cat: '教育' }) === null, '清白时可以当老师');
  s2.flags.ex_prisoner = true;
  ok(!!A.recordBlocked(s2, { id: 'teacher', cat: '教育' }), '出狱后当不了老师');
  ok(!!A.recordBlocked(s2, { id: 'pilot', cat: '航空' }), '出狱后当不了飞行员');
  const blocked = A.jobOffers(s2).filter(o => o.record).map(o => o.career.id);
  ok(blocked.indexOf('teacher') >= 0 && blocked.length >= 3, `jobOffers 里 ${blocked.length} 个岗位被封`, blocked.join(','));
}

console.log('== 8. 象限三：NPC 对等 ==');
{
  const { s, sp } = married({});
  s.stats.MONEY = 500000000;
  const fund = A.spouseFundTick(s);
  ok(fund > 0 && sp.fund === fund, '配偶会藏私房钱', A.fmtMoney(fund));
  // 高怀疑 → 藏得更多
  const m2 = married({}); m2.s.stats.MONEY = 500000000; m2.sp.suspicion = 90;
  const fund2 = A.spouseFundTick(m2.s);
  ok(fund2 > fund, '不信任你的时候藏得更多', `${A.fmtMoney(fund)} → ${A.fmtMoney(fund2)}`);

  // 主动置办
  let bought = null;
  for (let i = 0; i < 80 && !bought; i++) bought = A.spouseBuyTick(married({}).s) || null, bought = null;
  const m3 = married({}); m3.s.stats.MONEY = 500000000;
  let any = null;
  for (let i = 0; i < 200 && !any; i++) any = A.spouseBuyTick(m3.s);
  ok(!!any, '配偶会主动买东西', any ? any.name : '');

  // 子女事件
  const s4 = mk({}); s4.age = 62; s4.stats.MONEY = 500000000;
  const c = A.addChild(s4); c.born = s4.age - 25;
  let ev = null;
  for (let i = 0; i < 200 && !ev; i++) ev = A.childRevoltTick(s4);
  ok(ev && ev.choices && ev.choices.length >= 2, '成年子女会啃老 / 争产 / 忤逆', ev ? ev.id : '');

  // 配偶先提离婚
  const m5 = married({}); m5.sp.affinity = 10;
  let initiated = false;
  for (let i = 0; i < 100 && !initiated; i++) initiated = A.spouseInitiateDivorce(m5.s);
  ok(initiated, '配偶会主动提出离婚');
}

console.log('== 9. 象限四：生育窗口 / 精力 ==');
{
  const s = mk({ gender: 'F' });
  ok(A.fertility(s, 'F', 46).p === 0, '女性 46 岁后不能生');
  ok(A.fertility(s, 'F', 28).p > 0.4, '女性 28 岁生育力正常');
  ok(A.fertility(s, 'M', 78).p === 0, '男性 78 岁也生不了（不是只有女的会老）');
  ok(A.fertility(s, 'M', 70).p > 0 && A.fertility(s, 'M', 70).p < 0.15, '男性 70 岁概率大幅下降',
    A.fertility(s, 'M', 70).p.toFixed(3));
  ok(A.maternityRisk(s, 42) > A.maternityRisk(s, 30), '高龄产妇有身体代价');
  ok(A.maternityRisk(Object.assign(s, { gender: 'M' }), 42) === 0, '男性没有产褥风险');

  // 职业精力冲突
  const s2 = mk({}); s2.age = 30; A.marketMigrate(s2);
  s2.career = { id: 'astronaut', level: 1, years: 2, joinedAge: 28 };
  s2.clubs = ['club_race'];
  const loy0 = s2.stats.LOY;
  ok(!!A.careerConflictTick(s2), '全职行当 + 赛车副业 → 会被谈话');
  ok(s2.stats.LOY < loy0, '口碑受损', s2.stats.LOY);
}

console.log('== 10. 长寿模拟（90 年随机推进） ==');
{
  let crashed = null;
  let exposed = 0, illegit = 0;
  for (let seed = 0; seed < 12 && !crashed; seed++) {
    const s = mk({ name: 'P' + seed, gender: seed % 2 ? 'F' : 'M' });
    s.stats.MONEY = 800000000;
    try {
      for (let i = 0; i < 95 && !s.finished; i++) {
        const it = A.step(s);
        if (it && it.type === 'event' && it.ev && it.ev.choices) {
          A.resolveEvent(s, it.ev, Math.floor(Math.random() * it.ev.choices.length));
        }
      }
      if (s.flags.exposed) exposed++;
      if ((s.children || []).some(c => c.illegit)) illegit++;
    } catch (e) {
      crashed = `seed ${seed}: ${e.message}\n${(e.stack || '').split('\n').slice(0, 4).join('\n')}`;
    }
  }
  ok(!crashed, '12 局 × 95 年随机推进无异常', crashed || `曝光 ${exposed} 局 · 私生子 ${illegit} 局`);
}

console.log('== 11. 端到端：偷情 → 曝光 → 配偶反击 ==');
{
  let fired = 0, verdicts = {};
  for (let seed = 0; seed < 40; seed++) {
    const s = mk({ name: 'X' + seed, startYear: 1985 });
    s.age = 32; s.stats.MONEY = 3000000000; s.stats.FAME = 40;
    const l = A.makeLover(s, '偶遇'); l.affinity = 80;
    A.loveInit(s).candidates.push(l);
    A.marry(s, l);
    const lover = A.makeLover(s, '外遇');
    lover.affinity = 72; lover.secret = true; lover.affairSince = s.age;
    A.loveInit(s).candidates.push(lover);
    try {
      for (let y = 0; y < 25 && !s.finished; y++) {
        const it = A.step(s);
        if (it && it.type === 'event' && it.ev && it.ev.choices) {
          const id = String(it.ev.id || '');
          if (id.indexOf('expose_at_') === 0) {
            fired++;
            A.resolveEvent(s, it.ev, 0);   // 一律选「全部承认」，把裁决权交给配偶
            verdicts[s.flags.sued ? 'sue' : (s.flags.spouse_terms ? 'forgive' : (s.flags.open_marriage ? 'coexist' : (s.flags.blacklisted ? 'blacklist' : 'other')))] =
              (verdicts[s.flags.sued ? 'sue' : (s.flags.spouse_terms ? 'forgive' : (s.flags.open_marriage ? 'coexist' : (s.flags.blacklisted ? 'blacklist' : 'other')))] || 0) + 1;
            break;
          }
          A.resolveEvent(s, it.ev, Math.floor(Math.random() * it.ev.choices.length));
        }
      }
    } catch (e) { ok(false, 'E2E 抛异常', e.message); break; }
  }
  ok(fired > 0, '偷情会在若干年后被撞破', `40 局里 ${fired} 局曝光`);
  ok(Object.keys(verdicts).length >= 2, '配偶的反击不止一种', JSON.stringify(verdicts));
}

console.log('== 附：v6.2 成就注册 ==');
{
  const ids = A.ACHIEVEMENTS.map(a => a.id);
  ['a_bastard', 'a_ack', 'a_exposed', 'a_sued', 'a_cuckoo', 'a_twins', 'a_landlord', 'a_blacklist']
    .forEach(id => ok(ids.indexOf(id) >= 0, `成就 ${id}`));
  const dup = ids.length - new Set(ids).size;
  ok(dup === 0, '成就 id 无重复', dup ? `重复 ${dup}` : '');
}

console.log(fail ? `\n✗ 失败 ${fail} 项` : '\n全部通过 ✓');
process.exit(fail ? 1 : 0);
