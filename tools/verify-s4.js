/* cangame v2 · Sprint 4 验证（沿用仓库 vm 沙箱模式）
 * vm.createContext({console,Math,JSON,Date,window,document,localStorage})
 *   → 按 13 文件 defer 顺序 runInContext（含 ai / leader）→ 断言。
 * 覆盖（§5 AI 行为树 + §2.3 领袖选举，Sprint 4）：
 *   1) 初始化：13 玩家均赋予 personality 且人类阵营领袖=玩家；同 seed 可复现
 *   2) 生产决策确定性：risky 领袖 +1 决策（封顶区间上限）
 *   3) 贸易决策：对头拒单(aiWouldTrade) + aiDecideTrade 挂单确定性
 *   4) 战争决策：hard rule + war 权重偏置(>0.6) + 防背刺 + 复仇优先 + 确定性
 *   5) 背叛规则：盟友毁约 && 收益×背叛权重>维系成本 → betray；否则不背叛 + 执行落地
 *   6) 生存淘汰：贪狼自保（自身不被选）/ 复仇压对头
 *   7) 领袖选举：多人选出 leaderId / 单人=本人 / 人类=玩家 / 可复现 / 提案生成
 *   8) 端到端：ai 加载下空转至终局不崩、提案非空
 *   9) 回归：verify-s1 / verify-s2 / verify-s3 仍全绿
 * 目标：≥30 条断言，全绿。
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');

// 最小 DOM 桩：ui.js 仅在 DOMContentLoaded 真正派发时才跑 boot()；
// 这里 readyState='loading'，boot 不触发，ui.js 在 vm 中 inert。
const fakeEl = () => ({
  style: {}, classList: { add() {}, remove() {} },
  appendChild() {}, setAttribute() {}, addEventListener() {},
  set innerHTML(_) {}, get innerHTML() { return ''; }
});
const ctx = {
  console, Math, JSON, Date, isNaN, parseInt, parseFloat, Number, String, Array, Object,
  window: { addEventListener() {} },
  document: {
    readyState: 'loading',
    addEventListener() {},
    getElementById() { return null; },
    querySelectorAll() { return []; },
    querySelector() { return null; },
    createElement() { return fakeEl(); },
    body: null, documentElement: null
  },
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  alert: function () {}
};
vm.createContext(ctx);

// Sprint 4 终态顺序（ADR-3）：config→rng→state→factions→resource→ai→leader→production→economy→war→settle→engine→ui
['assets/config.js', 'assets/rng.js', 'assets/state.js', 'assets/factions.js', 'assets/resource.js',
 'assets/ai.js', 'assets/leader.js', 'assets/production.js', 'assets/economy.js', 'assets/war.js',
 'assets/settle.js', 'assets/engine.js', 'assets/ui.js']
  .forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));

// 暴露需要的符号。
const M = vm.runInContext('({' +
  'createGameState, serializeGameState, advancePhase, endDay, endPhase, runAIDecisions, createEngine,' +
  'CONFIG, PHASES, makeRNG, transferResource, canAfford, pushLog,' +
  'leader, ai, electLeader, aiChooseVictims, settleDay, declareWar, war, economy, production,' +
  'signAgreement, breakAgreement' +
 '})', ctx);

let fail = 0, pass = 0;
const ok = (cond, name, extra) => {
  if (cond) { pass++; console.log('  ✓', name, extra == null ? '' : extra); }
  else { fail++; console.log('  ✗', name, extra == null ? '' : extra); }
};
const fac = (s, id) => s.factions.find(f => f.id === id);
const humanOf = (s) => s.players.find(p => p.isHuman && p.alive);
const KNOWN_TYPES = ['greedy', 'steady', 'risky', 'vengeful', 'opportunist', 'lone'];
const WKEYS = ['prod', 'trade', 'war', 'betray'];

// 设定某阵营领袖的性格（type + 显式权重），便于确定性测试。
function setLeader(s, fid, type, weights) {
  const f = fac(s, fid);
  const ld = s.players[f.leaderId];
  ld.personality = { type: type, weights: weights };
  return f;
}

// ===== 1. 初始化：personality + 人类领袖 + 可复现 =====
console.log('== 1. 初始化 / 可复现 ==');
{
  const s = M.createGameState(123);
  // 13 人均有合法 personality
  const allHave = s.players.length === 13 &&
    s.players.every(p => KNOWN_TYPES.indexOf(p.personality.type) >= 0 &&
      WKEYS.every(k => typeof p.personality.weights[k] === 'number' &&
        p.personality.weights[k] >= 0 && p.personality.weights[k] <= 1));
  ok(allHave, '13 名玩家均赋予合法 personality（type∈6类 / 权重∈[0,1]）');

  // 权重保留 2 位小数（jitter 已夹紧）
  const rounded = s.players.every(p => WKEYS.every(k =>
    Math.round(p.personality.weights[k] * 100) / 100 === p.personality.weights[k]));
  ok(rounded, '性格权重确定性夹紧（2 位小数）');

  // 人类阵营领袖 = 玩家
  const hf = fac(s, s.humanFactionId);
  ok(hf.leaderId === humanOf(s).id, '人类阵营领袖 = 玩家本人', s.humanFactionId + ' → ' + hf.leaderId);

  // 同 seed 可复现（personality + 领袖 + 提案）
  const a = M.createGameState(123), b = M.createGameState(123);
  ok(JSON.stringify(a.players.map(p => p.personality)) === JSON.stringify(b.players.map(p => p.personality)),
    '同 seed → 性格分配完全一致（可复现）');
  ok(a.factions.every(f => f.leaderId === b.factions.find(x => x.id === f.id).leaderId),
    '同 seed → 领袖选举完全一致（可复现）');
  ok(a.leaderProposals.length === b.leaderProposals.length && a.leaderProposals.length >= 1,
    '同 seed → 领袖提案数量一致且非空', 'proposals=' + a.leaderProposals.length);
}

// ===== 2. 生产决策确定性（§5.4① risky +1，封顶区间上限）=====
console.log('== 2. 生产决策（risky +1）==');
{
  const s = M.createGameState(7);
  const fRisky = { id: 'x', leaderId: 0 };
  const fSteady = { id: 'y', leaderId: 1 };
  s.players[0] = { id: 0, alive: true, personality: { type: 'risky', weights: { prod: 0.5, trade: 0.5, war: 0.9, betray: 0.5 } } };
  s.players[1] = { id: 1, alive: true, personality: { type: 'steady', weights: { prod: 0.8, trade: 0.3, war: 0.1, betray: 0.2 } } };
  ok(M.ai.productionBonus(s, fRisky) === 1, '冒险(risky)领袖 → 生产 +1 决策');
  ok(M.ai.productionBonus(s, fSteady) === 0, '守成(steady)领袖 → 生产 +0 决策');

  // 集成：red 领袖默认 risky（pool[0]=risky），goodsMax=1 → 封顶，delta ≤ 1
  // 注意：production.runAll 一次性处理全部非人类阵营，故 red/white 基线须在其前捕获。
  const s2 = M.createGameState(2024); s2.humanFactionId = 'black'; s2.phase = 'TRADING';
  const red = fac(s2, 'red'); const rg0 = red.goods;
  const white = fac(s2, 'white'); const wg0 = white.goods;
  M.production.runAll(s2);
  const d = red.goods - rg0;
  ok(d >= 0 && d <= 1, 'red（risky 领袖）AI 产出仍封顶区间上限（delta ≤ 1）', 'delta=' + d);
  // 白队（守成领袖）不受 +1 影响，仍落在产能区间内（v2.0.1 为 6~10，由 CONFIG 推导）
  const pw = M.CONFIG.PRODUCTION.white;
  ok(white.goods - wg0 >= pw.goodsMin && white.goods - wg0 <= pw.goodsMax,
    '白队（守成领袖）产出落 ' + pw.goodsMin + '~' + pw.goodsMax + ' 区间', 'delta=' + (white.goods - wg0));
}

// ===== 3. 贸易决策（§5.4② 对头拒单 + 挂单确定性）=====
console.log('== 3. 贸易决策 ==');
{
  const s = M.createGameState(11); s.humanFactionId = 'black'; s.phase = 'WAR';
  // 对头拒单：蓝队领袖记仇白队 → 拒绝与白队成交
  const blue = fac(s, 'blue');
  s.players[blue.leaderId].memory.grudges = ['white'];
  ok(M.ai.wouldTrade(s, 'blue', 'white') === false, '记仇对头（白队）→ 拒绝成交');
  ok(M.ai.wouldTrade(s, 'blue', 'red') === true, '非对头（红队）→ 允许成交');

  // aiDecideTrade 挂单确定性：两次独立同盘面 → 挂单结构完全一致（忽略自增 id）
  const buildTrade = () => {
    const st = M.createGameState(909); st.humanFactionId = 'black'; st.phase = 'WAR';
    // 让 AI 阵营缺药 → 触发急购挂单
    ['white', 'blue', 'red'].forEach(id => { fac(st, id).life = 0; fac(st, id).goods = 2; fac(st, id).won = 20; });
    M.ai.decideTrade(st);
    return st.market.orders.map(o => ({ side: o.side, factionId: o.factionId, goodsType: o.goodsType, qty: o.qty, price: o.price }));
  };
  const o1 = buildTrade(), o2 = buildTrade();
  ok(JSON.stringify(o1) === JSON.stringify(o2), 'aiDecideTrade 同盘面 → 挂单结构完全一致（确定性）');
  ok(o1.length === 3, '三 AI 阵营各挂 1 单（缺药急购）', 'orders=' + o1.length);
  // 价格随 trade 权重浮动：所有挂单价格在 [4,6]（base 5 ±20%）区间内
  const pricesOk = o1.every(o => o.price >= 4 && o.price <= 6);
  ok(pricesOk, '挂单价格在 base×±20% 区间内（4~6）', JSON.stringify(o1.map(o => o.price)));

  // 价格浮动方向：高 trade 权重→偏贵，低 trade 权重→偏低（确定性可测）
  const sHi = M.createGameState(5), sLo = M.createGameState(5);
  sHi.humanFactionId = 'black'; sLo.humanFactionId = 'black'; sHi.phase = 'WAR'; sLo.phase = 'WAR';
  setLeader(sHi, 'white', 'greedy', { prod: 0.6, trade: 0.95, war: 0.5, betray: 0.9 }); // 高 trade
  setLeader(sLo, 'white', 'steady', { prod: 0.8, trade: 0.05, war: 0.1, betray: 0.2 }); // 低 trade
  [sHi, sLo].forEach(st => { fac(st, 'white').life = 0; fac(st, 'white').goods = 2; fac(st, 'white').won = 20; });
  M.ai.decideTrade(sHi); M.ai.decideTrade(sLo);
  const pHi = sHi.market.orders.find(o => o.factionId === 'white').price;
  const pLo = sLo.market.orders.find(o => o.factionId === 'white').price;
  ok(pHi > pLo, '高 trade 权重挂单价 > 低 trade 权重（±20% 浮动生效）', pHi + ' > ' + pLo);
}

// ===== 4. 战争决策（§5.4③/④ hard rule + 权重偏置 + 防背刺）=====
console.log('== 4. 战争决策 ==');
{
  // day < 解锁 → 必不宣战
  const s0 = M.createGameState(2024); s0.humanFactionId = 'black'; s0.day = 1; s0.phase = 'WAR';
  setLeader(s0, 'red', 'risky', { prod: 0.5, trade: 0.6, war: 0.9, betray: 0.6 });
  ok(M.ai.decideWar(s0, fac(s0, 'red')) === null, 'day<解锁日 → 不宣战（强制）');

  // 构造可控盘面：day=2，目标贫弱（使 aiWantWar 硬规则返回 null，单独检验性格偏置）
  function warBoard() {
    const s = M.createGameState(2024); s.humanFactionId = 'black'; s.day = 2; s.phase = 'WAR';
    ['white', 'red'].forEach(id => { fac(s, id).goods = 1; fac(s, id).won = 1; }); // 贫弱
    fac(s, 'black').goods = 1; fac(s, 'black').won = 1;
    fac(s, 'blue').won = 30; // 可负担宣战费 18
    return s;
  }
  // war 权重 0.3（低于阈值 0.6）→ 无硬规则命中 → 不宣战
  const sLow = warBoard();
  setLeader(sLow, 'blue', 'steady', { prod: 0.8, trade: 0.3, war: 0.3, betray: 0.2 });
  ok(M.ai.decideWar(sLow, fac(sLow, 'blue')) === null, 'war 权重 0.3(<0.6) 且无非硬规则 → 不宣战');

  // war 权重 0.9（>0.6）→ 偏置宣战，目标为某存活非自身阵营
  const sHi = warBoard();
  setLeader(sHi, 'blue', 'risky', { prod: 0.5, trade: 0.6, war: 0.9, betray: 0.6 });
  const dHi = M.ai.decideWar(sHi, fac(sHi, 'blue'));
  ok(dHi && dHi.target && dHi.target !== 'blue', 'war 权重 0.9(>0.6) → 偏置宣战（目标非自身）', JSON.stringify(dHi));

  // 防背刺：目标为「未破裂协议盟友」→ 即便权重高也不宣战
  const sAlly = warBoard();
  setLeader(sAlly, 'blue', 'risky', { prod: 0.5, trade: 0.6, war: 0.9, betray: 0.6 });
  fac(sAlly, 'white').goods = 50; fac(sAlly, 'white').won = 50; // 让 white 成为最肥目标
  M.signAgreement(sAlly, 'blue', 'white', 'nonaggression');      // 未破裂盟友
  ok(M.ai.decideWar(sAlly, fac(sAlly, 'blue')) === null, '对「未破裂协议盟友」避免背刺式宣战（返回 null）');

  // 确定性：同盘面两次决策 JSON 一致
  const sDet = warBoard();
  setLeader(sDet, 'blue', 'risky', { prod: 0.5, trade: 0.6, war: 0.9, betray: 0.6 });
  const j1 = JSON.stringify(M.ai.decideWar(sDet, fac(sDet, 'blue')));
  const j2 = JSON.stringify(M.ai.decideWar(sDet, fac(sDet, 'blue')));
  ok(j1 === j2, 'aiDecideWar 同盘面 → decisionJSON 完全一致（确定性）');
}

// ===== 5. 背叛规则（§5.4④ 盟友毁约 + 收益阈值）=====
console.log('== 5. 背叛规则 ==');
{
  // 构造：blue×red 签互不侵犯，red 毁约(breachedBy='red')；blue 贪狼高背叛权重
  const mk = () => {
    const s = M.createGameState(2024); s.humanFactionId = 'black'; s.day = 2; s.phase = 'WAR';
    setLeader(s, 'blue', 'greedy', { prod: 0.6, trade: 0.9, war: 0.5, betray: 0.9 });
    const ag = M.signAgreement(s, 'blue', 'red', 'nonaggression');
    M.breakAgreement(s, ag.id, 'red'); // red 毁约
    return s;
  };
  // 富 red → 收益足 → 背叛
  const sRich = mk(); fac(sRich, 'red').goods = 20; fac(sRich, 'red').won = 25;
  const dRich = M.ai.decideBetray(sRich, fac(sRich, 'blue'));
  ok(dRich && dRich.action === 'betray' && dRich.target === 'red',
    '盟友毁约 + 收益达阈值 → 输出 betray(目标=毁约方)', JSON.stringify(dRich));

  // 穷 red → 收益不足 → 不背叛
  const sPoor = mk(); fac(sPoor, 'red').goods = 1; fac(sPoor, 'red').won = 1;
  const dPoor = M.ai.decideBetray(sPoor, fac(sPoor, 'blue'));
  ok(dPoor === null, '盟友毁约但收益不足 → 不背叛');

  // 无毁约协议 → 不背叛
  const sNone = M.createGameState(2024); sNone.humanFactionId = 'black';
  setLeader(sNone, 'blue', 'greedy', { prod: 0.6, trade: 0.9, war: 0.5, betray: 0.9 });
  fac(sNone, 'red').goods = 20; fac(sNone, 'red').won = 25;
  ok(M.ai.decideBetray(sNone, fac(sNone, 'blue')) === null, '无毁约记录 → 不背叛');

  // 确定性
  const sDet = mk(); fac(sDet, 'red').goods = 20; fac(sDet, 'red').won = 25;
  ok(JSON.stringify(M.ai.decideBetray(sDet, fac(sDet, 'blue'))) ===
     JSON.stringify(M.ai.decideBetray(sDet, fac(sDet, 'blue'))),
    'aiDecideBetray 同盘面 → decisionJSON 一致（确定性）');

  // 执行落地：aiDecideAll('MORNING') 触发背叛 → 记入 memory.grudges + 日志
  const sExe = mk(); fac(sExe, 'red').goods = 20; fac(sExe, 'red').won = 25;
  const before = sExe.log.length;
  M.ai.decideAll(sExe, 'MORNING');
  const blueLd = sExe.players[fac(sExe, 'blue').leaderId];
  ok(blueLd.memory.grudges.indexOf('red') >= 0, '背叛执行 → blue 将 red 记入 grudges');
  ok(sExe.log.length > before && sExe.log.some(l => l.text.indexOf('背叛') >= 0), '背叛执行 → 写入日志');
}

// ===== 6. 生存淘汰（§5.4④ 贪狼自保 / 复仇压对头）=====
console.log('== 6. 生存淘汰 ==');
{
  // 构造最小盘面（不依赖 createGameState 的随机）
  const mkF = (defs) => {
    const s = { seed: 1, day: 1, phase: 'SETTLEMENT', factions: [], players: [], market: { agreements: [] }, config: M.CONFIG };
    s.players = defs.map(d => ({
      id: d.id, alive: true, scoreBase: d.sb,
      personality: { type: d.type, weights: { prod: 0.5, trade: 0.5, war: 0.5, betray: 0.5 } },
      memory: { agreements: [], grudges: d.gr || [], lastWarDay: 0 }
    }));
    const ids = defs.map(d => d.id);
    s.factions.push({ id: 'white', name: '白队', popAlive: ids.length, playerIds: ids, alive: true,
      requiredLife: 0, deficit: 0, leaderId: ids[0] });
    return s;
  };

  // 贪狼自保：贪狼(sb=1) 不应被选，即使自身分最低
  const sG = mkF([
    { id: 0, type: 'greedy', sb: 1 }, { id: 1, type: 'steady', sb: 5 },
    { id: 2, type: 'steady', sb: 10 }, { id: 3, type: 'steady', sb: 20 }, { id: 4, type: 'steady', sb: 30 }
  ]);
  const gVic = M.ai.chooseVictims(sG, sG.factions[0], 2);
  ok(gVic.indexOf(0) < 0, '缺药时贪狼自身不被选为淘汰对象', JSON.stringify(gVic));
  ok(gVic.length === 2 && gVic.indexOf(1) >= 0, '淘汰落到低分非贪狼成员', JSON.stringify(gVic));

  // 复仇压对头：p1 是 p0(vengeful) 的 grudge → p1 优先死；高 sb 的复仇者自身不先死
  const sV = mkF([
    { id: 0, type: 'vengeful', sb: 100, gr: [1] }, { id: 1, type: 'steady', sb: 1 },
    { id: 2, type: 'steady', sb: 50 }
  ]);
  const vVic = M.ai.chooseVictims(sV, sV.factions[0], 2);
  ok(vVic[0] === 1, '复仇性格优先淘汰 grudge 对头（最先死）', JSON.stringify(vVic));
  ok(vVic.indexOf(0) < 0, '复仇者自身（高贡献）不先死', JSON.stringify(vVic));

  // 接入 settle：settleDay 实际调用 chooseVictims（白队缺口 → 贪狼存活）
  const sS = M.createGameState(2024);
  const wf = fac(sS, 'white');
  // 其余成员低分、贪狼成员高分 → 贪狼绝不应被选中
  wf.playerIds.forEach(pid => { sS.players[pid].scoreBase = 1; });
  const greedyPid = wf.playerIds.find(pid => sS.players[pid].personality.type === 'greedy');
  sS.players[greedyPid].scoreBase = 99; // 贪狼分数最高，仍不应被选
  wf.life = 5; // popAlive=6 → required=6，缺口 1 → killN=1（仅淘汰 1 名低分非贪狼）
  M.settleDay(sS);
  ok(wf.eliminatedIds.indexOf(greedyPid) < 0, 'settleDay 实际淘汰中贪狼仍自保（未被选）', 'elim=' + JSON.stringify(wf.eliminatedIds));
}

// ===== 7. 领袖选举（§2.3）=====
console.log('== 7. 领袖选举 ==');
{
  // 单人阵营（黑队 pop=1）→ 领袖即本人
  const s = M.createGameState(123);
  const black = fac(s, 'black');
  ok(black.popAlive === 1 && black.leaderId === black.playerIds[0], '单人阵营领袖 = 本人', black.leaderId);

  // 多人阵营：操控 scoreBase/type 后选举精确可预测
  const wf = fac(s, 'white');
  wf.playerIds.forEach(pid => { s.players[pid].scoreBase = 1; s.players[pid].personality.type = 'steady'; });
  const chosen = wf.playerIds[3];
  s.players[chosen].scoreBase = 99; s.players[chosen].personality.type = 'risky'; // 最高领导力偏置
  M.electLeader(s, wf);
  ok(wf.leaderId === chosen, '多人民主投票 → 选出于贡献×领导力偏置最高者', 'leader=' + wf.leaderId);

  // 人类阵营领袖恒为玩家
  ok(fac(s, s.humanFactionId).leaderId === humanOf(s).id, '人类阵营领袖恒为玩家');

  // 可复现：同 seed 同领袖
  const a = M.createGameState(777), b = M.createGameState(777);
  ok(a.factions.every(f => f.leaderId === b.factions.find(x => x.id === f.id).leaderId),
    '同 seed → 选举结果完全一致（可复现）');

  // 领导力偏置：冒险/贪狼 高于 守成
  ok(M.leader.leaderBias('risky') > M.leader.leaderBias('steady'), 'risky 领导力偏置 > steady');
  ok(M.leader.leaderBias('greedy') > M.leader.leaderBias('steady'), 'greedy 领导力偏置 > steady');

  // 提案生成：结构化、无自然语言文案
  ok(s.leaderProposals.length >= 1, '生成领袖会议提案（非空）', 'proposals=' + s.leaderProposals.length);
  const propOk = s.leaderProposals.every(p => p.kind && p.targetId && p.factionId && p.day != null);
  ok(propOk, '提案结构完整（kind/targetId/factionId/day，无文案）');
  ok(s.leaderProposals.every(p => p.kind === 'nonaggression'), '提案类型 = nonaggression（结构化）');
}

// ===== 8. 端到端（ai 加载下空转至终局不崩）=====
console.log('== 8. 端到端空转 ==');
{
  const s = M.createGameState(99);
  ok(s.phase === 'MORNING', '起始阶段 = MORNING');
  ok(s.leaderProposals.length >= 1, '开局即完成早间选举（提案非空）');
  const eng = M.createEngine(s);
  let guard = 0;
  while (s.status === 'PLAYING' && guard < 300) {
    for (let i = 0; i < 4 && s.status === 'PLAYING'; i++) M.advancePhase(s);
    if (s.status !== 'PLAYING') break;
    M.endDay(s);
    guard++;
  }
  ok(s.status === 'ENDED', 'ai 加载下空转至终局 status=ENDED', 'day=' + s.day + ' guard=' + guard);
  ok(s.result && typeof s.result.factionTotals === 'object', '终局产出分红结果');
  ok(s.leaderProposals.length >= 1, '全程提案持续生成（非一次性）', 'proposals=' + s.leaderProposals.length);
  // 无幽灵资源
  const nonNeg = s.factions.every(f => f.life >= 0 && f.goods >= 0 && f.won >= 0 && f.militaryFund >= 0);
  ok(nonNeg, '终局后所有阵营资源非负（无幽灵）');
}

// ===== 9. 回归（Sprint 1/2/3 仍全绿）=====
console.log('== 9. 回归（Sprint 1 / 2 / 3）==');
{
  const reg = (file) => {
    try { cp.execSync('node ' + file, { cwd: __dirname, stdio: 'inherit' }); return true; }
    catch (e) { return false; }
  };
  ok(reg('verify-s1.js'), 'verify-s1.js 全绿（无回归）');
  ok(reg('verify-s2.js'), 'verify-s2.js 全绿（无回归）');
  ok(reg('verify-s3.js'), 'verify-s3.js 全绿（无回归）');
}

console.log('\n' + (fail === 0 ? 'Sprint 4 全部通过 ✓' : fail + ' 项失败 ✗') +
  '  （通过 ' + pass + ' / ' + (pass + fail) + '）');
process.exit(fail === 0 ? 0 : 1);
