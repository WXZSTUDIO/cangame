// cangame v3.4 · 冠军杯赛（XBA 逆向：512 人制单淘汰 + 报名三阶段）
// 规模 512（AI 俱乐部填充 + 人类资格队）；报名：优先邀请函(各级前2) → 盟邀请函(联盟资格) → 全员可报。
// 与街球杯不同：冠军杯面向职业队，凭联赛/联盟战绩拿邀请函，大型单淘汰。

function champ_clubRating(state, club) {
  if (club.human) {
    const t = teamById(state, state.humanTeamId);
    const rt = tactics_lineupRating(t, tactics_resolve(t));
    return Math.round((rt.off + rt.def + rt.reb) / 3);
  }
  return club.rating;
}

// 俱乐部间比赛（简化：以评分差定胜负 + 噪声；人类队含战术评分）
function simulateClubGame(state, a, b, seed) {
  const rng = makeRNG(seed);
  const ra = champ_clubRating(state, a), rb = champ_clubRating(state, b);
  let diff = (ra - rb) * 1.25 + (rng() - 0.5) * 22;
  let hScore, aScore;
  if (diff >= 0) {
    hScore = 78 + Math.round(rng() * 22);
    aScore = Math.max(45, hScore - Math.round(diff) - Math.round(rng() * 12));
  } else {
    aScore = 78 + Math.round(rng() * 22);
    hScore = Math.max(45, aScore + Math.round(diff) - Math.round(rng() * 12));
  }
  const winner = hScore > aScore ? a.id : (aScore > hScore ? b.id : a.id);
  return { hScore: hScore, aScore: aScore, winner: winner };
}

function champ_makeClub(state, rng, i) {
  const name = CITY_POOL[Math.floor(rng() * CITY_POOL.length)] + NICK_POOL[Math.floor(rng() * NICK_POOL.length)] + '队';
  return { id: 'cc' + i, name: name, rating: randInt(rng, 55, 92), human: false };
}

// 联赛各级前 2 的俱乐部（优先邀请函资格）
function champ_priorityClubs(state) {
  const out = [];
  ['L1', 'L2a', 'L2b'].forEach(function (lid) {
    seasonStandings(state, lid).slice(0, 2).forEach(function (r) {
      if (out.some(function (c) { return c.id === r.team.id; })) return;
      const rt = tactics_lineupRating(r.team, tactics_resolve(r.team));
      out.push({ id: r.team.id, name: r.team.name, rating: Math.round((rt.off + rt.def + rt.reb) / 3), human: r.team.id === state.humanTeamId });
    });
  });
  return out;
}

function championship_build(state) {
  const C = CONFIG.CHAMPIONSHIP;
  const rng = makeRNG(deriveSeed(state.seed, 70707 + state.season));
  const pool = [];
  for (let i = 0; i < C.size; i++) pool.push(champ_makeClub(state, rng, i));
  const human = teamById(state, state.humanTeamId);
  return {
    size: C.size, opened: true, phase: 'priority',
    pool: pool, entrants: [], humanEntry: null,
    humanClub: { id: 'HUMAN', name: human.name + '（你）', human: true },
    bracket: null, roundIdx: 0, done: false, champion: null, myResult: null, lastRound: null
  };
}

// 依联赛轮推进报名阶段 + 自动资格入签
function championship_register(state, r) {
  const C = CONFIG.CHAMPIONSHIP;
  const c = state.championship;
  if (!c || !c.opened || c.bracket) return;
  if (r >= C.openRound) c.phase = 'priority';
  if (r >= C.phase2Round) c.phase = 'alliance';
  if (r >= C.phase3Round) c.phase = 'open';

  // 优先邀请函：各级联赛前 2 自动入签
  if (r >= C.openRound) {
    champ_priorityClubs(state).forEach(function (pc) {
      if (c.entrants.some(function (e) { return e.id === pc.id; })) return;
      c.entrants.push(pc);
      if (pc.human) { c.humanEntry = 'priority'; state.log.push('🎫 冠军杯优先邀请函：你以联赛前 2 身份直接入围！'); }
    });
  }
  // 盟邀请函：联盟排名资格（玩家在联盟即获一个名额）
  if (r >= C.phase2Round && state.alliance && !c.humanEntry) {
    c.humanEntry = 'alliance';
    state.log.push('🎫 冠军杯盟邀请函：你的联盟获得参赛名额，你代表联盟出战！');
  }
}

// 全员报名（玩家手动）
function championship_registerOpen(state) {
  const c = state.championship;
  if (!c || !c.opened || c.bracket) return { ok: false, reason: 'closed' };
  if (c.humanEntry) return { ok: false, reason: 'already' };
  if (!state.round || state.round < CONFIG.CHAMPIONSHIP.phase3Round) return { ok: false, reason: 'too-early' };
  c.humanEntry = 'open';
  state.log.push('🎫 冠军杯全员报名：你以自由身份入围 512 强！');
  return { ok: true };
}

// 第 bracketStart 轮锁定对阵：资格队 + AI 俱乐部填充到 size
function championship_lock(state, rng) {
  const c = state.championship;
  const entrants = c.entrants.slice();
  if (c.humanEntry) entrants.push(c.humanClub);
  const usedIds = {};
  entrants.forEach(function (e) { usedIds[e.id] = true; });
  let pi = 0;
  while (entrants.length < c.size && pi < c.pool.length) {
    const club = c.pool[pi++];
    if (usedIds[club.id]) continue;
    usedIds[club.id] = true;
    entrants.push(club);
  }
  // 仍不足则补（理论上不会）：用 AI 克隆
  let k = 0;
  while (entrants.length < c.size) { entrants.push(champ_makeClub(state, rng, 100000 + (k++))); }
  const shuffled = shuffle(rng, entrants);
  const bracket = [];
  for (let i = 0; i + 1 < shuffled.length; i += 2) bracket.push([shuffled[i].id, shuffled[i + 1].id]);
  c.byId = {};
  entrants.forEach(function (e) { c.byId[e.id] = e; });
  c.bracket = [bracket];
  c.roundIdx = 0;
}

function championship_tick(state, r) {
  const C = CONFIG.CHAMPIONSHIP;
  if (!state.championship) {
    if (r >= C.openRound) state.championship = championship_build(state);
    else return;
  }
  championship_register(state, r);
  const c = state.championship;
  if (c.done) return;

  if (!c.bracket) {
    if (r >= C.bracketStart) championship_lock(state, makeRNG(deriveSeed(state.seed, 80808 + state.season)));
    else return;
  }
  // 每 gap 联赛轮推进一 bracket 轮
  if (c.roundIdx >= Math.log2(c.size)) return;
  if (r < C.bracketStart + c.roundIdx * C.gap) return;

  const cur = c.bracket[c.roundIdx];
  const next = [];
  cur.forEach(function (pair) {
    const a = c.byId[pair[0]], b = c.byId[pair[1]];
    const res = simulateClubGame(state, a, b, deriveSeed(state.seed, 3131 + r * 17 + c.roundIdx * 131 + idNum(pair[0]) + idNum(pair[1]) * 3));
    const winnerId = res.winner;
    next.push(winnerId);
    if (pair[0] === 'HUMAN' || pair[1] === 'HUMAN') {
      const won = winnerId === 'HUMAN';
      const opp = won ? (pair[0] === 'HUMAN' ? b : a) : (pair[0] === 'HUMAN' ? a : b);
      c.myResult = { round: c.roundIdx, won: won, opp: opp ? opp.name : '?', hScore: res.hScore, aScore: res.aScore };
      state.lastChampResult = { stage: 'bracket', round: c.roundIdx, won: won, opp: opp ? opp.name : '?', hScore: res.hScore, aScore: res.aScore };
      if (won) {
        state.finance.cash += C.runPrize; state.finance.income += C.runPrize;
        state.log.push('🏆 冠军杯第 ' + (c.roundIdx + 1) + ' 轮：你击败 ' + (opp ? opp.name : '?') + '，晋级！+¥' + C.runPrize);
      } else {
        state.log.push('冠军杯第 ' + (c.roundIdx + 1) + ' 轮：你不敌 ' + (opp ? opp.name : '?') + '，止步 512 强淘汰赛');
      }
    }
  });
  c.roundIdx++;
  // 人类出局但 AI 继续决出冠军
  if (next.length === 1) {
    c.done = true;
    c.champion = next[0];
    const champClub = c.byId[next[0]];
    state.trophies.push({ season: state.season, name: '冠军杯', kind: 'championship' });
    if (next[0] === 'HUMAN') {
      state.finance.cash += C.championPrize.cash;
      state.finance.income += C.championPrize.cash;
      state.prestige += C.championPrize.prestige;
      state.kingsPts += C.championPrize.kings;
      state.log.push('🏆 你夺得了「冠军杯」总冠军！+¥' + C.championPrize.cash + ' +' + C.championPrize.prestige + ' 威望 +' + C.championPrize.kings + ' 王者积分');
    } else {
      state.log.push('「冠军杯」总冠军：' + (champClub ? champClub.name : next[0]));
    }
  } else {
    const nb = [];
    for (let i = 0; i < next.length; i += 2) nb.push([next[i], next[i + 1]]);
    c.bracket[c.roundIdx] = nb;
  }
}

// 当前报名阶段文案
function championship_phaseText(state) {
  const c = state.championship;
  if (!c || !c.opened) return '未开放';
  if (c.bracket) return '淘汰赛进行中（第 ' + (c.roundIdx + 1) + '/' + Math.log2(c.size) + ' 轮）';
  if (c.phase === 'priority') return '报名阶段 · 优先邀请函（各级联赛前 2）';
  if (c.phase === 'alliance') return '报名阶段 · 盟邀请函开放';
  if (c.phase === 'open') return '报名阶段 · 全员可报';
  return c.phase;
}

if (typeof module !== 'undefined') {
  module.exports = { championship_build, championship_register, championship_registerOpen, championship_tick, championship_phaseText, champ_clubRating };
}
