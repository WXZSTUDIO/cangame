// cangame v3.3 · 转会市场（XBA 逆向：系统球员池，按综合定价买卖，含极限球员）
function transfer_genPool(state, rng) {
  const T = CONFIG.TRANSFER;
  const pool = [];
  for (let i = 0; i < T.poolSize; i++) {
    const p = genPlayer(rng, { id: 'mkt_' + i, tier: randInt(rng, -4, 14) });
    const extreme = rng() < T.extremeRate;
    if (extreme) {
      p.isExtreme = true;
      p.overall = clamp(p.overall + randInt(rng, 3, 8), CONFIG.PLAYER.ATTR_MIN, CONFIG.PLAYER.ATTR_MAX);
      p.a = p.a; // 重算综合已含在 overall
    }
    p.marketPrice = Math.round((p.overall * p.overall * T.priceK + (extreme ? 50000 : 0)) / 100) * 100;
    p.salary = players_salary(p);
    pool.push(p);
  }
  return pool;
}

// 买入：扣资金入 roster；满员则替换综合最低者并半价回收
function transfer_buy(state, playerId) {
  const pool = state.transferPool || [];
  const p = pool.find(function (x) { return x.id === playerId; });
  if (!p) return { ok: false, reason: 'no-player' };
  if (state.finance.cash < p.marketPrice) return { ok: false, reason: 'no-cash' };
  const human = teamById(state, state.humanTeamId);

  if (human.players.length >= CONFIG.PLAYER.ROSTER_SIZE) {
    const drop = human.players.slice().sort(function (a, b) { return a.overall - b.overall; })[0];
    human.players = human.players.filter(function (x) { return x.id !== drop.id; });
    const refund = Math.round((drop.marketPrice || drop.overall * 200) * CONFIG.TRANSFER.resellRate);
    state.finance.cash += refund;
    state.finance.income += refund;
    state.log.push('转出 ' + drop.name + '（回收 ¥' + refund + '）');
  }

  state.finance.cash -= p.marketPrice;
  state.finance.expense += p.marketPrice;
  const np = JSON.parse(JSON.stringify(p));
  np.id = state.humanTeamId + '_m' + (state.transferBought || 0);
  state.transferBought = (state.transferBought || 0) + 1;
  human.players.push(np);
  if (human.lineup.length < CONFIG.PLAYER.STARTING &&
      !human.lineup.some(function (id) { return id === np.id; })) {
    human.lineup.push(np.id);
  }
  state.transferPool = pool.filter(function (x) { return x.id !== playerId; });
  state.log.push('转会引入 ' + p.name + '（综合 ' + p.overall + '，¥' + p.marketPrice + '）');
  return { ok: true, player: p.name, overall: p.overall };
}

if (typeof module !== 'undefined') {
  module.exports = { transfer_genPool, transfer_buy };
}
