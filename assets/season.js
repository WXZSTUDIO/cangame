// cangame v3.2 · 赛季（赛程 / 分联赛积分榜 / 升降级 / 新赛季）
function idNum(id) { return parseInt(id.slice(1), 10); }

// 单循环轮转（m-1 轮）；双循环 = 跑两遍（主客对调）
function buildSchedule(teamIds, rounds, rng) {
  const arr = teamIds.slice();
  const m = arr.length;
  if (m % 2) arr.push(null); // 轮空
  const half = arr.length / 2;
  const sched = [];
  for (let r = 0; r < m - 1 && sched.length < rounds; r++) {
    const games = [];
    for (let i = 0; i < half; i++) {
      const a = arr[i], b = arr[arr.length - 1 - i];
      if (a == null || b == null) continue;
      const home = (r % 2 === 0) ? a : b;
      const away = home === a ? b : a;
      games.push([home, away]);
    }
    sched.push(games);
    arr.splice(1, 0, arr.pop());
  }
  // 第二循环：主客对调
  const first = sched.slice(0, Math.min(sched.length, rounds - sched.length));
  first.forEach(function (games) {
    sched.push(games.map(function (g) { return [g[1], g[0]]; }));
  });
  return sched.slice(0, rounds);
}

// 为全部联赛生成赛程：state.schedule = { L1: [...], L2a: [...], L2b: [...] }
function buildAllSchedules(state, rng) {
  const sched = {};
  LEAGUE_DEFS.forEach(function (ld) {
    sched[ld.id] = buildSchedule(state.leagues[ld.id].teamIds, CONFIG.LEAGUE.REGULAR_ROUNDS, rng);
  });
  return sched;
}

// 某联赛积分榜（XBA 排名规则：先胜场（胜率）后净胜分）
function seasonStandings(state, leagueId) {
  const teams = state.leagues[leagueId].teamIds
    .map(function (id) { return teamById(state, id); })
    .sort(function (x, y) {
      if (y.wins !== x.wins) return y.wins - x.wins;
      return (y.pf - y.pa) - (x.pf - x.pa);
    });
  return teams.map(function (t, i) { return { rank: i + 1, team: t }; });
}

// 赛季结束：冠军 + 升降级 + 重排联赛 + 新赛程；返回摘要
function seasonRoll(state, rng) {
  const LG = CONFIG.LEAGUE;
  const summary = { champion: null, promoted: [], relegated: [], humanRank: null };

  const l1Stand = seasonStandings(state, 'L1');
  summary.champion = l1Stand[0].team.id;
  l1Stand[0].team.titles++;
  l1Stand.forEach(function (row) {
    if (row.team.id === state.humanTeamId) summary.humanRank = row.rank;
  });

  // 升：每个 2级联赛前 2；降：1级联赛后 4
  const promoted = [], relegated = [];
  ['L2a', 'L2b'].forEach(function (lid) {
    const st = seasonStandings(state, lid);
    for (let i = 0; i < LG.PROMOTE_PER_LEAGUE; i++) promoted.push(st[i].team);
  });
  for (let i = 0; i < LG.RELEGATE_PER_LEAGUE; i++) relegated.push(l1Stand[l1Stand.length - 1 - i].team);
  summary.promoted = promoted.map(function (t) { return t.name; });
  summary.relegated = relegated.map(function (t) { return t.name; });
  promoted.forEach(function (t) { t.level = 1; });
  relegated.forEach(function (t) { t.level = 2; });

  // 重排：1级 = 原1级(去掉降级) + 升级队（按战绩排序）；2级两队 = 剩余 28 队蛇形分组
  const stayL1 = l1Stand.map(function (r) { return r.team; }).filter(function (t) { return t.level === 1; });
  const newL1 = stayL1.concat(promoted).slice(0, LG.TEAMS_PER_LEAGUE);
  const stayL2 = [];
  ['L2a', 'L2b'].forEach(function (lid) {
    seasonStandings(state, lid).forEach(function (r) { if (r.team.level === 2) stayL2.push(r.team); });
  });
  const pool = stayL2.concat(relegated).filter(function (t) { return newL1.indexOf(t) < 0; });
  // 按上赛季战绩排序后蛇形分到 A/B 组
  pool.sort(function (x, y) {
    if (y.wins !== x.wins) return y.wins - x.wins;
    return (y.pf - y.pa) - (x.pf - x.pa);
  });
  const newL2a = [], newL2b = [];
  pool.forEach(function (t, i) {
    const rowN = Math.floor(i / 2);
    (rowN % 2 === 0 ? (i % 2 === 0 ? newL2a : newL2b) : (i % 2 === 0 ? newL2b : newL2a)).push(t);
  });

  function assign(leagueId, teams) {
    state.leagues[leagueId].teamIds = teams.map(function (t) { return t.id; });
    teams.forEach(function (t) { t.leagueId = leagueId; });
  }
  assign('L1', newL1);
  assign('L2a', newL2a);
  assign('L2b', newL2b);
  const restCount = newL1.length + newL2a.length + newL2b.length;
  if (restCount !== 42) { /* 防御：永远不应发生 */ }

  // 跨赛季重置：战绩清零、赛程重排、年龄+1、合同-1
  state.teams.forEach(function (t) {
    t.wins = 0; t.losses = 0; t.pf = 0; t.pa = 0;
    t.players.forEach(function (p) {
      p.age++;
      if (p.contractYears > 1) p.contractYears--;
      p.stamina = 100; p.injury = 0;
    });
  });
  state.season++;
  state.round = 0;
  state.phase = 'REGULAR';
  state.schedule = buildAllSchedules(state, rng);
  state.cups = buildCupInstances(state);
  return summary;
}

if (typeof module !== 'undefined') {
  module.exports = { buildSchedule, buildAllSchedules, seasonStandings, seasonRoll, idNum };
}
