// cangame v3.5 · 验收测试（篮板分布 / 轮换人数 / 比分统计一致 / 升降级）
// 对应需求：①PG 篮板异常 ②轮换 ③比分≠统计 ④职业联赛升降级
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = process.cwd();
const FILES = ['config', 'rng', 'players', 'transfer', 'league', 'tactics', 'match', 'season', 'training', 'cup', 'bet', 'championship', 'alliance', 'ad', 'cba-data', 'engine']
  .map(n => 'assets/' + n + '.js');
const ctx = { console, Math, JSON, Date, isNaN, parseInt, parseFloat, Number, String, Array, Object, Boolean };
vm.createContext(ctx);
FILES.forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));
const C = vm.runInContext('CONFIG', ctx);
const M = vm.runInContext('({makeRNG,deriveSeed,engine_newGame,simulateGame,teamById,seasonStandings,seasonRoll,seasonFillFromReserve,buildReservePool,ad_sign,ad_settle,pickRebounder})', ctx);
const teamById = M.teamById;

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) pass++; else { fail++; console.log('  ✗ ' + msg); } }
function band(x, lo, hi) { return x >= lo && x <= hi; }

// ============ 1. 篮板分布（1000 场，按位置场均）============
(function () {
  const s = M.engine_newGame(2026, 't0');
  const teams = s.teams;
  const sum = { PG: 0, SG: 0, SF: 0, PF: 0, C: 0 };
  const cnt = { PG: 0, SG: 0, SF: 0, PF: 0, C: 0 };
  const N = 1000;
  for (let i = 0; i < N; i++) {
    const a = teams[Math.floor((i * 7) % teams.length)];
    const b = teams[Math.floor((i * 13 + 3) % teams.length)];
    const g = M.simulateGame(s, a.id, b.id, 1000 + i);
    // 按“首发位置球员”统计（符合篮球常识的“位置场均”）
    [a, b].forEach(team => {
      team.lineup.forEach(id => {
        const row = (team.id === a.id ? g.hBox : g.aBox).players[id];
        if (row) { sum[row.pos] += row.reb; cnt[row.pos]++; }
      });
    });
  }
  const avg = {};
  ['PG', 'SG', 'SF', 'PF', 'C'].forEach(p => { avg[p] = cnt[p] ? sum[p] / cnt[p] : 0; });
  console.log('  篮板场均：', ['PG', 'SG', 'SF', 'PF', 'C'].map(p => p + '=' + avg[p].toFixed(1)).join('  '));
  ok(band(avg.C, 8, 15), 'C 场均篮板 8-15（实际 ' + avg.C.toFixed(1) + '）');
  ok(band(avg.PF, 6, 12), 'PF 场均篮板 6-12（实际 ' + avg.PF.toFixed(1) + '）');
  ok(band(avg.SF, 3, 7), 'SF 场均篮板 3-7（实际 ' + avg.SF.toFixed(1) + '）');
  ok(band(avg.SG, 2, 5), 'SG 场均篮板 2-5（实际 ' + avg.SG.toFixed(1) + '）');
  ok(band(avg.PG, 1, 4), 'PG 场均篮板 1-4（实际 ' + avg.PG.toFixed(1) + '）');
})();

// ============ 2. 轮换：每场 ≥8 人登场 ============
(function () {
  const s = M.engine_newGame(77, 't0');
  let minCount = 99, worst = 0;
  for (let i = 0; i < 30; i++) {
    const a = s.teams[i % s.teams.length], b = s.teams[(i + 5) % s.teams.length];
    const g = M.simulateGame(s, a.id, b.id, 5000 + i);
    const played = box => Object.keys(box.players).filter(pid => box.players[pid].min > 0).length;
    const n = played(g.hBox) + played(g.aBox);
    if (n < minCount) { minCount = n; worst = i; }
  }
  ok(minCount >= 8 * 2, '单场双方登场人数 ≥ 16（每队 ≥8），最少 ' + minCount + ' 人');
})();

// ============ 3. 比分 = 统计一致 ============
(function () {
  const s = M.engine_newGame(88, 't0');
  let bad = 0;
  for (let i = 0; i < 50; i++) {
    const a = s.teams[i % s.teams.length], b = s.teams[(i + 2) % s.teams.length];
    const g = M.simulateGame(s, a.id, b.id, 7000 + i);
    const sp = box => Object.keys(box.players).reduce((x, id) => x + box.players[id].pts, 0);
    if (sp(g.hBox) !== g.hScore || sp(g.aBox) !== g.aScore) bad++;
  }
  ok(bad === 0, '50 场比分 = 个人得分总和（不一致 ' + bad + ' 场）');
})();

// ============ 4. 职业联赛升降级 ============
(function () {
  const s = M.engine_newGame(99, 't0');
  // 人为排定战绩：L1 前高后低；L2 前 2 应升
  function setWins(leagueId, arr) {
    s.leagues[leagueId].teamIds.forEach((id, i) => {
      const t = teamById(s, id); t.wins = arr[i]; t.losses = 26 - arr[i]; t.pf = arr[i] * 100; t.pa = (26 - arr[i]) * 90;
    });
  }
  setWins('L1', [14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);     // 末 4 名 = 后 4
  setWins('L2a', [13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);     // 前 2 应升
  setWins('L2b', [13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);
  const l1Before = s.leagues.L1.teamIds.slice();
  const relegatedIds = l1Before.slice(-4);                  // 末 4
  const l2aBefore = s.leagues.L2a.teamIds.slice();
  const promotedIds = [l2aBefore[0], l2aBefore[1]];         // L2a 前 2
  M.seasonRoll(s, M.makeRNG(123));
  // 校验：被降级队现处于 2 级联赛
  const l1After = s.leagues.L1.teamIds;
  const l2After = s.leagues.L2a.teamIds.concat(s.leagues.L2b.teamIds);
  ok(relegatedIds.every(id => l2After.indexOf(id) >= 0), 'L1 末 4 名降级到 2 级');
  ok(promotedIds.every(id => l1After.indexOf(id) >= 0), 'L2a 前 2 名升级到 1 级');
  ok(l1After.length === 14 && s.leagues.L2a.teamIds.length === 14 && s.leagues.L2b.teamIds.length === 14, '三联赛各 14 队');
  ok(s.schedule && s.schedule.L1 && s.schedule.L1.length === C.LEAGUE.REGULAR_ROUNDS, '下赛季赛程已生成');
})();

// ============ 5. 备用球队池填充空缺 ============
(function () {
  const s = M.engine_newGame(123, 't0');
  const reserveBefore = s.reservePool.length;
  // 人为从 L2b 移除一队，制造空缺
  const removed = s.leagues.L2b.teamIds.pop();
  s.teams = s.teams.filter(t => t.id !== removed);
  M.seasonFillFromReserve(s);
  ok(s.leagues.L2b.teamIds.length === 14, 'L2b 空缺由备用球队补齐到 14');
  ok(s.reservePool.length === reserveBefore - 1, '备用池消耗 1 队');
})();

// ============ 6. CBA 队名骨架：42 队队名唯一（防队名池不足导致取模回绕重名） ============
(function () {
  const s = M.engine_newGame(2026, 't0');
  const names = s.teams.map(t => t.name);
  const uniq = new Set(names);
  ok(s.teams.length === 42, 'CBA 骨架共 42 队（实际 ' + s.teams.length + '）');
  ok(uniq.size === names.length, '42 队队名无重复（唯一 ' + uniq.size + ' / ' + names.length + '）');
  // 各联赛内也不重名
  let dupInLeague = 0;
  ['L1', 'L2a', 'L2b'].forEach(lg => {
    const ns = s.leagues[lg].teamIds.map(id => teamById(s, id).name);
    if (new Set(ns).size !== ns.length) dupInLeague++;
  });
  ok(dupInLeague === 0, '各联赛内队名无重复');
  // 占位球员必须标记待人工核对
  const marked = s.teams.every(t => t.players.every(p => p.todoVerify === true));
  ok(marked, '占位球员全部标记 todoVerify=true（非真实名单）');
})();

console.log('\nverify-v35: 通过 ' + pass + ' / ' + (pass + fail) + (fail ? '  ❌' : '  ✅'));
process.exit(fail ? 1 : 0);
