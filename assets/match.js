// cangame v3.5 · 比赛引擎（回合模拟 + play-by-play）
// 修复：①篮板按位置/属性/身高/力量分配 ②赛中轮换（体力/犯规换人，≥8人） ③比分=统计一致
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
  return used.slice(0, CONFIG.PLAYER.STARTING).map(function (p) { return { player: p, acc: 0, min: 0, fouls: 0 }; });
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

// —— 篮板归属：位置基础权重 × 篮板属性 × 身高 × 力量 × 体力 × 随机 ——
function rebWeight(p, isOff) {
  const P = CONFIG.PLAYER;
  const posW = P.POS_REB_WEIGHT[p.pos] || 1;
  const rebN = p.a.REB / 100;
  const hgt = clamp((p.height - 178) / 42, 0.4, 1.5);
  const strN = (p.a.STR != null ? p.a.STR : 60) / 100;
  const staN = clamp(p.stamina != null ? p.stamina / 100 : 1, 0.5, 1);
  let w = posW * (0.64 * rebN + 0.36 * hgt + 0.26 * strN) * staN;
  if (isOff) w *= CONFIG.MATCH.OREB_FACTOR;
  return Math.max(0.04, w);
}
function pickRebounder(line, isOff, rng) {
  const w = line.map(function (x) { return rebWeight(x.player, isOff); });
  let sum = w.reduce(function (a, b) { return a + b; }, 0), r = rng() * sum;
  for (let i = 0; i < line.length; i++) { r -= w[i]; if (r <= 0) return line[i]; }
  return line[line.length - 1];
}

// —— 轮换：按综合/状态/战术选派首发；赛中按体力/犯规换人；保证 ≥8 人登场 ——
function rotRating(p) {
  return p.overall + (p.mood != null ? (p.mood - 70) * 0.1 : 0) + (p.star ? p.star * 2 : 0);
}
function buildCourt(team) {
  const dressed = team.players.filter(function (p) { return p.injury === 0; });
  // 首发按位置选最强（保证每位置各 1 人，杜绝“无中锋上场”导致篮板崩盘）
  const starters = [];
  CONFIG.PLAYER.POSITIONS.forEach(function (pos) {
    const best = dressed.filter(function (p) { return p.pos === pos; })
      .slice().sort(function (a, b) { return rotRating(b) - rotRating(a); })[0];
    if (best && starters.indexOf(best) < 0) starters.push(best);
  });
  // 某位置无人（极端伤病）用剩余最高综合补
  if (starters.length < CONFIG.PLAYER.STARTING) {
    dressed.slice().sort(function (a, b) { return rotRating(b) - rotRating(a); }).forEach(function (p) {
      if (starters.indexOf(p) < 0) starters.push(p);
    });
  }
  const bench = dressed.filter(function (p) { return starters.indexOf(p) < 0; });
  const mk = function (p) { return { player: p, acc: 0, min: 0, fouls: 0, isStarter: starters.indexOf(p) >= 0 }; };
  // all 必须与 onCourt/bench 共享引用，否则赛中累加的 min/fouls 无法写回 box
  const onCourt = starters.map(mk);
  const benchList = bench.map(mk);
  return { onCourt: onCourt, bench: benchList, all: onCourt.concat(benchList) };
}
function bestSub(bench, pos) {
  const avail = bench.filter(function (b) { return b.player.fouls < CONFIG.MATCH.FOUL_OUT; });
  if (!avail.length) return null;
  avail.sort(function (a, b) {
    const pa = (b.player.pos === pos ? 1 : 0) - (a.player.pos === pos ? 1 : 0);
    return pa !== 0 ? pa : (rotRating(b.player) - rotRating(a.player));
  });
  return avail[0];
}
function trySubs(court, rng, possDone, totalPoss) {
  const M = CONFIG.MATCH;
  // 1) 体力 / 犯规换人（下场休息）
  for (let i = 0; i < court.onCourt.length; i++) {
    const x = court.onCourt[i];
    const tired = x.player.stamina != null && x.player.stamina <= M.SUB_STAMINA;
    const foulRisk = x.fouls >= M.FOUL_SUB;
    if ((tired || foulRisk) && x.fouls < M.FOUL_OUT) {
      const sub = bestSub(court.bench, x.player.pos);
      if (sub) {
        const bi = court.bench.indexOf(sub); court.bench.splice(bi, 1);
        court.onCourt[i] = sub; court.bench.push(x);
      }
    }
  }
  // 2) 首发回归：休息充分（体力>70）的首发，同位置换下打最久的纯替补（双向轮换，保证首发核心上场时间）
  //    注意：min 计的是回合数（每队约 100 回合），不能拿 STARTER_MIN(篮球分钟) 当回合阈值，否则首发打 1/3 场就被永久流放
  if (possDone > totalPoss * 0.2) {
    court.bench.slice().forEach(function (bs) {
      if (bs.isStarter && bs.player.stamina > 70) {
        let target = -1, bestMin = -1;
        court.onCourt.forEach(function (o, idx) {
          if (!o.isStarter && o.player.pos === bs.player.pos && o.min > bestMin) { bestMin = o.min; target = idx; }
        });
        if (target >= 0) {
          const bi = court.bench.indexOf(bs); court.bench.splice(bi, 1);
          const out = court.onCourt[target]; court.onCourt[target] = bs; court.bench.push(out);
        }
      }
    });
  }
  // 3) 保证每场 ≥ MIN_ROTATION 人登场（过半场后强制轮换板凳）
  const played = court.all.filter(function (o) { return o.min > 0; }).length;
  if (possDone > totalPoss * 0.5 && played < M.MIN_ROTATION) {
    for (let i = 0; i < court.onCourt.length && court.all.filter(function (o) { return o.min > 0; }).length < M.MIN_ROTATION; i++) {
      const x = court.onCourt[i];
      if (x.min > 0) {
        const sub = bestSub(court.bench, x.player.pos);
        if (sub) {
          const bi = court.bench.indexOf(sub); court.bench.splice(bi, 1);
          court.onCourt[i] = sub; court.bench.push(x);
        }
      }
    }
  }
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
  team.players.forEach(function (p) { players[p.id] = { id: p.id, name: p.name, pos: p.pos, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, to: 0, fgm: 0, fga: 0, min: 0 }; });
  return { teamId: team.id, teamName: team.name, players: players, teamReb: 0, teamTo: 0, teamStl: 0, teamBlk: 0 };
}

function simulateGame(state, homeId, awayId, seed) {
  const rng = makeRNG(seed);
  const M = CONFIG.MATCH;
  const home = teamById(state, homeId), away = teamById(state, awayId);
  const ht = tactics_resolve(home), at = tactics_resolve(away);
  // 赛前重置体力 / 清犯规
  [home, away].forEach(function (t) {
    t.players.forEach(function (p) { if (p.injury === 0) p.stamina = 100; p.fouls = 0; });
  });
  const hCourt = buildCourt(home), aCourt = buildCourt(away);
  const hBox = initBox(home), aBox = initBox(away);
  const poss = Math.round(M.POSSESSIONS * tactics_paceFactor(ht));
  const total = poss * 2;
  let hScore = 0, aScore = 0, ball = 'home', log = [];

  for (let i = 0; i < total; i++) {
    const hLine = hCourt.onCourt, aLine = aCourt.onCourt;
    const offLine = ball === 'home' ? hLine : aLine;
    const defLine = ball === 'home' ? aLine : hLine;
    const offTeam = ball === 'home' ? home : away;
    const defTeam = ball === 'home' ? away : home;
    const offTac = ball === 'home' ? ht : at;
    const defTac = ball === 'home' ? at : ht;
    const offBox = ball === 'home' ? hBox : aBox;
    const defBox = ball === 'home' ? aBox : hBox;
    const clk = ppClock(i, total);

    // 体力 / 上场分钟累积
    offLine.concat(defLine).forEach(function (x) {
      x.min++;
      if (x.player.stamina > 0) x.player.stamina = clamp(x.player.stamina - M.FATIGUE_PER_POSSESS, 0, 100);
    });
    // 板凳恢复体力（支持首发休息后回归）
    hCourt.bench.concat(aCourt.bench).forEach(function (x) {
      if (x.player.stamina < 100) x.player.stamina = clamp(x.player.stamina + M.REST_RECOVER_POSSESS, 0, 100);
    });

    // 失误
    const toProb = M.TO_BASE - M.IQ_TO_COEF * (avgAttr(offLine, 'IQ') - avgAttr(defLine, 'IQ'))
      + (defTac.defense === '夹击' ? M.PRESS_TO_BONUS : 0);
    if (rng() < clamp(toProb, 0.03, 0.35)) {
      const tp = pickShooter(rng, offLine).player;
      const dp = bestBy(defLine, 'DEF').player;
      offBox.players[tp.id].to++; offBox.teamTo++;
      defBox.teamStl++; defBox.players[dp.id].stl++;
      if (rng() < M.FOUL_RATE * 0.4) { const ofp = pickOnCourt(rng, offLine); if (ofp) { const e = offLine.find(function (x) { return x.player === ofp; }); if (e) e.fouls++; } }
      if (!state.simQuiet) log.push(clk + ' ' + offTeam.name + ' ' + tp.name + ' ' + PP_ACTION.TO);
      ball = ball === 'home' ? 'away' : 'home';
      trySubs(hCourt, rng, i, total); trySubs(aCourt, rng, i, total);
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
      if (rng() < M.FOUL_RATE * 0.5) { const e = defLine[Math.floor(rng() * defLine.length)]; if (e) e.fouls++; }
      if (sp.a.PAS >= 68 && rng() < 0.45) {
        const ap = pickOnCourt(rng, offLine, sh);
        if (ap) offBox.players[ap.id].ast++;
      }
      if (!state.simQuiet) log.push(clk + ' ' + offTeam.name + ' ' + sp.name + ' ' + (isThree ? PP_ACTION['3M'] : PP_ACTION['2M']) + ' (' + hScore + '-' + aScore + ')');
    } else {
      offBox.players[sp.id].fga++;
      const rb = clamp(M.REB_BASE + M.REB_COEF * (avgAttr(offLine, 'REB') - avgAttr(defLine, 'REB')), 0.12, 0.45);
      if (rng() < rb) {
        const rp = pickRebounder(offLine, true, rng);
        offBox.teamReb++; offBox.players[rp.player.id].reb++;
        if (!state.simQuiet) log.push(clk + ' ' + offTeam.name + ' ' + rp.player.name + ' ' + PP_ACTION.OREB);
      } else {
        const rp = pickRebounder(defLine, false, rng);
        defBox.teamReb++; defBox.players[rp.player.id].reb++;
        if (rng() < 0.22) { defBox.teamBlk++; defBox.players[rp.player.id].blk++; }
        if (!state.simQuiet) log.push(clk + ' ' + defTeam.name + ' ' + rp.player.name + ' ' + PP_ACTION.DREB);
        ball = ball === 'home' ? 'away' : 'home';
      }
    }
    trySubs(hCourt, rng, i, total); trySubs(aCourt, rng, i, total);
  }

  // 上场分钟写回 box
  hCourt.all.forEach(function (o) { if (hBox.players[o.player.id]) hBox.players[o.player.id].min = o.min; });
  aCourt.all.forEach(function (o) { if (aBox.players[o.player.id]) aBox.players[o.player.id].min = o.min; });

  const winner = hScore > aScore ? homeId : (aScore > hScore ? awayId : homeId);
  return { homeId: homeId, awayId: awayId, hScore: hScore, aScore: aScore, winner: winner, log: log, hBox: hBox, aBox: aBox, force20: false };
}

// —— 比分 = 统计一致性校验（不一致写错误日志）——
function assertBoxConsistent(res, state) {
  if (res.force20) return true;
  const sumPts = function (box) { return Object.keys(box.players).reduce(function (s, id) { return s + box.players[id].pts; }, 0); };
  const okH = sumPts(res.hBox) === res.hScore;
  const okA = sumPts(res.aBox) === res.aScore;
  if (!okH || !okA) {
    (state.log = state.log || []).push('⚠ 比分与统计不一致：' + res.homeId + ' ' + res.hScore + ' / ' + res.aScore + '（box ' + sumPts(res.hBox) + '/' + sumPts(res.aBox) + '）');
    return false;
  }
  return true;
}

function availableCount(team) {
  return team.players.filter(function (p) { return p.injury === 0; }).length;
}

if (typeof module !== 'undefined') {
  module.exports = {
    simulateGame, getLineup, initBox, availableCount,
    rebWeight, pickRebounder, buildCourt, trySubs, rotRating, assertBoxConsistent
  };
}
