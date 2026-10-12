// cangame v3 · 验证脚本（vm 沙箱，加载顺序同 index.html，不含 ui）
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = process.cwd();
const FILES = ['config', 'rng', 'players', 'league', 'tactics', 'match', 'season', 'engine']
  .map(n => 'assets/' + n + '.js');

const ctx = { console, Math, JSON, Date, isNaN, parseInt, parseFloat, Number, String, Array, Object, Boolean };
vm.createContext(ctx);
FILES.forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; }
  else { fail++; console.log('  ✗ ' + msg); }
}

const C = vm.runInContext('CONFIG', ctx);
const M = vm.runInContext('({makeRNG,deriveSeed,buildLeague,teamById,simulateGame,getLineup,tactics_resolve,tactics_counterBonus,seasonStandings,endRegular,engine_newGame,engine_advanceRound})', ctx);

// 1. 联赛生成
const teams = M.buildLeague(M.makeRNG(C.SEED_DEFAULT));
ok(teams.length === 30, '联赛 30 队');
ok(teams.every(t => t.players.length === 12), '每队 12 人名册');
ok(teams.every(t => new Set(t.lineup).size === 5), '每队 5 名首发（无重复）');
const posSet = new Set(teams[0].players.map(p => p.pos));
ok(['PG', 'SG', 'SF', 'PF', 'C'].every(p => posSet.has(p)), '位置覆盖 PG/SG/SF/PF/C');

// 2. 球员属性与评分
ok(teams[0].players.every(p => p.overall >= 35 && p.overall <= 99), '综合评分 35~99');
ok(teams[0].players.every(p => C.PLAYER.ATTRS.every(k => p.a[k] >= 35 && p.a[k] <= 99)), '十维属性 35~99');
ok(teams[0].players.every(p => p.salary > 0), '薪资为正');

// 3. 比赛确定性（同种子同结果）
const s1 = M.engine_newGame(12345, 't0');
const g1 = M.simulateGame(s1, 't0', 't1', 999);
const g2 = M.simulateGame(s1, 't0', 't1', 999);
ok(g1.hScore === g2.hScore && g1.aScore === g2.aScore, '同种子比分一致');
ok(JSON.stringify(g1.log) === JSON.stringify(g2.log), '同种子 play-by-play 一致');
ok(g1.log.length > 50, 'play-by-play 有内容（' + g1.log.length + ' 条）');
ok(g1.hScore > 0 && g1.aScore > 0, '双方均有得分');

// 4. 战术克制
const atkOut = { pace: '稳', offense: '外线', defense: '盯人', rotation: '均衡' };
const defZone = { pace: '稳', offense: '均衡', defense: '联防', rotation: '均衡' };
const defMan = { pace: '稳', offense: '均衡', defense: '盯人', rotation: '均衡' };
ok(M.tactics_counterBonus(atkOut, defZone) > M.tactics_counterBonus(atkOut, defMan), '外线打联防 命中加成 > 打盯人');

// 5. 完整赛季推进到冠军
const s = M.engine_newGame(777, 't0');
let guard = 0, sawPlayoff = false;
while (s.phase !== 'CHAMPION' && guard < 400) {
  M.engine_advanceRound(s); guard++;
  if (s.phase === 'PLAYOFF') sawPlayoff = true;
}
ok(sawPlayoff, '常规赛后进入季后赛');
ok(s.phase === 'CHAMPION', '最终产生冠军（guard=' + guard + '）');
ok(s.playoff && s.playoff.champion, '冠军队伍已确定：' + (s.playoff ? s.playoff.champion : '无'));
const champ = M.teamById(s, s.playoff.champion);
ok(champ.wins + champ.losses >= C.LEAGUE.REGULAR_ROUNDS, '冠军打满常规赛');

// 6. 积分榜有序
const st = M.seasonStandings(s);
ok(st[0].team.wins - st[0].team.losses >= st[29].team.wins - st[29].team.losses, '积分榜按胜场差降序');

// 7. 确定性复现（同种子同冠军）
const sA = M.engine_newGame(777, 't0'), sB = M.engine_newGame(777, 't0');
let ga = 0; while (sA.phase !== 'CHAMPION' && ga < 400) { M.engine_advanceRound(sA); ga++; }
let gb = 0; while (sB.phase !== 'CHAMPION' && gb < 400) { M.engine_advanceRound(sB); gb++; }
ok(sA.playoff.champion === sB.playoff.champion, '同种子同冠军（可复现存档）');

console.log('\nverify-s1: 通过 ' + pass + ' / ' + (pass + fail) + (fail ? '  ❌ 有失败' : '  ✅ 全部通过'));
process.exit(fail ? 1 : 0);
