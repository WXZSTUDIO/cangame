/* cangame v2 · Sprint 3 验证（沿用仓库 vm 沙箱模式）
 * vm.createContext({console,Math,JSON,Date,window,document,localStorage})
 *   → 按 11 文件 defer 顺序 runInContext（含 war）→ 断言。
 * 覆盖：战争解锁(day) / 宣战费(红4·白20·蓝18·黑10)扣减入 prizePool /
 *      掠夺率(Goods×20%·Won×10%)夹零无幽灵 / 战斗力裁决(compareCombat) /
 *      人类小游戏加成可被应用 / resolveWar 写 history / runAll 分派
 *      (WAR→AI 宣战；SETTLEMENT→结算人类 pending) / 防重入 / 无幽灵资源。
 * 目标：≥30 条断言，全绿；脚本内跑 verify-s1 / verify-s2 回归全绿。
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');

// 最小 DOM 桩：ui.js 仅在 DOMContentLoaded 真正派发时才跑 boot()；
// 这里 readyState='loading' 且 addEventListener 为空，boot 不触发，ui.js 在 vm 中 inert。
const fakeEl = () => ({
  style: {}, classList: { add() {}, remove() {} },
  appendChild() {}, setAttribute() {}, addEventListener() {},
  set innerHTML(_) {}, get innerHTML() { return ''; }
});
const ctx = {
  console, Math, JSON, Date, isNaN, parseInt, parseFloat, Number, String, Array, Object,
  window: { addEventListener() {} },
  document: {
    readyState: 'loading',
    addEventListener() {},
    getElementById() { return null; },
    querySelectorAll() { return []; },
    querySelector() { return null; },
    createElement() { return fakeEl(); },
    body: null, documentElement: null
  },
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  alert: function () {}
};
vm.createContext(ctx);

// Sprint 3 defer 顺序：config→rng→state→factions→resource→production→economy→war→settle→engine→ui
['assets/config.js', 'assets/rng.js', 'assets/state.js', 'assets/factions.js',
 'assets/resource.js', 'assets/production.js', 'assets/economy.js', 'assets/war.js',
 'assets/settle.js', 'assets/engine.js', 'assets/ui.js']
  .forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));

// 暴露需要的符号（顶层函数/var 已挂到 ctx 全局，这里解构取出）。
const M = vm.runInContext('({' +
  'createGameState, CONFIG, PHASES, makeRNG, transferResource, canAfford, pushLog,' +
  'declareWar, resolveWar, applyPlunder, computePower, compareCombat, war,' +
  'advancePhase, endDay, endPhase, runAIDecisions' +
 '})', ctx);

let fail = 0, pass = 0;
const ok = (cond, name, extra) => {
  if (cond) { pass++; console.log('  ✓', name, extra == null ? '' : extra); }
  else { fail++; console.log('  ✗', name, extra == null ? '' : extra); }
};
const approx = (a, b, eps) => Math.abs(a - b) <= (eps == null ? 1e-9 : eps);
const fac = (s, id) => s.factions.find(f => f.id === id);
const constRng = () => 0.5; // 固定扰动源（perturb = 1），用于确定性战斗力测试

// ===== 1. 战争解锁：day < WAR_UNLOCK_DAY 失败；day≥2 成功 =====
console.log('== 1. 战争解锁 ==');
{
  const s = M.createGameState(123);
  s.humanFactionId = 'red'; s.day = 1; s.phase = 'WAR';
  const r1 = M.declareWar(s, 'red', 'white', {});
  ok(r1.ok === false && r1.reason === 'locked', '第 1 天宣战失败（locked）', r1.reason);
  s.day = 2;
  const r2 = M.declareWar(s, 'red', 'white', {});
  ok(r2.ok === true, '第 2 天红队宣战成功', r2.ok ? '' : r2.reason);
}

// ===== 2. 宣战费基线（§3.4）=====
console.log('== 2. 宣战费基线 ==');
{
  ok(M.CONFIG.WAR_COST.red === 4, '红队宣战费 = 4（极低）');
  ok(M.CONFIG.WAR_COST.white === 20, '白队宣战费 = 20（极高）');
  ok(M.CONFIG.WAR_COST.blue === 18, '蓝队宣战费 = 18（极高）');
  ok(M.CONFIG.WAR_COST.black === 10, '黑队宣战费 = 10');
  ok(M.CONFIG.WAR_UNLOCK_DAY === 2, 'WAR_UNLOCK_DAY = 2');
}

// ===== 3. 扣费正确 + 入奖金池（§3.5）=====
console.log('== 3. 宣战费扣除 / 入奖金池 ==');
{
  // 红队：won 25 → 扣 4 → 21；prizePool 1000 → 1004
  const s = M.createGameState(2024); s.humanFactionId = 'red'; s.day = 2; s.phase = 'WAR';
  const red = fac(s, 'red'); const pool0 = s.prizePool;
  const r = M.declareWar(s, 'red', 'white', {});
  ok(r.ok === true, '红队宣战成功');
  ok(red.won === 25 - 4, '红队 won 25 → 21（扣 4）', red.won);
  ok(s.prizePool === pool0 + 4, '奖金池 +4', s.prizePool);

  // 白队（提额后）：won 50 → 扣 20 → 30；prizePool +20
  const s2 = M.createGameState(2024); s2.humanFactionId = 'white'; s2.day = 2; s2.phase = 'WAR';
  fac(s2, 'white').won = 50; const pool2 = s2.prizePool;
  const r2 = M.declareWar(s2, 'white', 'red', {});
  ok(r2.ok === true, '白队（won=50）宣战成功');
  ok(fac(s2, 'white').won === 30, '白队 won 50 → 30（扣 20）', fac(s2, 'white').won);
  ok(s2.prizePool === pool2 + 20, '奖金池 +20', s2.prizePool);

  // 买不起：白队初始 won 10 < 20 → 失败
  const s3 = M.createGameState(2024); s3.humanFactionId = 'white'; s3.day = 2; s3.phase = 'WAR';
  const r3 = M.declareWar(s3, 'white', 'red', {});
  ok(r3.ok === false && r3.reason === 'cannot-afford', '白队初始资源不足宣战失败（cannot-afford）');
}

// ===== 4. 掠夺率 + 夹零防幽灵（§3.4 PLUNDER）=====
console.log('== 4. 掠夺率 / 防幽灵 ==');
{
  // 整数倍：败者 货20 金10 → 胜者获 货4 金1
  const s = M.createGameState(99);
  const winner = fac(s, 'red'), loser = fac(s, 'white');
  const wg0 = winner.goods, ww0 = winner.won, lg0 = loser.goods, lw0 = loser.won;
  const p = M.applyPlunder(winner, loser);
  ok(p.goods === 4 && p.won === 1, '掠夺 = 败者货×20%(4) + 金×10%(1)', JSON.stringify(p));
  ok(winner.goods === wg0 + 4 && winner.won === ww0 + 1, '胜者资源增加');
  ok(loser.goods === lg0 - 4 && loser.won === lw0 - 1, '败者资源减少', 'loser goods=' + loser.goods + ' won=' + loser.won);

  // 非整数倍：败者 货15 金20 → round → 货3 金2
  const s2 = M.createGameState(99);
  const w2 = fac(s2, 'red'), l2 = fac(s2, 'white');
  l2.goods = 15; l2.won = 20;
  const p2 = M.applyPlunder(w2, l2);
  ok(p2.goods === 3 && p2.won === 2, '非整数倍四舍五入（货3 金2）', JSON.stringify(p2));

  // 夹零防幽灵：败者 0 资源 → 不产生负资源
  const s3 = M.createGameState(99);
  const w3 = fac(s3, 'red'), l3 = fac(s3, 'white');
  l3.goods = 0; l3.won = 0;
  const p3 = M.applyPlunder(w3, l3);
  ok(p3.goods === 0 && p3.won === 0, '败者 0 资源时掠夺量为 0');
  ok(l3.goods === 0 && l3.won === 0, '败者资源不为负（无幽灵）');
  ok(w3.goods >= 0 && w3.won >= 0, '胜者资源非负');
}

// ===== 5. 战斗力裁决（compareCombat）+ 人类小游戏加成 =====
console.log('== 5. 战斗力裁决 / 加成 ==');
{
  // 单方明显占优：attacker mf20/pop3 vs defender mf0/pop3
  const s = M.createGameState(7);
  const atk = fac(s, 'red'), def = fac(s, 'blue');
  atk.militaryFund = 20; atk.popAlive = 3;
  def.militaryFund = 0; def.popAlive = 3;
  const atkP = M.computePower(s, ['red'], constRng, 1);
  const defP = M.computePower(s, ['blue'], constRng, 1);
  ok(atkP > defP, 'attacker 战力 > defender', atkP.toFixed(2) + ' vs ' + defP.toFixed(2));
  ok(M.compareCombat(atkP, defP) === 'attacker', 'compareCombat 判 attacker 胜');

  // 平局 → 防守方占优；加成可翻转
  const s2 = M.createGameState(7);
  const a2 = fac(s2, 'red'), d2 = fac(s2, 'white');
  a2.militaryFund = 10; a2.popAlive = 3;
  d2.militaryFund = 10; d2.popAlive = 3;
  const noBonus = M.computePower(s2, ['red'], constRng, 1);  // = 19
  const def2 = M.computePower(s2, ['white'], constRng, 1);   // = 19
  ok(approx(noBonus, def2, 1e-9), '双方战力相等（平局）', noBonus.toFixed(2));
  ok(M.compareCombat(noBonus, def2) === 'defender', '平局归防守方');
  const bonusP = M.computePower(s2, ['red'], constRng, 1.6); // 19*1.6 = 30.4
  ok(bonusP > def2, '人类加成 ×1.6 放大己方战力', bonusP.toFixed(2) + ' vs ' + def2.toFixed(2));
  ok(M.compareCombat(bonusP, def2) === 'attacker', '加成后 compareCombat 判 attacker 胜（加成生效）');

  // compareCombat 纯裁决单元
  ok(M.compareCombat(20, 10) === 'attacker', 'compareCombat(20,10)=attacker');
  ok(M.compareCombat(10, 20) === 'defender', 'compareCombat(10,20)=defender');
  ok(M.compareCombat(7, 7) === 'defender', 'compareCombat(7,7)=defender（平局）');
}

// ===== 6. resolveWar 集成（写 history + 掠夺落地）=====
console.log('== 6. resolveWar 集成 ==');
{
  const s = M.createGameState(55); s.day = 2; s.phase = 'WAR';
  const red = fac(s, 'red'), blue = fac(s, 'blue');
  red.militaryFund = 10; red.popAlive = 3;
  blue.militaryFund = 0; blue.popAlive = 3; blue.goods = 10; blue.won = 10;
  const h0 = s.war.history.length;
  const rec = M.resolveWar(s, { attacker: 'red', defender: 'blue', allies: { attacker: [], defender: [] }, bonus: 1 });
  ok(s.war.history.length === h0 + 1, 'resolveWar 写入 history[]');
  ok(rec.winner === 'red', 'red 战力占优 → winner=red', rec.winner);
  ok(blue.goods === 10 - Math.round(10 * M.CONFIG.PLUNDER.goods), '败者 blue 被掠夺货', 'blue goods=' + blue.goods);
  ok(blue.won === 10 - Math.round(10 * M.CONFIG.PLUNDER.won), '败者 blue 被掠夺金', 'blue won=' + blue.won);
  ok(rec.plundered.goods > 0 && rec.plundered.won > 0, '战果含掠夺量', JSON.stringify(rec.plundered));
}

// ===== 7. AI runAll 分派（WAR 阶段 AI 宣战 + 防重入；TRADING 不触发）=====
console.log('== 7. runAll · WAR 阶段 AI 宣战 ==');
{
  const s = M.createGameState(2024); s.humanFactionId = 'white'; s.day = 2; s.phase = 'WAR';
  const h0 = s.war.history.length;
  M.war.runAll(s);
  ok(s.war.history.length > h0, 'WAR 阶段 war.runAll 触发 AI 宣战并结算', 'history+' + (s.war.history.length - h0));
  ok(fac(s, 'red').lastWarDay === s.day, '红队当日防重入标记 lastWarDay 已置', fac(s, 'red').lastWarDay);

  // 同日再跑不重复宣战（防重入）
  const h1 = s.war.history.length;
  M.war.runAll(s);
  ok(s.war.history.length === h1, 'WAR 阶段同日重复 runAll 不重复宣战', s.war.history.length);

  // TRADING 阶段不触发战争
  const s2 = M.createGameState(2024); s2.humanFactionId = 'white'; s2.day = 2; s2.phase = 'TRADING';
  const h2 = s2.war.history.length;
  M.war.runAll(s2);
  ok(s2.war.history.length === h2, 'TRADING 阶段 war.runAll 不结算战争（guard）');

  // aiWantWar 锁定期返回 null
  const s3 = M.createGameState(2024); s3.day = 1;
  ok(M.war.aiWantWar(s3, fac(s3, 'red')) === null, 'day<2 时 AI 不宣战（锁定）');
}

// ===== 8. 非红阵营收益比 > 1.5 才宣战（§5.4③）=====
console.log('== 8. 非红阵营收益比门槛 ==');
{
  const s = M.createGameState(909); s.humanFactionId = 'red'; s.day = 2; s.phase = 'WAR';
  // 让白队极富，蓝队（AI，cost 18 须可负担）won 提到 20，使其对白队收益比>1.5
  fac(s, 'white').goods = 100; fac(s, 'white').won = 100;
  fac(s, 'blue').won = 20;
  M.war.runAll(s);
  ok(s.war.history.some(h => h.attacker === 'blue'), '蓝队(收益比>1.5) 向富有的白队宣战', JSON.stringify(s.war.history.map(h => h.attacker)));
}

// ===== 9. SETTLEMENT 结算人类 pending 战争（早于 settle 扣药）=====
console.log('== 9. SETTLEMENT 结算人类 pending 战争 ==');
{
  const s = M.createGameState(321); s.humanFactionId = 'red'; s.day = 2; s.phase = 'WAR';
  const white = fac(s, 'white'); const wg0 = white.goods;
  const r = M.declareWar(s, 'red', 'white', { bonus: 1.6 });  // 人类路径 → pending
  ok(r.ok === true && s.war.pending.length === 1, '人类宣战进入 pending（待 SETTLEMENT 结算）', 'pending=' + s.war.pending.length);
  ok(s.war.active === r.war, 'state.war.active 指向当前战争（供 UI 标签）');

  s.phase = 'SETTLEMENT';
  M.war.runAll(s);
  ok(s.war.pending.length === 0, 'SETTLEMENT 结算后 pending 清空', 'pending=' + s.war.pending.length);
  ok(s.war.history.length >= 1, 'SETTLEMENT 结算写入 history', 'history=' + s.war.history.length);
  ok(s.war.active === null, '结算后 war.active 清空（战果已入 history）');
  ok(white.goods < wg0, '白队在结算阶段被掠夺（货下降）', 'white goods ' + wg0 + ' → ' + white.goods);
}

// ===== 10. 无幽灵资源（全盘面非负）=====
console.log('== 10. 资源非负（无幽灵）==');
{
  const s = M.createGameState(7); s.humanFactionId = 'red'; s.day = 3; s.phase = 'WAR';
  fac(s, 'white').goods = 3; // 极小目标
  M.declareWar(s, 'red', 'white', { bonus: 1.6 });
  s.phase = 'SETTLEMENT'; M.war.runAll(s);
  const allNonNeg = s.factions.every(f =>
    f.life >= 0 && f.goods >= 0 && f.won >= 0 && f.militaryFund >= 0);
  ok(allNonNeg, '结算后所有阵营四类资源非负（无幽灵）');
}

// ===== 11. 引擎端到端集成（advancePhase / endDay 真实路径）=====
console.log('== 11. 引擎端到端集成 ==');
{
  const s = M.createGameState(4242); s.humanFactionId = 'red'; s.day = 2; s.phase = 'WAR';
  const white = fac(s, 'white'); const wg0 = white.goods;
  const r = M.declareWar(s, 'red', 'white', { bonus: 1.6 }); // 人类路径 → pending
  ok(r.ok && s.war.pending.length === 1, '集成：人类宣战进入 pending');
  const adv = M.advancePhase(s);                              // WAR→SETTLEMENT，触发 runAIDecisions(SETTLEMENT)→resolvePending
  ok(adv.ok && s.phase === 'SETTLEMENT', '集成：进入 SETTLEMENT 阶段');
  ok(s.war.pending.length === 0 && s.war.history.length >= 1, '集成：SETTLEMENT 结算人类战争');
  ok(white.goods < wg0, '集成：败者被掠夺（货下降）', 'white goods ' + wg0 + ' → ' + white.goods);
  const ed = M.endDay(s);                                     // settleDay 扣药应在掠夺之后
  ok(ed.ok === true, '集成：endDay 正常无异常');
  ok(s.day === 3 && s.phase === 'MORNING', '集成：进入新一天 MORNING', 'day=' + s.day);
}

// ===== 12. 回归：verify-s1 / verify-s2 仍全绿 =====
console.log('== 11. 回归（Sprint 1 / 2）==');
{
  const reg = (file) => {
    try { cp.execSync('node ' + file, { cwd: __dirname, stdio: 'inherit' }); return true; }
    catch (e) { return false; }
  };
  ok(reg('verify-s1.js'), 'verify-s1.js 全绿（无回归）');
  ok(reg('verify-s2.js'), 'verify-s2.js 全绿（无回归）');
}

console.log('\n' + (fail === 0 ? '全部通过 ✓' : fail + ' 项失败 ✗') +
  '  （通过 ' + pass + ' / ' + (pass + fail) + '）');
process.exit(fail === 0 ? 0 : 1);
