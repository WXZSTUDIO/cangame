/* =========================================================
 * cangame v2 · economy.js
 * 交易 / 市场 / 黑队专利抽成（Sprint 2）：
 *   - 公开挂单：state.market.orders[]（side/qty/price/goodsType/factionId/status）
 *   - 私密交易：state.market.privateOffers[]（私聊报价 + 成交）
 *   - 协议：state.market.agreements[]（含 breached 标记；Sprint 2 支持「互不侵犯 / 供货」）
 *   - 黑队专利抽成：非黑队成交「专利线」Goods（CONFIG.BLACK_PATENTS）时，
 *     按 PATENT_ROYALTY(15%) 缴 Won 给黑队（在 executeTrade 内结算）。
 *   - economy.runAll(state)：AI 自动挂单 / 接单，由 engine.runAIDecisions 在
 *     「离开贸易阶段（phase=WAR）」时调用。
 * 依赖：config.js / rng.js / state.js(pushLog) / resource.js(transferResource,canAfford)。
 * 加载顺序：production.js → economy.js（在 settle 之前）。
 * 复用：transferResource / canAfford（防幽灵资源）。
 * ========================================================= */

var GOODS_GENERIC = '货物';           // 普通货物（非专利线，不抽成）
var LIFE_GOODS = '生命药';             // 生命药（可交易；Sprint 5 平衡校准启用，让白/红/黑向蓝队购药续命）
var AGREEMENT_TYPES = ['nonaggression', 'supply']; // 互不侵犯 / 供货

function econFaction(state, id) {
  return state.factions.find(function (f) { return f.id === id; });
}

// 货物类型是否属黑队专利线（成交抽成）。
function isPatentGoods(goodsType) {
  return CONFIG.BLACK_PATENTS.indexOf(goodsType) >= 0;
}

// —— 公开挂单 ——
var _orderSeq = 0;
function placeOrder(state, o) {
  state.market.orders = state.market.orders || [];
  var order = {
    id: 'o' + (++_orderSeq),
    side: o.side,                                   // 'buy' | 'sell'
    factionId: o.factionId,
    goodsType: o.goodsType || GOODS_GENERIC,
    qty: Math.max(1, Math.floor(o.qty) || 1),
    price: Math.max(0, o.price || 0),
    status: 'open',                                 // open | filled | cancelled
    day: state.day
  };
  state.market.orders.push(order);
  pushLog(state,
    (econFaction(state, order.factionId) || {}).name + ' 挂' + (order.side === 'buy' ? '买' : '卖') + '单：' +
    order.goodsType + ' ×' + order.qty + ' @' + order.price, 'trade');
  return order;
}

// 撤销自己的公开挂单。
function cancelOrder(state, orderId, factionId) {
  var o = state.market.orders.find(function (x) { return x.id === orderId; });
  if (!o || o.status !== 'open') return false;
  if (factionId != null && o.factionId !== factionId) return false;
  o.status = 'cancelled';
  return true;
}

// 人类（或 AI）接下一条公开挂单：自动判定买卖方向并成交。
function fillPublicOrder(state, orderId, factionId) {
  var o = state.market.orders.find(function (x) { return x.id === orderId; });
  if (!o || o.status !== 'open' || o.factionId === factionId) return null;
  var t;
  if (o.side === 'sell') {
    t = executeTrade(state, factionId, o.factionId, o.goodsType, o.qty, o.price); // 我买
  } else {
    t = executeTrade(state, o.factionId, factionId, o.goodsType, o.qty, o.price); // 我卖
  }
  if (t) { o.status = 'filled'; o.qty = 0; }
  return t;
}

// —— 核心成交（含专利抽成钩子）——
// 普通货物：buyer 付 won 得 goods；seller 收 won 出 goods。
// 生命药(LIFE_GOODS)：buyer 付 won 得 life；seller 收 won 出 life（Sprint 5 平衡校准启用）。
// 专利线：非黑队卖方缴 PATENT_ROYALTY 比例 Won 给黑队。
function executeTrade(state, buyerId, sellerId, goodsType, qty, price) {
  var buyer = econFaction(state, buyerId), seller = econFaction(state, sellerId);
  if (!buyer || !seller || !buyer.alive || !seller.alive) return null;
  qty = Math.max(0, Math.floor(qty)); price = Math.max(0, price);
  if (qty <= 0) return null;
  var cost = qty * price;
  var isLife = (goodsType === LIFE_GOODS);
  if (!canAfford(buyer, { won: cost })) return null;     // 买方买不起 → 不成交
  if (isLife) {
    if ((Number(seller.life) || 0) < qty) return null;   // 卖方没药 → 不成交
  } else {
    if (!canAfford(seller, { goods: qty })) return null; // 卖方没货 → 不成交
  }

  if (isLife) {
    transferResource(buyer, { won: -cost, life: qty });
    transferResource(seller, { won: cost, life: -qty });
  } else {
    transferResource(buyer, { won: -cost, goods: qty });
    transferResource(seller, { won: cost, goods: -qty });
  }

  var patentFee = 0, patentTo = null;
  if (!isLife && isPatentGoods(goodsType) && sellerId !== 'black') {
    patentFee = Math.round(cost * CONFIG.PATENT_ROYALTY);
    if (patentFee > 0) {
      var black = econFaction(state, 'black');
      transferResource(seller, { won: -patentFee });     // 卖方缴专利费
      if (black && black.alive) transferResource(black, { won: patentFee }); // 黑队收
      patentTo = 'black';
    }
  }

  var trade = {
    id: 't' + (state.market.trades.length + 1),
    buyerId: buyerId, sellerId: sellerId, goodsType: goodsType,
    qty: qty, price: price, total: cost, day: state.day,
    patentFee: patentFee, patentTo: patentTo
  };
  state.market.trades.push(trade);
  pushLog(state,
    (seller.name) + ' → ' + (buyer.name) + ' 成交 ' + goodsType + ' ×' + qty + ' @' + price +
    (patentFee > 0 ? '（专利费 ' + patentFee + ' 缴黑队）' : ''), 'trade');
  return trade;
}

// 撮合全部公开挂单：任意买/卖同货物类型且卖价≤买价、不同阵营、双方可负担即成交。
// 以卖方挂单价成交；循环至无可撮合，防死循环（上限 = 挂单数 + 2）。
function resolveOrders(state) {
  var guard = 0, max = (state.market.orders.length + 2);
  while (guard++ < max) {
    var matched = false;
    for (var i = 0; i < state.market.orders.length; i++) {
      var buy = state.market.orders[i];
      if (buy.status !== 'open' || buy.side !== 'buy') continue;
      var sell = null;
      for (var j = 0; j < state.market.orders.length; j++) {
        var s = state.market.orders[j];
        if (s.status === 'open' && s.side === 'sell' && s.goodsType === buy.goodsType &&
            s.factionId !== buy.factionId && s.price <= buy.price) { sell = s; break; }
      }
      if (!sell) continue;
      var qty = Math.min(buy.qty, sell.qty);
      var t = executeTrade(state, buy.factionId, sell.factionId, sell.goodsType, qty, sell.price);
      if (t) {
        buy.qty -= qty; sell.qty -= qty;
        if (buy.qty <= 0) buy.status = 'filled';
        if (sell.qty <= 0) sell.status = 'filled';
        matched = true;
      }
    }
    if (!matched) break;
  }
  return state;
}

// —— 私密交易（私聊报价）——
function proposePrivate(state, fromId, toId, goodsType, qty, price) {
  state.market.privateOffers = state.market.privateOffers || [];
  var offer = {
    id: 'p' + (state.market.privateOffers.length + 1),
    fromId: fromId, toId: toId,                 // fromId=卖方(提议)，toId=买方(受邀)
    goodsType: goodsType || GOODS_GENERIC,
    qty: Math.max(1, Math.floor(qty) || 1),
    price: Math.max(0, price || 0),
    status: 'open', day: state.day
  };
  state.market.privateOffers.push(offer);
  pushLog(state,
    (econFaction(state, fromId) || {}).name + ' 向 ' + (econFaction(state, toId) || {}).name +
    ' 私密报价：' + offer.goodsType + ' ×' + offer.qty + ' @' + offer.price, 'trade');
  return offer;
}

// 受邀方（toId）接受私密报价 → 成交（toId 为买方，fromId 为卖方）。
function acceptPrivate(state, offerId, factionId) {
  var o = (state.market.privateOffers || []).find(function (x) { return x.id === offerId; });
  if (!o || o.status !== 'open') return null;
  if (factionId != null && o.toId !== factionId) return null;
  var t = executeTrade(state, o.toId, o.fromId, o.goodsType, o.qty, o.price);
  if (t) o.status = 'accepted';
  return t;
}

// —— 协议（互不侵犯 / 供货）——
function signAgreement(state, a, b, type) {
  state.market.agreements = state.market.agreements || [];
  if (AGREEMENT_TYPES.indexOf(type) < 0) type = AGREEMENT_TYPES[0];
  var ag = { id: 'a' + (state.market.agreements.length + 1), a: a, b: b, type: type, breached: false, day: state.day };
  state.market.agreements.push(ag);
  pushLog(state,
    (econFaction(state, a) || {}).name + ' 与 ' + (econFaction(state, b) || {}).name +
    ' 签署协议：' + type, 'diplo');
  return ag;
}

function breakAgreement(state, agId, byId) {
  var ag = state.market.agreements.find(function (x) { return x.id === agId; });
  if (!ag || ag.breached) return false;
  ag.breached = true; ag.breachedBy = byId;
  pushLog(state, '协议破裂：' + (econFaction(state, ag.a) || {}).name + ' × ' + (econFaction(state, ag.b) || {}).name, 'diplo');
  return true;
}

// —— AI 自动挂单（简版策略，确定性）——
function placeAIOrders(state) {
  state.factions.forEach(function (f) {
    if (!f.alive || f.id === state.humanFactionId) return;
    // 每日至多 1 单：先撤销该 AI 自己的旧挂单，避免跨日累积。
    state.market.orders.forEach(function (o) {
      if (o.factionId === f.id && o.status === 'open') o.status = 'cancelled';
    });
    var rng = makeRNG(
      ((state.seed ^ Math.imul(state.day, 0x9E3779B1) ^ Math.imul(f.id.charCodeAt(0) + 1, 0x85EBCA77)) >>> 0) || 1
    );
    var needGoods = f.goods < 8;
    var hasWon = f.won > 5;
    if (needGoods && hasWon) {
      placeOrder(state, { side: 'buy', factionId: f.id, goodsType: GOODS_GENERIC, qty: randInt(rng, 1, 3), price: randInt(rng, 4, 7) });
    } else if (f.goods > 6) {
      placeOrder(state, { side: 'sell', factionId: f.id, goodsType: GOODS_GENERIC, qty: randInt(rng, 1, 3), price: randInt(rng, 3, 6) });
    } else {
      placeOrder(state, { side: 'buy', factionId: f.id, goodsType: GOODS_GENERIC, qty: 1, price: 5 });
    }
  });
}

// AI 自动交易：离开贸易阶段（phase=WAR）时由 runAIDecisions 调用。
// 防重入：aiTradeDay 同天只跑一次。
// Sprint 4：AI 挂单决策交由 ai.decideTrade（性格驱动：价格随 trade 权重 ±20%、对头拒单）；
//   ai.js 未加载时（verify-s2）守卫回退到原 placeAIOrders，保证回归零影响。
function runAll(state) {
  if (!state || state.phase !== 'WAR') return state;
  if (state.aiTradeDay === state.day) return state;
  state.aiTradeDay = state.day;
  if (typeof ai !== 'undefined' && ai.decideTrade) ai.decideTrade(state);
  else placeAIOrders(state);
  resolveOrders(state);
  return state;
}

// 模块对象（engine/ui 通过 economy.runAll / economy.placeOrder / ... 调用）。
var economy = {
  GOODS_GENERIC: GOODS_GENERIC,
  LIFE_GOODS: LIFE_GOODS,
  AGREEMENT_TYPES: AGREEMENT_TYPES,
  isPatentGoods: isPatentGoods,
  placeOrder: placeOrder,
  cancelOrder: cancelOrder,
  fillPublicOrder: fillPublicOrder,
  executeTrade: executeTrade,
  resolveOrders: resolveOrders,
  proposePrivate: proposePrivate,
  acceptPrivate: acceptPrivate,
  signAgreement: signAgreement,
  breakAgreement: breakAgreement,
  placeAIOrders: placeAIOrders,
  runAll: runAll
};

if (typeof globalThis !== 'undefined') {
  globalThis.economy = economy;
  globalThis.econFaction = econFaction;
  globalThis.isPatentGoods = isPatentGoods;
  globalThis.LIFE_GOODS = LIFE_GOODS;
  globalThis.executeTrade = executeTrade;
  globalThis.resolveOrders = resolveOrders;
  globalThis.placeOrder = placeOrder;
  globalThis.signAgreement = signAgreement;
  globalThis.breakAgreement = breakAgreement;
}
