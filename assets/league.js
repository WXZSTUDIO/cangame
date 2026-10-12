// cangame v3 · 联赛生成（30 队虚构）
var CITY_POOL = ['江城', '云港', '朔北', '临海', '枫桥', '鹤城', '霖川', '岚州', '炽都', '银沙',
  '槐里', '砚台', '苍梧', '澜沧', '北芒', '霁月', '寒山', '汀州', '赤焰', '青冥',
  '梧州', '朔方', '锦官', '雁门', '沧澜', '麓山', '霂野', '曦和', '濯水', '岷源'];
var NICK_POOL = ['雄鹰', '猛虎', '烈焰', '苍狼', '雷霆', '飓风', '磐石', '猎鹰', '蛟龙', '锋刃',
  '骄阳', '寒星', '铁骑', '浪人', '苍穹', '锐士', '狂澜', '疾风', '玄铁', '破晓',
  '炽翼', '霜狼', '惊蛰', '银河', '烈风', '苍隼', '燎原', '渊渟', '骁骑', '曜石'];
var TEAM_COLORS = ['#ff7a3c', '#4ea8ff', '#6fcf7f', '#f2c14e', '#e26d6d', '#b98cff',
  '#39c5b0', '#ff9ecb', '#9fb0a8', '#ffd166', '#7c9cff', '#ef6f6c',
  '#5ec8a8', '#c0a36e', '#d98cff', '#6fd3ff', '#ffb085', '#a8d18d',
  '#e88f4d', '#8aa9ff', '#d3a0a0', '#7bd0c1', '#f0a85a', '#9b8cff',
  '#5fb0e0', '#e0c45f', '#cf7f9b', '#8fd08f', '#e09b6f', '#a0a8d8'];

function buildLeague(rng) {
  const L = CONFIG.LEAGUE, P = CONFIG.PLAYER;
  const cities = shuffle(rng, CITY_POOL).slice(0, L.TEAMS);
  const nicks = shuffle(rng, NICK_POOL).slice(0, L.TEAMS);
  const teams = [];
  let idx = 0;
  L.CONFS.forEach(function (conf, ci) {
    for (let d = 0; d < L.DIVS_PER_CONF; d++) {
      for (let t = 0; t < L.TEAMS_PER_DIV; t++) {
        const id = 't' + idx;
        const players = buildRoster(rng, id, idx);
        teams.push({
          id: id,
          name: cities[idx] + nicks[idx],
          city: cities[idx], nick: nicks[idx],
          conf: conf, div: conf + (d + 1),
          color: TEAM_COLORS[idx % TEAM_COLORS.length],
          players: players,
          tactics: { pace: '稳', offense: '均衡', defense: '盯人', rotation: '均衡' },
          lineup: players.slice(0, P.STARTING).map(function (p) { return p.id; }),
          wins: 0, losses: 0, pf: 0, pa: 0,
          seed: 0, alive: true, seriesWins: 0, seriesOpp: null
        });
        idx++;
      }
    }
  });
  return teams;
}

// 12 人名册：5 首发（覆盖 PG/SG/SF/PF/C）+ 7 替补
function buildRoster(rng, teamId, teamIdx) {
  const P = CONFIG.PLAYER;
  const startPos = ['PG', 'SG', 'SF', 'PF', 'C'];
  const benchPos = ['PG', 'SG', 'SF', 'PF', 'C', 'SF', 'PF'];
  const roster = [];
  let pid = 0;
  function mk(pos, tier) {
    const p = genPlayer(rng, { pos: pos, tier: tier, id: teamId + '_' + (pid++) });
    return p;
  }
  startPos.forEach(function (pos, i) {
    // 明星浓度随队序号微扰：前几队更强
    const tier = i === 0 ? 14 : 8;
    roster.push(mk(pos, tier));
  });
  benchPos.forEach(function (pos) { roster.push(mk(pos, -8)); });
  return roster;
}

function teamById(state, id) {
  return state.teams.find(function (t) { return t.id === id; });
}

if (typeof module !== 'undefined') {
  module.exports = { buildLeague, teamById, buildRoster };
}
