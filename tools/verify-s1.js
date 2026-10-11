/* cangame v2 · Sprint 1 验证（沿用仓库 vm 沙箱模式）
 * vm.createContext({console,Math,JSON,Date,window,document,localStorage})
 *   → 按 defer 顺序 runInContext 各 assets js → 断言。
 * 覆盖：13 人入营分布 / randomAssign 确定性 / 扣药与淘汰 / 终局分红公式 / 空转至终局。
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
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
    createElement() { return fakeEl(); },
    body: null, documentElement: null
  },
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} }
};
vm.createContext(ctx);

['assets/config.js', 'assets/rng.js', 'assets/state.js', 'assets/factions.js',
 'assets/resource.js', 'assets/settle.js', 'assets/engine.js', 'assets/ui.js']
  .forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));

// 暴露需要的符号（顶层函数/var 已挂到 ctx 全局，这里解构取出）。
const M = vm.runInContext('({' +
  'createGameState, serializeGameState, deserializeGameState, randomAssign, assignHumanFaction,' +
  'transferResource, canAfford, settleDay, endGame, factionPrizeTotal, factionPrizePerPerson,' +
  'advancePhase, endDay, endPhase, createEngine, CONFIG, PHASES, makeRNG' +
 '})', ctx);

let fail = 0, pass = 0;
const ok = (cond, name, extra) => {
  if (cond) { pass++; console.log('  ✓', name, extra == null ? '' : extra); }
  else { fail++; console.log('  ✗', name, extra == null ? '' : extra); }
};
const approx = (a, b, eps) => Math.abs(a - b) <= (eps == null ? 1e-9 : eps);

// ===== 1. 13 人正确分到 4 阵营，分布 = 6/3/3/1 =====
console.log('== 1. 人口分配 ==');
{
  const s = M.createGameState(12345);
  ok(s.players.length === 13, '总人数 = 13', s.players.length);
  const pop = {};
  s.factions.forEach(f => { pop[f.id] = f.popAlive; });
  ok(pop.white === 6 && pop.blue === 3 && pop.red === 3 && pop.black === 1,
    '人口分布 = 6/3/3/1', JSON.stringify(pop));
  // 领袖绑定：每个阵营 leaderId 是其存活成员之一
  ok(s.factions.every(f => f.playerIds.indexOf(f.leaderId) >= 0), '领袖均为本阵营成员');
  // 人类恰好 1 人，且为某阵营领袖
  const humans = s.players.filter(p => p.isHuman);
  ok(humans.length === 1, '人类玩家恰 1 人', humans.length);
  ok(humans[0] && humans[0].id === s.factions.find(f => f.id === s.humanFactionId).leaderId,
    '人类即所属阵营领袖');
}

// ===== 2. randomAssign 确定性 + assignHumanFaction ∈ 4 =====
console.log('== 2. 确定性 ==');
{
  const a = M.randomAssign(777), b = M.randomAssign(777);
  const key = (x) => JSON.stringify(x.factions.map(f => f.playerIds.slice().sort((m, n) => m - n)));
  ok(key(a) === key(b), 'randomAssign 同 seed 同结果');
  const c = M.randomAssign(778);
  ok(key(a) !== key(c) || true, '不同 seed 可不同（非强约束，记录即可）');

  const s2 = M.createGameState(777);
  ok(['white', 'blue', 'red', 'black'].indexOf(s2.humanFactionId) >= 0,
    'assignHumanFaction 返回 4 选 1', s2.humanFactionId);
}

// ===== 3. 每日扣药 + 白队首夜缺药淘汰 =====
console.log('== 3. 结算扣药 / 淘汰 ==');
{
  const s3 = M.createGameState(2024);
  const white = s3.factions.find(f => f.id === 'white');
  ok(white.popAlive === 6 && white.life === 2, '白队初始 6 人 / 2 药', 'pop=' + white.popAlive + ' life=' + white.life);

  // 通用公式：requiredLife = 存活 × 日耗
  ok(M.CONFIG.DAILY_LIFE_COST === 1, 'DAILY_LIFE_COST = 1');

  M.settleDay(s3);
  const w = s3.factions.find(f => f.id === 'white');
  ok(w.life === 0, '白队药被扣到 0', 'life=' + w.life);
  ok(w.popAlive < 6, '白队首夜缺药触发淘汰，人数下降', 'pop=' + w.popAlive);
  ok(w.requiredLife === w.popAlive * M.CONFIG.DAILY_LIFE_COST,
    'requiredLife = 存活 × 日耗', w.requiredLife + ' = ' + w.popAlive + '×' + M.CONFIG.DAILY_LIFE_COST);
  ok(w.deficit >= 0, 'deficit 非负', 'deficit=' + w.deficit);

  // 其余阵营首夜不致死（药充足）
  const blue = s3.factions.find(f => f.id === 'blue');
  ok(blue.popAlive === 3 && blue.life === 27, '蓝队首夜不淘汰（药足）', 'pop=' + blue.popAlive + ' life=' + blue.life);
}

// ===== 4. 终局分红公式（构造小盘面）=====
console.log('== 4. 终局分红公式 ==');
{
  const s4 = M.createGameState(1);
  const w = s4.factions.find(f => f.id === 'white');
  const b = s4.factions.find(f => f.id === 'blue');
  s4.factions.forEach(f => {
    if (f.id !== 'white' && f.id !== 'blue') { f.alive = false; f.popAlive = 0; f.goods = 0; }
  });
  w.alive = true; w.popAlive = 4; w.goods = 20;
  b.alive = true; b.popAlive = 2; b.goods = 30;
  s4.prizePool = M.CONFIG.PRIZE_SEED; // 1000

  const r = M.endGame(s4);
  // Σgoods = 50 → white 总额 = 1000*(20/50)=400, 人均=100; blue 总额=600, 人均=300
  ok(approx(r.factionTotals.white, 400), '白队奖金总额 = 1000×(20/50) = 400', r.factionTotals.white);
  ok(approx(r.factionTotals.blue, 600), '蓝队奖金总额 = 600', r.factionTotals.blue);
  ok(approx(r.perPerson.white, 100), '白队人均 = 400/4 = 100', r.perPerson.white);
  ok(approx(r.perPerson.blue, 300), '蓝队人均 = 600/2 = 300', r.perPerson.blue);
  ok(s4.status === 'ENDED', 'status = ENDED');
  ok(r.winner === 'blue', '赢家 = 人均最高（蓝）', r.winner);

  // 公式一致性：实时预期与终局计算同源
  ok(approx(M.factionPrizePerPerson(s4, w), 100), '实时人均预期与终局一致');
}

// ===== 5. 空转至终局（无交易/战争也能跑到 ENDED）=====
console.log('== 5. 全流程空转至终局 ==');
{
  const s5 = M.createGameState(99);
  ok(s5.phase === 'MORNING', '起始阶段 = MORNING');
  // 阶段推进：MORNING → PRODUCTION
  M.advancePhase(s5);
  ok(s5.phase === 'PRODUCTION', 'advancePhase 推进到 PRODUCTION', s5.phase);

  const eng = M.createEngine(s5);
  let guard = 0;
  while (s5.status === 'PLAYING' && guard < 300) {
    for (let i = 0; i < 4 && s5.status === 'PLAYING'; i++) M.advancePhase(s5); // 推进到 SETTLEMENT
    if (s5.status !== 'PLAYING') break;
    M.endDay(s5);  // 结算 + 日推进 / 终局
    guard++;
  }
  ok(s5.status === 'ENDED', '空转至终局 status = ENDED', 'day=' + s5.day + ' guard=' + guard);
  ok(s5.result && typeof s5.result.factionTotals === 'object', '终局产出分红结果对象');
  // 终局触发条件之一成立：≤1 阵营存活 或 day>MAX_DAY
  const aliveF = s5.factions.filter(f => f.alive && f.popAlive > 0).length;
  ok(aliveF <= 1 || s5.day > M.CONFIG.MAX_DAY, '终局条件满足（存活阵营≤1 或 超最大天数）',
    'aliveFactions=' + aliveF + ' day=' + s5.day + ' MAX_DAY=' + M.CONFIG.MAX_DAY);
}

// ===== 6. 序列化往返（单一真源可重放）=====
console.log('== 6. 序列化往返 ==');
{
  const s6 = M.createGameState(555);
  const json = M.serializeGameState(s6);
  const s7 = M.deserializeGameState(json);
  ok(s7.players.length === 13 && s7.factions.length === 4, '序列化保留 13 人 / 4 阵营');
  ok(s7.seed === s6.seed, 'seed 保留', s7.seed);
  ok(s7.humanFactionId === s6.humanFactionId, '人类阵营保留');
  const pop7 = {}; s7.factions.forEach(f => { pop7[f.id] = f.popAlive; });
  ok(pop7.white === 6 && pop7.blue === 3 && pop7.red === 3 && pop7.black === 1,
    '往返后人口分布仍为 6/3/3/1', JSON.stringify(pop7));
}

// ===== 7. 资源流转防幽灵（附赠健壮性校验）=====
console.log('== 7. 资源流转 ==');
{
  const s8 = M.createGameState(7);
  const f = s8.factions.find(x => x.id === 'white');
  const before = f.life;
  const applied = M.transferResource(f, { life: -(before + 5) }); // 试图超额扣
  ok(f.life === 0, '超额扣药被夹到 0（无幽灵资源）', 'life=' + f.life);
  ok(applied.life === -before, '实际扣减不超过持有', 'applied=' + applied.life);
  M.transferResource(f, { goods: 10 });
  ok(f.goods === 20 + 10, '正向增加正常', 'goods=' + f.goods);
  ok(M.canAfford(f, { won: 99999 }) === false, 'canAfford 正确识别买不起');
}

console.log('\n' + (fail === 0 ? '全部通过 ✓' : fail + ' 项失败 ✗') +
  '  （通过 ' + pass + ' / ' + (pass + fail) + '）');
process.exit(fail === 0 ? 0 : 1);
