// cangame v3 · 战术系统（克制矩阵 + 阵容评分）
function tactics_default() {
  return { pace: '稳', offense: '均衡', defense: '盯人', rotation: '均衡' };
}
function tactics_resolve(team) {
  const d = tactics_default();
  if (team && team.tactics) {
    d.pace = team.tactics.pace || d.pace;
    d.offense = team.tactics.offense || d.offense;
    d.defense = team.tactics.defense || d.defense;
    d.rotation = team.tactics.rotation || d.rotation;
  }
  return d;
}

// 攻方战术对守方战术的命中加成（封顶 ±0.10）
function tactics_counterBonus(atk, def) {
  let b = 0;
  const c = CONFIG.COUNTER;
  const k1 = atk.offense + '_' + def.defense; if (c[k1]) b += c[k1];
  const k2 = atk.pace + '_' + def.pace; if (c[k2]) b += c[k2];
  const k3 = atk.pace + '_' + def.defense; if (c[k3]) b += c[k3];
  return clamp(b, -0.10, 0.10);
}

function tactics_paceFactor(pace) {
  return CONFIG.TACTICS.PACE_POS_FACTOR[pace] || 1.0;
}

// 阵容评分（进攻/防守/篮板），用首发 + 板凳深度
function tactics_lineupRating(team, tac) {
  const starters = team.lineup.map(function (id) {
    return team.players.find(function (p) { return p.id === id; });
  }).filter(Boolean);
  const bench = team.players.filter(function (p) { return team.lineup.indexOf(p.id) < 0; });
  function avg(arr, key) {
    if (!arr.length) return 60;
    return arr.reduce(function (s, p) { return s + p.a[key]; }, 0) / arr.length;
  }
  const off = avg(starters, 'SHO') * 0.4 + avg(starters, 'TRE') * 0.25 + avg(starters, 'DRV') * 0.2 + avg(starters, 'IQ') * 0.15;
  const def = avg(starters, 'DEF') * 0.6 + avg(bench, 'DEF') * 0.15 + avg(starters, 'SPD') * 0.25;
  const reb = avg(starters, 'REB') * 0.7 + avg(bench, 'REB') * 0.3;
  // 进攻倾向微调
  if (tac.offense === '外线') off += 3;
  if (tac.offense === '内线') off += 1;
  if (tac.defense === '联防') def += 2;
  if (tac.defense === '夹击') def += 3;
  return { off: Math.round(off), def: Math.round(def), reb: Math.round(reb) };
}

if (typeof module !== 'undefined') {
  module.exports = { tactics_default, tactics_resolve, tactics_counterBonus, tactics_paceFactor, tactics_lineupRating };
}
