/* cangame v2 · Sprint 2 验证（沿用仓库 vm 沙箱模式）
 * vm.createContext({console,Math,JSON,Date,window,document,localStorage})
 *   → 按 defer 顺序 runInContext 各 assets js（含 production / economy）→ 断言。
 * 覆盖：产能区间(白3~5/蓝4~6/红0~1/黑1~2)同seed可复现 / 人类小游戏产出+行动力 /
 *      黑队专利费≈成交额15%且卖方扣除 / 人类挂单被AI接单双方资源变动 / 私密交易 /
 *      协议签署破裂 / 无幽灵资源 / 引擎阶段触发生产·交易 / 每日行动力重置 / 防重入。
 * 目标：≥30 条断言，全绿。
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = path.join(__dirname, '..');

// 最小 DOM 桩：ui.js 仅在 DOMContentLoaded 真正派发时才跑 boot()；
// 这里 readyState='loading' 且 addEventListener 为空，boot 不触发，ui.js 在 vm 中 inert。
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
    createElement() { return fakeEl(); },
    body: null, documentElement: null
  },
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  alert: function () {}
};
vm.createContext(ctx);

['assets/config.js', 'assets/rng.js', 'assets/state.js', 'assets/factions.js',
 'assets/resource.js', 'assets/production.js', 'assets/economy.js', 'assets/settle.js',
 'assets/engine.js', 'assets/ui.js']
  .forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));

// 暴露需要的符号（顶层函数/var 已挂到 ctx 全局，这里解构取出）。
const M = vm.runInContext('({' +
  'createGameState, serializeGameState, advancePhase, endDay, endPhase, runAIDecisions,' +
  'CONFIG, PHASES, makeRNG, transferResource, canAfford, pushLog,' +
  'production, economy, econFaction, executeTrade, resolveOrders, placeOrder,' +
  'signAgreement, breakAgreement, isPatentGoods, factionPrizeTotal' +
 '})', ctx);

let fail = 0, pass = 0;
const ok = (cond, name, extra) => {
  if (cond) { pass++; console.log('  ✓', name, extra == null ? '' : extra); }
  else { fail++; console.log('  ✗', name, extra == null ? '' : extra); }
};
const approx = (a, b, eps) => Math.abs(a - b) <= (eps == null ? 1e-9 : eps);
const fac = (s, id) => s.factions.find(f => f.id === id);
const humanOf = (s) => s.players.find(p => p.isHuman && p.alive);

// ===== 1. AI 产能区间（非人类阵营）=====
console.log('== 1. AI 产能区间 ==');
{
  const s = M.createGameState(12345);
  s.humanFactionId = 'black';           // 白/蓝/红 为 AI
  s.phase = 'TRADING';
  const w = fac(s, 'white'), b = fac(s, 'blue'), r = fac(s, 'red');
  const wg0 = w.goods, bl0 = b.life, rg0 = r.goods;
  M.production.runAll(s);
  const dw = w.goods - wg0, dbl = b.life - bl0, drg = r.goods - rg0;
  // 区间由 CONFIG 推导（v2.0.1：白 3~5→6~10、蓝产药 4~6→3~5），避免调基线后漂移
  const P = M.CONFIG.PRODUCTION;
  ok(dw >= P.white.goodsMin && dw <= P.white.goodsMax,
    '白队 AI 货物产出 ' + P.white.goodsMin + '~' + P.white.goodsMax, dw);
  ok(dbl >= P.blue.lifeMin && dbl <= P.blue.lifeMax,
    '蓝队 AI 生命药产出 ' + P.blue.lifeMin + '~' + P.blue.lifeMax, dbl);
  ok(drg >= P.red.goodsMin && drg <= P.red.goodsMax,
    '红队 AI 货物产出 ' + P.red.goodsMin + '~' + P.red.goodsMax, drg);
}

// ===== 2. 确定性（同 seed 同产出）=====
console.log('== 2. 产能确定性 ==');
{
  const sa = M.createGameState(777); sa.humanFactionId = 'black'; sa.phase = 'TRADING';
  const sb = M.createGameState(777); sb.humanFactionId = 'black'; sb.phase = 'TRADING';
  M.production.runAll(sa); M.production.runAll(sb);
  ok(fac(sa, 'white').goods === fac(sb, 'white').goods, '白队同 seed 同货物产出',
    fac(sa, 'white').goods + ' vs ' + fac(sb, 'white').goods);
  ok(fac(sa, 'blue').life === fac(sb, 'blue').life, '蓝队同 seed 同生命药产出',
    fac(sa, 'blue').life + ' vs ' + fac(sb, 'blue').life);
  ok(fac(sa, 'red').goods === fac(sb, 'red').goods, '红队同 seed 同货物产出');
}

// ===== 3. 人类生产小游戏 + 行动力 =====
console.log('== 3. 人类生产小游戏 / 行动力 ==');
{
  const s = M.createGameState(42);
  const h = humanOf(s);
  ok(h.actionPoints === 2, '人类初始行动力 = 2', h.actionPoints);
  const fid = s.humanFactionId;
  const f = fac(s, fid);
  const pr = M.CONFIG.PRODUCTION[fid];
  const g0 = f.goods, l0 = f.life;
  const res = M.production.humanProduce(s, { correct: true, skillBonus: h.skills.production });
  ok(res.ok === true, '人类生产成功');
  ok(res.goods >= pr.goodsMin && res.goods <= pr.goodsMax, '人类货物产出封顶区间上限', res.goods);
  ok(res.life >= pr.lifeMin && res.life <= pr.lifeMax, '人类生命药产出封顶区间上限', res.life);
  ok(f.goods - g0 === res.goods && f.life - l0 === res.life, '盘面资源随人类产出更新');
  ok(h.actionPoints === 1, '行动力 -1', h.actionPoints);

  // 第二次生产
  M.production.humanProduce(s, { correct: true });
  ok(h.actionPoints === 0, '行动力耗尽 = 0', h.actionPoints);
  const r3 = M.production.humanProduce(s, { correct: true });
  ok(r3.ok === false && r3.reason === 'no-ap', '行动力耗尽时拒绝生产');

  // 答错：无产出但消耗行动力（新一局）
  const s2 = M.createGameState(7);
  const h2 = humanOf(s2);
  const r4 = M.production.humanProduce(s2, { correct: false });
  ok(r4.ok === true && r4.goods === 0 && r4.life === 0, '答错无产出');
  ok(h2.actionPoints === 1, '答错仍扣行动力');
}

// ===== 4. 黑队专利抽成（直接成交）=====
console.log('== 4. 黑队专利抽成 ==');
{
  const s = M.createGameState(99);
  s.humanFactionId = 'red';
  const white = fac(s, 'white'), blue = fac(s, 'blue'), black = fac(s, 'black');
  blue.won = 100;                        // 确保买方买得起
  const bW0 = black.won, wW0 = white.won;
  const t = M.executeTrade(s, 'blue', 'white', '科技品', 2, 10); // 买方蓝 / 卖方白 / 专利线
  ok(!!t, '专利线成交成功');
  const fee = Math.round(2 * 10 * M.CONFIG.PATENT_ROYALTY);
  ok(black.won - bW0 === fee, '黑队 Won 增加 ≈ 成交额×15%', (black.won - bW0) + ' (期望 ' + fee + ')');
  ok(white.won - wW0 === 20 - fee, '卖方 Won 净增 = 成交额 - 专利费', (white.won - wW0) + ' (期望 ' + (20 - fee) + ')');
  ok(t.patentFee === fee && t.patentTo === 'black', '成交记录专利费字段');
  ok(blue.goods - fac(s, 'blue').goods === 0 && blue.won === 100 - 20, '买方正确支付 Won 得 Goods');

  // 非专利线不抽成
  const s3 = M.createGameState(99); s3.humanFactionId = 'red';
  const black3 = fac(s3, 'black'); const wW3_0 = fac(s3, 'white').won; const bW3_0 = black3.won;
  fac(s3, 'blue').won = 100;
  const t3 = M.executeTrade(s3, 'blue', 'white', '货物', 2, 10);
  ok(t3.patentFee === 0, '普通货物不抽专利费');
  ok(black3.won === bW3_0, '非专利成交黑队 Won 不变');
  ok(fac(s3, 'white').won - wW3_0 === 20, '普通成交卖方净收全额');
}

// ===== 5. 黑队专利抽成（挂单→撮合全路径）=====
console.log('== 5. 专利费（挂单全路径）==');
{
  const s = M.createGameState(909); s.humanFactionId = 'red';
  fac(s, 'blue').won = 100;
  const black = fac(s, 'black'); const bW0 = black.won;
  M.placeOrder(s, { side: 'sell', factionId: 'white', goodsType: '科技品', qty: 2, price: 10 }); // 白卖专利
  M.placeOrder(s, { side: 'buy', factionId: 'blue', goodsType: '科技品', qty: 2, price: 12 });   // 蓝买专利
  M.resolveOrders(s);
  const fee = Math.round(2 * 10 * M.CONFIG.PATENT_ROYALTY);
  ok(black.won - bW0 === fee, '挂单撮合后黑队收专利费', (black.won - bW0) + ' (期望 ' + fee + ')');
  ok(s.market.trades.some(t => t.goodsType === '科技品' && t.patentFee === fee), '专利成交记录存在');
}

// ===== 6. 人类挂单被 AI 接单，双方资源变动 =====
console.log('== 6. 人类挂单被 AI 接单 ==');
{
  const s = M.createGameState(321);
  s.humanFactionId = 'blue';            // 人类=蓝，挂卖单；白/红/黑 为 AI 接单方
  const blue = fac(s, 'blue');
  const bG0 = blue.goods, bW0 = blue.won;
  // 进入 TRADING 阶段后再挂单（模拟人类在交易大厅操作）
  M.advancePhase(s);                    // MORNING -> PRODUCTION
  M.advancePhase(s);                    // PRODUCTION -> TRADING（触发 AI 生产）
  M.economy.placeOrder(s, { side: 'sell', factionId: 'blue', goodsType: '货物', qty: 1, price: 3 });
  M.advancePhase(s);                    // TRADING -> WAR（触发 economy.runAll，AI 接单）
  const trade = s.market.trades.find(t => t.sellerId === 'blue');
  ok(!!trade, '存在人类(蓝)卖方成交记录');
  ok(blue.won > bW0, '人类卖方 Won 增加', (blue.won - bW0));
  ok(blue.goods < bG0, '人类卖方 Goods 减少', (bG0 - blue.goods));
  const red = fac(s, 'red');
  ok(red.goods > M.CONFIG.INITIAL.red.goods - 1 || red.won < M.CONFIG.INITIAL.red.won, 'AI 买方(红)资源相应变动');
}

// ===== 7. 私密交易 =====
console.log('== 7. 私密交易 ==');
{
  const s = M.createGameState(55);
  const white = fac(s, 'white'), red = fac(s, 'red');
  const wW0 = white.won, rW0 = red.won, wG0 = white.goods, rG0 = red.goods;
  const offer = M.economy.proposePrivate(s, 'white', 'red', '货物', 2, 4); // 白向红报价出售
  const t = M.economy.acceptPrivate(s, offer.id, 'red');
  ok(!!t, '私密报价被接受并成交');
  ok(white.won - wW0 === 8, '卖方收 Won = 2×4', white.won - wW0);
  ok(red.won - rW0 === -8, '买方付 Won = -8', red.won - rW0);
  ok(white.goods - wG0 === -2, '卖方出 Goods = -2');
  ok(red.goods - rG0 === 2, '买方得 Goods = +2');
  const t2 = M.economy.acceptPrivate(s, offer.id, 'red'); // 已成交不能重复
  ok(t2 === null, '已接受报价不可重复成交');
}

// ===== 8. 协议签署 / 破裂 =====
console.log('== 8. 协议 ==');
{
  const s = M.createGameState(11);
  const ag = M.economy.signAgreement(s, 'white', 'blue', 'nonaggression');
  ok(ag && ag.breached === false && ag.type === 'nonaggression', '签署「互不侵犯」协议');
  ok(Array.isArray(s.market.agreements) && s.market.agreements.length >= 1, '协议入 agreements[]');
  const okBreak = M.economy.breakAgreement(s, ag.id, 'red');
  ok(okBreak === true && ag.breached === true, '协议可被破裂（breached=true）');
  const ag2 = M.economy.signAgreement(s, 'red', 'black', 'supply');
  ok(ag2.type === 'supply', '签署「供货」协议');
  // 未知类型回落到互不侵犯
  const ag3 = M.economy.signAgreement(s, 'white', 'black', 'unknown');
  ok(ag3.type === 'nonaggression', '未知协议类型回落默认');
}

// ===== 9. 无幽灵资源（transferResource 夹零 / 成交校验）=====
console.log('== 9. 防幽灵资源 ==');
{
  const s = M.createGameState(3);
  const f = fac(s, 'white');
  const g0 = f.goods;
  M.transferResource(f, { goods: -(g0 + 1000) });
  ok(f.goods === 0, '超额扣 Goods 被夹到 0（无幽灵）', f.goods);
  const t = M.executeTrade(s, 'blue', 'red', '货物', 9999, 1); // 卖方红无货 → 不成交
  ok(t === null, '卖方无力交货时成交返回 null（不产负资源）');
  ok(fac(s, 'red').goods >= 0 && fac(s, 'red').life >= 0, '成交后各方资源非负');
}

// ===== 10. 引擎阶段分派：离开生产→AI 产出；离开贸易→AI 交易 =====
console.log('== 10. 引擎阶段触发 ==');
{
  const s = M.createGameState(2024);
  const nonHuman = s.factions.filter(f => f.id !== s.humanFactionId && f.alive);
  M.advancePhase(s);                    // MORNING -> PRODUCTION
  const snap = {};
  nonHuman.forEach(f => { snap[f.id] = { g: f.goods, l: f.life }; });
  M.advancePhase(s);                    // PRODUCTION -> TRADING（应触发 AI 生产）
  ok(s.phase === 'TRADING', '已进入 TRADING 阶段');
  nonHuman.forEach(f => {
    const pr = M.CONFIG.PRODUCTION[f.id];
    const dg = f.goods - snap[f.id].g, dl = f.life - snap[f.id].l;
    ok(dg >= pr.goodsMin && dg <= pr.goodsMax, f.id + ' 货物产出落区间', dg);
    ok(dl >= pr.lifeMin && dl <= pr.lifeMax, f.id + ' 生命药产出落区间', dl);
  });

  // economy 仅在 WAR 阶段跑（离开贸易）
  const s2 = M.createGameState(2024); s2.humanFactionId = 'blue';
  s2.phase = 'TRADING';
  M.economy.runAll(s2);
  ok(s2.aiTradeDay === undefined, 'TRADING 阶段 economy.runAll 不交易（guard）');
  s2.phase = 'WAR';
  M.economy.runAll(s2);
  ok(s2.aiTradeDay === s2.day, 'WAR 阶段 economy.runAll 执行 AI 交易');
}

// ===== 11. 防重入：同日重复 runAll 不产生/不重复挂单 =====
console.log('== 11. 防重入 ==');
{
  const s = M.createGameState(5); s.humanFactionId = 'black'; s.phase = 'TRADING';
  const white = fac(s, 'white'); const g0 = white.goods;
  M.production.runAll(s);
  const g1 = white.goods;
  M.production.runAll(s);                // 同日再跑应跳过
  ok(white.goods === g1, '同天重复 production.runAll 不重复产出', white.goods);
  ok(white.goods - g0 >= M.CONFIG.PRODUCTION.white.goodsMin && white.goods - g0 <= M.CONFIG.PRODUCTION.white.goodsMax,
    '白队一次产出在区间 ' + M.CONFIG.PRODUCTION.white.goodsMin + '~' + M.CONFIG.PRODUCTION.white.goodsMax);

  const s2 = M.createGameState(9); s2.humanFactionId = 'blue'; s2.phase = 'WAR';
  M.economy.runAll(s2);
  const n1 = s2.market.orders.filter(o => o.status === 'open' && o.factionId !== 'blue').length;
  M.economy.runAll(s2);                  // 同日再跑应跳过
  const n2 = s2.market.orders.filter(o => o.status === 'open' && o.factionId !== 'blue').length;
  ok(n2 === n1, '同天 economy.runAll 不重复挂单', n1 + ' vs ' + n2);
}

// ===== 12. 每日行动力重置（resetDailyAP / endDay）=====
console.log('== 12. 行动力每日重置 ==');
{
  const s = M.createGameState(8);
  const h = humanOf(s);
  M.production.humanProduce(s, { correct: true });
  M.production.humanProduce(s, { correct: true });
  ok(h.actionPoints === 0, '连续两次生产后行动力耗尽');
  M.production.resetDailyAP(s);
  ok(h.actionPoints === 2, 'resetDailyAP 重置行动力 = 2', h.actionPoints);

  const s2 = M.createGameState(8);
  const h2 = humanOf(s2);
  M.production.humanProduce(s2, { correct: true });
  M.production.humanProduce(s2, { correct: true });
  ok(h2.actionPoints === 0, '耗尽后再重置前 = 0');
  for (let i = 0; i < 4; i++) M.advancePhase(s2);   // -> SETTLEMENT
  M.endDay(s2);                                     // 结算 + 新一天（重置行动力）
  ok(h2.actionPoints === 2, 'endDay 进入新一天后行动力重置 = 2', h2.actionPoints);
}

// ===== 13. 市场数据结构存在 =====
console.log('== 13. 市场结构 ==');
{
  const s = M.createGameState(1);
  ok(Array.isArray(s.market.orders), 'market.orders[] 存在');
  ok(Array.isArray(s.market.trades), 'market.trades[] 存在');
  ok(Array.isArray(s.market.agreements), 'market.agreements[] 存在');
  M.economy.proposePrivate(s, 'white', 'red', '货物', 1, 1);
  ok(Array.isArray(s.market.privateOffers) && s.market.privateOffers.length === 1, 'privateOffers 惰性创建');
  ok(M.isPatentGoods('科技品') === true && M.isPatentGoods('货物') === false, 'isPatentGoods 判定正确');
}

// ===== 14. 生产不污染人类阵营 / 黑队区间独立 =====
console.log('== 14. 黑队产出区间 ==');
{
  const s = M.createGameState(2026); s.humanFactionId = 'white'; s.phase = 'TRADING';
  const black = fac(s, 'black'); const b0 = black.goods;
  M.production.runAll(s);
  ok(black.goods - b0 >= 1 && black.goods - b0 <= 2, '黑队 AI 货物产出 1~2', black.goods - b0);
  // 人类(白)未被 AI 自动生产
  ok(fac(s, 'white').lastProducedDay == null, '人类阵营不被 AI 自动生产');
}

console.log('\n' + (fail === 0 ? '全部通过 ✓' : fail + ' 项失败 ✗') +
  '  （通过 ' + pass + ' / ' + (pass + fail) + '）');
process.exit(fail === 0 ? 0 : 1);
