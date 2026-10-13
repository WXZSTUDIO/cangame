// cangame v3.4 · 联盟系统（XBA 逆向：联盟首页 / 盟战 / 联盟威望 / 联盟杯赛 / 至尊杯邀请函）
// 单机版用 AI 联盟池模拟工会；玩家可创建或加入联盟，参与盟战攒威望，凭排名拿至尊杯邀请函。

var ALLIANCE_NAMES = ['苍穹', '破晓', '惊雷', '逐星', '镇海', '擎岳', '流光', '霜刃', '燎原', '听涛', '长风', '北辰'];

function alliance_teamRating(state) {
  const t = teamById(state, state.humanTeamId);
  const rt = tactics_lineupRating(t, tactics_resolve(t));
  return Math.round((rt.off + rt.def + rt.reb) / 3);
}
function alliance_strength(state, al) {
  if (al.joined) return alliance_teamRating(state) + al.prestige * 0.2;
  return al.rating + al.prestige * 0.2;
}
function simulateAllianceGame(state, a, b, seed) {
  const rng = makeRNG(seed);
  const ra = alliance_strength(state, a), rb = alliance_strength(state, b);
  let diff = (ra - rb) * 1.2 + (rng() - 0.5) * 24;
  let hScore, aScore;
  if (diff >= 0) { hScore = 75 + Math.round(rng() * 22); aScore = Math.max(40, hScore - Math.round(diff) - Math.round(rng() * 12)); }
  else { aScore = 75 + Math.round(rng() * 22); hScore = Math.max(40, aScore + Math.round(diff) - Math.round(rng() * 12)); }
  return { winner: hScore > aScore ? a.id : (aScore > hScore ? b.id : a.id), hScore: hScore, aScore: aScore };
}

// 生成 AI 联盟池（确定性，独立子种子，不影响联赛生成）
function alliance_init(state) {
  const A = CONFIG.ALLIANCE;
  const rng = makeRNG(deriveSeed(state.seed, 5151 + state.season));
  const list = [];
  for (let i = 0; i < A.poolSize; i++) {
    list.push({
      id: 'al' + i, isAI: true, joined: false,
      name: ALLIANCE_NAMES[i % ALLIANCE_NAMES.length] + '联盟',
      rating: randInt(rng, 62, 86),
      prestige: randInt(rng, 0, 40)
    });
  }
  state.alliances = list;
  state.alliance = null;
  state.allianceWar = { lastRound: 0 };
  state.allianceCup = null;
  state.supremeInvite = false;
  state.supremeCup = null;
}

function alliance_create(state, name) {
  if (state.alliance) return { ok: false, reason: 'already' };
  const al = {
    id: 'mine', isAI: false, joined: true,
    name: (name || '我的联盟').slice(0, 8),
    rating: alliance_teamRating(state), prestige: 0
  };
  state.alliances.push(al);
  state.alliance = al;
  state.log.push('🤝 你创建了联盟「' + al.name + '」，开始招募成员（单机模拟）。');
  return { ok: true, alliance: al.name };
}
function alliance_join(state, id) {
  if (state.alliance) return { ok: false, reason: 'already' };
  const al = state.alliances.find(function (x) { return x.id === id; });
  if (!al) return { ok: false, reason: 'no-alliance' };
  al.joined = true;
  state.alliance = al;
  state.log.push('🤝 你加入了联盟「' + al.name + '」。');
  return { ok: true, alliance: al.name };
}
function alliance_leave(state) {
  if (!state.alliance) return { ok: false, reason: 'none' };
  if (state.alliance.id === 'mine') {
    state.alliances = state.alliances.filter(function (x) { return x.id !== 'mine'; });
  } else {
    state.alliance.joined = false;
  }
  state.alliance = null;
  state.supremeInvite = false;
  state.log.push('你退出了联盟。');
  return { ok: true };
}

// 盟战：每 warGap 轮，与最强 rival 联盟交锋
function alliance_warTick(state, r) {
  if (!state.alliance) return;
  const A = CONFIG.ALLIANCE;
  if (r % A.warGap !== 0) return;
  if (state.allianceWar.lastRound === r) return;
  state.allianceWar.lastRound = r;
  // AI 联盟威望随机浮动（排名演化）
  state.alliances.forEach(function (al) {
    if (al.isAI) al.prestige = clamp(al.prestige + randInt(makeRNG(deriveSeed(state.seed, 9191 + r + idNum(al.id))), -3, 4), 0, 999);
  });
  const rivals = state.alliances.filter(function (x) { return x.id !== state.alliance.id; })
    .sort(function (a, b) { return b.prestige - a.prestige; });
  const rival = rivals[0];
  if (!rival) return;
  const res = simulateAllianceGame(state, state.alliance, rival, deriveSeed(state.seed, 6262 + r));
  const won = res.winner === state.alliance.id;
  if (won) {
    state.alliance.prestige += A.warPrestige;
    state.kingsPts += A.warKings;
    state.log.push('⚔ 盟战告捷！你的联盟击败「' + rival.name + '」，联盟威望 +' + A.warPrestige + '、你获 ' + A.warKings + ' 王者积分');
  } else {
    rival.prestige += A.warPrestige;
    state.log.push('盟战失利：你的联盟不敌「' + rival.name + '」（联盟威望归其所有）。');
  }
}

// 联盟杯赛：每赛季一次，各联盟派最强队出战（单机模拟为联盟代表淘汰赛）
function alliance_cup_build(state) {
  const A = CONFIG.ALLIANCE;
  if (!state.alliance) return null;
  const rng = makeRNG(deriveSeed(state.seed, 7171 + state.season));
  let ents = state.alliances.slice();
  while (ents.length < 2 || (ents.length & (ents.length - 1)) !== 0) {
    ents.push({ id: 'fill' + ents.length, name: '挑战者' + ents.length, isAI: true, joined: false, rating: randInt(rng, 60, 80), prestige: 0 });
  }
  const sh = shuffle(rng, ents);
  const byId = {}; ents.forEach(function (e) { byId[e.id] = e; });
  const bracket = [];
  for (let i = 0; i + 1 < sh.length; i += 2) bracket.push([sh[i].id, sh[i + 1].id]);
  return { bracket: [bracket], byId: byId, roundIdx: 0, done: false, champion: null, myResult: null };
}
function alliance_cup_tick(state, r) {
  const A = CONFIG.ALLIANCE;
  if (!state.alliance) return;
  if (!state.allianceCup && r >= A.cupRound) state.allianceCup = alliance_cup_build(state);
  const cup = state.allianceCup;
  if (!cup || cup.done) return;
  if (cup.roundIdx >= Math.log2(Object.keys(cup.byId).length)) return;
  if (r < A.cupRound + cup.roundIdx * A.cupGap) return;
  const cur = cup.bracket[cup.roundIdx];
  const next = [];
  cur.forEach(function (pair) {
    const a = cup.byId[pair[0]], b = cup.byId[pair[1]];
    const res = simulateAllianceGame(state, a, b, deriveSeed(state.seed, 4141 + r * 7 + cup.roundIdx * 31 + idNum(pair[0]) + idNum(pair[1]) * 3));
    next.push(res.winner);
    const mine = pair[0] === state.alliance.id || pair[1] === state.alliance.id;
    if (mine) {
      const won = res.winner === state.alliance.id;
      const opp = won ? (pair[0] === state.alliance.id ? b : a) : (pair[0] === state.alliance.id ? a : b);
      cup.myResult = { round: cup.roundIdx, won: won, opp: opp ? opp.name : '?' };
      state.log.push('🏆 联盟杯赛第 ' + (cup.roundIdx + 1) + ' 轮：你' + (won ? '胜' : '负') + ' ' + (opp ? opp.name : '?'));
    }
  });
  cup.roundIdx++;
  if (next.length === 1) {
    cup.done = true; cup.champion = next[0];
    const champ = cup.byId[next[0]];
    const pr = A.cupPrize[0], ps = A.cupPrestige[0];
    if (champ) champ.prestige += ps;
    if (next[0] === state.alliance.id) {
      state.finance.cash += pr; state.finance.income += pr;
      state.alliance.prestige += ps;
      state.trophies.push({ season: state.season, name: '联盟杯赛冠军', kind: 'alliance' });
      state.log.push('🏆 你的联盟夺得「联盟杯赛」冠军！+¥' + pr + ' +' + ps + ' 联盟威望');
    } else if (champ) {
      state.log.push('「联盟杯赛」冠军：' + champ.name);
    }
  } else {
    const nb = [];
    for (let i = 0; i < next.length; i += 2) nb.push([next[i], next[i + 1]]);
    cup.bracket[cup.roundIdx] = nb;
  }
}

// 至尊杯邀请函：联盟排名前 N 获资格
function alliance_supremeCheck(state, r) {
  const A = CONFIG.ALLIANCE;
  if (state.supremeInvite) return;
  if (r < A.supremeCheckRound) return;
  const ranked = state.alliances.slice().sort(function (a, b) { return b.prestige - a.prestige; });
  const top = ranked.slice(0, A.supremeTopN);
  const mine = top.some(function (x) { return x.id === (state.alliance ? state.alliance.id : null); });
  if (state.alliance && mine) {
    state.supremeInvite = true;
    state.log.push('🎫 你的联盟位列前 ' + A.supremeTopN + '，获得「至尊杯」邀请函！');
  }
}
function supreme_build(state) {
  const A = CONFIG.ALLIANCE;
  const rng = makeRNG(deriveSeed(state.seed, 9292 + state.season));
  let ents = state.alliances.filter(function (x) { return x.prestige >= 0; }); // 全体联盟均可由邀请函代表
  // 仅取有邀请函资格的（前 N + 玩家联盟若达标），用 prestige 排序取前 8 填充
  ents = state.alliances.slice().sort(function (a, b) { return b.prestige - a.prestige; }).slice(0, 8);
  while ((ents.length & (ents.length - 1)) !== 0) ents.push({ id: 'sfill' + ents.length, name: '外卡' + ents.length, isAI: true, rating: randInt(rng, 60, 82), prestige: 0 });
  const sh = shuffle(rng, ents);
  const byId = {}; ents.forEach(function (e) { byId[e.id] = e; });
  const bracket = [];
  for (let i = 0; i + 1 < sh.length; i += 2) bracket.push([sh[i].id, sh[i + 1].id]);
  return { bracket: [bracket], byId: byId, roundIdx: 0, done: false, champion: null, myResult: null };
}
function supreme_tick(state, r) {
  const A = CONFIG.ALLIANCE;
  if (!state.supremeInvite) return;
  if (!state.supremeCup && r >= A.supremeRound) state.supremeCup = supreme_build(state);
  const cup = state.supremeCup;
  if (!cup || cup.done) return;
  if (cup.roundIdx >= Math.log2(Object.keys(cup.byId).length)) return;
  if (r < A.supremeRound + cup.roundIdx * A.supremeGap) return;
  const cur = cup.bracket[cup.roundIdx];
  const next = [];
  cur.forEach(function (pair) {
    const a = cup.byId[pair[0]], b = cup.byId[pair[1]];
    const res = simulateAllianceGame(state, a, b, deriveSeed(state.seed, 5252 + r * 7 + cup.roundIdx * 31 + idNum(pair[0]) + idNum(pair[1]) * 3));
    next.push(res.winner);
    const mine = pair[0] === (state.alliance ? state.alliance.id : null) || pair[1] === (state.alliance ? state.alliance.id : null);
    if (mine) {
      const won = res.winner === (state.alliance ? state.alliance.id : null);
      const opp = won ? (pair[0] === state.alliance.id ? b : a) : (pair[0] === state.alliance.id ? a : b);
      cup.myResult = { round: cup.roundIdx, won: won, opp: opp ? opp.name : '?' };
      state.log.push('👑 至尊杯第 ' + (cup.roundIdx + 1) + ' 轮：你' + (won ? '胜' : '负') + ' ' + (opp ? opp.name : '?'));
    }
  });
  cup.roundIdx++;
  if (next.length === 1) {
    cup.done = true; cup.champion = next[0];
    if (next[0] === (state.alliance ? state.alliance.id : null)) {
      state.finance.cash += A.supremePrize.cash; state.finance.income += A.supremePrize.cash;
      state.prestige += A.supremePrize.prestige; state.kingsPts += A.supremePrize.kings;
      state.trophies.push({ season: state.season, name: '至尊杯冠军', kind: 'supreme' });
      state.log.push('👑 你的联盟问鼎「至尊杯」！+¥' + A.supremePrize.cash + ' +' + A.supremePrize.prestige + ' 威望 +' + A.supremePrize.kings + ' 王者积分');
    } else {
      const champ = cup.byId[next[0]];
      state.log.push('「至尊杯」冠军：' + (champ ? champ.name : next[0]));
    }
  } else {
    const nb = [];
    for (let i = 0; i < next.length; i += 2) nb.push([next[i], next[i + 1]]);
    cup.bracket[cup.roundIdx] = nb;
  }
}

if (typeof module !== 'undefined') {
  module.exports = {
    alliance_init, alliance_create, alliance_join, alliance_leave,
    alliance_warTick, alliance_cup_build, alliance_cup_tick,
    alliance_supremeCheck, supreme_build, supreme_tick, alliance_teamRating
  };
}
