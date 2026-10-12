// cangame v3 · 引擎（阶段编排，业务在系统文件）
function engine_newGame(seed, humanTeamId) {
  const rng = makeRNG(seed >>> 0);
  const teams = buildLeague(rng);
  const schedule = buildSchedule(teams, CONFIG.LEAGUE.REGULAR_ROUNDS, rng);
  const state = {
    version: CONFIG.VERSION,
    seed: seed >>> 0,
    humanTeamId: humanTeamId || teams[0].id,
    teams: teams,
    round: 0,
    totalRounds: CONFIG.LEAGUE.REGULAR_ROUNDS,
    phase: 'REGULAR',
    schedule: schedule,
    playoff: null,
    finance: { cash: 0, income: 0, expense: 0, salaryCap: 0 },
    lastResults: [], lastLog: null, lastResult: null,
    log: []
  };
  // 工资帽 = 全联盟总薪资均值附近
  const caps = teams.map(function (t) { return t.players.reduce(function (s, p) { return s + p.salary; }, 0); });
  state.finance.salaryCap = Math.round(caps.reduce(function (a, b) { return a + b; }, 0) / caps.length);
  state.log.push('赛季开始：你执掌 ' + teamById(state, state.humanTeamId).name);
  return state;
}

function engine_setTactics(state, teamId, tac) {
  const t = teamById(state, teamId);
  if (!t) return;
  t.tactics = {
    pace: tac.pace || t.tactics.pace,
    offense: tac.offense || t.tactics.offense,
    defense: tac.defense || t.tactics.defense,
    rotation: tac.rotation || t.tactics.rotation
  };
}

function engine_applyPostGame(state, roundIdx) {
  const rng = makeRNG(deriveSeed(state.seed, roundIdx * 977 + 13));
  const M = CONFIG.MATCH, IN = CONFIG.INJURY;
  state.teams.forEach(function (t) {
    const line = getLineup(t, tactics_resolve(t));
    const onCourt = {};
    line.forEach(function (x) { onCourt[x.player.id] = true; });
    t.players.forEach(function (p) {
      if (p.injury > 0) { p.injury--; p.stamina = clamp(p.stamina + IN.REST_RECOVER, 0, 100); return; }
      if (onCourt[p.id]) {
        p.stamina = clamp(p.stamina - M.STARTER_MIN * M.FATIGUE_PER_MIN * 2.2, 0, 100);
        // 伤病判定
        let chance = IN.BASE + Math.max(0, p.age - 30) * IN.AGE_FACTOR;
        if (p.trait === '玻璃人') chance *= IN.GLASS_MULT;
        if (rng() < chance) p.injury = randInt(rng, 1, IN.MAX_DNP);
      } else {
        p.stamina = clamp(p.stamina + IN.REST_RECOVER, 0, 100);
      }
    });
  });
}

function engine_advanceRound(state) {
  if (state.phase === 'REGULAR') {
    const games = state.schedule[state.round];
    const results = [];
    games.forEach(function (g) {
      const seed = deriveSeed(state.seed, state.round * 131 + idNum(g[0]) * 17 + idNum(g[1]) * 3);
      const res = simulateGame(state, g[0], g[1], seed);
      const ht = teamById(state, g[0]), at = teamById(state, g[1]);
      if (res.winner === g[0]) { ht.wins++; at.losses++; } else { at.wins++; ht.losses++; }
      ht.pf += res.hScore; ht.pa += res.aScore;
      at.pf += res.aScore; at.pa += res.hScore;
      results.push(res);
      if (g[0] === state.humanTeamId || g[1] === state.humanTeamId) { state.lastLog = res; state.lastResult = res; }
    });
    state.lastResults = results;
    // 财务：每轮赞助 + 主场比赛门票；工资摊销
    const human = teamById(state, state.humanTeamId);
    state.finance.income += CONFIG.FINANCE.SPONSOR_BASE;
    const humanHome = games.some(function (g) { return g[0] === state.humanTeamId; });
    if (humanHome) state.finance.income += CONFIG.FINANCE.HOME_GATE;
    const salarySum = human.players.reduce(function (s, p) { return s + p.salary; }, 0);
    const amort = Math.round(salarySum / state.totalRounds);
    state.finance.expense += amort;
    state.finance.cash += state.finance.income - state.finance.expense;
    engine_applyPostGame(state, state.round);
    state.round++;
    if (state.round >= state.totalRounds) {
      endRegular(state);
      state.log.push('常规赛结束，季后赛开打。');
    }
  } else if (state.phase === 'PLAYOFF') {
    advancePlayoff(state, deriveSeed(state.seed, 7000 + state.round));
  }
  return state;
}

// 序列化（存档）
function engine_serialize(state) { return JSON.stringify(state); }
function engine_deserialize(str) { return JSON.parse(str); }

if (typeof module !== 'undefined') {
  module.exports = { engine_newGame, engine_setTactics, engine_advanceRound, engine_applyPostGame, engine_serialize, engine_deserialize };
}
