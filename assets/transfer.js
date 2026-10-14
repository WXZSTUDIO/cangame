// cangame v3.3 · 转会市场（XBA 逆向：系统球员池，按综合定价买卖，含极限球员）
function transfer_genPool(state, rng) {
  const T = CONFIG.TRANSFER;
  const pool = [];
  for (let i = 0; i < T.poolSize; i++) {
    const extreme = rng() < T.extremeRate;   // 先定极限，避免受 genPlayer 内部 rng 消耗影响
    const p = genPlayer(rng, { id: 'mkt_' + i, tier: randInt(rng, -4, 14) });
    if (extreme) {
      p.isExtreme = true;
      p.overall = clamp(p.overall + randInt(rng, 3, 8), CONFIG.PLAYER.ATTR_MIN, CONFIG.PLAYER.ATTR_MAX);
      p.jersey = randInt(rng, 0, 99); // 极限球员专属球衣号码（可刷）
    }
    p.marketPrice = Math.round((p.overall * p.overall * T.priceK + (extreme ? 50000 : 0)) / 100) * 100;
    p.salary = players_salary(p);
    pool.push(p);
  }
  // 保证转会池至少有一个极限球员（XBA：市场必出极限球员）
  if (!pool.some(function (p) { return p.isExtreme; })) {
    const p = pool[0]; p.isExtreme = true;
    p.overall = clamp(p.overall + randInt(rng, 3, 8), CONFIG.PLAYER.ATTR_MIN, CONFIG.PLAYER.ATTR_MAX);
    p.jersey = randInt(rng, 0, 99);
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

// 极限球员刷球衣：重滚专属号码，触发球迷增长 + 球衣销售收入（XBA 极限球员玩法）
function transfer_jersey(state, playerId) {
  const human = teamById(state, state.humanTeamId);
  const p = human.players.find(function (x) { return x.id === playerId; });
  if (!p) return { ok: false, reason: 'no-player' };
  if (!p.isExtreme) return { ok: false, reason: 'not-extreme' };
  p.jersey = randInt(makeRNG(deriveSeed(state.seed, state.round * 131 + idNum(p.id) + 7)), 0, 99);
  const sale = randInt(makeRNG(deriveSeed(state.seed, state.round * 17 + idNum(p.id))), 8000, 30000);
  state.finance.cash += sale; state.finance.income += sale;
  state.fans = clamp(state.fans + 300, 0, 9999999);
  state.log.push('👕 极限球员 ' + p.name + ' 换新球衣 #' + p.jersey + '，球衣热卖 +¥' + sale + '、球迷 +300');
  return { ok: true, jersey: p.jersey, sale: sale };
}

if (typeof module !== 'undefined') {
  module.exports = { transfer_genPool, transfer_buy, transfer_jersey };
}
