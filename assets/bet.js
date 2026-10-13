// cangame v3.4 · 有奖竞猜（XBA 逆向：押注比赛结果赢资金）
// 每轮展示若干焦点对阵，玩家押注胜方；联赛轮推进时结算已押注比赛。
function bet_teamStrength(state, id) {
  const t = teamById(state, id);
  if (!t) return 60;
  const rt = tactics_lineupRating(t, tactics_resolve(t));
  return (rt.off + rt.def) / 2;
}

function bet_odds(state, homeId, awayId, pick) {
  const sh = bet_teamStrength(state, homeId), sa = bet_teamStrength(state, awayId);
  const fav = sh >= sa ? homeId : awayId;
  const diff = Math.abs(sh - sa);
  let odd = CONFIG.BET.baseOdd;
  if (pick === fav) odd = Math.max(1.1, CONFIG.BET.baseOdd - diff * 0.03);
  else odd = CONFIG.BET.baseOdd + diff * 0.05;
  return Math.round(odd * 100) / 100;
}

// 下轮可押注的焦点场次（排除玩家本队，按双方实力之和挑焦点）
function bet_featured(state) {
  if (state.phase !== 'REGULAR') return [];
  const out = [];
  LEAGUE_DEFS.forEach(function (ld) {
    const games = state.schedule[ld.id][state.round] || [];
    games.forEach(function (g) {
      if (g[0] === state.humanTeamId || g[1] === state.humanTeamId) return;
      const sh = bet_teamStrength(state, g[0]), sa = bet_teamStrength(state, g[1]);
      out.push({ homeId: g[0], awayId: g[1], heat: sh + sa });
    });
  });
  out.sort(function (a, b) { return b.heat - a.heat; });
  return out.slice(0, CONFIG.BET.featured).map(function (m) {
    const ht = teamById(state, m.homeId), at = teamById(state, m.awayId);
    return {
      homeId: m.homeId, awayId: m.awayId,
      home: ht ? ht.name : m.homeId, away: at ? at.name : m.awayId,
      oddHome: bet_odds(state, m.homeId, m.awayId, m.homeId),
      oddAway: bet_odds(state, m.homeId, m.awayId, m.awayId)
    };
  });
}

// 押注：pick 为看好的一方 teamId
function bet_place(state, homeId, awayId, pick, amount) {
  if (state.phase !== 'REGULAR') return { ok: false, reason: 'closed' };
  amount = Math.round(amount);
  if (amount < 1000) return { ok: false, reason: 'min' };
  if (amount > state.finance.cash * CONFIG.BET.maxStakePct) return { ok: false, reason: 'over-stake' };
  if (state.finance.cash < amount) return { ok: false, reason: 'no-cash' };
  // 同一对阵不可重复押
  if ((state.bets || []).some(function (b) { return !b.resolved && b.homeId === homeId && b.awayId === awayId; }))
    return { ok: false, reason: 'dup' };
  state.bets = state.bets || [];
  state.bets.push({
    homeId: homeId, awayId: awayId, pick: pick, amount: amount,
    odd: bet_odds(state, homeId, awayId, pick), resolved: false, won: false, round: state.round
  });
  state.finance.cash -= amount;
  state.finance.expense += amount;
  const ht = teamById(state, homeId), at = teamById(state, awayId);
  state.log.push('🎲 竞猜押注：' + (ht ? ht.name : homeId) + ' vs ' + (at ? at.name : awayId) + '，押 ' + (pick === homeId ? (ht ? ht.name : homeId) : (at ? at.name : awayId)) + ' ¥' + amount);
  return { ok: true };
}

// 联赛轮推进后结算本轮回合内已押注的比赛
function bet_tick(state, played) {
  if (!state.bets) return;
  played.forEach(function (g) {
    state.bets.forEach(function (b) {
      if (b.resolved) return;
      if (b.homeId === g.homeId && b.awayId === g.awayId) {
        b.resolved = true;
        b.won = (b.pick === g.winner);
        if (b.won) {
          const pay = Math.round(b.amount * b.odd);
          state.finance.cash += pay;
          state.finance.income += pay;
          b.payout = pay;
          const ht = teamById(state, g.homeId), at = teamById(state, g.awayId);
          state.log.push('🎲 竞猜命中！' + (ht ? ht.name : g.homeId) + ' vs ' + (at ? at.name : g.awayId) + ' 收回 ¥' + pay);
        } else {
          b.payout = 0;
          const ht = teamById(state, g.homeId), at = teamById(state, g.awayId);
          state.log.push('🎲 竞猜落空：' + (ht ? ht.name : g.homeId) + ' vs ' + (at ? at.name : g.awayId) + ' 押注 ¥' + b.amount + ' 打水漂');
        }
      }
    });
  });
}

if (typeof module !== 'undefined') {
  module.exports = { bet_featured, bet_place, bet_tick, bet_odds, bet_teamStrength };
}
