/* =========================================================
 * cangame v2 · factions.js
 * 13 人随机分配入 4 阵营（白6/蓝3/红3/黑1），按 §3.2 注入初始资源。
 * 导出：randomAssign(seed) / assignHumanFaction(state)。
 * 依赖：config.js / rng.js（makeRNG, randInt, shuffle）。
 * 加载顺序：state.js → factions.js。
 * ========================================================= */

// 姓名库（确定性抽样，不依赖外部数据）。
var NAME_POOL = [
  '玄', '昭', '珩', '凛', '璟', '煜', '澈', '骁', '岚', '晏',
  '霄', '阙', '砚', '朔', '斐', '珩', '翊', '桓', '邈', '湛'
];

// 各阵营性格默认分布（§5.3 倾向）：数组长度 = 该阵营人口，按成员顺序分配。
// 保证白队含贪狼（自保偏置）、红队含复仇（对头压制），便于 Sprint 4 行为树与淘汰骨架演练。
var PERSONALITY_POOLS = {
  white: ['steady', 'steady', 'greedy', 'steady', 'greedy', 'steady'],
  blue:  ['steady', 'opportunist', 'steady'],
  red:   ['risky', 'vengeful', 'risky'],
  black: ['lone']
};

// 13 人随机分配（确定性：同 seed 同结果）。
// 返回 { players:[Player×13], factions:[Faction×4] }，不直接改动传入 state。
function randomAssign(seed) {
  var rng = makeRNG(seed >>> 0);
  var defs = CONFIG.FACTION_DEFS;

  // 1) 构造阵营槽位并洗牌：保证人口分布恒为 6/3/3/1（白6/蓝3/红3/黑1）。
  var slots = [];
  defs.forEach(function (d) {
    for (var i = 0; i < d.pop; i++) slots.push(d.id);
  });
  slots = shuffle(rng, slots); // 13 个槽，随机顺序

  // 2) 姓名抽样（确定性，避免重名）。
  var names = shuffle(rng, NAME_POOL).slice(0, CONFIG.TOTAL_PLAYERS);

  // 3) 创建 Player（§6.3）。
  // 性格权重在阵营默认倾向（PERSONALITY_WEIGHTS[ptype]）基础上做 ±PERSONALITY_JITTER 抖动，
  // 使同阵营成员互有微差（确定性：由独立派生子种子，不消费主 rng 序列，故人口/技能分配不变）。
  var jrng = makeRNG(((seed >>> 0) ^ 0x51ED270B) >>> 0 || 1);
  var players = [];
  for (var p = 0; p < CONFIG.TOTAL_PLAYERS; p++) {
    var fid = slots[p];
    var def = defs.find(function (d) { return d.id === fid; });
    var ptype = PERSONALITY_POOLS[fid][players.filter(function (x) { return x.factionId === fid; }).length];
    var baseW = CONFIG.PERSONALITY_WEIGHTS[ptype] || CONFIG.PERSONALITY_WEIGHTS.steady;
    var jit = CONFIG.PERSONALITY_JITTER || 0;
    var weights = {};
    ['prod', 'trade', 'war', 'betray'].forEach(function (k) {
      var v = (baseW[k] == null ? 0.5 : baseW[k]) + (jrng() * 2 - 1) * jit;
      weights[k] = Math.max(0, Math.min(1, Math.round(v * 100) / 100));
    });
    players.push({
      id: p,
      name: names[p],
      factionId: fid,
      isHuman: false,
      alive: true,
      personality: {
        type: ptype,
        weights: weights
      },
      actionPoints: def.production.ap,        // 当日剩余行动力（Sprint 2 启用）
      skills: { production: randInt(rng, 1, 3), combat: randInt(rng, 1, 3) },
      memory: { agreements: [], grudges: [], lastWarDay: 0 },
      scoreBase: randInt(rng, 1, 100),        // 淘汰排序基准（确定性）
      eliminatedDay: null
    });
  }

  // 4) 创建 Faction（§6.2）并按成员注入初始资源。
  var factions = defs.map(function (d) {
    var memberIds = [];
    players.forEach(function (pl) { if (pl.factionId === d.id) memberIds.push(pl.id); });
    var init = CONFIG.INITIAL[d.id];
    return {
      id: d.id,
      name: d.name,
      color: d.color,
      popAlive: memberIds.length,
      playerIds: memberIds,
      eliminatedIds: [],
      leaderId: memberIds[0] != null ? memberIds[0] : null, // 占位领袖（Sprint 4 选举覆盖）
      life: init.life,
      goods: init.goods,
      won: init.won,
      militaryFund: init.militaryFund,
      patents: (d.patents || []).slice(),
      alive: memberIds.length > 0,
      requiredLife: 0,   // 结算期实时字段
      deficit: 0         // 结算期实时字段
    };
  });

  return { players: players, factions: factions };
}

// 随机指定 1 个阵营为人类（玩家任领袖）。
// 确定性派生：由 seed 派生子种子，避免与 randomAssign 的 rng 消费序列耦合。
function assignHumanFaction(state) {
  if (!state || !state.factions || state.factions.length === 0) return null;
  var rng = makeRNG(((state.seed ^ 0x9E3779B9) >>> 0) || 1);
  var ids = state.factions.map(function (f) { return f.id; });
  var id = ids[Math.floor(rng() * ids.length)];
  state.humanFactionId = id;

  var f = state.factions.find(function (x) { return x.id === id; });
  if (f) {
    // 人类 = 该阵营领袖：取首位存活成员。
    var humanId = f.playerIds.find(function (pid) { return state.players[pid].alive; });
    if (humanId !== undefined) {
      state.players[humanId].isHuman = true;
      f.leaderId = humanId;
    }
  }
  return id;
}

if (typeof globalThis !== 'undefined') {
  globalThis.randomAssign = randomAssign;
  globalThis.assignHumanFaction = assignHumanFaction;
  globalThis.NAME_POOL = NAME_POOL;
  globalThis.PERSONALITY_POOLS = PERSONALITY_POOLS;
}
