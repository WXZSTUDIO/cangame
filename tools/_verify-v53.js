/* v5.3 专项验证：恋人年龄 / 离婚与婚外 / 安全亲密 / 家庭账簿动态 / 小学同学 / 疾病致死 / 成就 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const ctx = { console, Math, JSON, Date, isNaN, parseInt, parseFloat, Number, String, Array, Object };
vm.createContext(ctx);
['assets/data.js', 'assets/market.js', 'assets/engine.js', 'assets/school.js', 'assets/career.js', 'assets/love.js', 'assets/loan.js']
  .forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));

const A = vm.runInContext(`({
  createGame, step, resolveEvent, loveInit, loveAct, loveIntimate, loveTick, propose, marry, divorce,
  makeAffairEvent, makeMarriageEvent, meetByMatchmaker, makeLover, LOVE_META,
  familyTick, familyIncome, illnessTick, treatIllness, cureChance, illStageCn, illnessRisk,
  checkAchievements, buyLottery, ACHIEVEMENTS, ILLNESS, LOTTERY, CORE_STATS, FAMILY_ACTS,
  schoolStageOf, stageCn, refreshClassmates, livingCost, fmtMoney
})`, ctx);

let fail = 0;
const ok = (cond, name, extra) => {
  if (cond) console.log('  ✓', name, extra == null ? '' : extra);
  else { console.log('  ✗', name, extra == null ? '' : extra); fail++; }
};

console.log('== 1. 恋爱对象会一年年变老 ==');
{
  const s = A.createGame({ name: 'T', gender: 'M', familyId: 'shangren', priority: 'balance', talents: [] });
  s.age = 24; s.stats.MONEY = 300000000;
  A.meetByMatchmaker(s);
  const l = A.loveInit(s).candidates[0];
  const a0 = l.age;
  A.loveTick(s);
  const a1 = l.age;
  s.age++; A.loveTick(s);
  ok(l.age === a0 + 2 && a1 === a0 + 1, '候选人每年 +1 岁', `${a0} → ${a1} → ${l.age}`);
  // 配偶也要长岁
  const s2 = A.createGame({ name: 'T2', gender: 'F', familyId: 'jiaoshi', priority: 'balance', talents: [] });
  s2.age = 26; s2.stats.MONEY = 400000000;
  A.meetByMatchmaker(s2);
  const p = A.loveInit(s2).candidates[0];
  p.affinity = 90;
  A.marry(s2, p);
  const sp0 = s2.spouse.age;
  s2.age++; A.loveTick(s2);
  ok(s2.spouse.age === sp0 + 1, '配偶每年 +1 岁', `${sp0} → ${s2.spouse.age}`);
}

console.log('== 2. 结婚后可以离婚 ==');
{
  const s = A.createGame({ name: 'T', gender: 'M', familyId: 'tizhinei', priority: 'balance', talents: [] });
  s.age = 28; s.stats.MONEY = 500000000;
  A.meetByMatchmaker(s);
  const l = A.loveInit(s).candidates[0];
  l.affinity = 90;
  A.marry(s, l);
  ok(s.flags.married === true, '结婚成功');
  const before = s.stats.MONEY;
  const r = A.divorce(s, '过不下去了');
  ok(r.ok, '离婚执行成功');
  ok(!s.flags.married && s.flags.divorced, '婚姻状态已解除', `divorced=${!!s.flags.divorced}`);
  ok(!!s.ex && s.ex.name === l.name, '前任记录在案', s.ex ? s.ex.name : '—');
  ok(s.stats.MONEY < before, '分走了一部分家产', `${A.fmtMoney(before)} → ${A.fmtMoney(s.stats.MONEY)}`);
  ok(A.divorce(s).ok === false, '不能离第二次');
}

console.log('== 3. 已婚也能和别人发生关系（出轨有代价） ==');
{
  const s = A.createGame({ name: 'T', gender: 'M', familyId: 'tizhinei', priority: 'balance', talents: [] });
  s.age = 30; s.stats.MONEY = 600000000;
  A.meetByMatchmaker(s);
  const w = A.loveInit(s).candidates[0];
  w.affinity = 90;
  A.marry(s, w);
  const lover = A.makeLover(s, '偶遇');
  lover.affinity = 80; lover.age = 28;
  A.loveInit(s).candidates.push(lover);
  const eth0 = s.stats.ETH;
  const idx = A.loveInit(s).candidates.indexOf(lover);
  const r = A.loveIntimate(s, idx, false);
  ok(r.ok, '已婚仍可越界', r.ok ? '' : r.msg);
  ok(r.affair === true, '标记为婚外关系');
  ok(s.stats.ETH < eth0, '道德受损', `${Math.round(eth0)} → ${Math.round(s.stats.ETH)}`);
  ok(!s.flags.married ? false : true, '越界后婚姻仍在（由事件决定走向）');
  const ev = A.makeAffairEvent(s, lover);
  ok(ev.choices.length === 3, '东窗事发有三条路', ev.choices.map(c => c.text).join(' / '));
}

console.log('== 4. 做好措施的亲密几乎不会怀孕 ==');
{
  let preg = 0, N = 400;
  for (let i = 0; i < N; i++) {
    const s = A.createGame({ name: 'T', gender: 'M', familyId: 'shangren', priority: 'balance', talents: [] });
    s.age = 22; s.stats.MONEY = 200000000; s.stats.CHA = 70;
    const l = A.makeLover(s, '偶遇');
    l.affinity = 80; l.look = 90;
    A.loveInit(s).candidates.push(l);
    const r = A.loveIntimate(s, 0, true);
    if (r.pregnant) preg++;
  }
  const rate = preg / N;
  ok(rate < 0.03, `安全亲密怀孕率 ${(rate * 100).toFixed(1)}%（远低于普通亲密）`, `${preg}/${N}`);
  // 对照组：不做措施的概率明显更高
  let preg2 = 0;
  for (let i = 0; i < N; i++) {
    const s = A.createGame({ name: 'T', gender: 'M', familyId: 'shangren', priority: 'balance', talents: [] });
    s.age = 22; s.stats.MONEY = 200000000; s.stats.CHA = 70;
    const l = A.makeLover(s, '偶遇');
    l.affinity = 80; l.look = 90;
    A.loveInit(s).candidates.push(l);
    if (A.loveIntimate(s, 0, false).pregnant) preg2++;
  }
  ok(preg2 > preg * 3, `不做措施怀孕率显著更高 ${(preg2 / N * 100).toFixed(1)}%`, `${preg2}/${N}`);
}

console.log('== 5. 家庭账簿每年都在动，父母有行为 ==');
{
  const s = A.createGame({ name: 'T', gender: 'M', familyId: 'xiangong', priority: 'balance', talents: [] });
  s.startYear = 1985;
  const seen = { income: 0, delta: [], debt: [], acts: 0 };
  let actYears = 0;
  for (let y = 0; y < 25; y++) {
    s.age = y;
    const r = A.familyTick(s);
    if (!r) break;
    seen.income = r.income;
    seen.delta.push(r.delta);
    seen.debt.push(Math.round(s.family.debt));
    if (r.act) actYears++;
  }
  ok(seen.income > 0, '家庭有年收入', A.fmtMoney(seen.income));
  ok(new Set(seen.delta).size > 3, '每年结余都不一样（不是固定值）', seen.delta.slice(0, 6).join(','));
  ok(new Set(seen.debt).size > 1, '负债会随收支变化', seen.debt.slice(0, 8).join(','));
  ok(actYears >= 5, `父母每年有行为（25 年里 ${actYears} 次）`, actYears);
  ok(s.log.some(l => l.type === 'fam'), '家里发生的事会写进人生流水');
  ok(A.FAMILY_ACTS.length >= 14, '家庭行为事件数量', A.FAMILY_ACTS.length);
  // 成年后账簿依然活着
  const s2 = A.createGame({ name: 'T2', gender: 'F', familyId: 'jiaoshi', priority: 'balance', talents: [] });
  s2.startYear = 1990; s2.age = 30;
  const d0 = Math.round(s2.family.debt);
  let changed = false;
  for (let i = 0; i < 6; i++) { s2.age++; A.familyTick(s2); if (Math.round(s2.family.debt) !== d0) changed = true; }
  ok(changed, '成年后家庭账簿仍在变化', `${A.fmtMoney(d0)} → ${A.fmtMoney(s2.family.debt)}`);
}

console.log('== 6. 小学就有同学了 ==');
{
  const s = A.createGame({ name: 'T', gender: 'M', familyId: 'jiaoshi', priority: 'balance', talents: [] });
  s.startYear = 2000;
  for (let a = 1; a <= 9; a++) { s.age = a; s.job = '小学生'; A.step(s); }
  ok((s.classmates || []).length > 0, '小学阶段通讯录里有人', (s.classmates || []).length + ' 人');
  ok(A.schoolStageOf(s) === 'pri', '阶段判定为小学', A.schoolStageOf(s));
  ok(A.stageCn('pri') === '小学', '阶段名显示为小学', A.stageCn('pri'));
  ok((s.classmates || []).every(c => c.stage === 'pri'), '这批同学都标着小学');
  const c0 = s.classmates[0];
  ok(c0.age != null, '同学也有年龄', c0.age);
}

console.log('== 7. 健康低会强制生病，不治会恶化到死 ==');
{
  const s = A.createGame({ name: 'T', gender: 'M', familyId: 'kuangqu', priority: 'balance', talents: [] });
  s.startYear = 1990; s.age = 50; s.stats.HP = 20; s.stats.MONEY = 10;
  let got = null, guard = 0;
  while (!got && guard++ < 12) { got = A.illnessTick(s); }
  ok(!!s.ill, '健康过低会强制得病', s.ill ? s.ill.name : '—');
  ok((s.extraQueue || []).some(q => String(q.ev.id).indexOf('ill_at_') === 0), '生病弹出强制事件');
  ok((s.extraQueue || [])[0].ev.choices.length === 3, '生病有三个选择（硬扛 / 诊所 / 住院）');
  // 一直硬扛 → 恶化 → 死亡（多次采样，单次走到哪一步有随机性）
  let reached3 = 0, deadN = 0, sample = '';
  for (let n = 0; n < 12; n++) {
    const s2 = A.createGame({ name: 'T2', gender: 'F', familyId: 'kuangqu', priority: 'balance', talents: [] });
    s2.startYear = 1990; s2.age = 58; s2.stats.HP = 50; s2.stats.MONEY = 5;
    let g2 = 0;
    while (!s2.ill && g2++ < 20) A.illnessTick(s2);
    let stages = [];
    for (let i = 0; i < 30 && !s2.finished; i++) {
      s2.age++;
      if (s2.ill) stages.push(s2.ill.stage);
      A.illnessTick(s2);
    }
    if (stages.some(x => x >= 3)) reached3++;
    if (s2.finished) deadN++;
    if (!sample) sample = stages.join('→');
  }
  ok(reached3 >= 9, '不治会一路恶化到重度以上', `${reached3}/12 例 · 例：${sample}`);
  ok(deadN >= 10, '一直不治最终会病死', `${deadN}/12 例`);
  // 及时治疗能治好
  const s3 = A.createGame({ name: 'T3', gender: 'M', familyId: 'yiliao', priority: 'balance', talents: [] });
  s3.startYear = 2000; s3.age = 45; s3.stats.HP = 60; s3.stats.MONEY = 5000000000;
  let g3 = 0;
  while (!s3.ill && g3++ < 60) { s3.age++; A.illnessTick(s3); }
  if (s3.ill) {
    const r = A.treatIllness(s3, 'hospital');
    ok(r.ok && (r.cured || !s3.ill), '花钱治疗能治好', r.cured ? '已痊愈' : '还需疗程');
  } else { ok(false, '未能触发疾病用于治疗验证'); }
}

console.log('== 8. 属性简化与成就 ==');
{
  ok(A.CORE_STATS.length === 6, '核心属性精简为 6 项', A.CORE_STATS.map(x => x.name).join('/'));
  ok(A.CORE_STATS.some(x => x.key === 'HP') && A.CORE_STATS.some(x => x.key === 'MOOD'), '健康与心情在核心位');
  ok(A.ACHIEVEMENTS.length >= 15, '成就数量', A.ACHIEVEMENTS.length);
  const s = A.createGame({ name: 'T', gender: 'M', familyId: 'tizhinei', priority: 'balance', talents: [] });
  s.age = 30; s.childCount = 1; s.flags.own_house = true; s.pet = { name: '旺财', type: 'dog', alive: true };
  const got = A.checkAchievements(s);
  ok((s.achievements || []).length >= 3, '成就会自动解锁', (s.achievements || []).join(','));
  ok(!!got, '返回本次解锁的成就', got ? got.name : '—');
  const n = s.achievements.length;
  A.checkAchievements(s);
  ok(s.achievements.length === n, '同一成就不会重复解锁');
  // 彩票
  const s2 = A.createGame({ name: 'T2', gender: 'F', familyId: 'shangren', priority: 'balance', talents: [] });
  s2.age = 25; s2.stats.MONEY = 100000000;
  const r = A.buyLottery(s2);
  ok(r.ok, '一年可以买一张彩票', r.name);
  ok(A.buyLottery(s2).ok === false, '一年只能买一张');
}

console.log(fail === 0 ? '\n全部通过 ✅' : `\n失败 ${fail} 项 ❌`);
process.exit(fail ? 1 : 0);
