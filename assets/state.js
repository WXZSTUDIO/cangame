/* =========================================================
 * cangame v2 · state.js
 * 顶层 gameState 唯一真源工厂 + 日志 + 序列化。
 * 依赖：config.js / rng.js / factions.js（randomAssign, assignHumanFaction 在运行期调用）。
 * 加载顺序：rng.js → state.js（factions.js 晚于本文件，但仅在调用期引用，时序安全）。
 * ========================================================= */

// 事件日志（供 UI 时间线与复盘）。type 仅用于 UI 着色。
function pushLog(state, text, type) {
  if (!state || !state.log) return;
  state.log.push({ day: state.day, phase: state.phase, text: text, type: type || 'info' });
  // 防止日志无限增长（极端长跑对局保护）。
  if (state.log.length > 2000) state.log.splice(0, state.log.length - 2000);
}

// 创建一局完整 gameState（§6.1 / 6.2 / 6.3）。
// 流程：建骨架 → randomAssign 填充 13 人/4 阵营 → assignHumanFaction 指定人类阵营。
function createGameState(seed) {
  seed = (seed >>> 0) || 1;
  var state = {
    version: CONFIG.version,
    seed: seed,
    day: 1,
    phase: 'MORNING',
    phaseStep: 0,
    status: 'PLAYING',          // PLAYING | ENDED
    isResolving: false,         // 引擎置位：AI 批量结算中
    humanFactionId: null,       // 'white' | 'blue' | 'red' | 'black'
    factions: [],
    players: [],
    market: { orders: [], trades: [], agreements: [], bribeQueue: [] },
    war: { active: null, history: [], pending: [] }, // pending：人类 WAR 阶段宣战、待 SETTLEMENT 统一结算
    leaderProposals: [],                  // 早间领袖会议提案（Sprint 4 leader.js 写入，结构化、无文案）
    prizePool: CONFIG.PRIZE_SEED,
    config: CONFIG,             // 本局参数快照（引用单一真源）
    log: [],
    result: null                // 终局分红结果
  };

  var assigned = randomAssign(seed);   // factions.js 提供
  state.players = assigned.players;
  state.factions = assigned.factions;

  assignHumanFaction(state);           // factions.js 提供（随机选 1 阵营为人类）

  // 早间 AI 编排（Sprint 4）：领袖选举 + 背叛评估。
  // 守卫：仅当 ai.js/leader.js 已加载（浏览器全量 / verify-s4 全量加载）才触发；
  // 旧 verify-s1/s2/s3 不加载这两个文件 → 此处为安全 no-op，保证回归零影响。
  if (typeof leader !== 'undefined' && leader.runAll) leader.runAll(state);
  if (typeof ai !== 'undefined' && ai.decideAll) ai.decideAll(state, 'MORNING');

  pushLog(state, '新对局开始 · 种子 ' + seed + ' · 你随机入营为「' +
    (state.factions.find(function (f) { return f.id === state.humanFactionId; }) || {}).name + '」领袖', 'info');
  return state;
}

// 序列化：gameState 全部为纯数据（无函数），可直接 JSON。
// config 为引用，JSON.stringify 会按值展开；反序列化后得到自包含快照。
function serializeGameState(state) {
  return JSON.stringify(state);
}

// 反序列化：还原 gameState 对象（自包含，无需原 config 引用）。
function deserializeGameState(json) {
  var s = (typeof json === 'string') ? JSON.parse(json) : json;
  return s;
}

// 便捷方法：挂在 state 上，便于 state.serialize() 调用。
// （独立函数 serializeGameState 仍为主入口，供 vm 测试直接调用。）
if (typeof globalThis !== 'undefined') {
  globalThis.createGameState = createGameState;
  globalThis.pushLog = pushLog;
  globalThis.serializeGameState = serializeGameState;
  globalThis.deserializeGameState = deserializeGameState;
}
