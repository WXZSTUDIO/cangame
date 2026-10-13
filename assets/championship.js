// cangame v3.3 · 冠军杯赛（XBA 逆向：联赛前 2 名受邀 → 6 队小组单循环 → 前 2 进决赛淘汰）
// 与街球杯赛不同：冠军杯面向职业队，凭联赛战绩拿邀请函，先打小组循环再淘汰。

// 联赛各前 2 名受邀（共 6 队），生成小组单循环赛程
function championship_build(state) {
  const C = CONFIG.CHAMPIONSHIP;
  const invited = [];
  ['L1', 'L2a', 'L2b'].forEach(function (lid) {
    const st = seasonStandings(state, lid);
    st.slice(0, 2).forEach(function (r) {
      if (invited.indexOf(r.team.id) < 0) invited.push(r.team.id);
    });
  });
  // 圆形法生成单循环（n-1 轮，每轮 n/2 场）
  const arr = invited.slice();
  const sched = [];
  for (let i = 0; i < arr.length - 1; i++) {
    const round = [];
    for (let j = 0; j < arr.length / 2; j++) {
      const a = arr[j], b = arr[arr.length - 1 - j];
      round.push(i % 2 === 1 ? [b, a] : [a, b]);
    }
    sched.push(round);
    arr.splice(1, 0, arr.pop()); // 固定首队，其余轮转
  }
  const rec = {};
  invited.forEach(function (id) { rec[id] = { id: id, w: 0, l: 0, pf: 0, pa: 0 }; });
  return {
    invited: invited, rec: rec, schedule: sched, groupIdx: 0,
    opened: true, final: null, champion: null, done: false, myResult: null
  };
}

// 依据联赛轮（1-based）推进冠军杯
function championship_tick(state, r) {
  const C = CONFIG.CHAMPIONSHIP;
  if (!state.championship) {
    if (r >= C.openRound) state.championship = championship_build(state);
    else return;
  }
  const c = state.championship;
  if (c.done) return;

  // 小组赛阶段
  if (c.groupIdx < c.schedule.length && r >= C.openRound + c.groupIdx) {
    const games = c.schedule[c.groupIdx];
    games.forEach(function (pair) {
      const seed = deriveSeed(state.seed, 4242 + r * 13 + idNum(pair[0]) * 7 + idNum(pair[1]) * 3);
      const res = simulateGame(state, pair[0], pair[1], seed);
      const w = res.winner;
      c.rec[pair[0]].pf += res.hScore; c.rec[pair[0]].pa += res.aScore;
      c.rec[pair[1]].pf += res.aScore; c.rec[pair[1]].pa += res.hScore;
      if (w === pair[0]) { c.rec[pair[0]].w++; c.rec[pair[1]].l++; }
      else { c.rec[pair[1]].w++; c.rec[pair[0]].l++; }
      if (pair[0] === state.humanTeamId || pair[1] === state.humanTeamId) {
        const won = w === state.humanTeamId;
        c.myResult = { stage: 'group', round: c.groupIdx, won: won, res: res };
        state.lastChampResult = { stage: 'group', won: won, res: res, round: c.groupIdx };
      }
    });
    c.groupIdx++;
  }

  // 决赛（小组前 2）
  if (c.groupIdx >= c.schedule.length && !c.final && r >= C.finalRound) {
    const ranked = c.invited.slice().sort(function (a, b) {
      if (c.rec[b].w !== c.rec[a].w) return c.rec[b].w - c.rec[a].w;
      return (c.rec[b].pf - c.rec[b].pa) - (c.rec[a].pf - c.rec[a].pa);
    });
    const a = ranked[0], b = ranked[1];
    const res = simulateGame(state, a, b, deriveSeed(state.seed, 9090 + state.season));
    c.final = { a: a, b: b, winner: res.winner, res: res };
    c.champion = res.winner;
    c.done = true;
    const champTeam = teamById(state, res.winner);
    state.trophies.push({ season: state.season, name: '冠军杯', kind: 'championship' });
    if (res.winner === state.humanTeamId) {
      state.finance.cash += C.championPrize.cash;
      state.finance.income += C.championPrize.cash;
      state.prestige += C.championPrize.prestige;
      state.log.push('🏆 你夺得了「冠军杯」！+¥' + C.championPrize.cash + ' +' + C.championPrize.prestige + ' 威望');
    } else {
      state.log.push('「冠军杯」冠军：' + champTeam.name);
    }
    // 小组出线奖（玩家晋级决赛）
    if (a === state.humanTeamId || b === state.humanTeamId) {
      const first = ranked[0] === state.humanTeamId;
      const pr = first ? C.groupPrestige[0] : C.groupPrestige[1];
      const cash = first ? C.groupPrize[0] : C.groupPrize[1];
      state.prestige += pr; state.finance.cash += cash; state.finance.income += cash;
      state.log.push('冠军杯小组出线：' + (first ? '第1名' : '第2名') + ' +' + pr + ' 威望 +¥' + cash);
    }
  }
}

// 玩家是否获得冠军杯邀请函（其联赛当前前 2）
function championship_invited(state) {
  if (!state.championship || !state.championship.opened) return false;
  return state.championship.invited.indexOf(state.humanTeamId) >= 0;
}

if (typeof module !== 'undefined') {
  module.exports = { championship_build, championship_tick, championship_invited };
}
