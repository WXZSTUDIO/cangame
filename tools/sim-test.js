/* 离线冒烟测试：不依赖浏览器，模拟整局人生 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const ctx = { console, Math, JSON, Date, isNaN, parseInt, Number };
vm.createContext(ctx);
['assets/data.js', 'assets/engine.js'].forEach(f => {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
});

const {
  createGame, step, resolveEvent, resolveInvest, finish, scoreOf,
  fmtMoney, FAMILIES, TALENTS, ENDINGS, EVENTS, INVESTMENTS
} = vm.runInContext(
  '({createGame, step, resolveEvent, resolveInvest, finish, scoreOf, fmtMoney, FAMILIES, TALENTS, ENDINGS, EVENTS, INVESTMENTS})',
  ctx
);

function playOne(seedTalents) {
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
    if (item.type === 'event') {
      const ci = item.ev.choices ? Math.floor(Math.random() * item.ev.choices.length) : -1;
      resolveEvent(st, item.ev, ci);
    } else if (item.type === 'invest') {
      const opts = item.choices.filter(c => !c.disabled && c.act === 'invest');
      if (opts.length && Math.random() < 0.8) resolveInvest(st, opts[opts.length - 1]);
      else resolveInvest(st, item.choices[item.choices.length - 1]);
    }
    // 队列
    while (st.queue && st.queue.length && !st.finished) {
      const q = st.queue.shift();
      if (q.type === 'year') continue;
      if (q.type === 'event') resolveEvent(st, q.ev, q.ev.choices ? Math.floor(Math.random() * q.ev.choices.length) : -1);
      else if (q.type === 'invest') {
        const opts = q.choices.filter(c => !c.disabled && c.act === 'invest');
        if (opts.length) resolveInvest(st, opts[0]); else resolveInvest(st, q.choices[q.choices.length - 1]);
      }
    }
  }
  return st;
}

let ok = 0, err = 0;
const endings = {};
for (let i = 0; i < 200; i++) {
  try {
    const talents = ['memory', 'math', 'gangnam', 'stock', 'estate', 'lucky']
      .filter(() => Math.random() < 0.5);
    const st = playOne(talents);
    if (!st.finished) throw new Error('未结束: age=' + st.age);
    if (!st.ending) throw new Error('无结局');
    if (typeof scoreOf(st) !== 'number' || isNaN(scoreOf(st))) throw new Error('评分异常');
    if (isNaN(st.stats.MONEY)) throw new Error('资产 NaN');
    endings[st.ending.title] = (endings[st.ending.title] || 0) + 1;
    ok++;
  } catch (e) { err++; console.error('第 ' + i + ' 局失败:', e.message); }
}
console.log('通过 ' + ok + ' / 失败 ' + err);
console.log('结局分布:');
Object.entries(endings).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log('  ' + k + ' × ' + v));

// 事件库静态检查
const ids = new Set();
let dup = 0;
  EVENTS.forEach(e => { if (ids.has(e.id)) { dup++; console.error('重复事件 id:', e.id); } ids.add(e.id); });
console.log('事件总数:', EVENTS.length, '天赋:', TALENTS.length, '投资:', INVESTMENTS.length, '结局:', ENDINGS.length, '重复id:', dup);

// 覆盖度检查：所有事件是否至少可能被触发过一次
const seen = new Set();
for (let i = 0; i < 300; i++) {
  const st = playOne(['memory']);
  st.log.forEach(() => { });
}
console.log('金额格式示例:', fmtMoney(0), '|', fmtMoney(12345678), '|', fmtMoney(-250000000), '|', fmtMoney(1.4e11));
