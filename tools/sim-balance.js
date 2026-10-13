// cangame v3.2 · 平衡脚本（批量赛季：冠军分布 / 升降级流通 / 确定性）
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = process.cwd();
const FILES = ['config', 'rng', 'players', 'transfer', 'league', 'tactics', 'match', 'season', 'training', 'cup', 'bet', 'championship', 'alliance', 'engine']
  .map(n => 'assets/' + n + '.js');
const ctx = { console, Math, JSON, Date, isNaN, parseInt, parseFloat, Number, String, Array, Object, Boolean };
vm.createContext(ctx);
FILES.forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));
const M = vm.runInContext('({engine_newGame,engine_advanceRound,teamById})', ctx);
const C = vm.runInContext('CONFIG', ctx);

const N = parseInt(process.argv[2] || '50', 10);
const seedBase = parseInt(process.argv[3] || '1', 10);

const champCount = {};
let detOk = true, guardMax = 0, scoreSum = 0, gamesSum = 0;

function runSeason(seed, count) {
  const s = M.engine_newGame(seed, 't0');
  s.simQuiet = true; // 批量模式：跳过 play-by-play 字符串
  let g = 0;
  while (s.phase !== 'SEASON_END' && g < 100) { M.engine_advanceRound(s); g++; }
  guardMax = Math.max(guardMax, g);
  if (count && s.seasonSummary) {
    champCount[s.seasonSummary.champion] = (champCount[s.seasonSummary.champion] || 0) + 1;
    // 平均比分采样（1级联赛）
    const l1t = s.leagues.L1.teamIds.map(id => M.teamById(s, id));
    l1t.forEach(t => { const gp = t.wins + t.losses; if (gp) { scoreSum += t.pf / gp; gamesSum++; } });
  }
  return s;
}

for (let i = 0; i < N; i++) {
  runSeason((seedBase + i * 2654435761) >>> 0, true);
}
// 确定性：第 0 个种子跑两次
const a = runSeason(seedBase >>> 0, false), b = runSeason(seedBase >>> 0, false);
detOk = a.seasonSummary.champion === b.seasonSummary.champion &&
  JSON.stringify(a.seasonSummary.promoted) === JSON.stringify(b.seasonSummary.promoted);

const distinct = Object.keys(champCount).length;
const maxTeam = Object.keys(champCount).sort((x, y) => champCount[y] - champCount[x])[0];
const maxRate = maxTeam ? (champCount[maxTeam] / N * 100).toFixed(1) : '0';
const avgScore = gamesSum ? (scoreSum / gamesSum).toFixed(1) : '-';

console.log('=== cangame v3.4 平衡报告（金字塔联赛 + 冠军杯512 + 联盟 + 经营 + 竞猜） ===');
console.log('赛季数 N =', N, ' 种子基 =', seedBase);
console.log('不同冠军队伍数 =', distinct, '/ 14（1级联赛规模）');
console.log('最热队夺冠占比 =', maxRate + '%');
console.log('1级场均得分 =', avgScore);
console.log('最高推进 guard =', guardMax);
console.log('确定性（同种子同冠军同升降级）=', detOk ? '✅' : '❌');
const top = Object.keys(champCount).map(id => {
  const t = M.teamById(a, id);
  return [(t ? t.name : id), champCount[id]];
}).sort((x, y) => y[1] - x[1]).slice(0, 8);
console.log('冠军分布 Top8:', top.map(x => x[0] + ':' + x[1]).join('  '));
const balanced = parseFloat(maxRate) <= 45 && distinct >= 6;
console.log(balanced ? '✅ 平衡：冠军有竞争（策略布阵>先天强弱）' : '⚠ 需调参：冠军过度集中');

const out = { N, seedBase, distinct, maxRate, avgScore, guardMax, detOk, balanced, champCount };
fs.writeFileSync(path.join(ROOT, 'tools', 'sim-balance.last.json'), JSON.stringify(out, null, 2));
process.exit(0);
