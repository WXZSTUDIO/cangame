// cangame v3.2 · 街球杯赛（新人杯/小杯赛/大杯赛）+ 胜者为王（王者积分）
// XBA 逆向：杯赛为淘汰赛制，系统定期推出；胜者为王为连续淘汰竞技场

// —— 杯赛实例（每赛季重建）——
function buildCupInstances(state) {
  const list = {};
  CONFIG.CUP.TYPES.forEach(function (def) {
    const nRounds = Math.log2(def.size);
    const rounds = [];
    for (let i = 0; i < nRounds; i++) rounds.push(def.startRound + i * def.gap);
    list[def.id] = {
      id: def.id, name: def.name, size: def.size, only: def.only,
      desc: def.desc, prize: def.prize, kings: def.kings, reqCupWin: def.reqCupWin,
      rounds: rounds,          // 各轮次对应的联赛轮（1-based）
      registered: false,
      bracket: null,           // [[aId,bId,...], ...] 每轮对阵
      roundIdx: 0,
      done: false, eliminated: false, myResult: null, champion: null
    };
  });
  return list;
}

// 报名（新人杯仅第一赛季可报；大师杯需先夺过任意杯赛冠军）
function cup_register(state, cupId) {
  const cup = state.cups[cupId];
  if (!cup) return { ok: false, reason: 'no-cup' };
  if (cup.registered) return { ok: false, reason: 'already' };
  if (cup.done || cup.roundIdx > 0) return { ok: false, reason: 'closed' };
  if (cup.only === 'first-season' && state.season > 1) return { ok: false, reason: 'not-rookie' };
  if (cup.reqCupWin && !(state.trophies || []).some(function (t) { return t.kind === 'cup'; }))
    return { ok: false, reason: 'need-cup-win' };
  cup.registered = true;
  state.log.push('📋 已报名「' + cup.name + '」（' + cup.size + ' 队淘汰赛，第 ' + cup.rounds[0] + ' 轮开打）');
  return { ok: true };
}

// 杯赛抽签：玩家（若报名）+ 随机对手填满 size（确定性）
function cup_draw(state, cup, rng) {
  const pool = state.teams.map(function (t) { return t.id; }).filter(function (id) { return id !== state.humanTeamId; });
  const need = cup.size - (cup.registered ? 1 : 0);
  const chosen = shuffle(rng, pool).slice(0, need);
  const entrants = cup.registered
    ? shuffle(rng, [state.humanTeamId].concat(chosen))
    : shuffle(rng, chosen);
  const bracket = [];
  for (let i = 0; i + 1 < entrants.length; i += 2) bracket.push([entrants[i], entrants[i + 1]]);
  cup.bracket = [bracket];
  cup.roundIdx = 0;
}

// 该轮是否为某杯赛比赛轮
function cup_tick(state, leagueRound1based) {
  const rng = makeRNG(deriveSeed(state.seed, state.season * 7717 + leagueRound1based * 131));
  Object.keys(state.cups).forEach(function (cid) {
    const cup = state.cups[cid];
    if (cup.done) return;
    const rIdx = cup.rounds.indexOf(leagueRound1based);
    if (rIdx < 0 || rIdx !== cup.roundIdx) return;
    if (!cup.bracket) {
      // 开赛：报名 → 玩家入签；否则 AI 之间自行开赛
      cup_draw(state, cup, rng);
    }
    // 打当前轮
    const cur = cup.bracket[cup.roundIdx];
    const next = [];
    cur.forEach(function (pair) {
      const seed = deriveSeed(state.seed, state.season * 913 + cid.charCodeAt(0) * 57 + cup.roundIdx * 31 + idNum(pair[0]) * 7 + idNum(pair[1]));
      const res = simulateGame(state, pair[0], pair[1], seed);
      const winner = res.winner;
      next.push(winner);
      if (pair[0] === state.humanTeamId || pair[1] === state.humanTeamId) {
        const won = winner === state.humanTeamId;
        cup.myResult = { round: cup.roundIdx, res: res, won: won };
        state.lastCupResult = { cup: cup.name, res: res, won: won, roundIdx: cup.roundIdx, totalRounds: cup.rounds.length };
        if (!won) cup.eliminated = true;
      }
    });
    cup.roundIdx++;
    if (next.length === 1) {
      cup.done = true;
      cup.champion = next[0];
      // 奖励结算
      const C = CONFIG.CUP;
      const human = teamById(state, state.humanTeamId);
      const champTeam = teamById(state, next[0]);
      if (cup.champion === state.humanTeamId) {
        cup.myResult = { champion: true };
        state.finance.income += cup.prize[0];
        state.finance.cash += cup.prize[0];
        state.kingsPts += cup.kings;
        state.trophies.push({ season: state.season, name: cup.name + '冠军', kind: 'cup' });
        state.log.push('🏆 你夺得了「' + cup.name + '」冠军！奖金 ¥' + cup.prize[0] + ' + ' + cup.kings + ' 王者积分');
      } else if (cup.eliminated) {
        // 按止步轮次给奖金：决赛负=亚军奖，半决赛负=四强奖，依此类推
        const tier = clamp(cup.rounds.length - cup.roundIdx + 1, 1, cup.prize.length - 1);
        const prize = cup.prize[Math.max(0, Math.min(tier, cup.prize.length - 1))] || 0;
        if (prize) { state.finance.income += prize; state.finance.cash += prize; }
        state.log.push('「' + cup.name + '」结束：冠军 ' + champTeam.name + '（你止步' + (cup.roundIdx >= cup.rounds.length - 1 ? '决赛' : '第' + (cup.roundIdx) + '轮') + '）');
      } else {
        state.log.push('「' + cup.name + '」结束：冠军 ' + champTeam.name);
      }
    } else {
      // 下一轮对阵
      const nb = [];
      for (let i = 0; i < next.length; i += 2) nb.push([next[i], next[i + 1]]);
      cup.bracket[cup.roundIdx] = nb;
    }
  });
}

// —— 胜者为王：连续淘汰赛，输即结束（或 3/6/9 连胜后主动领取）——
function kings_start(state) {
  if (state.kings && state.kings.active) return { ok: false, reason: 'ongoing' };
  state.kings = { active: true, streak: 0, pts: 0, cash: 0, history: [] };
  return { ok: true };
}

function kings_pickOpponent(state, rng) {
  const human = teamById(state, state.humanTeamId);
  const myStr = human.players.slice().sort(function (a, b) { return b.overall - a.overall; })
    .slice(0, 5).reduce(function (s, p) { return s + p.overall; }, 0) / 5;
  const near = state.teams.filter(function (t) {
    if (t.id === state.humanTeamId) return false;
    const s = t.players.slice().sort(function (a, b) { return b.overall - a.overall; })
      .slice(0, 5).reduce(function (s2, p) { return s2 + p.overall; }, 0) / 5;
    return Math.abs(s - myStr) <= 6;
  });
  const pool = near.length ? near : state.teams.filter(function (t) { return t.id !== state.humanTeamId; });
  return pool[Math.floor(rng() * pool.length)];
}

function kings_next(state) {
  const K = CONFIG.KINGS;
  if (!state.kings || !state.kings.active) return { ok: false, reason: 'not-started' };
  if (state.kings.streak >= K.MAX_STREAK) return { ok: false, reason: 'max' };
  const rng = makeRNG(deriveSeed(state.seed, 5501 + state.kings.streak * 97 + state.season));
  const opp = kings_pickOpponent(state, rng);
  const res = simulateGame(state, state.humanTeamId, opp.id, deriveSeed(rng() * 1e9 | 0, 1));
  const won = res.winner === state.humanTeamId;
  const run = state.kings;
  if (won) {
    run.streak++;
    run.pts += K.POINTS_PER_WIN[Math.min(run.streak - 1, K.POINTS_PER_WIN.length - 1)];
    run.cash += K.CASH_PER_WIN;
    // 体力消耗
    const t = teamById(state, state.humanTeamId);
    t.players.forEach(function (p) { if (p.injury === 0) p.stamina = clamp(p.stamina - K.STAMINA_COST, 0, 100); });
  } else {
    run.active = false; // 输掉：积分清零（未领取）
    run.pts = 0; run.cash = 0;
  }
  state.lastKingsResult = { res: res, won: won, streak: run.streak, opp: opp.name };
  return { ok: true, won: won, streak: run.streak, res: res, opp: opp.name };
}

// 领取：连胜 3/6/9 可全额领；中途退出按 60%（XBA 规则）
function kings_claim(state) {
  const K = CONFIG.KINGS;
  if (!state.kings) return { ok: false, reason: 'not-started' };
  const run = state.kings;
  if (run.streak <= 0) return { ok: false, reason: 'nothing' };
  const milestone = K.CLAIM_AT.indexOf(run.streak) >= 0;
  const pts = milestone ? run.pts : Math.floor(run.pts * K.EXIT_KEEP_PCT);
  const cash = milestone ? run.cash : Math.floor(run.cash * K.EXIT_KEEP_PCT);
  state.kingsPts += pts;
  state.finance.cash += cash;
  state.finance.income += cash;
  state.log.push('⚔ 胜者为王：' + run.streak + ' 连胜结算，+' + pts + ' 王者积分 +' + cash + ' 资金');
  state.kings = null;
  return { ok: true, pts: pts, cash: cash, streak: run.streak, milestone: milestone };
}

if (typeof module !== 'undefined') {
  module.exports = { buildCupInstances, cup_register, cup_tick, kings_start, kings_next, kings_claim };
}
