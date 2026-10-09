/* S-01 ③ 减压行动专项验证
 * ---------------------------------------------------------
 * 守的是 stress-respec.md §2.③ 的三条硬性质，以及 spec 落地清单里最容易被漏掉的几条：
 *
 *   RA-1  RELAX_ACTS 三条数据完整（id / 减压量 / 年龄门槛）
 *   RA-2  三条**共享**一个年度额度（不是各一次）—— 这是 spec §2.③3.3 的核心，
 *         若退化成各一次，理论年减压 −38，会把 STRESS 打到 0，压力系统失效
 *   RA-3  relaxBranch 的 55+ 分支：文案切换 + **免费**（穷人永远有一件能做的事，E-2）
 *   RA-4  各道门槛：年龄 / 金钱 / cond.min.NET ≥ 20（提示语是叙事文案，不是「条件不足」）
 *   RA-5  r_counsel 打 flags.counseled（晚年事件要能回收这条叙事线索）
 *   RA-6  migrateState 给老存档补 relaxUsedYear（否则老存档一读就 undefined）
 *   RA-7  socialAct 朋友项已降权为 −1（与 r_friends 去重，spec 落地清单 #7）
 *   RA-8  E-5 式源码级守卫：doRelaxAct 必须在 applyEffects 之前写入 relaxUsedYear，
 *         否则「扣了钱没记额度」可以一年内无限刷
 *
 * 这些常数/性质都是手工推的、且互相咬合（B = 22 = 7 恢复 + 12 减压 + 3 自住房），
 * 没有机器守着，任何人动一个数都会让 S-01 的三件套静默失效。
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const MODULES = ['assets/data.js', 'assets/market.js', 'assets/engine.js', 'assets/school.js',
  'assets/career.js', 'assets/love.js', 'assets/pet.js', 'assets/legacy.js', 'assets/loan.js'];

const ctx = {
  console, Math, JSON, Date, isNaN, isFinite, parseInt, parseFloat,
  Number, String, Array, Object, Boolean, RegExp, Error, Map, Set,
  setTimeout, clearTimeout, encodeURIComponent, decodeURIComponent,
  window: { addEventListener() {}, innerWidth: 1280 },
  document: {
    addEventListener() {}, getElementById() { return null; },
    querySelectorAll() { return []; }, querySelector() { return null; },
    createElement() { return { style: {}, setAttribute() {}, appendChild() {} }; },
    body: { appendChild() {}, classList: { add() {}, remove() {} } }
  },
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} }
};
vm.createContext(ctx);
MODULES.forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));

const A = vm.runInContext(`({
  RELAX_ACTS, GOOD_DEEDS, createGame, doRelaxAct, relaxBranch, migrateState,
  socialAct, applyEffects, STRESS_TUNE
})`, ctx);

let fail = 0;
const ok = (cond, name, extra) => {
  if (cond) console.log('  ✓', name, extra == null ? '' : extra);
  else { console.log('  ✗', name, extra == null ? '' : extra); fail++; }
};

/* 造一个可控的存档 */
function mk(over) {
  const s = A.createGame({ name: '测试', gender: 'M', familyId: 'xiangong', talents: [] });
  s.age = 30;
  s.stats.STRESS = 80;
  s.stats.MONEY = 100000000;
  s.stats.NET = 50;
  Object.assign(s, over || {});
  return s;
}

console.log('== RA-1 数据基线 ==');
ok(Array.isArray(A.RELAX_ACTS) && A.RELAX_ACTS.length === 3, 'RELAX_ACTS 三条', A.RELAX_ACTS && A.RELAX_ACTS.length);
const byId = {};
A.RELAX_ACTS.forEach(r => { byId[r.id] = r; });
ok(!!(byId.r_friends && byId.r_court && byId.r_counsel), '三条 id 齐备', Object.keys(byId).join(','));
if (byId.r_friends) {
  ok(byId.r_friends.eff.STRESS === -12, 'r_friends 减压 −12', byId.r_friends.eff.STRESS);
  ok(byId.r_friends.minAge === 20, 'r_friends minAge 20', byId.r_friends.minAge);
  ok(byId.r_friends.cond && byId.r_friends.cond.min.NET === 20, 'r_friends 门槛 NET ≥ 20',
    JSON.stringify(byId.r_friends.cond));
  ok(byId.r_friends.condMsg === '你现在叫不出八个人', 'r_friends 门槛提示是叙事文案', byId.r_friends.condMsg);
}
if (byId.r_court) {
  ok(byId.r_court.eff.STRESS === -10, 'r_court 减压 −10', byId.r_court.eff.STRESS);
  ok(byId.r_court.minAge === 16, 'r_court minAge 16', byId.r_court.minAge);
}
if (byId.r_counsel) {
  ok(byId.r_counsel.eff.STRESS === -16, 'r_counsel 减压 −16', byId.r_counsel.eff.STRESS);
  ok(byId.r_counsel.minAge === 18, 'r_counsel minAge 18', byId.r_counsel.minAge);
  ok(byId.r_counsel.flags && byId.r_counsel.flags[0] === 'counseled', 'r_counsel 打 flag counseled',
    JSON.stringify(byId.r_counsel.flags));
}

console.log('== RA-2 三条共享一个年度额度 ==');
{
  const s = mk();
  const r1 = A.doRelaxAct(s, 'r_court');
  ok(r1.ok === true, '第一次（出一身汗）成功', JSON.stringify(r1));
  const r2 = A.doRelaxAct(s, 'r_friends');
  ok(r2.ok === false, '同一年内第二条被拒（共享额度，不是各一次）', r2.msg);
  const r3 = A.doRelaxAct(s, 'r_counsel');
  ok(r3.ok === false, '同一年内第三条被拒', r3.msg);
  // 跨年后应恢复
  s.age = 31;
  const r4 = A.doRelaxAct(s, 'r_counsel');
  ok(r4.ok === true, '跨年后额度自动恢复（relaxUsedYear === age 判定，无需 yearBase 重置）', JSON.stringify(r4));
}

console.log('== RA-3 r_court 的 55+ 分支 ==');
{
  const young = A.relaxBranch(byId.r_court, 30);
  const late = A.relaxBranch(byId.r_court, 55);
  const older = A.relaxBranch(byId.r_court, 70);
  ok(young.cost === 800000, '30 岁：羽毛球 800,000', young.cost);
  ok(late.cost === 0, '55 岁：**免费**（E-2 穷人永远有一件能做的事）', late.cost);
  ok(older.cost === 0, '70 岁：仍免费', older.cost);
  ok(late.desc !== young.desc && !!late.desc, '55 岁文案切换（公园太极/广场舞）',
    String(late.desc).slice(0, 12) + '…');
  ok(late.eff.STRESS === -10, '55 岁减压量不变 −10', late.eff.STRESS);
}

console.log('== RA-4 各道门槛 ==');
{
  // 年龄
  const s = mk({ age: 15 });
  const r = A.doRelaxAct(s, 'r_court');
  ok(r.ok === false && /16/.test(r.msg || ''), 'minAge 生效（15 岁用不了 r_court）', r.msg);
  // 金钱
  const p = mk(); p.stats.MONEY = 1000;
  const r5 = A.doRelaxAct(p, 'r_counsel');
  ok(r5.ok === false && r5.msg === '钱不够', '钱不够被拒', r5.msg);
  // cond.NET
  const n = mk(); n.stats.NET = 5;
  const r6 = A.doRelaxAct(n, 'r_friends');
  ok(r6.ok === false && r6.msg === '你现在叫不出八个人', 'NET < 20 被拒且返回叙事文案', r6.msg);
  // 已结束
  const d = mk(); d.finished = true;
  ok(A.doRelaxAct(d, 'r_court').ok === false, '已结束的局不能减压');
}

console.log('== RA-5 flag 写入 ==');
{
  const s = mk();
  A.doRelaxAct(s, 'r_counsel');
  ok(s.flags && s.flags.counseled === true, 'flags.counseled 已置位', s.flags && s.flags.counseled);
}

console.log('== RA-6 老存档迁移 ==');
{
  const s = mk();
  delete s.relaxUsedYear;
  A.migrateState(s);
  ok(s.relaxUsedYear === 0, 'migrateState 补 relaxUsedYear = 0', s.relaxUsedYear);
  const r = A.doRelaxAct(s, 'r_court');
  ok(r.ok === true, '迁移后仍可正常使用', JSON.stringify(r));
}

console.log('== RA-7 socialAct 朋友项降权 ==');
{
  const src = fs.readFileSync(path.join(ROOT, 'assets/engine.js'), 'utf8');
  const seg = src.slice(src.indexOf("} else if (kind === 'friend') {"), src.indexOf("} else { delete touch[key]; return { ok: false }; }"));
  /* v6.4 把属性上限统一到 100 后，STRESS 由 120 尺度折到 100 尺度：
   * 原 −1 → −1 × 100/120 ≈ −0.83。这里跟着折算后的值走。 */
  ok(/s\.STRESS -= 0\.83;/.test(seg), '朋友项 STRESS −0.83（v6.4 尺度折算，与 r_friends 去重）',
    (seg.match(/s\.STRESS -= [\d.]+;/) || ['?'])[0]);
  ok(/【问候】/.test(seg), '文案改为轻量维护（【问候】）', /【问候】/.test(seg) ? 'ok' : 'missing');
}

console.log('== RA-8 源码级守卫（防「扣了钱没记额度」无限刷）==');
{
  const src = fs.readFileSync(path.join(ROOT, 'assets/engine.js'), 'utf8');
  const fn = src.slice(src.indexOf('function doRelaxAct'), src.indexOf('/* 每年最多一次「有人来找你」'));
  const iCost = fn.indexOf('state.stats.MONEY -= b.cost');
  const iMark = fn.indexOf('state.relaxUsedYear = state.age');
  ok(iCost > 0 && iMark > 0 && iMark <= iCost,
    'relaxUsedYear 的写入不晚于扣钱（先记账后扣款）', 'cost@' + iCost + ' mark@' + iMark);
  ok(/if \(state\.relaxUsedYear === state\.age\) return/.test(fn),
    '额度校验在扣钱之前', /if \(state\.relaxUsedYear === state\.age\)/.test(fn) ? 'ok' : 'missing');
}

console.log('== RA-9 与恢复公式的联立（B = 22 的来源）==');
{
  // spec §3：B = 22 = 7 固定恢复 + 12 减压 + 3 自住房。
  // 这里只守「减压这一项」确实是 −12 量级：三条里最常用的是 r_court(−10)/r_friends(−12)，
  // spec 按 −12 推演。若有人把三条都改小，B 会变小、激进流稳态会抬上去。
  const maxRelief = Math.min.apply(null, A.RELAX_ACTS.map(r => -r.eff.STRESS));
  const best = Math.max.apply(null, A.RELAX_ACTS.map(r => -r.eff.STRESS));
  ok(maxRelief >= 10, '最弱一条减压量 ≥ 10（保证穷人也有 −10）', maxRelief);
  ok(best === 16, '最强一条 = 16（与 spec 的 −16 一致）', best);
  /* v6.4 调参：固定恢复项 7 → 0.8（配合 DAMP_T 58 收敛压力） */
  ok(A.STRESS_TUNE && A.STRESS_TUNE.RECOVER_FLAT === 0.8, '固定恢复项为 0.8', A.STRESS_TUNE && A.STRESS_TUNE.RECOVER_FLAT);
}

console.log(fail ? `\n✗ ${fail} 条未通过` : '\n全部通过 ✅');
process.exit(fail ? 1 : 0);
