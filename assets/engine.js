// cangame v3.2 · 引擎（阶段编排：联赛轮 + 杯赛轮 + 赛季滚动）
function engine_newGame(seed, humanTeamId) {
  const rng = makeRNG(seed >>> 0);
  const teams = buildLeague(rng);
  const state = {
    version: CONFIG.VERSION,
    seed: seed >>> 0,
    humanTeamId: humanTeamId || teams[0].id,
    season: 1,
    teams: teams,
    leagues: {},
    round: 0,
    totalRounds: CONFIG.LEAGUE.REGULAR_ROUNDS,
    phase: 'REGULAR',            // REGULAR | SEASON_END
    schedule: null,
    finance: {
      cash: 0, income: 0, expense: 0, salaryCap: 0,
      revenue: { ad: 0, gate: 0, jersey: 0 }
    },
    trainPts: CONFIG.TRAINING.START_POINTS,
    kingsPts: 0,                 // 王者积分（球星训练 / 胜者为王）
    kings: null,                 // 胜者为王进行中的场次
    cups: null,
    championship: null,          // 冠军杯赛（联赛前2受邀）
    prestige: 0,                 // 威望（冠军杯/盟战来源）
    fans: 1000,                  // 球迷数量（影响球票/广告）
    transferPool: [],             // 转会市场系统球员池
    transferBought: 0,
    seasonStats: {},             // 本赛季球员技术统计 {pid:{pts,reb,ast,stl,blk,gp}}
    trophies: [],                // 荣誉室
    seasonSummary: null,         // 赛季结束摘要（冠军/升降级/排名）
    lastResults: [], lastResult: null, lastCupResult: null, lastKingsResult: null, lastChampResult: null,
    log: []
  };
  // 联赛划分：前 14 队 → 1级，其后 14 → 2级A，再 14 → 2级B
  LEAGUE_DEFS.forEach(function (ld, li) {
    state.leagues[ld.id] = { id: ld.id, name: ld.name, level: ld.level, teamIds: [] };
    for (let i = 0; i < CONFIG.LEAGUE.TEAMS_PER_LEAGUE; i++) {
      const t = teams[li * CONFIG.LEAGUE.TEAMS_PER_LEAGUE + i];
      t.leagueId = ld.id; t.level = ld.level;
      state.leagues[ld.id].teamIds.push(t.id);
    }
  });
  state.schedule = buildAllSchedules(state, rng);
  state.cups = buildCupInstances(state);
  state.transferPool = transfer_genPool(state, rng);
  const caps = teams.map(function (t) { return t.players.reduce(function (s, p) { return s + p.salary; }, 0); });
  state.finance.salaryCap = Math.round(caps.reduce(function (a, b) { return a + b; }, 0) / caps.length);
  const human = teamById(state, state.humanTeamId);
  const lgName = human.level === 1 ? '1级联赛' : '2级联赛' + (human.leagueId === 'L2a' ? 'A组' : 'B组');
  state.log.push('第 ' + state.season + ' 赛季开始：你执掌 ' + human.name + '（' + lgName + '）');
  return state;
}

function engine_setTactics(state, teamId, tac) {
  const t = teamById(state, teamId);
  if (!t) return;
  t.tactics = {
    offense: tac.offense || t.tactics.offense,
    defense: tac.defense || t.tactics.defense,
    rotation: tac.rotation || t.tactics.rotation
  };
}

function engine_applyPostGame(state, roundIdx) {
  const rng = makeRNG(deriveSeed(state.seed, state.season * 31 + roundIdx * 977 + 13));
  const M = CONFIG.MATCH, IN = CONFIG.INJURY;
  state.teams.forEach(function (t) {
    const line = getLineup(t, tactics_resolve(t));
    const onCourt = {};
    line.forEach(function (x) { onCourt[x.player.id] = true; });
    t.players.forEach(function (p) {
      if (p.injury > 0) { p.injury--; p.stamina = clamp(p.stamina + IN.REST_RECOVER, 0, 100); return; }
      if (onCourt[p.id]) {
        p.stamina = clamp(p.stamina - M.STARTER_MIN * M.FATIGUE_PER_MIN * 2.2, 0, 100);
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
  if (state.phase === 'SEASON_END') {
    state.phase = 'REGULAR';
    state.seasonSummary = null;
    return state;
  }
  if (state.phase !== 'REGULAR') return state;
  if (state.simQuiet) { /* 批量模拟仍走同一逻辑 */ }

  const rng = makeRNG(deriveSeed(state.seed, state.season * 4099 + state.round));
  const results = [];
  // 三个联赛各自打本轮
  LEAGUE_DEFS.forEach(function (ld) {
    const games = state.schedule[ld.id][state.round] || [];
    const isMyLeague = !!state.leagues[ld.id].teamIds.some(function (id) { return id === state.humanTeamId; });
    games.forEach(function (g) {
      const seed = deriveSeed(state.seed, state.season * 131 + state.round * 17 + idNum(g[0]) * 3 + idNum(g[1]) * 7);
      const res = simulateGame(state, g[0], g[1], seed);
      const ht = teamById(state, g[0]), at = teamById(state, g[1]);
      if (res.winner === g[0]) { ht.wins++; at.losses++; } else { at.wins++; ht.losses++; }
      ht.pf += res.hScore; ht.pa += res.aScore;
      at.pf += res.aScore; at.pa += res.hScore;
      if (isMyLeague) results.push(res);
      if (g[0] === state.humanTeamId || g[1] === state.humanTeamId) {
        state.lastLog = res; state.lastResult = res;
        // 累积本队球员赛季技术统计
        const box = (g[0] === state.humanTeamId) ? res.hBox : res.aBox;
        Object.keys(box.players).forEach(function (pid) {
          const s = state.seasonStats[pid] || (state.seasonStats[pid] = { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, gp: 0 });
          const row = box.players[pid];
          s.pts += row.pts; s.reb += row.reb; s.ast += row.ast; s.stl += row.stl; s.blk += row.blk; s.gp++;
        });
      }
    });
  });
  state.lastResults = results;

  // 杯赛轮 + 冠军杯（联赛轮打完后进行）
  cup_tick(state, state.round + 1);
  championship_tick(state, state.round + 1);

  // 财务：XBA 三大收入 + 工资摊销
  const human = teamById(state, state.humanTeamId);
  const rev = state.finance.revenue;
  rev.ad += CONFIG.FINANCE.AD_BASE;
  const myGames = state.schedule[human.leagueId][state.round] || [];
  const humanHome = myGames.some(function (g) { return g[0] === state.humanTeamId; });
  if (humanHome) rev.gate += CONFIG.FINANCE.HOME_GATE;
  rev.jersey += CONFIG.FINANCE.JERSEY_BASE;
  state.finance.income += CONFIG.FINANCE.AD_BASE + CONFIG.FINANCE.JERSEY_BASE + (humanHome ? CONFIG.FINANCE.HOME_GATE : 0);
  const humanWon = results.some(function (r) {
    return (r.homeId === state.humanTeamId && r.winner === r.homeId) || (r.awayId === state.humanTeamId && r.winner === r.awayId);
  });
  training_tick(state, humanWon);
  // 球迷随战绩波动（影响球票/广告）
  state.fans = clamp(state.fans + (humanWon ? 40 : -20), 0, 9999999);
  const salarySum = human.players.reduce(function (s, p) { return s + p.salary; }, 0);
  const amort = Math.round(salarySum / state.totalRounds);
  state.finance.expense += amort;
  state.finance.cash += CONFIG.FINANCE.AD_BASE + CONFIG.FINANCE.JERSEY_BASE + (humanHome ? CONFIG.FINANCE.HOME_GATE : 0) - amort;

  engine_applyPostGame(state, state.round);
  state.round++;
  if (state.round >= state.totalRounds) {
    // 赛季结束：冠军 + 升降级 + 新赛程（state 已滚动到新赛季，摘要暂存展示）
    const summary = seasonRoll(state, makeRNG(deriveSeed(state.seed, state.season * 7919 + 5)));
    state.seasonSummary = summary;
    state.phase = 'SEASON_END';
    state.log.push('第 ' + (state.season - 1) + ' 赛季结束，冠军：' + teamById(state, summary.champion).name);
  }
  return state;
}

// 序列化（存档）
function engine_serialize(state) { return JSON.stringify(state); }
function engine_deserialize(str) { return JSON.parse(str); }

if (typeof module !== 'undefined') {
  module.exports = { engine_newGame, engine_setTactics, engine_advanceRound, engine_applyPostGame, engine_serialize, engine_deserialize };
}
