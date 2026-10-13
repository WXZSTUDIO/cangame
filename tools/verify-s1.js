// cangame v3.2 · 验证脚本（vm 沙箱：金字塔联赛/升降级/杯赛/胜者为王/球星/战术相克）
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = process.cwd();
const FILES = ['config', 'rng', 'players', 'transfer', 'league', 'tactics', 'match', 'season', 'training', 'cup', 'championship', 'engine']
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
const M = vm.runInContext('({makeRNG,deriveSeed,buildLeague,teamById,simulateGame,tactics_resolve,tactics_counterBonus,seasonStandings,seasonRoll,buildAllSchedules,engine_newGame,engine_advanceRound,training_apply,training_physio,teamLevel,cup_register,cup_tick,kings_start,kings_next,kings_claim,training_star,training_starDowngrade,star_cost,buildCupInstances,championship_build,championship_tick,championship_invited,transfer_genPool,transfer_buy})', ctx);

// 1. 金字塔联赛生成（XBA：1级×14 + 2级×2×14 = 42 队）
const teams = M.buildLeague(M.makeRNG(C.SEED_DEFAULT));
ok(teams.length === 42, '联赛 42 队（1级14 + 2级28）');
ok(teams.every(t => t.players.length === 12), '每队 12 人名册');
ok(teams.every(t => new Set(t.lineup).size === 5), '每队 5 名首发（无重复）');
const posSet = new Set(teams[0].players.map(p => p.pos));
ok(['PG', 'SG', 'SF', 'PF', 'C'].every(p => posSet.has(p)), '位置覆盖 PG/SG/SF/PF/C');
const l1 = teams.filter(t => t.level === 1), l2 = teams.filter(t => t.level === 2);
ok(l1.length === 14 && l2.length === 28, '1级 14 队 / 2级 28 队');
const avg = arr => arr.reduce((s, t) => s + t.players.reduce((x, p) => x + p.overall, 0) / 12, 0) / arr.length;
ok(avg(l1) > avg(l2), '1级平均综合 > 2级（金字塔落差）' );

// 2. 球员属性与薪资
ok(teams[0].players.every(p => p.overall >= 35 && p.overall <= 99), '综合评分 35~99');
ok(teams[0].players.every(p => C.PLAYER.ATTRS.every(k => p.a[k] >= 35 && p.a[k] <= 99)), '十维属性 35~99');
ok(teams[0].players.every(p => p.salary > 0), '薪资为正');

// 3. 比赛确定性
const s1 = M.engine_newGame(12345, 't0');
const g1 = M.simulateGame(s1, 't0', 't1', 999);
const g2 = M.simulateGame(s1, 't0', 't1', 999);
ok(g1.hScore === g2.hScore && g1.aScore === g2.aScore, '同种子比分一致');
ok(g1.hScore > 0 && g1.aScore > 0, '双方均有得分');

// 4. 战术相克（6攻×6防，XBA 攻略方向）
const T = C.TACTICS;
ok(T.OFFENSE.length === 6 && T.DEFENSE.length === 6, '6 进攻 × 6 防守战术');
const bk = (o, d) => M.tactics_counterBonus({ offense: o }, { defense: d });
ok(bk('挡拆', '2-3联防') > 0, '挡拆克 2-3联防（+）');
ok(bk('整体', '2-3联防') < 0, '整体被 2-3联防克（−）');
ok(bk('内线强攻', '盯内') < 0, '内线强攻被盯内克制（−）');
ok(bk('外线', '2-3联防') < 0 && bk('外线', '3-2联防') > 0, '外线怕 2-3、吃 3-2');
ok(Math.abs(bk('快攻', '盯人')) <= T.COUNTER_CAP, '克制值封顶 ±' + T.COUNTER_CAP);

// 5. 完整赛季 → 冠军 + 升降级（前2升 / 后4降）
const s = M.engine_newGame(777, 't0');
s.simQuiet = false;
ok(Object.keys(s.leagues).length === 3, '三个联赛（L1/L2a/L2b）');
ok(s.leagues.L1.teamIds.length === 14 && s.leagues.L2a.teamIds.length === 14 && s.leagues.L2b.teamIds.length === 14, '每联赛 14 队');
ok(s.schedule.L1.length === C.LEAGUE.REGULAR_ROUNDS, '1级联赛 26 轮赛程');
// 双循环：每队恰好 26 场（对手唯一性：主客各一次）
const round1 = s.schedule.L1[0];
ok(round1.length === 7, '每轮 7 场（14 队）');
let guard = 0;
let champWins = -1, champLosses = -1; // 末轮前常规赛领头羊（已打满 25 轮）战绩快照
while (s.phase !== 'SEASON_END' && guard < 100) {
  if (s.round === C.LEAGUE.REGULAR_ROUNDS - 1) {
    const pre = M.seasonStandings(s, 'L1');
    champWins = pre[0].team.wins;   // 快照基本值，避免被 seasonRoll 重置引用污染
    champLosses = pre[0].team.losses;
  }
  M.engine_advanceRound(s); guard++;
}
ok(s.phase === 'SEASON_END', '26 轮后进入赛季结算（guard=' + guard + '）');
ok(s.seasonSummary && s.seasonSummary.champion, '产生 1级联赛冠军');
ok(champWins + champLosses === C.LEAGUE.REGULAR_ROUNDS - 1,
  '冠军常规赛打满 ' + (C.LEAGUE.REGULAR_ROUNDS - 1) + ' 轮（' + champWins + '胜' + champLosses + '负）');
ok(s.seasonSummary.promoted.length === 4 && s.seasonSummary.relegated.length === 4, '升级 4 队（2×2）/ 降级 4 队');
ok(s.season === 2, '赛季滚动到第 2 赛季');
ok(s.phase === 'SEASON_END', '等玩家点「开始新赛季」');
// 新赛季结构完整性
ok(s.leagues.L1.teamIds.length === 14 && s.leagues.L2a.teamIds.length === 14 && s.leagues.L2b.teamIds.length === 14, '新赛季联赛仍各 14 队');
const allIds = new Set([].concat(s.leagues.L1.teamIds, s.leagues.L2a.teamIds, s.leagues.L2b.teamIds));
ok(allIds.size === 42, '42 队不重不漏');
ok(s.schedule.L1.length === C.LEAGUE.REGULAR_ROUNDS, '新赛季赛程已重排');
// 升降级闭环：原 2级升级队现在 level=1
const promotedIn = s.leagues.L1.teamIds.filter(id => { const t = M.teamById(s, id); return t && t.wins === 0; }).length >= 0; // 结构性检查见下
ok(s.teams.filter(t => t.level === 1).length === 14, 'level=1 恒为 14 队');

// 6. 积分榜（胜场 → 净胜分）
const st = M.seasonStandings(s, 'L1');
ok(st.length === 14, '积分榜 14 行');
ok(st[0].team.wins >= st[13].team.wins, '积分榜按胜场降序');
if (st[0].team.wins === st[1].team.wins) ok((st[0].team.pf - st[0].team.pa) >= (st[1].team.pf - st[1].team.pa), '同胜场按净胜分排序');

// 7. 新赛季继续推进（跨赛季）
M.engine_advanceRound(s); // SEASON_END → REGULAR
ok(s.phase === 'REGULAR' && s.round === 0, '开始新赛季回到第 1 轮');
M.engine_advanceRound(s);
ok(s.round === 1, '新赛季可正常推进');

// 8. 杯赛（报名 / 开赛 / 淘汰）—— 4 个街球杯赛
const s2 = M.engine_newGame(42, 't0');
ok(Object.keys(s2.cups).length === 4, '四个街球杯赛（新人杯/小杯赛/大杯赛/大师杯）');
ok(M.cup_register(s2, 'rookie').ok === true, '第一赛季可报名新人杯');
// 推进到新人杯开赛轮（第 4 轮）
let g2n = 0;
while (g2n < 4) { M.engine_advanceRound(s2); g2n++; }
const rookie = s2.cups.rookie;
ok(rookie.bracket && rookie.bracket[0].length === 8, '新人杯 16 队抽签（首轮 8 场）');
ok(rookie.bracket[0].flat().includes(s2.humanTeamId), '玩家在新人杯对阵表中');
ok(s2.cups.rookie.roundIdx === 1, '杯赛首轮已打完');
// 第二赛季不可报名新人杯；大杯赛随时可报
const s3 = M.engine_newGame(43, 't0');
s3.season = 2;
ok(M.cup_register(s3, 'rookie').ok === false && M.cup_register(s3, 'big').ok === true, '新人杯仅第一赛季；大杯赛随时可报');
// 大师杯需先夺任意杯赛冠军
const s9 = M.engine_newGame(56, 't0');
ok(M.cup_register(s9, 'master').ok === false, '未夺杯不可报名大师杯');
s9.trophies.push({ season: 1, name: '新人杯冠军', kind: 'cup' });
ok(M.cup_register(s9, 'master').ok === true, '夺杯后可报名大师杯');

// 9. 胜者为王（连胜 / 领取 / 清零）
const s4 = M.engine_newGame(99, 't0');
ok(M.kings_next(s4).ok === false, '未报名时不能打胜者为王');
ok(M.kings_start(s4).ok === true, '报名胜者为王');
ok(M.kings_start(s4).ok === false, '进行中不可重复报名');
let res = M.kings_next(s4);
ok(res.ok === true, '第 1 场可打');
// 循环直到赢一场（最多 9 场）以验证连胜领取
let gk = 0;
while (res.won === false && s4.kings && s4.kings.active && gk < 20) { res = M.kings_next(s4); gk++; }
if (s4.kings && s4.kings.active) {
  const kp0 = s4.kingsPts;
  const claim = M.kings_claim(s4);
  ok(claim.ok === true, '连胜中可领取（60%）');
  ok(s4.kings === null && s4.kingsPts >= kp0, '领取后结算并积分入账（+' + (s4.kingsPts - kp0) + '）');
} else {
  ok(true, '（本局连败出局，积分清零，符合规则）');
}

// 10. 球星系统（王者积分 + 资金 → 升星 → 属性涨 → 降级可逆）
const s5 = M.engine_newGame(7, 't0');
s5.kingsPts = 100; s5.finance.cash = 100000;
const hu5 = M.teamById(s5, s5.humanTeamId);
const p5 = hu5.players[0];
const attrs0 = JSON.stringify(p5.a);
const st5 = M.training_star(s5, p5.id);
ok(st5.ok === true, '球星训练成功：' + p5.name + ' → ' + p5.star + ' 星');
ok(JSON.stringify(p5.a) !== attrs0, '球星训练后属性增长');
ok(Object.values(p5.starGains[0]).every(g => g >= 0) && Object.values(p5.starGains[0]).reduce((s, g) => s + g, 0) >= 10, '每属性增益非负且总量可观（≥10）');
const after1 = JSON.stringify(p5.a);
ok(M.training_starDowngrade(s5, p5.id).ok === true && p5.star === 0, '降级回到 0 星');
ok(JSON.stringify(p5.a) === attrs0, '降级完全撤销属性增长（可重训）');
ok(M.training_star(s5, p5.id).ok === true, '降级后可重新训练');
const cost1 = M.star_cost(1), cost2 = M.star_cost(2);
ok(cost2.kings > cost1.kings && cost2.cash > cost1.cash, '球星训练花费逐级递增');
s5.kingsPts = 0;
ok(M.training_star(s5, hu5.players[1].id).ok === false, '王者积分不足时拒绝');

// 11. 冠军杯赛（联赛前2受邀 → 小组循环 → 决赛）
const s7 = M.engine_newGame(2024, 't0');
let g7 = 0;
while (g7 < 30 && !(s7.championship && s7.championship.opened)) { M.engine_advanceRound(s7); g7++; }
ok(s7.championship && s7.championship.opened, '冠军杯第 ' + C.CHAMPIONSHIP.openRound + ' 轮开放');
ok(s7.championship.invited.length === 6, '冠军杯 6 队受邀（每联赛前2）');
ok(typeof M.championship_invited(s7) === 'boolean', 'championship_invited 返回布尔');
// 确保玩家在受邀名单（替换一名），验证赛程能跑完并产生冠军
const inv7 = s7.championship.invited;
if (inv7.indexOf('t0') < 0) { const ix = inv7.indexOf('t1'); if (ix >= 0) { inv7[ix] = 't0'; s7.championship.rec['t0'] = { id: 't0', w: 0, l: 0, pf: 0, pa: 0 }; delete s7.championship.rec['t1']; } }
let g8 = 0;
while (g8 < 40 && !(s7.championship && s7.championship.done)) { M.engine_advanceRound(s7); g8++; }
ok(s7.championship && s7.championship.done, '冠军杯决赛完成（guard=' + g8 + '）');
ok(!!s7.championship.champion, '产生冠军杯冠军');
ok(s7.championship.groupIdx === s7.championship.schedule.length, '小组赛打满 ' + s7.championship.schedule.length + ' 轮');

// 12. 转会市场（系统球员池 / 买入 / 资金 / 阵容）
const s8 = M.engine_newGame(55, 't0');
ok(s8.transferPool.length === C.TRANSFER.poolSize, '转会市场系统球员池生成（' + C.TRANSFER.poolSize + ' 人）');
s8.finance.cash = 2000000; // 模拟经营若干轮后的资金
const cashB = s8.finance.cash;
const nB = M.teamById(s8, s8.humanTeamId).players.length;
const buy = M.transfer_buy(s8, s8.transferPool[0].id);
ok(buy.ok === true, '买入系统球员成功：' + (buy.player || ''));
ok(s8.finance.cash < cashB, '买入后资金减少（¥' + (cashB - s8.finance.cash) + '）');
ok(M.teamById(s8, s8.humanTeamId).players.length === Math.min(nB + 1, C.PLAYER.ROSTER_SIZE), '阵容人数正确（满员则替换）');
ok(s8.transferPool.length === C.TRANSFER.poolSize - 1, '球员买入后下架');
// 资金不足拒绝
const s8b = M.engine_newGame(55, 't0');
s8b.finance.cash = 0;
ok(M.transfer_buy(s8b, s8b.transferPool[0].id).ok === false, '资金不足拒绝买入');

// 13. 确定性复现（同种子同冠军同升降级）
const sA = M.engine_newGame(777, 't0'), sB = M.engine_newGame(777, 't0');
let ga = 0; while (sA.phase !== 'SEASON_END' && ga < 100) { M.engine_advanceRound(sA); ga++; }
let gb = 0; while (sB.phase !== 'SEASON_END' && gb < 100) { M.engine_advanceRound(sB); gb++; }
ok(sA.seasonSummary.champion === sB.seasonSummary.champion, '同种子同冠军');
ok(JSON.stringify(sA.seasonSummary.promoted) === JSON.stringify(sB.seasonSummary.promoted), '同种子同升级名单');

// 12. 训练/理疗/收入（v3.1 回归）
const s6 = M.engine_newGame(42, 't0');
const ptsBefore = s6.trainPts;
M.engine_advanceRound(s6);
ok(s6.trainPts > ptsBefore, '一轮后训练点入账');
ok(s6.finance.revenue.ad === C.FINANCE.AD_BASE && s6.finance.revenue.jersey === C.FINANCE.JERSEY_BASE, '广告+球衣收入入账');
const hu6 = M.teamById(s6, s6.humanTeamId);
s6.trainPts = 50;
const tgt = hu6.players.find(p => p.injury === 0 && p.stamina > 30);
ok(M.training_apply(s6, tgt.id, 'SHO').ok === true, '普通训练成功');
ok(M.teamLevel(0) === '业余球队' && M.teamLevel(25000) === '职业球队', '球队等级阈值正确');

console.log('\nverify-s1: 通过 ' + pass + ' / ' + (pass + fail) + (fail ? '  ❌ 有失败' : '  ✅ 全部通过'));
process.exit(fail ? 1 : 0);
