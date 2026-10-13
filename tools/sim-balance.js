// cangame v3 · 平衡脚本（批量对局，统计冠军分布/比分/确定性）
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = process.cwd();
const FILES = ['config', 'rng', 'players', 'league', 'tactics', 'match', 'season', 'training', 'engine']
  .map(n => 'assets/' + n + '.js');
const ctx = { console, Math, JSON, Date, isNaN, parseInt, parseFloat, Number, String, Array, Object, Boolean };
vm.createContext(ctx);
FILES.forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));
const C = vm.runInContext('CONFIG', ctx);
const M = vm.runInContext('({engine_newGame,engine_advanceRound,teamById})', ctx);

const N = parseInt(process.argv[2] || '200', 10);
const seedBase = parseInt(process.argv[3] || '1', 10);

const champCount = {};
const teamO = {}; // 队名→平均综合
let totalGames = 0, scoreSum = 0, guardMax = 0;
let detOk = true;

// 确定性抽查
function runSeed(seed, count) {
  const s = M.engine_newGame(seed, 't0');
  let g = 0;
  while (s.phase !== 'CHAMPION' && g < 600) { M.engine_advanceRound(s); g++; }
  s.teams.forEach(function (t) {
    const gp = t.wins + t.losses; if (gp) { scoreSum += t.pf / gp; totalGames += gp; }
  });
  if (count && s.playoff && s.playoff.champion) champCount[s.playoff.champion] = (champCount[s.playoff.champion] || 0) + 1;
  guardMax = Math.max(guardMax, g);
  return s;
}

for (let i = 0; i < N; i++) {
  const seed = (seedBase + i * 2654435761) >>> 0;
  runSeed(seed, true);
}

// 确定性：第 0 个种子跑两次比对（不计入分布）
const a = runSeed((seedBase) >>> 0, false), b = runSeed((seedBase) >>> 0, false);
detOk = a.playoff.champion === b.playoff.champion;

const totalChamp = Object.values(champCount).reduce((x, y) => x + y, 0);
const distinct = Object.keys(champCount).length;
const avgChampPerTeam = (totalChamp / 30).toFixed(2);
// 集中度：最多冠军队伍占比
const maxTeam = Object.keys(champCount).sort((x, y) => champCount[y] - champCount[x])[0];
const maxRate = maxTeam ? (champCount[maxTeam] / N * 100).toFixed(1) : '0';

console.log('=== cangame v3 平衡报告 ===');
console.log('对局数 N =', N, ' 种子基 =', seedBase);
console.log('产生冠军的局数 =', totalChamp, ' 不同冠军队伍数 =', distinct, '/ 30');
console.log('平均每队夺冠次数 =', avgChampPerTeam, ' 最热队占比 =', maxRate + '%');
console.log('最高推进轮数 guard =', guardMax);
console.log('确定性（同种子同冠军）=', detOk ? '✅' : '❌');
// 冠军分布 top 8
const top = Object.keys(champCount).map(id => [M.teamById(a, id) ? M.teamById(a, id).name : id, champCount[id]])
  .sort((x, y) => y[1] - x[1]).slice(0, 8);
console.log('冠军分布 Top8:', top.map(x => x[0] + ':' + x[1]).join('  '));
const balanced = distinct >= 15 && parseFloat(maxRate) <= 18;
console.log(balanced ? '✅ 平衡：冠军分散、无垄断队' : '⚠ 失衡：冠军集中（需调参）');

const out = { N, seedBase, totalChamp, distinct, avgChampPerTeam, maxRate, guardMax, detOk, balanced, champCount };
fs.writeFileSync(path.join(ROOT, 'tools', 'sim-balance.last.json'), JSON.stringify(out, null, 2));
process.exit(0);
