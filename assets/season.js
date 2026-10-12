// cangame v3 · 赛季（赛程 / 积分榜 / 季后赛）
function idNum(id) { return parseInt(id.slice(1), 10); }

function buildSchedule(teams, rounds, rng) {
  const arr = teams.map(function (t) { return t.id; });
  const m = arr.length;            // 30，偶数
  const half = m / 2;
  const sched = [];
  let guard = 0;
  while (sched.length < rounds && guard < 10000) {
    guard++;
    for (let r = 0; r < m - 1; r++) {
      const games = [];
      for (let i = 0; i < half; i++) {
        const a = arr[i], b = arr[m - 1 - i];
        const home = ((r + sched.length) % 2 === 0) ? a : b;
        const away = home === a ? b : a;
        games.push([home, away]);
      }
      sched.push(games);
      if (sched.length >= rounds) break;
      arr.splice(1, 0, arr.pop()); // 轮转
    }
  }
  return sched.slice(0, rounds);
}

function seasonStandings(state) {
  return state.teams.slice().sort(function (x, y) {
    if (y.wins - y.losses !== x.wins - x.losses) return (y.wins - y.losses) - (x.wins - x.losses);
    return (y.pf - y.pa) - (x.pf - x.pa);
  }).map(function (t, i) { return { rank: i + 1, team: t }; });
}

function endRegular(state) {
  // 各联盟取前 8，按胜场排种子
  const byConf = {};
  state.teams.forEach(function (t) {
    (byConf[t.conf] = byConf[t.conf] || []).push(t);
  });
  const survivors = {};
  Object.keys(byConf).forEach(function (conf) {
    const sorted = byConf[conf].slice().sort(function (a, b) {
      if (b.wins - b.losses !== a.wins - a.losses) return (b.wins - b.losses) - (a.wins - a.losses);
      return (b.pf - b.pa) - (a.pf - a.pa);
    }).slice(0, CONFIG.LEAGUE.PLAYOFF_PER_CONF);
    sorted.forEach(function (t, i) { t.seed = i + 1; t.alive = true; t.seriesWins = 0; t.seriesOpp = null; });
    survivors[conf] = sorted;
  });
  const series = [];
  Object.keys(survivors).forEach(function (conf) {
    const s = survivors[conf];
    for (let i = 0; i < s.length / 2; i++) {
      const a = s[i], b = s[s.length - 1 - i];
      a.seriesOpp = b.id; b.seriesOpp = a.id;
      series.push(makeSeries(a, b));
    }
  });
  state.playoff = { round: 0, series: series, survivors: survivors, champion: null, done: false, names: ['首轮', '半决赛', '联盟决赛', '总决'] };
  state.phase = 'PLAYOFF';
}

function makeSeries(a, b) { return { a: a.id, b: b.id, aw: 0, bw: 0, done: false, winner: null }; }

function advancePlayoff(state, seedBase) {
  const po = state.playoff;
  let active = 0;
  po.series.forEach(function (ser, idx) {
    if (ser.done) return;
    active++;
    const gameNo = ser.aw + ser.bw + 1;
    const homeIsA = CONFIG.LEAGUE.HOME_GAMES_H2H.indexOf(gameNo) >= 0;
    const home = homeIsA ? ser.a : ser.b;
    const away = homeIsA ? ser.b : ser.a;
    const seed = deriveSeed(seedBase, po.round * 1009 + idx * 31 + gameNo);
    const res = simulateGame(state, home, away, seed);
    if (res.winner === ser.a) ser.aw++; else ser.bw++;
    // 记录玩家队比赛回放
    if (ser.a === state.humanTeamId || ser.b === state.humanTeamId) state.lastLog = res;
    if (ser.aw >= CONFIG.LEAGUE.PLAYOFF_WINS_NEEDED || ser.bw >= CONFIG.LEAGUE.PLAYOFF_WINS_NEEDED) {
      ser.done = true;
      ser.winner = ser.aw > ser.bw ? ser.a : ser.b;
      const w = teamById(state, ser.winner);
      const l = teamById(state, ser.winner === ser.a ? ser.b : ser.a);
      w.alive = true; l.alive = false;
    }
  });
  if (active === 0 || po.series.every(function (s) { return s.done; })) {
    // 当前轮全部结束 → 下一轮或冠军
    if (po.round >= 3) {
      const final = po.series[0];
      state.playoff.champion = final.winner;
      state.playoff.done = true;
      const champ = teamById(state, final.winner);
      champ.alive = true;
      state.phase = 'CHAMPION';
      state.log.push('🏆 ' + champ.name + ' 夺得总冠军！');
      return;
    }
    buildNextRound(state, po);
    po.round++;
  }
}

function buildNextRound(state, po) {
  if (po.round < 2) {
    // 联盟内重排：每联盟胜者按原种子排序后配对
    const next = [];
    Object.keys(po.survivors).forEach(function (conf) {
      const wins = po.survivors[conf].filter(function (t) { return t.alive; })
        .sort(function (a, b) { return a.seed - b.seed; });
      for (let i = 0; i < wins.length / 2; i++) {
        const a = wins[i], b = wins[wins.length - 1 - i];
        a.seriesOpp = b.id; b.seriesOpp = a.id;
        next.push(makeSeries(a, b));
      }
    });
    po.series = next;
  } else if (po.round === 2) {
    // 总决：东胜者 vs 西胜者
    const east = po.survivors['东'].find(function (t) { return t.alive; });
    const west = po.survivors['西'].find(function (t) { return t.alive; });
    east.seriesOpp = west.id; west.seriesOpp = east.id;
    po.series = [makeSeries(east, west)];
  }
  // 标记本轮存活队
  po.series.forEach(function (ser) {
    const a = teamById(state, ser.a), b = teamById(state, ser.b);
    if (ser.done) { const w = teamById(state, ser.winner); a.alive = (a.id === w.id); b.alive = (b.id === w.id); }
  });
}

if (typeof module !== 'undefined') {
  module.exports = { buildSchedule, seasonStandings, endRegular, advancePlayoff, idNum };
}
