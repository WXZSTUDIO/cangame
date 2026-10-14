// cangame v3.2 · 联赛生成（XBA 金字塔：1级×14 + 2级×2×14 = 42 队虚构）
var CITY_POOL = ['江城', '云港', '朔北', '临海', '枫桥', '鹤城', '霖川', '岚州', '炽都', '银沙',
  '槐里', '砚台', '苍梧', '澜沧', '北芒', '霁月', '寒山', '汀州', '赤焰', '青冥',
  '梧州', '朔方', '锦官', '雁门', '沧澜', '麓山', '霂野', '曦和', '濯水', '岷源',
  '云梦', '白泽', '扶摇', '听涛', '望岳', '临溪', '栖霞', '照夜', '长陵', '安澜',
  '宁远', '靖海'];
var NICK_POOL = ['雄鹰', '猛虎', '烈焰', '苍狼', '雷霆', '飓风', '磐石', '猎鹰', '蛟龙', '锋刃',
  '骄阳', '寒星', '铁骑', '浪人', '苍穹', '锐士', '狂澜', '疾风', '玄铁', '破晓',
  '炽翼', '霜狼', '惊蛰', '银河', '烈风', '苍隼', '燎原', '渊渟', '骁骑', '曜石',
  '断岳', '流火', '鸣鸿', '逐日', '裂空', '踏雪', '追云', '镇岳', '擎天', '掠影',
  '横江', '镇海'];
var TEAM_COLORS = ['#ff7a3c', '#4ea8ff', '#6fcf7f', '#f2c14e', '#e26d6d', '#b98cff',
  '#39c5b0', '#ff9ecb', '#9fb0a8', '#ffd166', '#7c9cff', '#ef6f6c',
  '#5ec8a8', '#c0a36e', '#d98cff', '#6fd3ff', '#ffb085', '#a8d18d',
  '#e88f4d', '#8aa9ff', '#d3a0a0', '#7bd0c1', '#f0a85a', '#9b8cff',
  '#5fb0e0', '#e0c45f', '#cf7f9b', '#8fd08f', '#e09b6f', '#a0a8d8',
  '#8fd3e0', '#d8b4e0', '#b0d89b', '#e0a878', '#98a8e8', '#d8a0b0',
  '#78c8b8', '#e8c878', '#b898d8', '#88c8e8', '#e8b098', '#a8c8a8'];

// 联赛名（XBA：1级联赛为最高）
var LEAGUE_DEFS = [
  { id: 'L1', name: '1级联赛', level: 1 },
  { id: 'L2a', name: '2级联赛A组', level: 2 },
  { id: 'L2b', name: '2级联赛B组', level: 2 }
];

function buildLeague(rng) {
  const L = CONFIG.LEAGUE;
  const total = L.TEAMS_PER_LEAGUE * (L.LEVEL1_LEAGUES + L.LEVEL2_LEAGUES); // 42
  const cities = shuffle(rng, CITY_POOL).slice(0, total);
  const nicks = shuffle(rng, NICK_POOL).slice(0, total);
  const teams = [];
  let idx = 0;
  LEAGUE_DEFS.forEach(function (ld, li) {
    for (let t = 0; t < L.TEAMS_PER_LEAGUE; t++) {
      const id = 't' + idx;
      const players = buildRoster(rng, id, li * 100 + idx);
      teams.push({
        id: id,
        name: cities[idx] + nicks[idx],
        city: cities[idx], nick: nicks[idx],
        leagueId: ld.id, level: ld.level,
        color: TEAM_COLORS[idx % TEAM_COLORS.length],
        players: players,
        tactics: { offense: '整体', defense: '2-3联防', rotation: '均衡' },
        lineup: players.slice(0, 5).map(function (p) { return p.id; }),
        wins: 0, losses: 0, pf: 0, pa: 0,
        titles: 0   // 夺冠次数（跨赛季）
      });
      idx++;
    }
  });
  return teams;
}

// 12 人名册：5 首发（覆盖 PG/SG/SF/PF/C）+ 7 替补
// leagueIdx 决定明星浓度：1级联赛明显强于 2级（金字塔落差）
function buildRoster(rng, teamId, sortKey) {
  const leagueIdx = Math.floor(sortKey / 100);
  const baseTier = [10, -2, -6][leagueIdx] !== undefined ? [10, -2, -6][leagueIdx] : 0;
  const startPos = ['PG', 'SG', 'SF', 'PF', 'C'];
  const benchPos = ['PG', 'SG', 'SF', 'PF', 'C', 'SF', 'PF'];
  const roster = [];
  let pid = 0;
  startPos.forEach(function (pos, i) {
    const tier = baseTier + (i === 0 ? 6 : 0);
    roster.push(genPlayer(rng, { pos: pos, tier: tier, id: teamId + '_' + (pid++) }));
  });
  benchPos.forEach(function (pos) { roster.push(genPlayer(rng, { pos: pos, tier: baseTier - 8, id: teamId + '_' + (pid++) })); });
  return roster;
}

function teamById(state, id) {
  return state.teams.find(function (t) { return t.id === id; });
}

function leagueTeamIds(state, leagueId) {
  return state.leagues[leagueId].teamIds;
}

// 备用球队池（真实地名+队名，用于升降级空缺填充 / 低级别联赛）
// 注：队名为真实次级联赛/ABL 等公开队名；球员为占位数据，须 TODO 人工核对
var RESERVE_TEAM_NAMES = [
  ['石家庄', '翔蓝'], ['合肥', '狂风'], ['长沙', '勇胜'], ['武汉', '锟鹏'], ['广西', '威壮'],
  ['陕西', '信达'], ['安徽', '文一'], ['河南', '赊店老酒'], ['贵州', '森航'], ['重庆', '华熙'],
  ['佛山', '功夫小子'], ['东莞', '麻涌'], ['拉萨', '净土'], ['江苏', '国立'], ['江西', '鑫业'],
  ['河北', '翔蓝'], ['山西', '国投'], ['宁夏', '哈纳斯'], ['天津', '雄狮'], ['北京', '东方雄鹿']
];
function buildReservePool(rng) {
  return RESERVE_TEAM_NAMES.map(function (nm, i) {
    const id = 'r' + i;
    const players = buildRoster(rng, id, 250 + i); // 低级别（leagueIdx 2 → baseTier -6）
    return {
      id: id, name: nm[0] + nm[1], city: nm[0], nick: nm[1],
      leagueId: null, level: 2, color: TEAM_COLORS[i % TEAM_COLORS.length],
      players: players,
      tactics: { offense: '整体', defense: '2-3联防', rotation: '均衡' },
      lineup: players.slice(0, 5).map(function (p) { return p.id; }),
      wins: 0, losses: 0, pf: 0, pa: 0, titles: 0, isReserve: true
    };
  });
}

if (typeof module !== 'undefined') {
  module.exports = { buildLeague, teamById, buildRoster, leagueTeamIds, LEAGUE_DEFS, RESERVE_TEAM_NAMES, buildReservePool };
}
