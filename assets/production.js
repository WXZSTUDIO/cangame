/* =========================================================
 * cangame v2 · production.js
 * 生产系统（Sprint 2）：
 *   - AI 侧：production.runAll(state) 每阵营按 §3.3 产能区间确定性产出；
 *            由 engine.runAIDecisions() 在「离开生产阶段（phase=TRADING）」时调用。
 *   - 人类侧：production.humanProduce(state, opts) 由 ui.js 生产小游戏调用，
 *            产出落该阵营产能区间（答对 + 技能加成，封顶区间上限），扣行动力。
 *   - 行动力：每玩家 actionPoints（§3.3 默认 2）限制每日生产次数；每日重置。
 * 依赖：config.js / rng.js / state.js(pushLog) / resource.js(transferResource)。
 * 加载顺序：resource.js → production.js（在 economy 之前）。
 * 确定性：产出 RNG 由 (seed ^ day*K ^ factionIndex*K) 派生，同 seed 同结果。
 * ========================================================= */

// 取阵营对象（按 id）。
function prodFaction(state, id) {
  return state.factions.find(function (f) { return f.id === id; });
}

// 每阵营、每日的确定性 RNG（避免与分配/结算序列耦合）。
function prodRNG(state, factionIndex) {
  return makeRNG(
    ((state.seed ^ Math.imul(state.day, 0x85EBCA6B) ^ Math.imul(factionIndex + 1, 0xC2B2AE35)) >>> 0) || 1
  );
}

// AI 自动生产：遍历存活且非人类的阵营，按产能区间确定性产出并写资源池。
// 仅在「离开生产阶段」（phase=TRADING）时由 runAIDecisions 调用；
// 用 faction.lastProducedDay 双重防重入（同一天只产一次）。
function runAll(state) {
  if (!state || state.phase !== 'TRADING') return state; // 仅在 AI 结算生产阶段时跑
  state.factions.forEach(function (f, idx) {
    if (!f.alive) return;
    if (f.id === state.humanFactionId) return;          // 人类由 UI 小游戏产出
    if (f.lastProducedDay === state.day) return;         // 防重入
    var pr = CONFIG.PRODUCTION[f.id];
    if (!pr) return;
    var rng = prodRNG(state, idx);
    var g = (pr.goodsMax > 0) ? randInt(rng, pr.goodsMin, pr.goodsMax) : 0;
    var l = (pr.lifeMax > 0) ? randInt(rng, pr.lifeMin, pr.lifeMax) : 0;
    // 性格调参（Sprint 4 §5.4①）：冒险性格领袖额外 +1 产出，封顶区间上限。
    // ai.js 未加载时（verify-s1/s2/s3）守卫为 no-op，保证回归零影响。
    if (typeof ai !== 'undefined' && ai.productionBonus) {
      var bonus = ai.productionBonus(state, f);
      if (bonus) g = Math.min(pr.goodsMax, g + bonus);
    }
    transferResource(f, { goods: g, life: l });
    f.lastProducedDay = state.day;

    // 行动力记账：消耗该阵营领袖 1 点（仅记账，不影响产出公式）。
    var leader = (f.leaderId != null) ? state.players[f.leaderId] : null;
    if (leader && leader.actionPoints > 0) leader.actionPoints -= 1;

    pushLog(state, f.name + ' 自动生产 +' + g + '货 +' + l + '药', 'produce');
  });
  return state;
}

// 人类生产小游戏产出（由 ui.js 调用）。
// opts: { correct: bool, skillBonus: int }
//   - correct=true：按产能区间抽样 + 技能加成，封顶区间上限；
//   - correct=false：本次未产出（行动力照扣）。
// 行动力：人类玩家 actionPoints 不足则拒绝。
function humanProduce(state, opts) {
  opts = opts || {};
  var fid = state.humanFactionId;
  var f = prodFaction(state, fid);
  if (!f || !f.alive) return { ok: false, reason: 'faction-dead' };
  var human = state.players.find(function (p) { return p.isHuman && p.alive; });
  if (!human) return { ok: false, reason: 'no-human' };
  if ((human.actionPoints || 0) <= 0) return { ok: false, reason: 'no-ap' };

  var pr = CONFIG.PRODUCTION[fid];
  var correct = opts.correct !== false;
  var skillBonus = (correct ? Math.max(0, opts.skillBonus || 0) : 0);
  var rng = makeRNG(
    ((state.seed ^ Math.imul(state.day, 0x27D4EB2F) ^ Math.imul(fid.charCodeAt(0) + 1, 0x165667B1)) >>> 0) || 1
  );

  var g = 0, l = 0;
  if (correct) {
    if (pr.goodsMax > 0) g = Math.min(pr.goodsMax, randInt(rng, pr.goodsMin, pr.goodsMax) + skillBonus);
    if (pr.lifeMax > 0) l = Math.min(pr.lifeMax, randInt(rng, pr.lifeMin, pr.lifeMax) + skillBonus);
  }
  if (g > 0 || l > 0) transferResource(f, { goods: g, life: l });

  human.actionPoints -= 1;
  f.lastProducedDay = state.day; // 标记本阵营今日已生产（runAll 不会再补人类阵营）
  pushLog(state,
    '你（' + f.name + '）生产小游戏' + (correct ? '产出 +' + g + '货 +' + l + '药' : '未产出') +
    '（剩 ' + human.actionPoints + ' 行动力）', 'produce');
  return { ok: true, correct: correct, goods: g, life: l, apLeft: human.actionPoints };
}

// 每日重置行动力（endDay 进入新一天时由 engine 调用）并清空生产标记。
function resetDailyAP(state) {
  state.factions.forEach(function (f) {
    var ap = (CONFIG.PRODUCTION[f.id] && CONFIG.PRODUCTION[f.id].ap) || 2;
    f.playerIds.forEach(function (pid) {
      if (state.players[pid]) state.players[pid].actionPoints = ap;
    });
    f.lastProducedDay = null;
  });
  return state;
}

// 模块对象（engine/ui 通过 production.runAll / production.humanProduce 调用）。
var production = {
  runAll: runAll,
  humanProduce: humanProduce,
  resetDailyAP: resetDailyAP
};

if (typeof globalThis !== 'undefined') {
  globalThis.production = production;
  globalThis.prodFaction = prodFaction;
  globalThis.prodRNG = prodRNG;
}
