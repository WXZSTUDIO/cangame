/* =========================================================
 * cangame v2 · leader.js
 * 早间领袖选举（Sprint 4，对应设计文档 §2.3 / §5.3）。
 *   - 多人阵营：每日早间内部「投票」选领袖（权重 = 贡献分 scoreBase × 性格领导力偏置）
 *   - 单人阵营：领袖即本人
 *   - 人类阵营：领袖恒为玩家（assignHumanFaction 已置，本模块不覆盖）
 *   - 生成「领袖会议提案」写入 state.leaderProposals（结构化、无自然语言文案，供贸易/外交用）
 *
 * 依赖：config.js / state.js(pushLog) / ai.js（读取 personality 用于领导力偏置）。
 * 加载顺序：ai.js → leader.js（leader 在 ai 之后，可复用 ai 的性格数据）。
 * 确定性：投票为纯函数（scoreBase 确定性 + 同分取 id 小者），同 seed 同结果。
 * ========================================================= */

// 性格领导力偏置：冒险 / 贪狼 更想当领袖（权重更高 → 更可能被选上）。
//   bias = 1 + war*0.5 + betray*0.3（封顶 2）。
function leaderBias(type) {
  var w = (CONFIG.PERSONALITY_WEIGHTS && CONFIG.PERSONALITY_WEIGHTS[type]) || { war: 0.5, betray: 0.5 };
  return Math.min(2, 1 + (w.war || 0) * 0.5 + (w.betray || 0) * 0.3);
}

// 选举单阵营领袖（写 f.leaderId）。
function electLeader(state, faction) {
  if (!faction || !faction.alive) return;
  // 人类阵营：领袖恒为玩家，不重选。
  if (faction.id === state.humanFactionId) {
    var human = faction.playerIds.find(function (id) {
      var p = state.players[id]; return p && p.isHuman && p.alive;
    });
    if (human !== undefined) faction.leaderId = human;
    return;
  }
  var alive = faction.playerIds
    .map(function (id) { return state.players[id]; })
    .filter(function (p) { return p && p.alive; });
  if (alive.length === 0) return;
  if (alive.length === 1) { faction.leaderId = alive[0].id; return; } // 单人阵营=本人

  // 多人民主投票（确定性）：各存活成员投自己，按 score = scoreBase × 领导力偏置 取最高；
  // 同分取 id 小者（稳定，避免抖动）。
  var best = null, bestScore = -Infinity;
  alive.forEach(function (p) {
    var score = (p.scoreBase || 0) * leaderBias(p.personality ? p.personality.type : 'steady');
    if (score > bestScore || (score === bestScore && best != null && p.id < best.id)) {
      bestScore = score; best = p;
    }
  });
  faction.leaderId = best ? best.id : alive[0].id;
}

// 生成领袖会议提案（结构化：day / factionId / kind / targetId / proposerId）。
// 多人对 AI 阵营：领袖提议与「最弱邻」签互不侵犯（整合外交，进入贸易/外交用）。
function makeProposal(state, faction) {
  if (faction.id === state.humanFactionId) return null; // 人类提案由 UI 发起，不抢占
  var leader = (faction.leaderId != null) ? state.players[faction.leaderId] : null;
  if (!leader) return null;
  // 最弱邻：存活、非己方、popAlive 最小者。
  var neighbors = state.factions.filter(function (t) {
    return t.alive && t.id !== faction.id && t.popAlive > 0;
  });
  if (neighbors.length === 0) return null;
  neighbors.sort(function (a, b) { return a.popAlive - b.popAlive; });
  var target = neighbors[0];
  return {
    day: state.day,
    factionId: faction.id,
    proposerId: faction.leaderId,
    kind: 'nonaggression',
    targetId: target.id
  };
}

// 早间编排入口：每个存活阵营选举领袖 + 生成提案。
// 仅 MORNING 阶段有效；幂等（每次调用都重新选举，便于每日刷新）。
function runAll(state) {
  if (!state) return state;
  if (state.phase !== 'MORNING') return state;
  state.leaderProposals = state.leaderProposals || [];
  state.factions.forEach(function (f) {
    if (!f.alive) return;
    electLeader(state, f);
    var proposal = makeProposal(state, f);
    if (proposal) state.leaderProposals.push(proposal);
  });
  pushLog(state, '早间选举完成 · 各阵营领袖已确定', 'diplo');
  return state;
}

// 模块对象（engine 通过 leader.runAll 调用）。
var leader = {
  runAll: runAll,
  electLeader: electLeader,
  leaderBias: leaderBias,
  makeProposal: makeProposal
};

if (typeof globalThis !== 'undefined') {
  globalThis.leader = leader;
  globalThis.electLeader = electLeader;
  globalThis.leaderBias = leaderBias;
  globalThis.leaderRunAll = runAll;
}
