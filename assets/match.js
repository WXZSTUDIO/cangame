// cangame v3 · 比赛引擎（回合模拟 + play-by-play）
function getLineup(team, tac) {
  const onCourt = team.lineup
    .map(function (id) { return team.players.find(function (p) { return p.id === id; }); })
    .filter(function (p) { return p && p.injury === 0; });
  const bench = team.players.filter(function (p) { return p.injury === 0 && team.lineup.indexOf(p.id) < 0; });
  let used = onCourt.slice();
  let bi = 0;
  while (used.length < CONFIG.PLAYER.STARTING && bi < bench.length) { used.push(bench[bi++]); }
  // 不足 5 人（极端伤病）用任意存活球员补
  if (used.length < CONFIG.PLAYER.STARTING) {
    team.players.forEach(function (p) { if (used.indexOf(p) < 0 && p.injury === 0) used.push(p); });
  }
  return used.slice(0, CONFIG.PLAYER.STARTING).map(function (p) { return { player: p, acc: 0, min: CONFIG.MATCH.STARTER_MIN }; });
}

function avgAttr(line, key) {
  if (!line.length) return 60;
  return line.reduce(function (s, x) { return s + x.player.a[key]; }, 0) / line.length;
}
function bestBy(line, key) {
  let best = line[0];
  for (let i = 1; i < line.length; i++) if (line[i].player.a[key] > best.player.a[key]) best = line[i];
  return best;
}
function pickShooter(rng, line) {
  const w = line.map(function (x) {
    const off = (x.player.a.SHO + x.player.a.TRE + x.player.a.DRV) / 3;
    const usage = CONFIG.PLAYER.TRAIT_USAGE[x.player.trait] || 1.0;
    return Math.max(1, off * usage - x.acc * 0.15); // 出手越多越疲劳，权重略降
  });
  let sum = w.reduce(function (a, b) { return a + b; }, 0), r = rng() * sum;
  for (let i = 0; i < line.length; i++) { r -= w[i]; if (r <= 0) return line[i]; }
  return line[line.length - 1];
}
function pickOnCourt(rng, line, exclude) {
  const pool = exclude ? line.filter(function (x) { return x.player !== exclude.player; }) : line;
  if (!pool.length) return null;
  return pool[Math.floor(rng() * pool.length)].player;
}

var PP_ACTION = { '2M': '两分命中', '3M': '三分命中', 'OREB': '进攻篮板', 'DREB': '防守篮板', 'TO': '失误' };
function ppClock(i, total) {
  const pq = total / 4;
  const q = Math.min(4, Math.floor(i / pq) + 1);
  const inQ = i % pq;
  const secLeft = Math.max(0, Math.round((1 - inQ / pq) * 12 * 60));
  const mm = String(Math.floor(secLeft / 60)).padStart(2, '0');
  const ss = String(secLeft % 60).padStart(2, '0');
  return q + '节 ' + mm + ':' + ss;
}

function initBox(team) {
  const players = {};
  team.players.forEach(function (p) { players[p.id] = { id: p.id, name: p.name, pos: p.pos, pts: 0, reb: 0, ast: 0, stl: 0, to: 0, fgm: 0, fga: 0 }; });
  return { teamId: team.id, teamName: team.name, players: players, teamReb: 0, teamTo: 0, teamStl: 0 };
}

function simulateGame(state, homeId, awayId, seed) {
  const rng = makeRNG(seed);
  const M = CONFIG.MATCH;
  const home = teamById(state, homeId), away = teamById(state, awayId);
  const ht = tactics_resolve(home), at = tactics_resolve(away);
  const hLine = getLineup(home, ht), aLine = getLineup(away, at);
  const hBox = initBox(home), aBox = initBox(away);
  const poss = Math.round(M.POSSESSIONS * tactics_paceFactor(ht));
  const total = poss * 2;
  let hScore = 0, aScore = 0, ball = 'home', log = [];

  for (let i = 0; i < total; i++) {
    const offLine = ball === 'home' ? hLine : aLine;
    const defLine = ball === 'home' ? aLine : hLine;
    const offTeam = ball === 'home' ? home : away;
    const defTeam = ball === 'home' ? away : home;
    const offTac = ball === 'home' ? ht : at;
    const defTac = ball === 'home' ? at : ht;
    const offBox = ball === 'home' ? hBox : aBox;
    const defBox = ball === 'home' ? aBox : hBox;
    const clk = ppClock(i, total);

    // 失误
    const toProb = M.TO_BASE - M.IQ_TO_COEF * (avgAttr(offLine, 'IQ') - avgAttr(defLine, 'IQ'))
      + (defTac.defense === '夹击' ? M.PRESS_TO_BONUS : 0);
    if (rng() < clamp(toProb, 0.03, 0.35)) {
      const tp = pickOnCourt(rng, offLine).player ? pickShooter(rng, offLine).player : offLine[0].player;
      const dp = bestBy(defLine, 'DEF').player;
      offBox.players[tp.id].to++; offBox.teamTo++;
      defBox.teamStl++; defBox.players[dp.id].stl++;
      if (!state.simQuiet) log.push(clk + ' ' + offTeam.name + ' ' + tp.name + ' ' + PP_ACTION.TO);
      ball = ball === 'home' ? 'away' : 'home';
      continue;
    }

    // 出手
    const sh = pickShooter(rng, offLine);
    const sp = sh.player, dp = bestBy(defLine, 'DEF').player;
    const isThree = (sp.a.TRE > sp.a.SHO + 6 && offTac.offense === '外线') || (sp.a.TRE > sp.a.SHO + 12);
    const base = isThree ? M.BASE_3P : M.BASE_2P;
    let p = base
      + (isThree ? M.TRE_COEF : M.SHO_COEF) * (sp.a[isThree ? 'TRE' : 'SHO'] - 65)
      - M.DEF_COEF * (dp.a.DEF - 65)
      + M.IQ_COEF * (sp.a.IQ - dp.a.IQ)
      + tactics_counterBonus(offTac, defTac);
    if (sh.acc > M.FATIGUE_MIN_THRESHOLD) p -= M.FATIGUE_SHOOT_PENALTY * (sh.acc - M.FATIGUE_MIN_THRESHOLD);
    // 心情修正（XBA 逆向：低落惩罚 / 高涨加成）
    const mo = CONFIG.MOOD;
    if (sp.mood != null) {
      if (sp.mood < mo.LOW) p -= mo.LOW_PENALTY * ((mo.LOW - sp.mood) / mo.LOW);
      else if (sp.mood > mo.HIGH) p += mo.HIGH_BONUS * ((sp.mood - mo.HIGH) / (100 - mo.HIGH));
    }
    if (i > total - total / 5 && Math.abs(hScore - aScore) <= M.CLUTCH_DIFF) {
      const trail = ball === 'home' ? hScore < aScore : aScore < hScore;
      if (trail) p += M.CLUTCH_BONUS * (sp.a.CLU - 60) / 40;
    }
    p = clamp(p + (rng() - 0.5) * 2 * M.NOISE, 0.05, 0.95);
    sh.acc++;

    if (rng() < p) {
      const pts = isThree ? 3 : 2;
      if (ball === 'home') hScore += pts; else aScore += pts;
      const row = offBox.players[sp.id]; row.pts += pts; row.fgm++; row.fga++;
      if (sp.a.PAS >= 68 && rng() < 0.45) {
        const ap = pickOnCourt(rng, offLine, sh);
        if (ap) offBox.players[ap.id].ast++;
      }
      if (!state.simQuiet) log.push(clk + ' ' + offTeam.name + ' ' + sp.name + ' ' + (isThree ? PP_ACTION['3M'] : PP_ACTION['2M']) + ' (' + hScore + '-' + aScore + ')');
    } else {
      offBox.players[sp.id].fga++;
      const rb = clamp(M.REB_BASE + M.REB_COEF * (avgAttr(offLine, 'REB') - avgAttr(defLine, 'REB')), 0.2, 0.8);
      if (rng() < rb) {
        const rp = pickOnCourt(rng, offLine).player ? pickShooter(rng, offLine).player : offLine[0].player;
        offBox.teamReb++; offBox.players[rp.id].reb++;
        if (!state.simQuiet) log.push(clk + ' ' + offTeam.name + ' ' + rp.name + ' ' + PP_ACTION.OREB);
      } else {
        const rp = bestBy(defLine, 'REB').player;
        defBox.teamReb++; defBox.players[rp.id].reb++;
        if (!state.simQuiet) log.push(clk + ' ' + defTeam.name + ' ' + rp.name + ' ' + PP_ACTION.DREB);
        ball = ball === 'home' ? 'away' : 'home';
      }
    }
  }
  const winner = hScore > aScore ? homeId : (aScore > hScore ? awayId : homeId);
  return { homeId: homeId, awayId: awayId, hScore: hScore, aScore: aScore, winner: winner, log: log, hBox: hBox, aBox: aBox };
}

if (typeof module !== 'undefined') {
  module.exports = { simulateGame, getLineup };
}
