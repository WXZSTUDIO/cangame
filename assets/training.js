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
  module.exports = { training_apply, training_physio, training_tick, teamLevel };
}
