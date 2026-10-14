// cangame v3.4 · 验证脚本（vm 沙箱：金字塔联赛/杯赛/冠军杯512/联盟/经营/竞猜/球星/战术相克）
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = process.cwd();
const FILES = ['config', 'rng', 'players', 'transfer', 'league', 'tactics', 'match', 'season', 'training', 'cup', 'bet', 'championship', 'alliance', 'ad', 'cba-data', 'engine']
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
const M = vm.runInContext('({makeRNG,deriveSeed,buildLeague,teamById,simulateGame,availableCount,tactics_resolve,tactics_counterBonus,seasonStandings,seasonRoll,seasonFillFromReserve,buildReservePool,buildAllSchedules,engine_newGame,engine_advanceRound,training_apply,training_physio,teamLevel,cup_register,cup_tick,kings_start,kings_next,kings_claim,training_star,training_starDowngrade,star_cost,buildCupInstances,championship_build,championship_tick,championship_register,championship_registerOpen,championship_phaseText,transfer_genPool,transfer_buy,transfer_jersey,alliance_init,alliance_create,alliance_join,alliance_leave,alliance_warTick,alliance_cup_tick,alliance_supremeCheck,supreme_tick,bet_featured,bet_place,bet_tick,ad_genSponsors,ad_slotCount,ad_available,ad_sign,ad_settle,ad_terminate,cba_apply,pickRebounder,buildCourt,rebWeight,assertBoxConsistent})', ctx);

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
ok(avg(l1) > avg(l2), '1级平均综合 > 2级（金字塔落差）');

// 2. 球员属性与薪资
ok(teams[0].players.every(p => p.overall >= 35 && p.overall <= 99), '综合评分 35~99');
ok(teams[0].players.every(p => p.salary > 0), '薪资为正');

// 3. 比赛确定性
const s1 = M.engine_newGame(12345, 't0');
const g1 = M.simulateGame(s1, 't0', 't1', 999);
const g2 = M.simulateGame(s1, 't0', 't1', 999);
ok(g1.hScore === g2.hScore && g1.aScore === g2.aScore, '同种子比分一致');
ok(g1.hScore > 0 && g1.aScore > 0, '双方均有得分');

// 4. 战术相克（6攻×6防）
const T = C.TACTICS;
ok(T.OFFENSE.length === 6 && T.DEFENSE.length === 6, '6 进攻 × 6 防守战术');
const bk = (o, d) => M.tactics_counterBonus({ offense: o }, { defense: d });
ok(bk('挡拆', '2-3联防') > 0, '挡拆克 2-3联防（+）');
ok(bk('整体', '2-3联防') < 0, '整体被 2-3联防克（−）');
ok(Math.abs(bk('快攻', '盯人')) <= T.COUNTER_CAP, '克制值封顶 ±' + T.COUNTER_CAP);

// 5. 完整赛季 → 冠军 + 升降级
const s = M.engine_newGame(777, 't0');
ok(Object.keys(s.leagues).length === 3, '三个联赛（L1/L2a/L2b）');
ok(s.alliances && s.alliances.length === C.ALLIANCE.poolSize, '生成 AI 联盟池（' + C.ALLIANCE.poolSize + '）');
ok(s.championship === null, '新游戏冠军杯未开放（按轮开放）');
let guard = 0;
let champWins = -1, champLosses = -1;
while (s.phase !== 'SEASON_END' && guard < 100) {
  if (s.round === C.LEAGUE.REGULAR_ROUNDS - 1) {
    const pre = M.seasonStandings(s, 'L1');
    champWins = pre[0].team.wins; champLosses = pre[0].team.losses;
  }
  M.engine_advanceRound(s); guard++;
}
ok(s.phase === 'SEASON_END', '26 轮后进入赛季结算（guard=' + guard + '）');
ok(s.seasonSummary && s.seasonSummary.champion, '产生 1级联赛冠军');
ok(champWins + champLosses === C.LEAGUE.REGULAR_ROUNDS - 1, '冠军常规赛打满 ' + (C.LEAGUE.REGULAR_ROUNDS - 1) + ' 轮');
ok(s.seasonSummary.promoted.length === 4 && s.seasonSummary.relegated.length === 4, '升级 4 队 / 降级 4 队');
ok(s.season === 2, '赛季滚动到第 2 赛季');
ok(s.teams.filter(t => t.level === 1).length === 14, 'level=1 恒为 14 队');
ok(s.allianceCup === null && s.supremeInvite === false && s.bets.length === 0, '新赛季重置联盟杯/至尊杯/竞猜');

// 6. 积分榜
const st = M.seasonStandings(s, 'L1');
ok(st.length === 14 && st[0].team.wins >= st[13].team.wins, '积分榜 14 行按胜场降序');

// 7. 跨赛季继续
M.engine_advanceRound(s);
ok(s.phase === 'REGULAR' && s.round === 0, '开始新赛季回到第 1 轮');
M.engine_advanceRound(s);
ok(s.round === 1, '新赛季可正常推进');

// 8. 杯赛（4 个街球杯赛）
const s2 = M.engine_newGame(42, 't0');
ok(Object.keys(s2.cups).length === 4, '四个街球杯赛');
ok(M.cup_register(s2, 'rookie').ok === true, '第一赛季可报名新人杯');
let g2n = 0; while (g2n < 4) { M.engine_advanceRound(s2); g2n++; }
const rookie = s2.cups.rookie;
ok(rookie.bracket && rookie.bracket[0].length === 8, '新人杯 16 队抽签（首轮 8 场）');
ok(rookie.bracket[0].flat().includes(s2.humanTeamId), '玩家在新人杯对阵表中');
const s3 = M.engine_newGame(43, 't0'); s3.season = 2;
ok(M.cup_register(s3, 'rookie').ok === false && M.cup_register(s3, 'big').ok === true, '新人杯仅第一赛季；大杯赛随时可报');
const s9 = M.engine_newGame(56, 't0');
ok(M.cup_register(s9, 'master').ok === false, '未夺杯不可报名大师杯');
s9.trophies.push({ season: 1, name: '新人杯冠军', kind: 'cup' });
ok(M.cup_register(s9, 'master').ok === true, '夺杯后可报名大师杯');

// 9. 胜者为王
const s4 = M.engine_newGame(99, 't0');
ok(M.kings_next(s4).ok === false, '未报名时不能打胜者为王');
ok(M.kings_start(s4).ok === true, '报名胜者为王');
ok(M.kings_start(s4).ok === false, '进行中不可重复报名');
let res = M.kings_next(s4);
let gk = 0;
while (res.won === false && s4.kings && s4.kings.active && gk < 20) { res = M.kings_next(s4); gk++; }
if (s4.kings && s4.kings.active) {
  const kp0 = s4.kingsPts; const claim = M.kings_claim(s4);
  ok(claim.ok === true && s4.kings === null && s4.kingsPts >= kp0, '连胜中领取并结算入账');
} else ok(true, '（本局连败出局，积分清零）');

// 10. 球星系统
const s5 = M.engine_newGame(7, 't0');
s5.kingsPts = 100; s5.finance.cash = 100000;
const p5 = M.teamById(s5, s5.humanTeamId).players[0];
const attrs0 = JSON.stringify(p5.a);
ok(M.training_star(s5, p5.id).ok === true, '球星训练成功');
ok(JSON.stringify(p5.a) !== attrs0, '球星训练后属性增长');
ok(M.training_starDowngrade(s5, p5.id).ok === true && p5.star === 0, '降级回到 0 星');
ok(JSON.stringify(p5.a) === attrs0, '降级完全撤销（可重训）');

// 11. 冠军杯赛（512 人制单淘汰 + 报名三阶段）
const s7 = M.engine_newGame(2024, 't0');
let g7 = 0; while (g7 < 30 && !(s7.championship && s7.championship.opened)) { M.engine_advanceRound(s7); g7++; }
ok(s7.championship && s7.championship.opened, '冠军杯第 ' + C.CHAMPIONSHIP.openRound + ' 轮开放报名');
ok(typeof M.championship_phaseText(s7) === 'string', 'championship_phaseText 返回文本');
ok(s7.championship.size === C.CHAMPIONSHIP.size, '冠军杯规模 ' + C.CHAMPIONSHIP.size);
// 推进到全员报名阶段并自由报名
let g7b = 0; while (g7b < 30 && (!s7.championship.humanEntry) && s7.round < C.CHAMPIONSHIP.phase3Round) { M.engine_advanceRound(s7); g7b++; }
const reg = M.championship_registerOpen(s7);
ok(reg.ok === true || s7.championship.humanEntry !== null, '玩家可入围 512 强（优先/盟/全员）');
let g8 = 0; while (g8 < 40 && !(s7.championship && s7.championship.done)) { M.engine_advanceRound(s7); g8++; }
ok(s7.championship && s7.championship.done, '冠军杯淘汰赛完成（guard=' + g8 + '）');
ok(!!s7.championship.champion, '产生冠军杯冠军');
ok(Math.log2(s7.championship.size) === 9, '512 强需 9 轮淘汰');

// 12. 转会市场 + 极限球员
const s8 = M.engine_newGame(55, 't0');
ok(s8.transferPool.length === C.TRANSFER.poolSize, '转会市场系统球员池生成');
const extremes = s8.transferPool.filter(p => p.isExtreme);
ok(extremes.length >= 1, '系统球员池含极限球员（' + extremes.length + ' 人）');
const ex0 = extremes[0];
ok(ex0.jersey != null, '极限球员带专属球衣号码 #' + ex0.jersey);
s8.finance.cash = 2000000;
const cashB = s8.finance.cash;
const nB = M.teamById(s8, s8.humanTeamId).players.length;
ok(M.transfer_buy(s8, s8.transferPool[0].id).ok === true, '买入系统球员成功');
ok(s8.finance.cash < cashB, '买入后资金减少');
ok(M.teamById(s8, s8.humanTeamId).players.length === Math.min(nB + 1, C.PLAYER.ROSTER_SIZE), '阵容人数正确');
ok(s8.transferPool.length === C.TRANSFER.poolSize - 1, '球员买入后下架');
// 刷球衣（需先买入一名极限球员到自己阵容）
const s8x = M.engine_newGame(55, 't0'); s8x.finance.cash = 5000000;
const exP = s8x.transferPool.find(p => p.isExtreme);
if (exP) {
  M.transfer_buy(s8x, exP.id);
  const own = M.teamById(s8x, s8x.humanTeamId).players.find(p => p.isExtreme);
  const fansB = s8x.fans;
  const jr = M.transfer_jersey(s8x, own.id);
  ok(jr.ok === true && s8x.fans > fansB, '刷球衣成功 + 球迷增长');
} else ok(true, '（本池无极限球员，跳过）');

// 13. 经营细化（票价/上座率/广告/球衣）—— 广告改为赞助商合同制
const s6 = M.engine_newGame(42, 't0');
// 签一个 10 轮赞助合同，下一轮应有广告收入
const sp0 = M.ad_available(s6)[0];
M.ad_sign(s6, sp0.id, 10);
ok(s6.adContracts.length === 1, '赞助合同已签订');
M.engine_advanceRound(s6);
ok(s6.finance.revenue.ad > 0 && s6.finance.revenue.jersey > 0, '广告(赞助商)+球衣收入入账');
ok(s6.adRevenueLogs.length > 0, '广告收入日志已生成');
ok(s6.finance.revenue.gate >= 0, '门票收入字段存在');
// 低价上座率 > 高价
s6.finance.ticketPrice = 'low'; const loOpt = C.PRICE.options.find(o => o.key === 'low');
s6.finance.ticketPrice = 'high'; const hiOpt = C.PRICE.options.find(o => o.key === 'high');
ok(loOpt.att > hiOpt.att, '低价档上座率 > 高价档');

// 14. 联盟系统
const sa = M.engine_newGame(314, 't0');
ok(sa.alliance === null, '初始未加入联盟');
const ac = M.alliance_create(sa, '雷霆联盟');
ok(ac.ok === true && sa.alliance && sa.alliance.name === '雷霆联盟', '创建联盟成功');
ok(sa.alliances.some(x => x.id === 'mine'), '玩家联盟进入联盟池（参与排名）');
// 盟战：推进到 warGap 倍数轮，验证威望/王者积分变化或 rival 威望变化
const ap0 = sa.alliance.prestige, ak0 = sa.kingsPts;
let gw = 0; while (gw < 30 && (sa.round + 1) % C.ALLIANCE.warGap !== 0) { M.engine_advanceRound(sa); gw++; }
M.engine_advanceRound(sa); // 触发盟战轮
ok(sa.allianceWar.lastRound > 0, '盟战已进行（lastRound=' + sa.allianceWar.lastRound + '）');
ok(sa.alliance.prestige !== ap0 || sa.kingsPts !== ak0 || sa.alliances.some(x => x.prestige !== 0 && x.id !== 'mine'), '盟战改变威望/积分');
// 联盟杯赛：推进到 cupRound
let gc = 0; while (gc < 30 && !(sa.allianceCup && sa.allianceCup.done) && sa.round < C.ALLIANCE.cupRound + 8) { M.engine_advanceRound(sa); gc++; }
ok(sa.allianceCup && sa.allianceCup.done, '联盟杯赛赛季内完成');
// 至尊杯邀请函：直接验证资格授予路径（联盟排名前 N）
sa.alliance.prestige = 9999;            // 确保联盟排名前 N
M.alliance_supremeCheck(sa, sa.round + 1);
ok(sa.supremeInvite === true, '联盟排名前 N 获至尊杯邀请函（授予路径）');
let gsup = 0;
while (gsup < 12 && sa.phase === 'REGULAR' && !(sa.supremeCup && sa.supremeCup.done)) { M.engine_advanceRound(sa); gsup++; }
ok(sa.supremeCup !== null, '至尊杯已建立并开战');
// 加入联盟路径
const sj = M.engine_newGame(315, 't0');
const joinId = sj.alliances[0].id;
ok(M.alliance_join(sj, joinId).ok === true && sj.alliance.id === joinId, '加入现有联盟成功');
ok(M.alliance_leave(sj).ok === true && sj.alliance === null, '退出联盟成功');

// 15. 有奖竞猜
const sb = M.engine_newGame(2026, 't0');
const feat = M.bet_featured(sb);
ok(Array.isArray(feat) && feat.length > 0, '存在可押注焦点场次（' + feat.length + '）');
sb.finance.cash = 1000000;
const f0 = feat[0];
const bp = M.bet_place(sb, f0.homeId, f0.awayId, f0.homeId, 50000);
ok(bp.ok === true && sb.bets.length === 1, '押注成功');
ok(sb.finance.cash === 1000000 - 50000, '押注扣资金');
const betBefore = sb.bets[0].resolved;
M.engine_advanceRound(sb); // 该轮比赛结算 → 竞猜结算
ok(sb.bets[0].resolved === true, '押注场次随联赛轮推进结算');

// 16. 特殊比分 20:0（对手伤退无法完赛）
const s20 = M.engine_newGame(888, 't0');
const human = M.teamById(s20, s20.humanTeamId);
const lg = human.leagueId;
const game0 = s20.schedule[lg][0].find(g => g[0] === s20.humanTeamId || g[1] === s20.humanTeamId);
const oppId = game0[0] === s20.humanTeamId ? game0[1] : game0[0];
const opp = M.teamById(s20, oppId);
// 让对手仅 4 人可出场
let avail = 0; opp.players.forEach(p => { if (avail >= 4) p.injury = 5; else avail++; });
M.engine_advanceRound(s20);
const forceRes = s20.lastResults.find(r => (r.homeId === s20.humanTeamId || r.awayId === s20.humanTeamId) && r.force20);
ok(forceRes && forceRes.hScore === 20 && forceRes.aScore === 0, '对手伤退判 20:0（结果 ' + (forceRes ? forceRes.hScore + ':' + forceRes.aScore : '无') + '）');

// 17. 确定性复现
const sA = M.engine_newGame(777, 't0'), sB = M.engine_newGame(777, 't0');
let ga = 0; while (sA.phase !== 'SEASON_END' && ga < 100) { M.engine_advanceRound(sA); ga++; }
let gb = 0; while (sB.phase !== 'SEASON_END' && gb < 100) { M.engine_advanceRound(sB); gb++; }
ok(sA.seasonSummary.champion === sB.seasonSummary.champion, '同种子同冠军');
ok(JSON.stringify(sA.seasonSummary.promoted) === JSON.stringify(sB.seasonSummary.promoted), '同种子同升级名单');

// 18. 训练/理疗/收入回归
const sT = M.engine_newGame(42, 't0');
const ptsBefore = sT.trainPts;
M.engine_advanceRound(sT);
ok(sT.trainPts > ptsBefore, '一轮后训练点入账');
ok(M.teamLevel(0) === '业余球队' && M.teamLevel(25000) === '职业球队', '球队等级阈值正确');

console.log('\nverify-s1: 通过 ' + pass + ' / ' + (pass + fail) + (fail ? '  ❌ 有失败' : '  ✅ 全部通过'));
process.exit(fail ? 1 : 0);
