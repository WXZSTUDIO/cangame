/* 检验「全力投资」路线能否触达财阀结局 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = { console, Math, JSON, Date, isNaN, parseInt, Number };
vm.createContext(ctx);
['assets/data.js', 'assets/engine.js'].forEach(f =>
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f }));
const { createGame, step, resolveEvent, resolveInvest, finish, fmtMoney } =
  vm.runInContext('({createGame, step, resolveEvent, resolveInvest, finish, fmtMoney})', ctx);

function run(strategy) {
  const st = createGame({ name: 'POWER', gender: 'M', familyId: 'banjiha', talents: ['memory', 'stock', 'estate', 'gangnam', 'math'] });
  let guard = 0;
  const drain = () => {
    while (st.queue && st.queue.length && !st.finished) {
      const q = st.queue.shift();
      if (q.type === 'year') continue;
      if (q.type === 'event') resolveEvent(st, q.ev, q.ev.choices ? (strategy === 'self' && q.ev.id === 't02' ? 2 : 0) : -1);
      else if (q.type === 'invest') {
        const opts = q.choices.filter(c => !c.disabled && c.act === 'invest');
        resolveInvest(st, opts.length ? opts[opts.length - 1] : q.choices[q.choices.length - 1]);
      }
    }
  };
  while (!st.finished && guard++ < 600) {
    const item = step(st);
    if (!item || item.type === 'end') { if (!st.finished) finish(st); break; }
    if (item.type === 'year') continue;
    if (item.type === 'event') resolveEvent(st, item.ev, item.ev.choices ? (strategy === 'self' && item.ev.id === 't02' ? 2 : 0) : -1);
    else if (item.type === 'invest') {
      const opts = item.choices.filter(c => !c.disabled && c.act === 'invest');
      resolveInvest(st, opts.length ? opts[opts.length - 1] : item.choices[item.choices.length - 1]);
    }
    drain();
  }
  return st;
}

['max', 'self'].forEach(s => {
  let top = 0, kings = 0, money = [];
  for (let i = 0; i < 100; i++) {
    const st = run(s);
    money.push(st.stats.MONEY);
    if (st.flags.took_over) kings++;
    if (st.stats.MONEY > top) top = st.stats.MONEY;
  }
  money.sort((a, b) => b - a);
  console.log(`策略=${s} 收购成功=${kings}/100 最高资产=${fmtMoney(top)} 中位数=${fmtMoney(money[50])} 末位=${fmtMoney(money[99])}`);
});
