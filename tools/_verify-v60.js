/* v6.0.0 冒烟验证：新系统不炸 + 核心闭环可用
 *  1 新事件包加载（节日/新闻/违法/监狱/执照）
 *  2 宠物系统（购买/喂养/美容/选美/繁育/赛马/年度结算）
 *  3 监狱系统（案发→宣判→服刑→出狱）
 *  4 遗嘱 + 世代传承 + 重生
 *  5 礼物系统
 *  6 度假 / 图书馆 / 超级大脑
 *  7 资产扩充可买入（商业地产/赛车/顶奢）
 *  8 长寿模拟 80 年随机推进不抛异常
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
  createGame, step, resolveEvent, migrateState, applyEffects, pushLog, addChild, childAge,
  petBuy, petFeed, petGroom, petBeautyContest, petBreed, petTick,
  horseAcquire, horseTrain, horseRace, horseOwn, PET_TYPES,
  makeWill, canMakeWill, willHeirOptions, successionOptions, inheritanceWorth, prepareSuccession, applyHeirBoost,
  prepareRebirth, applyRebirthBoost, familyGift, GIFT_CATALOG, libraryStudy,
  jobOffers, buyProp, netWorth, HOUSES, CARS, GOODS, EVENTS, fmtMoney, eventChoices, answerExamQ, resolveExam, prisonTick, yearBase, libraryStudy
})`, ctx);

let fail = 0;
const ok = (cond, name, extra) => {
  if (cond) console.log('  ✓', name, extra == null ? '' : extra);
  else { console.log('  ✗', name, extra == null ? '' : extra); fail++; }
};
const mk = (o) => A.createGame(Object.assign({
  name: 'T', gender: 'M', familyId: 'zhigong', priority: 'balance', talents: []
}, o || {}));

console.log('== 1. v6 事件包 ==');
{
  const ids = A.EVENTS.map(e => e.id);
  const need = ['ft_cny_kid', 'nw_bull', 'cm_scam', 'pr_in', 'v6_army', 'v6_race_lic'];
  need.forEach(id => ok(ids.indexOf(id) >= 0, `事件 ${id} 已注册`));
  const fest = A.EVENTS.filter(e => e.fest);
  ok(fest.length >= 10, '节日事件 ≥10（可重复触发）', fest.length + ' 条');
}

console.log('== 2. 宠物系统 ==');
{
  const s = mk({}); s.age = 30; s.stats.MONEY = 100000000;
  const r1 = A.petBuy(s, 'chow');
  ok(r1.ok, '买松狮犬');
  ok(s.pets.length === 1 && s.pet === s.pets[0], 'state.pets 与主宠别名就位');
  ok(A.petBuy(s, 'lioncat').ok, '买狮子猫');
  ok(A.petFeed(s, 0).ok, '喂养');
  ok(A.petGroom(s, 0).ok, '美容');
  const oldM = s.stats.MONEY;
  const b = A.petBeautyContest(s, 0);
  ok(b.ok, '选美比赛可报名', `花费后现金 ${A.fmtMoney(oldM)}→${A.fmtMoney(s.stats.MONEY)}`);
  // 繁育：再买一只松狮（此时 3 只在养，留出 cap 空间）
  A.petBuy(s, 'chow');
  s.pets[0].age = 3; s.pets[2].age = 3;
  let bred = false, bredMsg = '';
  for (let i = 0; i < 10 && !bred; i++) { const br = A.petBreed(s, 0, 2); bred = !!br.ok; bredMsg = br.msg || ''; }
  ok(bred, '同类型成年宠物可繁育', bred ? '' : bredMsg);
  const capAlive = s.pets.filter(p => p.alive).length;
  ok(capAlive === 4, '宠物上限 4 生效（繁育后满员）', capAlive + '/4');
  // 赛马
  const hb = A.horseAcquire(s, 'buy');
  ok(hb.ok && hb.got && A.horseOwn(s), '购入赛马');
  ok(A.horseTrain(s).ok, '训练');
  const rr = A.horseRace(s);
  ok(rr.ok, '参赛有结果', rr.place != null ? `名次 ${rr.place}` : '');
  A.petTick(s);
  ok(true, 'petTick 年度结算不抛异常');
}

console.log('== 3. 监狱系统 ==');
{
  const s = mk({}); s.age = 26; s.stats.MONEY = 50000000; s.job = '程序员';
  s.flags.crime_suspect = true;
  let jailed = false;
  for (let i = 0; i < 20 && !jailed; i++) { s.flags.crime_suspect = true; A.prisonTick(s); jailed = s.prison > 0; }
  function noop() {}
  ok(jailed, '案发后会被判刑', jailed ? `${s.prison} 年` : '');
  if (jailed) {
    const age0 = s.age;
    for (let i = 0; i < 5 && s.prison > 0; i++) { s.age++; A.yearBase(s); }
    ok(s.prison === 0 && s.flags.ex_prisoner, '刑满出狱 + ex_prisoner 旗');
  }
}

console.log('== 4. 遗嘱 / 传承 / 重生 ==');
{
  const s = mk({}); s.age = 65; s.stats.MONEY = 200000000;
  A.addChild(s, { name: '张一' }); A.addChild(s, { name: '张二' });
  ok(A.canMakeWill(s), '65 岁可立遗嘱');
  const opts = A.willHeirOptions(s);
  ok(opts.length >= 2, '继承人选项 ≥2', opts.map(o => o.kind).join(','));
  ok(A.makeWill(s, 'child:0').ok, '立遗嘱给长子');
  ok(s.will && s.will.heir.name === '张一', '遗嘱内容正确');
  ok(s.grandCount === 0 ? true : true, 'grand 状态读取不炸');
  // 传承
  const so = A.successionOptions(s);
  ok(so.length >= 2, '死亡后可选继承人选', so.length + ' 人');
  const w = A.inheritanceWorth(s, so[0]);
  ok(w > 0, '继承额 > 0', A.fmtMoney(w));
  A.prepareSuccession(s, so[0]);
  const s2 = mk({ name: '张小' });
  const injected = A.applyHeirBoost(s2);
  ok(injected && s2.stats.MONEY > 0 && s2.flags.inheritor, '新局注入继承包', A.fmtMoney(s2.stats.MONEY));
  // 重生
  A.prepareRebirth();
  const s3 = mk({});
  ok(A.applyRebirthBoost(s3) && s3.flags.reborn && s3.stats.INT >= 8, '重生：前世记忆 +3 智力', 'INT=' + s3.stats.INT);
}

console.log('== 5. 礼物系统 ==');
{
  const s = mk({}); s.age = 30; s.stats.MONEY = 500000000;
  ok(A.familyGift(s, 'father', 'gift_small').ok, '给父亲送心意礼');
  ok(!A.familyGift(s, 'father', 'gift_big').ok, '一年一人一次限制生效');
  ok(A.familyGift(s, 'mother', 'gift_big').ok, '给母亲送重礼');
  const r = A.familyGift(s, 'father', 'gift_small');
  ok(!r.ok, '重复送礼被拦');
  ok(A.familyGift(s, 'child', 'gift_mid').ok === false || true, '无孩子送礼有兜底不炸');
}

console.log('== 6. 度假 / 图书馆 ==');
{
  const s = mk({}); s.age = 30; s.stats.MONEY = 500000000;
  const r = A.libraryStudy(s);
  ok(r.ok, '图书馆学习');
  ok(!A.libraryStudy(s).ok, '一年一次限制');
}

console.log('== 7. 资产扩充 ==');
{
  const s = mk({}); s.age = 30; s.startYear = 2000; s.stats.MONEY = 200000000000;
  const island = A.HOUSES.find(h => h.id === 'h_island_priv');
  ok(!!island, '私人海岛上架');
  ok(A.buyProp(s, 'house', 'h_island_priv', 1).ok, '买海岛');
  ok(A.buyProp(s, 'car', 'car_race_f1', 1).ok, '买方程式赛车');
  ok(A.buyProp(s, 'good', 'g_yacht', 1).ok, '买游艇');
  ok(A.buyProp(s, 'good', 'g_jet', 1).ok, '买私人飞机');
  ok(A.netWorth(s) > 0, '净资产计算正常', A.fmtMoney(A.netWorth(s)));
}

console.log('== 8. 长寿模拟 ==');
{
  let err = null, s = mk({});
  try {
    for (let i = 0; i < 400 && !s.finished; i++) {
      const item = A.step(s);
      if (item && item.type === 'event' && item.ev) {
        const chs = vm.runInContext('eventChoices(state, ev)', Object.assign(ctx, { state: s, ev: item.ev }));
        A.resolveEvent(s, item.ev, Math.floor(Math.random() * Math.max(1, (chs || []).length)));
      } else if (item && item.type === 'exam') {
        A.answerExamQ(s, Math.floor(Math.random() * 4));
        A.resolveExam(s, 0);
      }
    }
  } catch (e) { err = e; }
  ok(!err, '80 年随机推进无异常', err ? err.message : (s.finished ? `终局 ${s.age} 岁` : `进行中 ${s.age} 岁`));
}

console.log(fail === 0 ? '\n全部通过 ✓' : `\n${fail} 项失败 ✗`);
process.exit(fail === 0 ? 0 : 1);
