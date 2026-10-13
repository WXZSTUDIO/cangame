// cangame v3.2 · 战术系统（XBA 逆向：6 进攻 × 6 防守 + 相克矩阵 + 阵容评分）
function tactics_default() {
  return { offense: '整体', defense: '2-3联防', rotation: '均衡' };
}
function tactics_resolve(team) {
  const d = tactics_default();
  if (team && team.tactics) {
    d.offense = team.tactics.offense || d.offense;
    d.defense = team.tactics.defense || d.defense;
    d.rotation = team.tactics.rotation || d.rotation;
  }
  return d;
}

// 攻方战术对守方战术的命中加成（查相克表，封顶 ±COUNTER_CAP）
function tactics_counterBonus(atk, def) {
  const c = CONFIG.TACTICS;
  const k = atk.offense + '_' + def.defense;
  return clamp(c.COUNTER[k] || 0, -c.COUNTER_CAP, c.COUNTER_CAP);
}

// 进攻战术自带节奏（快攻回合数更多）
function tactics_paceFactor(tac) {
  return CONFIG.TACTICS.OFF_TEMPO[tac.offense] || 1.0;
}

// 阵容评分（进攻/防守/篮板），用首发 + 板凳深度；战术适配微调
function tactics_lineupRating(team, tac) {
  const starters = team.lineup.map(function (id) {
    return team.players.find(function (p) { return p.id === id; });
  }).filter(Boolean);
  const bench = team.players.filter(function (p) { return team.lineup.indexOf(p.id) < 0; });
  function avg(arr, key) {
    if (!arr.length) return 60;
    return arr.reduce(function (s, p) { return s + p.a[key]; }, 0) / arr.length;
  }
  const bigs = avg(starters.filter(function (x) { return x.pos === 'C' || x.pos === 'PF'; }), 'SHO');
  const guards = avg(starters.filter(function (x) { return x.pos === 'PG' || x.pos === 'SG'; }), 'SHO');
  const all = avg(starters, 'SHO');
  let off = all * 0.5 + avg(starters, 'TRE') * 0.2 + avg(starters, 'DRV') * 0.15 + avg(starters, 'IQ') * 0.15;
  // 战术与人员适配（XBA 攻略：内线强攻需要强力 C/PF，外线需要外线火力）
  if (tac.offense === '内线强攻') off += (bigs - all) * 0.4;
  if (tac.offense === '中锋策应') off += (bigs - all) * 0.2 + (avg(starters, 'PAS') - 65) * 0.1;
  if (tac.offense === '外线') off += (guards - all) * 0.35;
  if (tac.offense === '快攻') off += (avg(starters, 'SPD') - 65) * 0.2;
  if (tac.offense === '整体') off += (avg(starters, 'IQ') - 65) * 0.15;
  if (tac.offense === '挡拆') off += (avg(starters, 'IQ') - 65) * 0.1;
  let def = avg(starters, 'DEF') * 0.6 + avg(bench, 'DEF') * 0.15 + avg(starters, 'SPD') * 0.25;
  if (tac.defense === '2-3联防' || tac.defense === '2-1-2联防') def += (avg(starters.filter(function (x) { return x.pos === 'C' || x.pos === 'PF'; }), 'DEF') - 65) * 0.2;
  if (tac.defense === '盯内') def += (avg(starters.filter(function (x) { return x.pos === 'C' || x.pos === 'PF'; }), 'DEF') - 65) * 0.25;
  if (tac.defense === '盯外' || tac.defense === '3-2联防') def += (guards > 0 ? (avg(starters.filter(function (x) { return x.pos !== 'C'; }), 'DEF') - 65) * 0.2 : 0);
  const reb = avg(starters, 'REB') * 0.7 + avg(bench, 'REB') * 0.3;
  return { off: Math.round(off), def: Math.round(def), reb: Math.round(reb) };
}

if (typeof module !== 'undefined') {
  module.exports = { tactics_default, tactics_resolve, tactics_counterBonus, tactics_paceFactor, tactics_lineupRating };
}
