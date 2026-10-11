/* =========================================================
 * cangame v2 · war.js
 * 战争系统（Sprint 3）：
 *   - declareWar(state, attackerId, defenderId, opts)
 *       校验解锁 / 买得起；从 attacker 的 won→militaryFund 扣宣战费（transferResource）；
 *       按 §3.5 把宣战费累加进 prizePool；写入 state.war（pending / active）。
 *   - 战斗力裁决（纯规则、无 LLM、确定性）：
 *       战斗力 = Σ(militaryFund×K_MILITARY) + Σ(存活人数×K_POP)，乘 ±PERTURB 随机扰动；
 *       人类方（仅 attacker=人类时）可凭战争小游戏获得加成系数 bonus（>1）放大己方战力。
 *   - resolveWar(state, warObj) → applyPlunder(winner, loser)：
 *       按 CONFIG.PLUNDER.goods(20%)/won(10%) 比例，用 transferResource 从 loser 转给 winner
 *       （夹零防幽灵）；战果写入 state.war.history[]。
 *   - runAll(state)（AI 回合）：由 engine.runAIDecisions 在 WAR 阶段调用 →
 *       AI 阵营按 §5.3/§5.4③ 规则决定是否 declareWar（红队 day≥2 即倾向、低费尽情用；
 *       其余评估 收益=掠夺预期/宣战费 > 1.5 才宣），并立即结算其战争；
 *       在 SETTLEMENT 阶段调用 → 统一结算人类 WAR 阶段留下的 pending 战争。
 * 依赖：config.js / rng.js / state.js(pushLog) / resource.js(transferResource,canAfford)。
 * 加载顺序：economy.js → war.js（在 settle 之前）。
 * 确定性：战斗扰动 RNG 由 (seed ^ day*K ^ 攻防 id) 派生，同盘面同结果。
 * ========================================================= */

// 取阵营对象（按 id）。
function warFaction(state, id) {
  return state.factions.find(function (f) { return f.id === id; });
}

// 攻防双方「总买得起」宣战费：won + militaryFund 合计 ≥ cost 才算可宣战。
function canPayWar(attacker, cost) {
  return (Number(attacker.won) || 0) + (Number(attacker.militaryFund) || 0) >= cost;
}

// 扣宣战费：优先从 won 扣，不足部分从 militaryFund 补；返回实际支付总额（=cost，调用方已 gate）。
function payWarCost(attacker, cost) {
  var fromWon = Math.min(cost, Number(attacker.won) || 0);
  transferResource(attacker, { won: -fromWon });
  var rest = cost - fromWon;
  if (rest > 0) transferResource(attacker, { militaryFund: -rest });
  return cost;
}

// 每场战争的确定性扰动 RNG（避免与分配/产出/结算序列耦合）。
function warRNG(state, warObj) {
  var a = ((warObj.attacker || 'x').charCodeAt(0) || 1) >>> 0;
  var d = ((warObj.defender || 'x').charCodeAt(0) || 1) >>> 0;
  var key = (state.seed ^ Math.imul(state.day, 0x1B873593) ^
             Math.imul(a + 1, 0x7FEB352D) ^ Math.imul(d + 1, 0x8FED35B3)) >>> 0;
  return makeRNG(key || 1);
}

// 计算一方战斗力 = Σ(成员 militaryFund×K_MILITARY) + Σ(存活人数×K_POP)，再乘 ±PERTURB 扰动。
// factionIds：参与方阵营 id 数组（含盟友）；bonus：人类小游戏加成（默认 1，>1 放大战力）。
// rng：确定性扰动源（测试可传入常量函数以消抖）。
function computePower(state, factionIds, rng, bonus) {
  rng = rng || makeRNG(1);
  var mf = 0, pop = 0;
  (factionIds || []).forEach(function (id) {
    var f = warFaction(state, id);
    if (!f || !f.alive) return;
    mf += Number(f.militaryFund) || 0;
    pop += Number(f.popAlive) || 0;
  });
  var base = mf * CONFIG.WAR_COMBAT.K_MILITARY + pop * CONFIG.WAR_COMBAT.K_POP;
  if (base <= 0) return 0;
  var perturb = 1 + (rng() * 2 - 1) * CONFIG.WAR_COMBAT.PERTURB; // ±PERTURB
  var power = base * perturb;
  if (bonus && bonus > 1) power *= bonus;
  return Math.max(0, power);
}

// 纯裁决：给定双方战力，返回胜方 key（'attacker' | 'defender'）。
// 平局归防守方（惩罚先手赌徒，符合攻方需明显优势才赢的设计）。
function compareCombat(powerA, powerB) {
  if (powerA > powerB) return 'attacker';
  if (powerB > powerA) return 'defender';
  return 'defender'; // 平局：防守方占优
}

// 掠夺：winner 从 loser 处夺取 loser.goods×PLUNDER.goods 与 loser.won×PLUNDER.won。
// 夹零防幽灵（transferResource 已夹零，此处再 Math.min 双保险）。返回实际掠夺量。
function applyPlunder(winner, loser) {
  var gRaw = Math.round((Number(loser.goods) || 0) * CONFIG.PLUNDER.goods);
  var wRaw = Math.round((Number(loser.won) || 0) * CONFIG.PLUNDER.won);
  var g = Math.max(0, Math.min(gRaw, Number(loser.goods) || 0));
  var w = Math.max(0, Math.min(wRaw, Number(loser.won) || 0));
  transferResource(loser, { goods: -g, won: -w });
  transferResource(winner, { goods: g, won: w });
  return { goods: g, won: w };
}

// 结算一场战争（纯函数式，依赖 warObj 的 attacker/defender/allies/bonus）。
// 计算双方战力（人类方按其 bonus 放大）→ 裁决 → 掠夺 → 写 history[]。
function resolveWar(state, warObj) {
  var atkIds = [warObj.attacker].concat((warObj.allies && warObj.allies.attacker) || []);
  var defIds = [warObj.defender].concat((warObj.allies && warObj.allies.defender) || []);
  var rng = warRNG(state, warObj);
  var atkBonus = (warObj.attacker === state.humanFactionId && warObj.bonus > 1) ? warObj.bonus : 1;
  var defBonus = (warObj.defender === state.humanFactionId && warObj.bonus > 1) ? warObj.bonus : 1;
  var atkPower = computePower(state, atkIds, rng, atkBonus);
  var defPower = computePower(state, defIds, rng, defBonus);
  var winnerSide = compareCombat(atkPower, defPower);
  var winnerId = winnerSide === 'attacker' ? warObj.attacker : warObj.defender;
  var loserId = winnerSide === 'attacker' ? warObj.defender : warObj.attacker;
  var winner = warFaction(state, winnerId), loser = warFaction(state, loserId);
  var plun = applyPlunder(winner, loser);
  var rec = {
    day: state.day,
    attacker: warObj.attacker,
    defender: warObj.defender,
    winner: winnerId,
    loser: loserId,
    plundered: { goods: plun.goods, won: plun.won },
    atkPower: Math.round(atkPower * 100) / 100,
    defPower: Math.round(defPower * 100) / 100,
    allies: warObj.allies || { attacker: [], defender: [] }
  };
  state.war.history.push(rec);
  pushLog(state,
    (winner ? winner.name : winnerId) + ' 击败 ' + (loser ? loser.name : loserId) +
    '，掠夺 货+' + plun.goods + ' 金+' + plun.won, 'war');
  return rec;
}

// 宣战入口。
// opts: { allies:{attacker:[],defender:[]}, minigame, bonus(人类小游戏加成>1), resolveNow(是否立即结算) }
//   - 默认（人类路径）：推入 state.war.pending，待 SETTLEMENT 统一结算；置 state.war.active 供 UI 标签。
//   - resolveNow=true（AI 路径）：立即结算并写 history，不进 pending。
// 返回 { ok, reason?, war, result? }。
function declareWar(state, attackerId, defenderId, opts) {
  opts = opts || {};
  var attacker = warFaction(state, attackerId), defender = warFaction(state, defenderId);
  if (!attacker || !defender) return { ok: false, reason: 'no-faction' };
  if (attackerId === defenderId) return { ok: false, reason: 'same-faction' };
  if (!attacker.alive || !defender.alive) return { ok: false, reason: 'dead' };
  if (state.day < CONFIG.WAR_UNLOCK_DAY) return { ok: false, reason: 'locked' };

  var cost = CONFIG.WAR_COST[attackerId];
  if (!canPayWar(attacker, cost)) return { ok: false, reason: 'cannot-afford' };

  // 扣宣战费（won→militaryFund），并累加进奖金池（§3.5）。
  payWarCost(attacker, cost);
  state.prizePool = (Number(state.prizePool) || 0) + cost;

  var warObj = {
    attacker: attackerId,
    defender: defenderId,
    allies: opts.allies || { attacker: [], defender: [] },
    minigame: opts.minigame || null,
    bonus: (opts.bonus && opts.bonus > 1) ? opts.bonus : 1, // 仅人类小游戏加成 >1
    status: 'pending'
  };

  if (opts.resolveNow) {
    var rec = resolveWar(state, warObj);
    warObj.status = 'resolved';
    warObj.result = rec;
    return { ok: true, war: warObj, result: rec };
  }

  state.war.pending = state.war.pending || [];
  state.war.pending.push(warObj);
  state.war.active = warObj;
  pushLog(state, attacker.name + ' 向 ' + defender.name + ' 宣战（费 ' + cost + '，入奖金池）', 'war');
  return { ok: true, war: warObj };
}

// —— AI 宣战决策（§5.3 / §5.4③）——
// 返回 { target, bonus } 或 null（不宣战）。
function aiWantWar(state, f) {
  if (state.day < CONFIG.WAR_UNLOCK_DAY) return null;
  var cost = CONFIG.WAR_COST[f.id];
  if (!canPayWar(f, cost)) return null;

  var targets = state.factions.filter(function (t) {
    return t.alive && t.id !== f.id && t.popAlive > 0;
  });
  if (targets.length === 0) return null;

  // 目标排序：富（goods+won 高）而弱（存活少）优先。
  targets.sort(function (a, b) {
    var sa = (a.goods + a.won) / Math.max(1, a.popAlive);
    var sb = (b.goods + b.won) / Math.max(1, b.popAlive);
    return sb - sa;
  });
  var target = targets[0];

  if (f.id === 'red') {
    // 红队 day≥2 即倾向宣战、低费尽情用。
    return { target: target.id, bonus: 1 };
  }
  // 其余阵营：收益比 = 掠夺预期 / 宣战费 > 1.5 才宣。
  var expectedLoot = target.goods * CONFIG.PLUNDER.goods + target.won * CONFIG.PLUNDER.won;
  var gain = cost > 0 ? expectedLoot / cost : 0;
  if (gain > 1.5) return { target: target.id, bonus: 1 };
  return null;
}

// AI 宣战 + 立即结算（WAR 阶段由 runAll 调用）。人类阵营由 UI 宣战，跳过。
// Sprint 4：宣战决策交由 ai.decideWar（复用 aiWantWar 硬规则 + 性格 war 权偏置 + 防背刺 + 复仇优先）；
//   ai.js 未加载时（verify-s3）守卫回退到原 aiWantWar，保证回归零影响。
function aiDeclareWars(state) {
  state.factions.forEach(function (f) {
    if (!f.alive || f.id === state.humanFactionId) return;
    if (f.lastWarDay === state.day) return; // 防重入：当日已宣战
    var decision = (typeof ai !== 'undefined' && ai.decideWar) ? ai.decideWar(state, f) : aiWantWar(state, f);
    if (decision && decision.target) {
      var res = declareWar(state, f.id, decision.target, { resolveNow: true, bonus: decision.bonus || 1 });
      if (res.ok) f.lastWarDay = state.day;
    }
  });
  return state;
}

// 结算所有 pending 战争（人类 WAR 阶段宣战，统一在 SETTLEMENT 结算）。
function resolvePending(state) {
  state.war.pending = state.war.pending || [];
  var list = state.war.pending.slice();
  state.war.pending = [];
  list.forEach(function (warObj) {
    warObj.result = resolveWar(state, warObj);
    warObj.status = 'resolved';
  });
  // 战争结束：清空 active（战果已入 history，供 UI 日志/卡片展示）。
  state.war.active = null;
  return state;
}

// runAll（AI 回合）：由 engine.runAIDecisions 按 phase 分派。
//   - WAR 阶段：AI 宣战并立即结算 + 兜底结算遗留 pending（正常为空）。
//   - SETTLEMENT 阶段：统一结算人类 WAR 阶段留下的 pending 战争（早于 settle 扣药）。
function runAll(state) {
  if (!state) return state;
  state.war = state.war || { active: null, history: [], pending: [] };
  if (state.phase === 'WAR') {
    aiDeclareWars(state);
    resolvePending(state);          // 兜底：正常 WAR 进入时 pending 已空
  } else if (state.phase === 'SETTLEMENT') {
    resolvePending(state);          // 结算人类 pending 战争
  }
  return state;
}

// 模块对象（engine/ui 通过 war.runAll / war.declareWar / ... 调用）。
var war = {
  declareWar: declareWar,
  resolveWar: resolveWar,
  applyPlunder: applyPlunder,
  computePower: computePower,
  compareCombat: compareCombat,
  aiWantWar: aiWantWar,
  aiDeclareWars: aiDeclareWars,
  resolvePending: resolvePending,
  runAll: runAll,
  warFaction: warFaction,
  canPayWar: canPayWar,
  payWarCost: payWarCost,
  warRNG: warRNG
};

if (typeof globalThis !== 'undefined') {
  globalThis.war = war;
  globalThis.declareWar = declareWar;
  globalThis.resolveWar = resolveWar;
  globalThis.applyPlunder = applyPlunder;
  globalThis.computePower = computePower;
  globalThis.compareCombat = compareCombat;
  globalThis.aiWantWar = aiWantWar;
  globalThis.warFaction = warFaction;
}
