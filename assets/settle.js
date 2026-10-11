/* =========================================================
 * cangame v2 · settle.js
 * 阶段5 结算：按存活人数扣药 → 不足按 score 升序淘汰（贪狼自保 / 复仇压对头）
 *           + 实时奖金预期（§3.5）+ 终局分红（最简：按 Goods 占比 ÷ 存活人数）。
 * 依赖：config.js / rng.js / state.js(pushLog) / resource.js(transferResource)。
 * 加载顺序：resource.js → settle.js。
 * Sprint 1 范围：仅 settlement 真算；生产/贸易/战争 为空桩（钩子见 engine.js）。
 * ========================================================= */

// 选择淘汰名单：按 score 升序取 killN 人。
// Sprint 4：决策交由 ai.chooseVictims（性格化：贪狼自保硬保护 / 复仇压对头 / score 公式）；
//   ai.js 未加载时（verify-s1）守卫回退到下方原骨架逻辑，保证回归零影响。
function chooseVictims(state, faction, killN) {
  if (typeof ai !== 'undefined' && ai.chooseVictims) return ai.chooseVictims(state, faction, killN);
  // —— 回退骨架（无 ai.js 时）——
  var alive = faction.playerIds
    .map(function (id) { return state.players[id]; })
    .filter(function (p) { return p.alive; });

  var scored = alive.map(function (p) {
    var score = p.scoreBase;
    if (p.personality && p.personality.type === 'greedy') score = Infinity; // 贪狼自保
    return { p: p, score: score };
  });

  // 复仇压制：阵营内任一复仇者把其 grudge 目标压到最低。
  alive.forEach(function (v) {
    if (v.personality && v.personality.type === 'vengeful' && v.memory && v.memory.grudges) {
      v.memory.grudges.forEach(function (tid) {
        var t = scored.find(function (s) { return s.p.id === tid && s.p.alive; });
        if (t) t.score = -Infinity;
      });
    }
  });

  scored.sort(function (a, b) { return a.score - b.score; });
  return scored.slice(0, killN).map(function (s) { return s.p.id; });
}

function eliminatePlayer(state, faction, pid) {
  var p = state.players[pid];
  if (!p || !p.alive) return;
  p.alive = false;
  p.eliminatedDay = state.day;
  faction.popAlive = Math.max(0, faction.popAlive - 1);
  faction.eliminatedIds.push(pid);
  if (faction.popAlive === 0) faction.alive = false;
  if (faction.leaderId === pid) {
    var next = faction.playerIds.find(function (id) { return state.players[id].alive; });
    faction.leaderId = (next !== undefined) ? next : null;
  }
  pushLog(state, p.name + '（' + faction.name + '）因缺药被淘汰', 'eliminate');
  if (state.eliminatedToday) state.eliminatedToday.push(pid);
}

// 单阵营结算：扣药 + 缺口淘汰。
function settleFaction(state, faction, rng) {
  if (!faction.alive) return;
  var required = faction.popAlive * CONFIG.DAILY_LIFE_COST;
  var have = faction.life;
  var pay = Math.min(have, required);
  transferResource(faction, { life: -pay });        // 扣到 0 为止（防幽灵）
  var deficit = Math.max(0, required - have);
  var killN = Math.ceil(deficit / CONFIG.DAILY_LIFE_COST);
  if (killN > 0) {
    var victims = chooseVictims(state, faction, killN);
    victims.forEach(function (pid) { eliminatePlayer(state, faction, pid); });
  }
}

// 全服结算（阶段5 引擎调用）。返回本日淘汰名单（player id 数组）。
function settleDay(state) {
  var rng = makeRNG(((state.seed ^ Math.imul(state.day, 2654435761)) >>> 0) || 1);
  state.eliminatedToday = [];
  state.factions.forEach(function (f) {
    if (f.alive) settleFaction(state, f, rng);
  });
  // 结算后刷新实时字段（供 UI / 奖金预期）。
  state.factions.forEach(function (f) {
    f.requiredLife = f.alive ? f.popAlive * CONFIG.DAILY_LIFE_COST : 0;
    f.deficit = Math.max(0, f.requiredLife - f.life);
  });
  return state.eliminatedToday;
}

// 实时奖金预期（§3.5）：某阵营奖金总额 = PrizePool × (factionGoods / ΣaliveGoods)
function factionPrizeTotal(state, faction) {
  var totalGoods = 0;
  state.factions.forEach(function (f) {
    if (f.alive && f.popAlive > 0) totalGoods += f.goods;
  });
  if (totalGoods <= 0) return 0;
  return state.prizePool * (faction.goods / totalGoods);
}

// 实时人均奖金（§3.5）：总额 ÷ 阵营存活人数（人头稀释核心张力）
function factionPrizePerPerson(state, faction) {
  if (!faction.alive || faction.popAlive <= 0) return 0;
  return factionPrizeTotal(state, faction) / faction.popAlive;
}

// 终局分红（最简实现）：仅剩 ≤1 阵营 或 day>MAX_DAY 时由引擎调用。
// 公式：factionTotal = PrizePool × (factionGoods / ΣaliveGoods)；perPerson = total / popAlive。
function endGame(state) {
  var aliveFactions = state.factions.filter(function (f) { return f.alive && f.popAlive > 0; });
  var totalGoods = 0;
  aliveFactions.forEach(function (f) { totalGoods += f.goods; });

  var result = {
    endedDay: state.day,
    prizePool: state.prizePool,
    totalGoods: totalGoods,
    factionTotals: {},
    perPerson: {},
    winner: null
  };

  var bestPer = -1;
  state.factions.forEach(function (f) {
    var total = 0;
    if (totalGoods > 0 && f.alive && f.popAlive > 0) {
      total = state.prizePool * (f.goods / totalGoods);
    }
    result.factionTotals[f.id] = total;
    result.perPerson[f.id] = (f.popAlive > 0) ? total / f.popAlive : 0;
    if (f.alive && f.popAlive > 0 && result.perPerson[f.id] > bestPer) {
      bestPer = result.perPerson[f.id];
      result.winner = f.id;
    }
  });

  state.result = result;
  state.status = 'ENDED';
  pushLog(state, '游戏结束（第 ' + state.day + ' 天）· 奖金已结算 · 赢家：' +
    ((state.factions.find(function (f) { return f.id === result.winner; }) || {}).name || '无'), 'endgame');
  return result;
}

if (typeof globalThis !== 'undefined') {
  globalThis.settleDay = settleDay;
  globalThis.settleFaction = settleFaction;
  globalThis.chooseVictims = chooseVictims;
  globalThis.eliminatePlayer = eliminatePlayer;
  globalThis.endGame = endGame;
  globalThis.factionPrizeTotal = factionPrizeTotal;
  globalThis.factionPrizePerPerson = factionPrizePerPerson;
}
