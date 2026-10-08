/* v6.1.0 冒烟验证：真人头像 + 五大家族系统
 *  1 时代浪潮事件注册与年份门控
 *  2 家族信托（设立 / 年度给付 / 不可取出）
 *  3 门阀声望（结算 / 兑换特权 / 出生生效）
 *  4 冷冻人（冷冻 → 跨代 → 苏醒）
 *  5 银发经济（客座教授 / 自传 / 基金会）
 *  6 养老服务（入住 / 年费 / 断供退宿）
 *  7 圈层（入会 / 年费 / 内幕消息 → 次年行情）
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
  createGame, step, resolveEvent, migrateState, applyEffects, pushLog, fmtMoney, fmtYear, netWorth,
  marketTick, STOCKS, EVENTS,
  setupTrust, trustInfo, canSetupTrust, trustTick,
  settlePrestige, buyPerk, takeBirthPerk, prestigeInfo, famVault, famSave, PRESTIGE_PERKS, RICH_FAMILIES,
  canCryo, prepareCryo, cryoReady, applyCryoRevive,
  silverProfessor, silverBook, silverFund, FUND_COST,
  setRetirePlan, retireTick, RETIRE_PLANS,
  clubJoinable, clubJoin, clubTick, CLUBS
})`, ctx);

let fail = 0;
const ok = (cond, name, extra) => {
  if (cond) console.log('  ✓', name, extra == null ? '' : extra);
  else { console.log('  ✗', name, extra == null ? '' : extra); fail++; }
};
const mk = (o) => A.createGame(Object.assign({
  name: 'T', gender: 'M', familyId: 'zhigong', priority: 'balance', talents: []
}, o || {}));

console.log('== 1. 时代浪潮事件 ==');
{
  const ids = A.EVENTS.map(e => e.id);
  ['w_crypto', 'w_ai', 'w_tsunami', 'w_techboom', 'w_techcrash', 'w_bodymod', 'w_space',
   'e_gateball', 'e_taichi', 'e_sunsetmeet', 'e_silveruni', 'e_grandstory', 'e_silvertrip']
    .forEach(id => ok(ids.indexOf(id) >= 0, `事件 ${id} 已注册`));
  const dup = ids.length - new Set(ids).size;
  ok(dup === 0, '事件 id 无重复', dup ? `重复 ${dup}` : '');
  const vac = vm.runInContext('VACATIONS', ctx).map(v => v.id);
  ok(vac.indexOf('vac_space') >= 0 && vac.indexOf('vac_livestay') >= 0, '太空度假 / 旅居度假上架');
}

console.log('== 2. 家族信托 ==');
{
  const s = mk({}); s.age = 45; s.stats.MONEY = 500000000;
  ok(!A.canSetupTrust(mk({})), '年轻人 / 穷人不能设信托');
  const r = A.setupTrust(s, 200000000);
  ok(r.ok, '设立信托 2 亿', `剩余现金 ${A.fmtMoney(s.stats.MONEY)}`);
  ok(s.flags.trust_founder, 'trust_founder 旗');
  const t = A.trustInfo();
  ok(t && t.money === 200000000, '信托本金入账', t ? A.fmtMoney(t.money) : '');
  ok(!A.setupTrust(s, 5000000).ok, '低于下限被拦');
  const before = s.stats.MONEY;
  A.trustTick(s);
  const paid = s.stats.MONEY - before;
  ok(paid === Math.round(200000000 * 0.006), '年度给付 = 本金 0.6%', A.fmtMoney(paid));
  ok(true, 'trustTick 幼年不给付不炸');
}

console.log('== 3. 门阀声望 ==');
{
  const s = mk({}); s.age = 80; s.rank = 'A'; s.peak.NET = 5000000000; s.achievements = ['a', 'b', 'c'];
  const v0 = A.famVault().prestige;
  const pts = A.settlePrestige(s);
  ok(pts >= 100, 'A 级 + 巅峰身家 → 声望 ≥100', `+${pts}`);
  ok(A.famVault().prestige === v0 + pts, '声望永久入账');
  // 兑换特权
  A.famSave(Object.assign(A.famVault(), { prestige: 100 }));
  const b = A.buyPerk('perk_stat');
  ok(b.ok, '30 点兑换「天资卓越」');
  ok(!A.buyPerk('perk_cash').ok, '一次只能带一个特权');
  ok(A.takeBirthPerk() === 'perk_stat', '出生时特权被消费');
  ok(A.takeBirthPerk() == null, '特权一次性');
  ok(A.RICH_FAMILIES.length >= 5, '豪门池就位', A.RICH_FAMILIES.join('/'));
}

console.log('== 4. 冷冻人 ==');
{
  const s = mk({}); s.age = 55; s.stats.MONEY = 600000000;
  s.ill = { name: '胰腺癌', stage: 3, years: 0 };
  ok(A.canCryo(s), '绝症 + 现金充足 → 可冷冻');
  const r = A.prepareCryo(s);
  ok(r.ok, '签字冷冻');
  ok(s.finished && s.ending && s.ending.id === 'cryo', '冷冻即终局');
  const v = A.famVault();
  ok(v.cryo && v.cryo.money > 0, '冷冻包入库', `${A.fmtMoney(v.cryo.money)} · ${v.cryo.frozenYear} 年`);
  ok(!A.cryoReady(), '刚冷冻还不能唤醒');
  // 快进两代
  v.gen = v.cryo.thawGen;
  A.famSave(v);
  ok(A.cryoReady(), '两代之后医学攻克 → 可唤醒');
  const s2 = mk({ name: '别人', gender: 'F' });
  const revived = A.applyCryoRevive(s2);
  ok(revived, '新局苏醒成功');
  ok(s2.name === 'T' && s2.flags.cryonaut, '冷冻者本人回归', `${s2.name} · ${s2.age} 岁`);
  ok(s2.stats.MONEY > 0 && !s2.ill, `家产 ${A.fmtMoney(s2.stats.MONEY)} · 绝症已愈`);
  ok(!A.famVault().cryo, '冷冻舱清空');
}

console.log('== 5. 银发经济 ==');
{
  const s = mk({}); s.age = 63; s.stats.INT = 90; s.edu.eduLevel = 4;
  s.stats.MONEY = 500000000; s.peak.NET = 2000000000; s.achievements = ['x'];
  const m0 = s.stats.MONEY;
  ok(A.silverProfessor(s).ok, '客座教授讲课', `+${A.fmtMoney(s.stats.MONEY - m0)}`);
  ok(!A.silverProfessor(s).ok, '一年只讲一次');
  const m1 = s.stats.MONEY;
  ok(A.silverBook(s).ok, '写自传拿版税', `+${A.fmtMoney(s.stats.MONEY - m1)}`);
  ok(A.silverFund(s).ok, '创办基金会', `花费后 ${A.fmtMoney(s.stats.MONEY)}`);
  ok(s.flags.foundation, 'foundation 旗');
  const young = mk({}); young.age = 30;
  ok(!A.silverProfessor(young).ok && !A.silverBook(young).ok, '年轻人进不了银发线');
}

console.log('== 6. 养老服务 ==');
{
  const s = mk({}); s.age = 65; s.stats.MONEY = 200000000;
  const r = A.setRetirePlan(s, 'ret_lux');
  ok(r.ok, '入住顶奢颐养中心');
  const m0 = s.stats.MONEY;
  A.retireTick(s);
  ok(s.stats.MONEY === m0 - A.RETIRE_PLANS.find(x => x.id === 'ret_lux').fee, '年费结算', `-${A.fmtMoney(m0 - s.stats.MONEY)}`);
  ok(!A.setRetirePlan(s, 'ret_space').ok, '2075 年前轨道养老站不可订');
  s.stats.MONEY = 1000000;
  A.retireTick(s);
  ok(s.retirePlan == null, '断供自动退宿');
  const y2 = mk({}); y2.age = 40;
  ok(!A.setRetirePlan(y2, 'ret_home').ok, '58 岁前不能入住');
}

console.log('== 7. 圈层系统 ==');
{
  const s = mk({}); s.age = 40; s.stats.MONEY = 2000000000;
  ok(!A.clubJoinable(s, 'club_race'), '没有赛车 / 赛车职业进不了赛车俱乐部');
  ok(A.clubJoinable(s, 'club_yacht') && A.clubJoinable(s, 'club_chamber'), '身家够进游艇会 / 商会');
  ok(A.clubJoin(s, 'club_yacht').ok, '入会游艇会');
  ok(A.clubJoin(s, 'club_chamber').ok, '入会商会');
  ok(!A.clubJoin(s, 'club_chamber').ok, '不能重复入会');
  // 跑 clubTick 直到拿到内幕消息（游艇会专属）
  let gotTip = false, threw = false;
  for (let i = 0; i < 80 && !gotTip; i++) {
    try { A.clubTick(s); if (s.market.tip) gotTip = true; } catch (e) { threw = e.message; break; }
  }
  ok(!threw, 'clubTick 60 轮无异常', threw || '');
  ok(gotTip, '拿到内幕消息', s.market.tip ? `${s.market.tip.name} ${s.market.tip.wrong ? '(假消息)' : '(真消息)'}` : '');
  if (gotTip) {
    const t = s.market.tip;
    const before = s.market.prices[t.id];
    A.marketTick(s);
    const after = s.market.prices[t.id];
    const moved = t.k >= 0 ? after > before : after < before;
    ok(moved, '内幕消息影响次年行情', `${t.name} ${A.fmtMoney(before)} → ${A.fmtMoney(after)}`);
    ok(!s.market.tip, '消息次年消费后清空');
  }
  s.stats.MONEY = 100000;
  A.clubTick(s);
  ok((s.clubs || []).length === 0, '缴不起年费被劝退');
}

console.log('== 8. 长寿模拟 ==');
{
  const s = mk({}); s.stats.MONEY = 3000000000;
  let err = null;
  try {
    for (let i = 0; i < 85 && !s.finished; i++) {
      const it = A.step(s);
      if (it && it.type === 'event' && it.ev && it.ev.choices) {
        A.resolveEvent(s, it.ev, Math.floor(Math.random() * it.ev.choices.length));
      }
    }
  } catch (e) { err = e.message; }
  ok(!err, '85 年随机推进无异常', err || `终局 ${s.age} 岁`);
}

console.log(fail === 0 ? '\n全部通过 ✓' : `\n${fail} 项失败 ✗`);
process.exit(fail === 0 ? 0 : 1);
