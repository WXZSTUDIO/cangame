/* =========================================================
 * cangame v2 · ai.js
 * AI 行为树 + 性格光谱（Sprint 4，对应设计文档 §5.2/§5.3/§5.4）。
 * 设计原则（§5.1）：纯规则、确定性、无 LLM、无自然语言文案；
 *   每个场景输出可解析 decisionJSON，由对应 system 文件执行。
 *
 * 六类性格（CONFIG.PERSONALITY_WEIGHTS）：greedy/steady/risky/vengeful/opportunist/lone，
 *   各含 weights.{prod,trade,war,betray} ∈ [0,1]，越高越激进/机会主义。
 *
 * 四场景确定性决策（全部由「性格权重 × 阈值 × 盘面」决定，给定盘面+性格输出唯一）：
 *   - produce : aiProductionBonus(state, f)            → {action:'produce',factionId,bonus}
 *   - trade   : aiDecideTrade(state)                  → 调 economy.placeOrder 挂单（价格随 trade 权重 ±20%、对头拒单）
 *   - war     : aiDecideWar(state, f)                 → {target} | null（复用 war.aiWantWar + war 权重偏置 + 防背刺 + 复仇优先）
 *   - betray  : aiDecideBetray(state, f)              → {action:'betray',target} | null（盟友毁约 && 收益×忠诚>维系成本）
 *   - survive : aiChooseVictims(state, f, killN)      → [playerId]（贪狼自保 / 复仇压对头 / score 公式）
 *   - 总入口 : aiDecideAll(state, phase)              → 按 phase 分派（MORNING 做背叛评估；其余由 system 的 runAll 咨询本模块）
 *
 * memory（沿用 state.players[].memory）：agreements / grudges / lastWarDay。
 *   - grudges：存「仇敌」标识，既可为 player id（阵营内对头，用于生存淘汰），
 *     也可为 faction id / 目标阵营领袖 player id（用于外交：拒单 / 战争优先 / 背叛）。
 *
 * 依赖（均在调用期引用，模块求值期不触碰，故可置于 economy/war/settle 之后加载）：
 *   config.js / rng.js / factions.js / resource.js / economy.js / war.js / settle.js。
 * 加载顺序（ADR-3 最终态）：…→ ai → leader → production → economy → war → settle → engine → ui。
 * 确定性：所有决策不含 Math.random；生产 yield 复用 production 的 prodRNG 思路由 system 负责，
 *   本模块的 rng 仅用于贸易挂单的轻微数量抖动（同 seed 同结果）。
 * ========================================================= */

// —— 工具 ——

// 取阵营对象（按 id）。
function aiFaction(state, id) {
  return state.factions.find(function (f) { return f.id === id; });
}

// 取阵营领袖 player。
function aiLeader(state, faction) {
  if (!faction) return null;
  return (faction.leaderId != null) ? state.players[faction.leaderId] : null;
}

// 该阵营领袖的性格权重（缺失时回落中性 0.5）。
function aiWeights(state, faction) {
  var ld = aiLeader(state, faction);
  return (ld && ld.personality && ld.personality.weights) || { prod: 0.5, trade: 0.5, war: 0.5, betray: 0.5 };
}

// 是否当前与 otherId 阵营有「未破裂」协议（互为盟友）。
function isAgreementAlly(state, a, b) {
  return (state.market.agreements || []).some(function (ag) {
    if (ag.breached) return false;
    return (ag.a === a && ag.b === b) || (ag.a === b && ag.b === a);
  });
}

// 阵营 fId 的领袖是否记仇于 otherId（otherId 可为 faction id 或 player id）。
function hasGrudge(state, fId, otherId) {
  var f = aiFaction(state, fId);
  if (!f) return false;
  var leader = aiLeader(state, f);
  if (!leader || !leader.memory || !leader.memory.grudges) return false;
  var g = leader.memory.grudges;
  if (g.indexOf(otherId) >= 0) return true;
  var otherLeader = aiFaction(state, otherId);
  var otherLeaderId = (otherLeader && otherLeader.leaderId != null) ? otherLeader.leaderId : null;
  return otherLeaderId != null && g.indexOf(otherLeaderId) >= 0;
}

// =========================================================
// ① 生产场景：冒险性格额外 +1 产出（封顶区间上限）；其余按产能区间（由 production.js 负责抽样）。
// 返回可被 production.runAll 直接叠加的 bonus（仅 risky 类型领袖 +1）。
// =========================================================
function aiProductionBonus(state, faction) {
  var ld = aiLeader(state, faction);
  if (ld && ld.personality && ld.personality.type === 'risky') return 1;
  return 0;
}

// =========================================================
// ② 贸易场景：AI 自动挂单（决策由性格驱动；执行交由 economy.placeOrder / resolveOrders）。
// 规则（§5.4②）：
//   - need = requiredLife - life > 0 → 急购生命药（高价，贪狼 urgency 更高）
//   - 其余：按需挂买/卖；要价随 weights.trade 浮动 factor = 1 + (trade-0.5)*0.4 → 恰好 ±20%
//   - 黑队专利抽成由 economy.executeTrade 自动结算（非黑队卖专利线 Goods 缴 15%，复用钩子）
//   - grudges 中的对头：拒绝与其成交（aiWouldTrade 返回 false，私密报价层使用）
// 确定性：挂单数量用派生子 rng（与 economy.placeAIOrders 同源 key），同盘面同结果。
// =========================================================
function aiWouldTrade(state, factionId, partnerId) {
  if (factionId === partnerId) return false;
  return !hasGrudge(state, factionId, partnerId);
}

function aiDecideTrade(state) {
  if (!state) return state;
  var lt = (typeof economy !== 'undefined' && economy.LIFE_GOODS) ? economy.LIFE_GOODS : '生命药';
  state.factions.forEach(function (f) {
    if (!f.alive || f.id === state.humanFactionId) return;
    if (f.aiTradeDay === state.day) return; // 防重入兜底（economy.runAll 已设标记）
    var w = aiWeights(state, f);
    var factor = 1 + (w.trade - 0.5) * 0.4;            // trade∈[0,1] → factor∈[0.8,1.2] = ±20%
    var basePrice = 5;
    var rng = makeRNG(
      ((state.seed ^ Math.imul(state.day, 0x9E3779B1) ^ Math.imul(f.id.charCodeAt(0) + 1, 0x85EBCA77)) >>> 0) || 1
    );
    var gt = (typeof economy !== 'undefined' && economy.GOODS_GENERIC) ? economy.GOODS_GENERIC : '货物';
    var required = f.popAlive * CONFIG.DAILY_LIFE_COST;
    var needLife = required - f.life;

    // —— 生命药市场（Sprint 5 平衡校准启用）：缺药阵营向蓝队求购生命药 ——
    // 注：保持原 if/else 结构的「单货物订单」语义（verify-s4#3 在 life=0 时仅触发本支），
    // 另以独立 `if` 追加卖货/卖药订单，避免破坏既有断言。
    if (needLife > 0) {
      // 急购生命药：贪狼(高 trade)报价更高（urgency）。
      var buyPrice = Math.max(1, Math.round(basePrice * factor * (w.trade > 0.7 ? 1.1 : 1)));
      placeAISafe(state, { side: 'buy', factionId: f.id, goodsType: lt, qty: Math.min(4, needLife), price: buyPrice }); // v2.0.1：3→4
    } else if (f.goods < 8 && f.won > 5) {
      placeAISafe(state, { side: 'buy', factionId: f.id, goodsType: gt, qty: randInt(rng, 1, 3), price: Math.max(1, Math.round(basePrice * factor)) });
    } else if (f.goods > 6) {
      placeAISafe(state, { side: 'sell', factionId: f.id, goodsType: gt, qty: randInt(rng, 1, 3), price: Math.max(1, Math.round(basePrice * factor)) });
    } else {
      placeAISafe(state, { side: 'buy', factionId: f.id, goodsType: gt, qty: 1, price: Math.max(1, Math.round(basePrice * factor)) });
    }

    // 有货盈余 → 卖货换 won（独立于上方，needLife 时也允许，作为购药资金）。
    if (f.goods > 6) {
      placeAISafe(state, { side: 'sell', factionId: f.id, goodsType: gt, qty: randInt(rng, 2, 4), price: Math.max(1, Math.round(basePrice * factor)) }); // v2.0.1：1~3→2~4
    }
    // 蓝队（医药垄断）卖出生存盈余外的生命药换 won。
    if (f.id === 'blue' && f.life - required > 1) {
      var sellLife = Math.max(1, Math.min(3, f.life - required - 1));
      placeAISafe(state, { side: 'sell', factionId: f.id, goodsType: lt, qty: sellLife, price: 4 });
    }
  });
  return state;
}

// 安全挂单（economy 存在时委托；否则 no-op，避免报错）。
function placeAISafe(state, o) {
  if (typeof economy !== 'undefined' && economy.placeOrder) return economy.placeOrder(state, o);
  return null;
}

// =========================================================
// ③ 战争场景：复用 war.aiWantWar（硬规则：红队 day≥2 低费即宣、其余收益比>1.5）+ 性格偏置。
// 规则（§5.4③ + §5.4④）：
//   - weights.war > 0.6 时在无硬规则命中时，也倾向宣战（选最富弱目标）
//   - 复仇性格优先把 grudge 仇敌作为目标
//   - 避免「背刺式」宣战：不对当前「未破裂协议盟友」动手（除非该盟友正是仇敌）
// 返回 {target} | null；由 war.runAll 据此 declareWar(resolveNow)。
// =========================================================
function pickWarTarget(state, f) {
  var targets = state.factions.filter(function (t) {
    return t.alive && t.id !== f.id && t.popAlive > 0;
  });
  if (targets.length === 0) return null;
  // 富（goods+won 高）而弱（存活少）优先。
  targets.sort(function (a, b) {
    var sa = (a.goods + a.won) / Math.max(1, a.popAlive);
    var sb = (b.goods + b.won) / Math.max(1, b.popAlive);
    return sb - sa;
  });
  return targets[0];
}

// 复仇优先：领袖 grudges 中、仍存活且可攻的「最肥」仇敌。
function bestGrudgeTarget(state, f) {
  var leader = aiLeader(state, f);
  if (!leader || !leader.memory || !leader.memory.grudges) return null;
  var best = null;
  leader.memory.grudges.forEach(function (gid) {
    var t = aiFaction(state, gid);
    if (t && t.alive && t.id !== f.id && t.popAlive > 0) {
      if (!best || (t.goods + t.won) > (best.goods + best.won)) best = t;
    }
  });
  return best;
}

function aiDecideWar(state, f) {
  if (!state || !f) return null;
  if (state.day < CONFIG.WAR_UNLOCK_DAY) return null;
  var cost = CONFIG.WAR_COST[f.id];
  if (typeof war !== 'undefined' && war.canPayWar) {
    if (!war.canPayWar(f, cost)) return null;
  } else if ((Number(f.won) || 0) + (Number(f.militaryFund) || 0) < cost) {
    return null;
  }

  // 硬规则（Sprint 3 既有）：红队低费尽情用、其余收益比>1.5。
  var base = (typeof war !== 'undefined' && war.aiWantWar) ? war.aiWantWar(state, f) : null;
  var decision = base;

  // 性格偏置：war 权重 > 0.6 时，即便硬规则未命中也倾向宣战。
  if (!decision) {
    var w = aiWeights(state, f);
    if (w.war > 0.6) {
      var t = pickWarTarget(state, f);
      if (t) decision = { target: t.id };
    }
  }

  if (decision) {
    // 复仇优先：若当前目标非仇敌但有更肥的仇敌可选 → 换成仇敌。
    var grudge = bestGrudgeTarget(state, f);
    if (grudge && decision.target !== grudge.id) decision = { target: grudge.id };

    // 避免背刺式宣战：不对「当前未破裂协议盟友」动手（除非该盟友正是仇敌）。
    if (isAgreementAlly(state, f.id, decision.target) && !hasGrudge(state, f.id, decision.target)) {
      return null;
    }
  }
  return decision;
}

// =========================================================
// ④ 背叛 / 生存场景（关键）
// =========================================================

// 背叛候选（输出 {factionId: agreementId|null}）：
//   - 协议：对方(非己方)毁约（breached 且 breachedBy 为对方）→ 视为可背刺对象
//   - memory.grudges：直接记仇的阵营 id（盟友毁约记忆）
function betrayCandidates(state, f) {
  var out = {};
  (state.market.agreements || []).forEach(function (ag) {
    if (!ag.breached) return;
    var partner = null;
    if (ag.a === f.id && ag.breachedBy === ag.b) partner = ag.b;
    else if (ag.b === f.id && ag.breachedBy === ag.a) partner = ag.a;
    if (partner) out[partner] = ag.id;
  });
  var leader = aiLeader(state, f);
  if (leader && leader.memory && leader.memory.grudges) {
    leader.memory.grudges.forEach(function (gid) {
      if (state.factions.some(function (x) { return x.id === gid; })) out[gid] = out[gid] || null;
    });
  }
  return out;
}

// 背叛决策（§5.4④）：盟友曾毁约 && (背叛收益 × (1 - loyalty) > 维系成本)
//   其中 loyalty = 1 - weights.betray（背叛倾向越高，忠诚越低）→ 等价于 收益 × weights.betray > 维系成本。
//   背叛收益 = 预期掠夺 = 目标.goods×PLUNDER.goods + 目标.won×PLUNDER.won。
function aiDecideBetray(state, f) {
  if (!state || !f) return null;
  if (f.id === state.humanFactionId) return null; // 人类阵营不自动背叛（由玩家决定）
  var w = aiWeights(state, f);
  var candidates = betrayCandidates(state, f);
  var ids = Object.keys(candidates);
  for (var i = 0; i < ids.length; i++) {
    var partner = ids[i];
    var pf = aiFaction(state, partner);
    if (!pf || !pf.alive) continue;
    var gain = pf.goods * CONFIG.PLUNDER.goods + pf.won * CONFIG.PLUNDER.won;
    var maintainCost = CONFIG.BETRAY_MAINTAIN_COST;
    if (gain * w.betray > maintainCost) {
      return { action: 'betray', target: partner, agreementId: candidates[partner] };
    }
  }
  return null;
}

// 执行背叛：标记协议由己方破坏（若仍有效）、把目标记入己方 grudges、写日志。
// 由 aiDecideAll('MORNING') 在决策命中后调用（system 执行层）。
function aiExecuteBetray(state, f, decision) {
  if (!decision) return state;
  if (decision.agreementId) {
    var ag = (state.market.agreements || []).find(function (x) { return x.id === decision.agreementId; });
    if (ag && !ag.breached) { ag.breached = true; ag.breachedBy = f.id; }
  }
  var leader = aiLeader(state, f);
  if (leader && leader.memory) {
    if (!leader.memory.grudges) leader.memory.grudges = [];
    if (leader.memory.grudges.indexOf(decision.target) < 0) leader.memory.grudges.push(decision.target);
  }
  pushLog(state, f.name + ' 背叛了 ' + ((aiFaction(state, decision.target) || {}).name || decision.target) + '（背刺盟友）', 'diplo');
  return state;
}

// —— 生存淘汰（阶段5 缺药）：性格化 chooseVictims（§5.4④）——
// score = 产出贡献(以 scoreBase 代理) × (1 - 贪狼自保偏置) - (复仇?对头加分:0)
//   - 贪狼性格：自身 score 强制 +∞（绝不先死自己）
//   - 复仇性格：优先把「对头（grudges 中的 player id）」score 压到 -∞
// 按 score 升序淘汰 killN 人（最低分先死）。
function aiChooseVictims(state, faction, killN) {
  var alive = faction.playerIds
    .map(function (id) { return state.players[id]; })
    .filter(function (p) { return p.alive; });

  var greedyBias = CONFIG.AI_GREEDY_SELF_BIAS || 0;

  var scored = alive.map(function (p) {
    if (p.personality && p.personality.type === 'greedy') {
      return { p: p, score: Infinity };       // 贪狼自保硬保护
    }
    var score = (p.scoreBase || 0) * (1 - greedyBias); // 产出贡献×(1-贪狼自保偏置)
    return { p: p, score: score };
  });

  // 复仇压制：阵营内任一复仇者把其 grudge（player id）目标压到最低。
  alive.forEach(function (v) {
    if (v.personality && v.personality.type === 'vengeful' && v.memory && v.memory.grudges) {
      v.memory.grudges.forEach(function (tid) {
        var t = scored.find(function (s) { return s.p.id === tid && s.p.alive; });
        if (t && t.score !== Infinity) t.score = -Infinity; // 对头优先死（复仇加分表达为压低分）
      });
    }
  });

  scored.sort(function (a, b) { return a.score - b.score; });
  return scored.slice(0, killN).map(function (s) { return s.p.id; });
}

// =========================================================
// 总入口：按 phase 分派。MORNING 做背叛评估（外交）；
// TRADING/WAR/SETTLEMENT 的 AI 决策由各 system 的 runAll 在内部咨询 ai.* 完成（避免逻辑重复）。
// =========================================================
function aiDecideAll(state, phase) {
  if (!state) return state;
  phase = phase || state.phase;
  if (phase === 'MORNING') {
    state.factions.forEach(function (f) {
      if (!f.alive || f.id === state.humanFactionId) return;
      var d = aiDecideBetray(state, f);
      if (d && d.action === 'betray') aiExecuteBetray(state, f, d);
    });
  }
  // TRADING: production.runAll 已咨询 aiProductionBonus；economy.runAll 咨询 aiDecideTrade
  // WAR:     war.runAll 咨询 aiDecideWar
  // SETTLEMENT: settle.chooseVictims 咨询 aiChooseVictims
  return state;
}

// 模块对象（engine / system 文件通过 ai.decideAll / ai.decideWar / ... 调用）。
var ai = {
  productionBonus: aiProductionBonus,
  decideTrade: aiDecideTrade,
  decideWar: aiDecideWar,
  decideBetray: aiDecideBetray,
  executeBetray: aiExecuteBetray,
  chooseVictims: aiChooseVictims,
  decideAll: aiDecideAll,
  wouldTrade: aiWouldTrade,
  pickWarTarget: pickWarTarget,
  betrayCandidates: betrayCandidates
};

if (typeof globalThis !== 'undefined') {
  globalThis.ai = ai;
  globalThis.aiProductionBonus = aiProductionBonus;
  globalThis.aiDecideTrade = aiDecideTrade;
  globalThis.aiDecideWar = aiDecideWar;
  globalThis.aiDecideBetray = aiDecideBetray;
  globalThis.aiExecuteBetray = aiExecuteBetray;
  globalThis.aiChooseVictims = aiChooseVictims;
  globalThis.aiDecideAll = aiDecideAll;
  globalThis.aiWouldTrade = aiWouldTrade;
}
