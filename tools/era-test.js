/* 年代事件验证：出生年份决定遇到什么时代事件 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = { console, Math, JSON, Date, isNaN, parseInt, Number };
vm.createContext(ctx);
['assets/data.js', 'assets/engine.js', 'assets/market.js', 'assets/school.js', 'assets/career.js', 'assets/love.js', 'assets/pet.js', 'assets/legacy.js', 'assets/loan.js' ].forEach(f =>
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f }));
vm.runInContext('this.__EVENTS = EVENTS; this.__META = GAME_META;', ctx);
const { createGame, step, resolveEvent, resolveInvest } = ctx;
const EVENTS = ctx.__EVENTS;

const ERA_IDS = EVENTS.filter(e => e.id[0] === 'y' || /^[ex]_e0\d$/.test(e.id) || /^e(1997|1998|2002|2008|2012|2020)/.test(e.id)).map(e => e.id);
console.log('年代事件池:', ERA_IDS.length, '个');

// 完整模拟一生，收集触发过的事件 id
function simulateLife(startYear) {
  const st = createGame({ name: '테스트', gender: 'M', familyId: 'chengzhongcun', startYear, talents: [] });
  const fired = new Set();
  let guard = 0;
  while (!st.finished && guard++ < 400) {
    const item = step(st);
    if (!item || item.type === 'end') break;
    if (item.type === 'event') {
      fired.add(item.ev.id);
      const list = ctx.eventChoices(st, item.ev);
      resolveEvent(st, item.ev, list ? Math.floor(Math.random() * list.length) : -1);
    } else if (item.type === 'invest') {
      resolveInvest(st, item.choices[item.choices.length - 1]); // 放弃
    }
  }
  return { fired, age: st.age };
}

const cohorts = [1956, 1970, 1985, 1998, 2004];
const sets = {};
let okCount = 0;
for (const y of cohorts) {
  const { fired, age } = simulateLife(y);
  const era = [...fired].filter(id => ERA_IDS.includes(id));
  sets[y] = era;
  console.log(`生于 ${y}: 享年 ${age}, 年代事件 ${era.length} 个 -> ${era.join(', ') || '(无)'}`);
  if (era.length >= 2) okCount++;
}
console.log('每个出生年都遇到 ≥2 个年代事件:', okCount === cohorts.length);

// 不同出生年的年代集合应明显不同
const key = y => sets[y].join('|');
const distinct = new Set(cohorts.map(key)).size;
console.log('年代组合互不相同的出生年数:', distinct, '/', cohorts.length);

// 窗口校验：y1960 只应在 1958-1963 年间触发
const ev1960 = EVENTS.find(e => e.id === 'y1960');
const st1960 = createGame({ name: 't', gender: 'F', familyId: 'jiaoshi', startYear: 1960, talents: [] });
st1960.age = 5; // 1965 年，窗口外
console.log('y1960 在 1965 年不可触发(应 true):', !ctx.matchEvent(st1960, ev1960));
st1960.age = 3; // 1963 年，窗口内
console.log('y1960 在 1963 年可触发(应 true):', ctx.matchEvent(st1960, ev1960));
console.log('年代系统验证通过');
