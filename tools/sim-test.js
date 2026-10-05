/* 离线冒烟测试：不依赖浏览器，模拟整局人生（含市场系统） */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const ctx = { console, Math, JSON, Date, isNaN, parseInt, Number };
vm.createContext(ctx);
['assets/data.js', 'assets/market.js', 'assets/engine.js'].forEach(f => {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
});

const api = vm.runInContext(
  '({createGame, step, resolveEvent, resolveInvest, finish, scoreOf, eventChoices, fmtMoney,' +
  ' FAMILIES, TALENTS, ENDINGS, EVENTS, INVESTMENTS, netWorth, HOUSES, CARS, GOODS, STOCKS, marketTick})',
  ctx
);
const {
  createGame, step, resolveEvent, resolveInvest, finish, scoreOf, eventChoices,
  fmtMoney, FAMILIES, TALENTS, ENDINGS, EVENTS, INVESTMENTS, netWorth,
  HOUSES, CARS, GOODS, STOCKS
} = api;

/* 玩法策略：style = 'random' | 'safe' | 'aggressive' | 'market' */
function pickIndex(st, ev, style) {
  const list = eventChoices(st, ev);
  if (!list || !list.length) return -1;
  if (style === 'safe') return 0;
  if (style === 'aggressive') return list.length - 1;
  return Math.floor(Math.random() * list.length);
}

/* 自动交易：验证市场买卖链路（仅 market / aggressive 策略启用） */
function trade(st, style) {
  if (style !== 'market' && style !== 'aggressive') return;
  const y = 1985 + st.age;
  const cash = st.stats.MONEY;
  if (cash <= 0) return;
  // 有余钱先买房（首付 50%）
  if (st.age >= 25 && !st.flags.own_house) {
    const h = HOUSES.filter(x => !x.jeonse && x.minYear <= y)
      .filter(x => ctx.housePrice(st, x) * 0.5 <= cash)
      .sort((a, b) => b.base - a.base)[0];
    if (h) ctx.buyProp(st, 'house', h.id, 0.5, 1);
  }
  // 再买股票：用剩余现金的 40%
  const s = STOCKS.filter(x => x.minYear <= y).sort((a, b) => b.growth - a.growth)[0];
  if (s) {
    const p = ctx.stockPrice(st, s.id);
    ctx.buyStock(st, s.id, Math.floor(st.stats.MONEY * 0.4 / Math.max(1, p)));
  }
  // 偶尔卖出（验证卖出链路）
  if (st.age >= 60 && st.market.props.length) {
    ctx.sellProp(st, st.market.props[0].uid);
  }
  if (st.age >= 55 && st.market.stocks.length) {
    ctx.sellStock(st, st.market.stocks[0].id, Math.floor(st.market.stocks[0].shares / 2));
  }
}

function playOne(seedTalents, style) {
  const st = createGame({
    name: '테스트', gender: Math.random() < 0.5 ? 'M' : 'F',
    familyId: FAMILIES[Math.floor(Math.random() * FAMILIES.length)].id,
    talents: seedTalents
  });
  let guard = 0;
  while (!st.finished && guard++ < 600) {
    let item = step(st);
    if (!item || item.type === 'end') { if (!st.finished) finish(st); break; }
    if (item.type === 'year') continue;
    if (item.type === 'event') resolveEvent(st, item.ev, pickIndex(st, item.ev, style));
    else if (item.type === 'invest') {
      const opts = item.choices.filter(c => !c.disabled && c.act === 'invest');
      if (opts.length && Math.random() < 0.85) resolveInvest(st, opts[Math.floor(Math.random() * opts.length)]);
      else resolveInvest(st, item.choices[item.choices.length - 1]);
    }
    while (st.queue && st.queue.length && !st.finished) {
      const q = st.queue.shift();
      if (q.type === 'year') continue;
      if (q.type === 'event') resolveEvent(st, q.ev, pickIndex(st, q.ev, style));
      else if (q.type === 'invest') {
        const opts = q.choices.filter(c => !c.disabled && c.act === 'invest');
        if (opts.length) resolveInvest(st, opts[Math.floor(Math.random() * opts.length)]);
        else resolveInvest(st, q.choices[q.choices.length - 1]);
      }
    }
    trade(st, style);
  }
  return st;
}

function run(style, n) {
  let ok = 0, err = 0;
  const endings = {};
  let worthSum = 0, cashSum = 0; const worths = [];
  for (let i = 0; i < n; i++) {
    try {
      const talents = ['memory', 'math', 'gangnam', 'stock', 'estate', 'lucky']
        .filter(() => Math.random() < 0.5);
      const st = playOne(talents, style);
      if (!st.finished) throw new Error('未结束: age=' + st.age);
      if (!st.ending) throw new Error('无结局');
      const sc = scoreOf(st);
      if (typeof sc !== 'number' || isNaN(sc)) throw new Error('评分异常');
      if (isNaN(st.stats.MONEY)) throw new Error('现金 NaN');
      const w = netWorth(st);
      if (isNaN(w)) throw new Error('净资产 NaN');
      worthSum += w; cashSum += st.stats.MONEY; worths.push(w);
      endings[st.ending.title] = (endings[st.ending.title] || 0) + 1;
      ok++;
    } catch (e) { err++; if (err < 4) console.error('[' + style + '] 第 ' + i + ' 局失败:', e.message, e.stack.split('\n')[1]); }
  }
  console.log(`\n== 策略 ${style} ==`);
  worths.sort((a, b) => a - b);
  const p50 = worths[Math.floor(worths.length * 0.5)] || 0;
  const p90 = worths[Math.floor(worths.length * 0.9)] || 0;
  console.log('通过 ' + ok + ' / 失败 ' + err +
    ' | 净资产 中位 ' + fmtMoney(p50) + ' / 均 ' + fmtMoney(worthSum / Math.max(1, ok)) +
    ' / p90 ' + fmtMoney(p90));
  const top = Object.entries(endings).sort((a, b) => b[1] - a[1]).slice(0, 8);
  top.forEach(([k, v]) => console.log('  ' + k + ' × ' + v));
}

run('random', 120);
run('safe', 80);
run('aggressive', 80);
run('market', 80);

// 静态检查
const ids = new Set();
let dup = 0;
EVENTS.forEach(e => { if (ids.has(e.id)) { dup++; console.error('重复事件 id:', e.id); } ids.add(e.id); });
const withChoices = EVENTS.filter(e => e.choices && e.choices.length).length;
console.log('\n事件总数:', EVENTS.length, '（自带 3 选项:', withChoices, '）',
  '| 房产:', HOUSES.length, '车:', CARS.length, '资产:', GOODS.length, '股票:', STOCKS.length,
  '| 投资:', INVESTMENTS.length, '结局:', ENDINGS.length, '重复id:', dup);
console.log('金额格式:', fmtMoney(0), '|', fmtMoney(12345678), '|', fmtMoney(-250000000), '|', fmtMoney(1.4e11));
