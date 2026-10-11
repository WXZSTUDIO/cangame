/* =========================================================
 * cangame v2 · ui.js
 * 极简可玩盘面：HUD（天数/阶段进度/奖金池/本阵营资源）、4 阵营卡片、
 * 阶段提示条、底部「结束本阶段 ▶」按钮驱动 engine；终局分红页 + 重开。
 * 原则：UI 不持有游戏状态，只读 GAME/ENGINE 并调用引擎。
 * 依赖：前面全部模块（config/rng/state/factions/resource/settle/engine）。
 * 加载顺序：engine.js → ui.js（最后）。
 * ========================================================= */

var GAME = null;     // 当前 gameState
var ENGINE = null;   // 当前 engine 实例

// 资源条参考上限（仅用于 UI 比例，非游戏数值）。
var BAR_MAX = { life: 40, goods: 40, won: 60, militaryFund: 30 };

var PHASE_TODO = {
  MORNING: '查看你的阵营与今日目标；点「结束本阶段」进入生产。',
  PRODUCTION: '点「生产小游戏」作答产出 Goods/Life（消耗行动力）；也可跳过直接结束本阶段（AI 自动产出）。',
  TRADING: '点「交易大厅」挂单 / 接单 / 私密报价 / 签协议；也可直接结束本阶段（AI 自动交易）。',
  WAR: '点「宣战」选目标 → 玩战争小游戏拿加成 → 确认；战争将在进入结算阶段时统一开战（掠夺自动结算）。',
  SETTLEMENT: '结算阶段：点「结束今日」执行扣药与淘汰（此前战争掠夺已结算）。'
};

// 生产小游戏题库（即时选择题，确定性，不依赖 RNG）。每题一个正确选项索引。
var QUIZ_BANK = [
  { q: '（文科逻辑）下列哪个推理有效？', opts: ['凡人皆会死，苏格拉底是人，故苏格拉底会死', '有人会死，故所有人都会死', '苏格拉底会死，故凡人皆会死', '无人会死'], ans: 0 },
  { q: '（数学）若 3x + 5 = 20，则 x = ？', opts: ['3', '5', '7', '15'], ans: 1 },
  { q: '（代码拼图）JS 中求数组最大值应写？', opts: ['arr.min()', 'Math.max(...arr)', 'max(arr)', 'arr.max()'], ans: 1 },
  { q: '（逻辑）命题「非(A 且 B)」等价于？', opts: ['非A 且 非B', '非A 或 非B', 'A 或 B', 'A 且 B'], ans: 1 },
  { q: '（数学）2 的 4 次方是？', opts: ['8', '12', '16', '32'], ans: 2 }
];

function el(id) { return (typeof document !== 'undefined') ? document.getElementById(id) : null; }

function bar(label, value, max, color) {
  var pct = Math.max(0, Math.min(100, (value / max) * 100));
  return '' +
    '<div class="res-row"><span class="res-label">' + label + '</span>' +
    '<span class="res-bar"><span class="res-fill" style="width:' + pct.toFixed(0) + '%;background:' + color + '"></span></span>' +
    '<span class="res-val">' + value + '</span></div>';
}

function factionCard(s, f) {
  var total = f.playerIds.length;
  var isHuman = (f.id === s.humanFactionId);
  var tags = [];
  if (!f.alive) tags.push('<span class="tag tag-dead">已灭绝</span>');
  else if (f.deficit > 0) tags.push('<span class="tag tag-warn">缺药⚠</span>');
  if (isHuman) tags.push('<span class="tag tag-you">★ 你</span>');
  // 战争状态标签：本阵营卷入当前/待结算战争。
  var inWar = s.war && (
    (s.war.active && (s.war.active.attacker === f.id || s.war.active.defender === f.id)) ||
    (s.war.pending || []).some(function (w) { return w.attacker === f.id || w.defender === f.id; })
  );
  if (inWar && f.alive) tags.push('<span class="tag tag-war">⚔ 宣战中</span>');

  var color = f.color;
  var textColor = (f.id === 'black' || f.id === 'blue') ? '#fff' : '#111';

  return '' +
    '<div class="card ' + (isHuman ? 'card-you' : '') + '" style="border-top:4px solid ' + color + '">' +
      '<div class="card-head">' +
        '<span class="card-name" style="color:' + (f.id === 'white' ? '#444' : color) + '">' + f.name + '</span>' +
        '<span class="card-pop">存活 ' + f.popAlive + '/' + total + '</span>' +
      '</div>' +
      '<div class="card-tags">' + (tags.join('') || '<span class="tag tag-ok">正常</span>') + '</div>' +
      bar('药', f.life, BAR_MAX.life, '#22c55e') +
      bar('货', f.goods, BAR_MAX.goods, '#eab308') +
      bar('金', f.won, BAR_MAX.won, '#3b82f6') +
      bar('军', f.militaryFund, BAR_MAX.militaryFund, '#ef4444') +
      '<div class="card-prize">人均奖金预期：' + Math.round(factionPrizePerPerson(s, f)) + '</div>' +
    '</div>';
}

function renderHUD(s) {
  var human = s.factions.find(function (f) { return f.id === s.humanFactionId; }) || { name: '?', life: 0, goods: 0, won: 0, militaryFund: 0 };
  var idx = PHASES.indexOf(s.phase);
  var steps = PHASES.map(function (p, i) {
    var cls = i < idx ? 'step-done' : (i === idx ? 'step-cur' : 'step-todo');
    return '<span class="step ' + cls + '">' + (CONFIG.PHASE_LABELS[p] || p) + '</span>';
  }).join('');

  return '' +
    '<div class="hud">' +
      '<div class="hud-cell"><div class="hud-k">天数</div><div class="hud-v">' + s.day + ' / ' + CONFIG.MAX_DAY + '</div></div>' +
      '<div class="hud-cell hud-steps">' + steps + '</div>' +
      '<div class="hud-cell"><div class="hud-k">奖金池</div><div class="hud-v">' + s.prizePool + '</div></div>' +
      '<div class="hud-cell"><div class="hud-k">本阵营（' + human.name + '）</div>' +
        '<div class="hud-v">药 ' + human.life + ' · 货 ' + human.goods + ' · 金 ' + human.won + ' · 军 ' + human.militaryFund + '</div></div>' +
    '</div>';
}

function renderEndgame(s) {
  var r = s.result || {};
  var rows = s.factions.map(function (f) {
    var total = Math.round(r.factionTotals ? r.factionTotals[f.id] : 0);
    var per = Math.round(r.perPerson ? r.perPerson[f.id] : 0);
    var win = (r.winner === f.id) ? ' ★赢家' : '';
    return '<tr class="' + (f.alive ? '' : 'dead-row') + '">' +
      '<td style="color:' + (f.id === 'white' ? '#444' : f.color) + '">' + f.name + win + '</td>' +
      '<td>' + (f.alive ? f.popAlive : 0) + '</td>' +
      '<td>' + f.goods + '</td>' +
      '<td>' + total + '</td>' +
      '<td>' + per + '</td></tr>';
  }).join('');

  return '' +
    '<div class="endgame">' +
      '<h1>对局结束</h1>' +
      '<p>第 ' + (r.endedDay || s.day) + ' 天 · 奖金池 ' + (r.prizePool || s.prizePool) + ' · 总货 ' + (r.totalGoods || 0) + '</p>' +
      '<table class="result-tbl"><thead><tr><th>阵营</th><th>存活</th><th>货</th><th>阵营总额</th><th>人均</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table>' +
      '<button id="btn-restart" class="btn btn-primary">再来一局（重随机入营）</button>' +
    '</div>';
}

function render() {
  var app = el('app');
  if (!app || !GAME) return;
  var s = GAME;

  if (s.status === 'ENDED') {
    app.innerHTML = renderHUD(s) + renderEndgame(s);
    var rb = el('btn-restart');
    if (rb) rb.addEventListener('click', function () { startNewGame((Date.now() & 0x7fffffff) ^ Math.floor(Math.random() * 1e9)); });
    return;
  }

  var cards = s.factions.map(function (f) { return factionCard(s, f); }).join('');
  var btnLabel = (s.phase === 'SETTLEMENT') ? '结束今日 ▶' : '结束本阶段 ▶';
  var hint = (CONFIG.PHASE_LABELS[s.phase] || s.phase) + ' — ' + (PHASE_TODO[s.phase] || '');

  // 阶段内人类操作按钮（状态全在 GAME，UI 不持有）。
  var actionBtn = '';
  var human = s.players.find(function (p) { return p.isHuman && p.alive; });
  var ap = human ? (human.actionPoints || 0) : 0;
  if (s.phase === 'PRODUCTION') {
    actionBtn = '<button id="btn-prod" class="btn">生产小游戏（行动力 ' + ap + '）</button>';
  } else if (s.phase === 'TRADING') {
    actionBtn = '<button id="btn-trade" class="btn">交易大厅</button>';
  } else if (s.phase === 'WAR') {
    actionBtn = '<button id="btn-war" class="btn">宣战</button>';
  }

  app.innerHTML = '' +
    renderHUD(s) +
    '<div class="phase-hint">' + hint + '</div>' +
    '<div class="cards">' + cards + '</div>' +
    '<div class="dock">' + actionBtn +
      '<button id="btn-end" class="btn btn-primary">' + btnLabel + '</button></div>';

  var b = el('btn-end');
  if (b) b.addEventListener('click', onEndPhase);
  var bp = el('btn-prod');
  if (bp) bp.addEventListener('click', openProductionModal);
  var bt = el('btn-trade');
  if (bt) bt.addEventListener('click', openTradeModal);
  var bw = el('btn-war');
  if (bw) bw.addEventListener('click', openWarModal);
}

function onEndPhase() {
  if (!ENGINE) return;
  ENGINE.endPhase();   // 引擎驱动：推进阶段 / 结算 / 终局
  render();
}

function startNewGame(seed) {
  GAME = createGameState(seed >>> 0);
  ENGINE = createEngine(GAME);
  render();
}

// ---------- 模态基础设施（不持有状态，读/写 GAME）----------
function modalRoot() {
  if (typeof document === 'undefined') return null;
  var r = document.getElementById('modal-root');
  if (!r) {
    r = document.createElement('div');
    r.id = 'modal-root';
    (document.body || document.documentElement).appendChild(r);
  }
  return r;
}
function closeModal() {
  var r = modalRoot();
  if (r) r.innerHTML = '';
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}

// ---------- 生产小游戏 ----------
function openProductionModal() {
  var s = GAME; if (!s) return;
  var human = s.players.find(function (p) { return p.isHuman && p.alive; });
  var ap = human ? (human.actionPoints || 0) : 0;
  if (ap <= 0) { closeModal(); alert('今日行动力已用尽，无法继续生产。'); return; }

  // 选题：确定性取题库前 3 题（不依赖随机，保证可复现体验）。
  var qs = QUIZ_BANK.slice(0, 3);
  var html = '<div class="modal-mask" id="modal-mask"><div class="modal">' +
    '<div class="modal-head">生产小游戏 · 答对越多产出越高（剩 ' + ap + ' 行动力）</div>' +
    '<div class="modal-body" id="quiz-body">';
  qs.forEach(function (q, i) {
    html += '<div class="quiz"><div class="quiz-q">' + (i + 1) + '. ' + esc(q.q) + '</div>';
    q.opts.forEach(function (opt, oi) {
      html += '<label class="quiz-opt"><input type="radio" name="q' + i + '" value="' + oi + '"> ' + esc(opt) + '</label>';
    });
    html += '</div>';
  });
  html += '</div>' +
    '<div class="modal-foot">' +
    '<button id="quiz-submit" class="btn btn-primary">提交产出</button>' +
    '<button id="quiz-cancel" class="btn">取消</button></div></div></div>';

  var r = modalRoot(); if (!r) return;
  r.innerHTML = html;

  var submit = el('quiz-submit');
  if (submit) submit.addEventListener('click', function () {
    var correct = 0;
    qs.forEach(function (q, i) {
      var sel = document.querySelector('input[name="q' + i + '"]:checked');
      if (sel && Number(sel.value) === q.ans) correct++;
    });
    var okAll = correct === qs.length;
    var res = production.humanProduce(s, {
      correct: correct >= 1,
      skillBonus: okAll ? (human.skills ? human.skills.production : 0) : 0
    });
    closeModal();
    if (res && res.ok) {
      alert('生产结果：+' + res.goods + ' 货 / +' + res.life + ' 药（答对 ' + correct + '/' + qs.length +
        (okAll ? '，技能加成生效' : '') + '，剩 ' + res.apLeft + ' 行动力）');
    }
    render();
  });
  var cancel = el('quiz-cancel');
  if (cancel) cancel.addEventListener('click', closeModal);
  var mask = el('modal-mask');
  if (mask) mask.addEventListener('click', function (e) { if (e.target === mask) closeModal(); });
}

// ---------- 交易大厅 ----------
function openTradeModal() {
  var s = GAME; if (!s) return;
  renderTradeModal();
}

function renderTradeModal() {
  var s = GAME; if (!s) return;
  var hfid = s.humanFactionId;
  var goodsOpts = '<option value="' + economy.GOODS_GENERIC + '">' + economy.GOODS_GENERIC + '</option>' +
    CONFIG.BLACK_PATENTS.map(function (g) { return '<option value="' + g + '">' + g + '（专利线）</option>'; }).join('');
  var factionOpts = s.factions.filter(function (f) { return f.alive && f.id !== hfid; })
    .map(function (f) { return '<option value="' + f.id + '">' + f.name + '</option>'; }).join('');

  // 公开挂单列表
  var orders = (s.market.orders || []).filter(function (o) { return o.status === 'open'; });
  var orderRows = orders.length ? orders.map(function (o) {
    var f = econFaction(s, o.factionId);
    var mine = o.factionId === hfid;
    return '<tr><td>' + (o.side === 'buy' ? '买' : '卖') + '</td><td>' + esc(o.goodsType) + '</td><td>' +
      o.qty + '</td><td>' + o.price + '</td><td>' + (f ? f.name : o.factionId) + (mine ? '（你）' : '') + '</td><td>' +
      (mine ? '—' : '<button class="btn sm" data-fill="' + o.id + '">接单</button>') + '</td></tr>';
  }).join('') : '<tr><td colspan="6">暂无公开挂单</td></tr>';

  // 私密报价列表
  var priv = (s.market.privateOffers || []).filter(function (o) { return o.status === 'open'; });
  var privRows = priv.length ? priv.map(function (o) {
    var from = econFaction(s, o.fromId), to = econFaction(s, o.toId);
    var mine = o.toId === hfid;
    return '<tr><td>' + (from ? from.name : o.fromId) + ' → ' + (to ? to.name : o.toId) + '</td><td>' +
      esc(o.goodsType) + '</td><td>' + o.qty + '</td><td>' + o.price + '</td><td>' +
      (mine ? '<button class="btn sm" data-acc="' + o.id + '">接受</button>' : '—') + '</td></tr>';
  }).join('') : '<tr><td colspan="5">暂无私密报价</td></tr>';

  // 协议列表
  var ags = (s.market.agreements || []);
  var agRows = ags.length ? ags.map(function (a) {
    var A = econFaction(s, a.a), B = econFaction(s, a.b);
    return '<tr><td>' + (A ? A.name : a.a) + ' × ' + (B ? B.name : a.b) + '</td><td>' + a.type +
      (a.breached ? '（已破裂）' : '') + '</td><td>' +
      (a.breached ? '—' : '<button class="btn sm" data-break="' + a.id + '">毁约</button>') + '</td></tr>';
  }).join('') : '<tr><td colspan="3">暂无协议</td></tr>';

  var html = '<div class="modal-mask" id="modal-mask"><div class="modal modal-wide">' +
    '<div class="modal-head">交易大厅（你：' + (econFaction(s, hfid) || {}).name + '）</div>' +
    '<div class="modal-body">' +
      '<h4>挂单</h4>' +
      '<div class="form-row">' +
        '<select id="o-side"><option value="buy">买</option><option value="sell">卖</option></select>' +
        '<select id="o-goods">' + goodsOpts + '</select>' +
        '<input id="o-qty" type="number" min="1" value="1" title="数量">' +
        '<input id="o-price" type="number" min="0" value="3" title="单价">' +
        '<button id="o-place" class="btn btn-primary">挂单</button>' +
      '</div>' +
      '<table class="tbl"><thead><tr><th>方向</th><th>货物</th><th>数量</th><th>单价</th><th>阵营</th><th>操作</th></tr></thead><tbody>' + orderRows + '</tbody></table>' +

      '<h4>私密报价（向某阵营提议出售）</h4>' +
      '<div class="form-row">' +
        '<select id="p-to">' + factionOpts + '</select>' +
        '<select id="p-goods">' + goodsOpts + '</select>' +
        '<input id="p-qty" type="number" min="1" value="1" title="数量">' +
        '<input id="p-price" type="number" min="0" value="3" title="单价">' +
        '<button id="p-propose" class="btn btn-primary">报价</button>' +
      '</div>' +
      '<table class="tbl"><thead><tr><th>方向</th><th>货物</th><th>数量</th><th>单价</th><th>操作</th></tr></thead><tbody>' + privRows + '</tbody></table>' +

      '<h4>协议（互不侵犯 / 供货）</h4>' +
      '<div class="form-row">' +
        '<select id="a-with">' + factionOpts + '</select>' +
        '<select id="a-type"><option value="nonaggression">互不侵犯</option><option value="supply">供货</option></select>' +
        '<button id="a-sign" class="btn btn-primary">签署</button>' +
      '</div>' +
      '<table class="tbl"><thead><tr><th>双方</th><th>类型</th><th>操作</th></tr></thead><tbody>' + agRows + '</tbody></table>' +
    '</div>' +
    '<div class="modal-foot"><button id="trade-close" class="btn">关闭</button></div>' +
    '</div></div>';

  var r = modalRoot(); if (!r) return;
  r.innerHTML = html;

  // 接公开挂单
  Array.prototype.forEach.call(r.querySelectorAll('[data-fill]'), function (btn) {
    btn.addEventListener('click', function () {
      economy.fillPublicOrder(s, btn.getAttribute('data-fill'), hfid);
      renderTradeModal(); render();
    });
  });
  // 接受私密报价
  Array.prototype.forEach.call(r.querySelectorAll('[data-acc]'), function (btn) {
    btn.addEventListener('click', function () {
      economy.acceptPrivate(s, btn.getAttribute('data-acc'), hfid);
      renderTradeModal(); render();
    });
  });
  // 毁约
  Array.prototype.forEach.call(r.querySelectorAll('[data-break]'), function (btn) {
    btn.addEventListener('click', function () {
      economy.breakAgreement(s, btn.getAttribute('data-break'), hfid);
      renderTradeModal(); render();
    });
  });
  // 挂单
  var op = el('o-place');
  if (op) op.addEventListener('click', function () {
    var side = el('o-side').value, goods = el('o-goods').value;
    var qty = Math.max(1, parseInt(el('o-qty').value, 10) || 1);
    var price = Math.max(0, parseInt(el('o-price').value, 10) || 0);
    economy.placeOrder(s, { side: side, factionId: hfid, goodsType: goods, qty: qty, price: price });
    renderTradeModal(); render();
  });
  // 私密报价
  var pp = el('p-propose');
  if (pp) pp.addEventListener('click', function () {
    var to = el('p-to').value, goods = el('p-goods').value;
    var qty = Math.max(1, parseInt(el('p-qty').value, 10) || 1);
    var price = Math.max(0, parseInt(el('p-price').value, 10) || 0);
    if (to) economy.proposePrivate(s, hfid, to, goods, qty, price);
    renderTradeModal(); render();
  });
  // 签协议
  var as = el('a-sign');
  if (as) as.addEventListener('click', function () {
    var withId = el('a-with').value, type = el('a-type').value;
    if (withId) economy.signAgreement(s, hfid, withId, type);
    renderTradeModal(); render();
  });
  // 关闭
  var cl = el('trade-close');
  if (cl) cl.addEventListener('click', closeModal);
  var mask = el('modal-mask');
  if (mask) mask.addEventListener('click', function (e) { if (e.target === mask) closeModal(); });
}

// ---------- 战争面板（宣战 + 小游戏加成）----------
// 战争小游戏题库（即时策略/选择题，确定性，不依赖 RNG）。每题一个正确选项索引。
var WAR_QUIZ_BANK = [
  { q: '（战略）敌众我寡，下列哪种最能提升胜算？', opts: ['倾全军正面强攻', '拉拢盟友分摊战力', '弃城逃跑', '原地观望'], ans: 1 },
  { q: '（后勤）开战前最该先确保的是？', opts: ['士气口号', '军费与补给充足', '敌情广播', '随机抽奖'], ans: 1 },
  { q: '（判断）若对方存活人数极少但军费雄厚，其战力取决于？', opts: ['仅人数', '仅军费加权', '人数与军费加权之和', '完全随机'], ans: 2 },
  { q: '（博弈）掠夺比例固定时，优先打哪类目标收益高？', opts: ['货多金多且人少', '货少人多的', '自家盟友', '已灭绝阵营'], ans: 0 },
  { q: '（决策）宣战费应从何处扣？', opts: ['凭空产生', '己方 won / militaryFund', '对手奖金池', '系统赠与'], ans: 1 }
];

// 预期掠夺量（用于 UI 预览，纯展示）。
function expectedPlunder(target) {
  return {
    goods: Math.round((Number(target.goods) || 0) * CONFIG.PLUNDER.goods),
    won: Math.round((Number(target.won) || 0) * CONFIG.PLUNDER.won)
  };
}

function openWarModal() {
  var s = GAME; if (!s) return;
  renderWarModal();
}

function renderWarModal() {
  var s = GAME; if (!s) return;
  var hfid = s.humanFactionId;
  var human = econFaction(s, hfid);
  var targets = s.factions.filter(function (f) { return f.alive && f.id !== hfid; });
  var targetOpts = targets.map(function (f) {
    var ep = expectedPlunder(f);
    return '<option value="' + f.id + '">' + f.name + '（货' + f.goods + ' 金' + f.won +
      ' 存活' + f.popAlive + ' · 预期掠夺 货+' + ep.goods + ' 金+' + ep.won + '）</option>';
  }).join('');
  var cost = CONFIG.WAR_COST[hfid];
  var canAfford = (Number(human.won) || 0) + (Number(human.militaryFund) || 0) >= cost;
  var locked = s.day < CONFIG.WAR_UNLOCK_DAY;

  var html = '<div class="modal-mask" id="modal-mask"><div class="modal modal-wide">' +
    '<div class="modal-head">宣战（你：' + (human ? human.name : hfid) + '）</div>' +
    '<div class="modal-body" id="war-body">';

  if (locked) {
    html += '<p class="warn">战争第 ' + CONFIG.WAR_UNLOCK_DAY + ' 天解锁，今日（第 ' + s.day + ' 天）尚不可宣战。</p>';
  } else if (targets.length === 0) {
    html += '<p class="warn">已无可选目标（其余阵营均灭绝）。</p>';
  } else {
    html += '<p>宣战费：<b>' + cost + '</b>（从你的 金/军费 扣除，并归入系统奖金池）。' +
      (canAfford ? '' : ' <span class="warn">你当前资源不足以支付宣战费。</span>') + '</p>';
    html += '<div class="form-row">' +
      '<label>目标：</label><select id="w-target">' + targetOpts + '</select>' +
      '<button id="w-confirm" class="btn btn-primary"' + (canAfford ? '' : ' disabled') + '>确认宣战 → 小游戏</button>' +
      '</div>';
    html += '<p class="hint">提示：宣战后需进入「结算」阶段才真正开战并自动掠夺；战争小游戏答对越多，你的战力加成越高。</p>';
  }
  html += '</div><div class="modal-foot"><button id="war-close" class="btn">关闭</button></div></div></div>';

  var r = modalRoot(); if (!r) return;
  r.innerHTML = html;

  var confirm = el('w-confirm');
  if (confirm) confirm.addEventListener('click', function () {
    var tid = el('w-target').value;
    openWarMinigame(tid);
  });
  var cl = el('war-close');
  if (cl) cl.addEventListener('click', closeModal);
  var mask = el('modal-mask');
  if (mask) mask.addEventListener('click', function (e) { if (e.target === mask) closeModal(); });
}

// 战争小游戏：答 WAR_MINIGAME.QUESTIONS 题，按答对数给加成 bonus（封顶 BONUS_MAX）。
function openWarMinigame(targetId) {
  var s = GAME; if (!s) return;
  var qs = WAR_QUIZ_BANK.slice(0, CONFIG.WAR_MINIGAME.QUESTIONS);
  var html = '<div class="modal-mask" id="modal-mask"><div class="modal modal-wide">' +
    '<div class="modal-head">战争小游戏 · 答对越多战力加成越高</div>' +
    '<div class="modal-body" id="war-quiz">';
  qs.forEach(function (q, i) {
    html += '<div class="quiz"><div class="quiz-q">' + (i + 1) + '. ' + esc(q.q) + '</div>';
    q.opts.forEach(function (opt, oi) {
      html += '<label class="quiz-opt"><input type="radio" name="wq' + i + '" value="' + oi + '"> ' + esc(opt) + '</label>';
    });
    html += '</div>';
  });
  html += '</div><div class="modal-foot">' +
    '<button id="war-submit" class="btn btn-primary">提交并宣战</button>' +
    '<button id="war-cancel" class="btn">取消</button></div></div></div>';

  var r = modalRoot(); if (!r) return;
  r.innerHTML = html;

  var submit = el('war-submit');
  if (submit) submit.addEventListener('click', function () {
    var correct = 0;
    qs.forEach(function (q, i) {
      var sel = document.querySelector('input[name="wq' + i + '"]:checked');
      if (sel && Number(sel.value) === q.ans) correct++;
    });
    var step = CONFIG.WAR_MINIGAME.BONUS_STEP, max = CONFIG.WAR_MINIGAME.BONUS_MAX;
    var bonus = Math.min(max, 1 + step * correct);
    var res = war.declareWar(s, s.humanFactionId, targetId, { bonus: bonus });
    if (res.ok) {
      closeModal();
      alert('已向 ' + (econFaction(s, targetId) || {}).name + ' 宣战！战争小游戏答对 ' + correct + '/' + qs.length +
        '，战力加成 ×' + bonus.toFixed(2) + '。\n将在进入「结算」阶段时统一开战并自动掠夺。');
      render();
    } else {
      alert('宣战失败：' + (res.reason || '未知原因'));
    }
  });
  var cancel = el('war-cancel');
  if (cancel) cancel.addEventListener('click', renderWarModal);
  var mask = el('modal-mask');
  if (mask) mask.addEventListener('click', function (e) { if (e.target === mask) closeModal(); });
}

function boot() {
  if (typeof document === 'undefined') return;
  if (!el('app')) {
    // 兼容：若 index.html 未提供 #app，则挂在 body。
    var d = document.createElement('div');
    d.id = 'app';
    (document.body || document.documentElement).appendChild(d);
  }
  startNewGame((Date.now() & 0x7fffffff) ^ Math.floor((typeof Math !== 'undefined' ? Math.random() : 0) * 1e9));
}

// 浏览器入口：defer 脚本在 DOMContentLoaded 前执行完，监听即可。
if (typeof document !== 'undefined' && document.addEventListener) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}

if (typeof globalThis !== 'undefined') {
  globalThis.GAME = GAME;
  globalThis.ENGINE = ENGINE;
  globalThis.startNewGame = startNewGame;
  globalThis.render = render;
  globalThis.boot = boot;
}
