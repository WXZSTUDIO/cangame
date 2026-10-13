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
      ticketPrice: CONFIG.PRICE.default,   // 经营细化：票价档位
      revenue: { ad: 0, gate: 0, jersey: 0 }
    },
    trainPts: CONFIG.TRAINING.START_POINTS,
    kingsPts: 0,                 // 王者积分（球星训练 / 胜者为王）
    kings: null,                 // 胜者为王进行中的场次
    cups: null,
    championship: null,          // 冠军杯赛（512 淘汰）
    prestige: 0,                 // 威望（冠军杯/盟战来源）
    fans: 1000,                  // 球迷数量（影响球票/广告）
    transferPool: [],             // 转会市场系统球员池
    transferBought: 0,
    seasonStats: {},             // 本赛季球员技术统计 {pid:{pts,reb,ast,stl,blk,gp}}
    trophies: [],                // 荣誉室
    bets: [],                    // 有奖竞猜
    alliances: null,             // AI 联盟池
    alliance: null,              // 玩家联盟
    allianceWar: null,           // 盟战状态
    allianceCup: null,           // 联盟杯赛
    supremeInvite: false,        // 至尊杯邀请函
    supremeCup: null,            // 至尊杯
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
  alliance_init(state);   // 生成 AI 联盟池（独立子种子，不影响联赛）
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
      const ht = teamById(state, g[0]), at = teamById(state, g[1]);
      const seed = deriveSeed(state.seed, state.season * 131 + state.round * 17 + idNum(g[0]) * 3 + idNum(g[1]) * 7);
      const ha = availableCount(ht), aa = availableCount(at);
      let res;
      if (ha < 5 || aa < 5) {
        // 特殊比分 20:0：对手伤退无法完赛，判可出场方 20:0 胜
        const winner = ha >= 5 ? g[0] : g[1];
        const wTeam = teamById(state, winner);
        res = { homeId: g[0], awayId: g[1], hScore: winner === g[0] ? 20 : 0, aScore: winner === g[1] ? 20 : 0, winner: winner, force20: true, log: ['对手伤退无法完赛，判 20:0'], hBox: initBox(ht), aBox: initBox(at) };
        state.log.push('⚠ 特殊比分：' + wTeam.name + ' 因对手伤退被判 20:0 胜');
      } else {
        res = simulateGame(state, g[0], g[1], seed);
      }
      if (res.winner === g[0]) { ht.wins++; at.losses++; } else { at.wins++; ht.losses++; }
      ht.pf += res.hScore; ht.pa += res.aScore;
      at.pf += res.aScore; at.pa += res.hScore;
      if (isMyLeague) results.push(res);
      if (g[0] === state.humanTeamId || g[1] === state.humanTeamId) {
        state.lastLog = res; state.lastResult = res;
        // 累积本队球员赛季技术统计（20:0 强制局不计个人数据）
        if (!res.force20) {
          const box = (g[0] === state.humanTeamId) ? res.hBox : res.aBox;
          Object.keys(box.players).forEach(function (pid) {
            const s = state.seasonStats[pid] || (state.seasonStats[pid] = { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, gp: 0 });
            const row = box.players[pid];
            s.pts += row.pts; s.reb += row.reb; s.ast += row.ast; s.stl += row.stl; s.blk += row.blk; s.gp++;
          });
        }
      }
    });
  });
  state.lastResults = results;
  // 竞猜结算（本轮回合内已押注比赛）
  bet_tick(state, results.map(function (r) { return { homeId: r.homeId, awayId: r.awayId, winner: r.winner }; }));

  // 杯赛轮 + 冠军杯 + 联盟系统（联赛轮打完后进行）
  cup_tick(state, state.round + 1);
  championship_tick(state, state.round + 1);
  alliance_warTick(state, state.round + 1);
  alliance_cup_tick(state, state.round + 1);
  alliance_supremeCheck(state, state.round + 1);
  supreme_tick(state, state.round + 1);

  // 财务：经营细化（票价×上座率 / 广告位 / 球衣销售） + 工资摊销
  const human = teamById(state, state.humanTeamId);
  const rev = state.finance.revenue;
  const F = CONFIG.FINANCE, PR = CONFIG.PRICE, J = CONFIG.JERSEY;
  const priceOpt = PR.options.find(function (o) { return o.key === state.finance.ticketPrice; }) || PR.options[1];
  const myGames = state.schedule[human.leagueId][state.round] || [];
  const humanHome = myGames.some(function (g) { return g[0] === state.humanTeamId; });
  const humanWon = results.some(function (r) {
    return (r.homeId === state.humanTeamId && r.winner === r.homeId) || (r.awayId === state.humanTeamId && r.winner === r.awayId);
  });

  let adInc = 0, gateInc = 0, jerseyInc = 0;
  if (humanHome) {
    // 上座率：基准受票价档影响，威望/球迷小幅加成；高票价拉低上座率
    const att = clamp(priceOpt.att * (1 + (state.prestige || 0) / 600 + (state.fans || 0) / 200000), 0.6, 0.95);
    gateInc = Math.round(priceOpt.price * F.STADIUM_CAP * att);
    rev.gate += gateInc;
  }
  // 广告位：球迷越多广告位越多，威望放大单价
  const adSlots = Math.floor((state.fans || 0) / 4000) + 1;
  adInc = Math.round(adSlots * F.AD_PER_SLOT * (1 + (state.prestige || 0) / 300));
  rev.ad += adInc;
  // 球衣销售：随上轮战绩 + 球星/极限球员加成
  const stars = human.players.filter(function (p) { return p.star; }).length;
  const extremes = human.players.filter(function (p) { return p.isExtreme; }).length;
  jerseyInc = Math.round(F.JERSEY_BASE * (1 + (humanWon ? J.perWin - 1 : 0) + stars * J.starBonus + extremes * J.extremeBonus));
  rev.jersey += jerseyInc;

  const roundInc = adInc + gateInc + jerseyInc;
  state.finance.income += roundInc;
  training_tick(state, humanWon);
  // 球迷随战绩波动（影响球票/广告）
  state.fans = clamp(state.fans + (humanWon ? 40 : -20), 0, 9999999);
  const salarySum = human.players.reduce(function (s, p) { return s + p.salary; }, 0);
  const amort = Math.round(salarySum / state.totalRounds);
  state.finance.expense += amort;
  state.finance.cash += roundInc - amort;

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
