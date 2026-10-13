// cangame v3.1 · 训练/理疗（XBA 逆向：训练点制，效果下一轮体现）
// 训练点通过比赛获得（胜 3 / 负 1），训练消耗点数+体力+心情，属性立即成长
function training_attrs() { return CONFIG.TRAINING.ATTRS; }

function training_apply(state, playerId, attrKey) {
  const T = CONFIG.TRAINING;
  if (T.ATTRS.indexOf(attrKey) < 0) return { ok: false, reason: 'bad-attr' };
  if (state.trainPts < T.COST_POINTS) return { ok: false, reason: 'no-points' };
  const t = teamById(state, state.humanTeamId);
  const p = t.players.find(function (x) { return x.id === playerId; });
  if (!p) return { ok: false, reason: 'no-player' };
  if (p.injury > 0) return { ok: false, reason: 'injured' };
  if (p.stamina < T.COST_STAMINA + 10) return { ok: false, reason: 'too-tired' };
  if (p.a[attrKey] >= CONFIG.PLAYER.ATTR_MAX) return { ok: false, reason: 'capped' };

  state.trainPts -= T.COST_POINTS;
  p.stamina = clamp(p.stamina - T.COST_STAMINA, 0, 100);
  p.mood = clamp(p.mood - T.COST_MOOD, 0, 100);
  const rng = makeRNG(deriveSeed(state.seed, state.round * 613 + p.a[attrKey] * 7 + p.stamina));
  const gain = randInt(rng, T.GAIN_MIN, T.GAIN_MAX);
  p.a[attrKey] = clamp(p.a[attrKey] + gain, CONFIG.PLAYER.ATTR_MIN, CONFIG.PLAYER.ATTR_MAX);
  p.overall = players_overall(p);
  state.log.push('训练：' + p.name + ' 的 ' + attrKey + ' +' + gain + '（体力-' + T.COST_STAMINA + ' 心情-' + T.COST_MOOD + '）');
  return { ok: true, gain: gain, attr: attrKey, player: p.name };
}

// 理疗中心：花钱买恢复（体力+心情）
function training_physio(state, playerId) {
  const T = CONFIG.TRAINING, F = state.finance;
  const t = teamById(state, state.humanTeamId);
  const p = t.players.find(function (x) { return x.id === playerId; });
  if (!p) return { ok: false, reason: 'no-player' };
  if (F.cash < T.PHYSIO_CASH) return { ok: false, reason: 'no-cash' };
  F.cash -= T.PHYSIO_CASH;
  F.expense += T.PHYSIO_CASH;
  p.stamina = clamp(p.stamina + T.PHYSIO_STAMINA, 0, 100);
  p.mood = clamp(p.mood + T.PHYSIO_MOOD, 0, 100);
  state.log.push('理疗：' + p.name + ' 体力+' + T.PHYSIO_STAMINA + ' 心情+' + T.PHYSIO_MOOD + '（-¥' + T.PHYSIO_CASH + '）');
  return { ok: true, player: p.name };
}

// —— 球星系统（XBA 逆向：王者积分+资金训练，每级最高 +7%，可降级重训）——
function star_cost(level) { // 升到第 level 级的花费
  const S = CONFIG.STAR;
  return {
    kings: S.KINGS_PTS_BASE + (level - 1) * S.KINGS_PTS_STEP,
    cash: S.CASH_BASE + (level - 1) * S.CASH_STEP
  };
}

function training_star(state, playerId) {
  const S = CONFIG.STAR;
  const t = teamById(state, state.humanTeamId);
  const p = t.players.find(function (x) { return x.id === playerId; });
  if (!p) return { ok: false, reason: 'no-player' };
  const cur = p.star || 0;
  if (cur >= S.MAX_LEVEL) return { ok: false, reason: 'max' };
  const cost = star_cost(cur + 1);
  if (state.kingsPts < cost.kings) return { ok: false, reason: 'no-kings' };
  if (state.finance.cash < cost.cash) return { ok: false, reason: 'no-cash' };

  state.kingsPts -= cost.kings;
  state.finance.cash -= cost.cash;
  state.finance.expense += cost.cash;
  const rng = makeRNG(deriveSeed(state.seed, state.season * 613 + state.round * 37 + p.a.SHO + p.a.DEF * 3 + cur * 101));
  const gains = {};
  CONFIG.PLAYER.ATTRS.forEach(function (k) {
    const pct = randFloat(rng, S.GAIN_PCT_MIN, S.GAIN_PCT_MAX);
    const g = Math.max(1, Math.round(p.a[k] * pct));
    const prev = p.a[k];
    p.a[k] = clamp(p.a[k] + g, CONFIG.PLAYER.ATTR_MIN, CONFIG.PLAYER.ATTR_MAX);
    gains[k] = p.a[k] - prev;   // 记录实际增量（受钳制），降级可精确还原
  });
  p.star = cur + 1;
  p.starGains = (p.starGains || []).concat([gains]);
  p.overall = players_overall(p);
  state.log.push('⭐ 球星训练：' + p.name + ' 升到 ' + p.star + ' 星（综合 ' + p.overall + '）');
  return { ok: true, level: p.star, gains: gains, player: p.name };
}

// 降级：撤销最近一级的属性增长（积分不返还，扣降级费）
function training_starDowngrade(state, playerId) {
  const S = CONFIG.STAR;
  const t = teamById(state, state.humanTeamId);
  const p = t.players.find(function (x) { return x.id === playerId; });
  if (!p) return { ok: false, reason: 'no-player' };
  if (!p.star || p.star <= 0) return { ok: false, reason: 'not-star' };
  if (state.finance.cash < S.DOWNGRADE_CASH) return { ok: false, reason: 'no-cash' };
  state.finance.cash -= S.DOWNGRADE_CASH;
  state.finance.expense += S.DOWNGRADE_CASH;
  const gains = p.starGains.pop();
  if (gains) {
    CONFIG.PLAYER.ATTRS.forEach(function (k) { p.a[k] = clamp(p.a[k] - (gains[k] || 0), CONFIG.PLAYER.ATTR_MIN, CONFIG.PLAYER.ATTR_MAX); });
  }
  p.star--;
  p.overall = players_overall(p);
  state.log.push('球星降级：' + p.name + ' 回到 ' + p.star + ' 星（-¥' + S.DOWNGRADE_CASH + '）');
  return { ok: true, level: p.star, player: p.name };
}

// 每轮结束：训练点入账 + 心情回归基线（AI 球员同样回归）
function training_tick(state, humanWon) {
  const T = CONFIG.TRAINING, M = CONFIG.MOOD;
  state.trainPts += humanWon ? T.POINTS_PER_WIN : T.POINTS_PER_LOSS;
  state.teams.forEach(function (t) {
    t.players.forEach(function (p) {
      if (p.mood == null) p.mood = M.BASE;
      p.mood = clamp(p.mood + (M.BASE - p.mood) * 0.1, 0, 100);
    });
  });
}

function teamLevel(cash) {
  let name = CONFIG.TEAM_LEVEL[0].name;
  CONFIG.TEAM_LEVEL.forEach(function (lv) { if (cash >= lv.min) name = lv.name; });
  return name;
}

if (typeof module !== 'undefined') {
  module.exports = { training_apply, training_physio, training_tick, teamLevel, training_star, training_starDowngrade, star_cost };
}
