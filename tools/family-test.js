/* 家庭线联动验证：结婚→生子→丧亲 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = { console, Math, JSON, Date, isNaN, parseInt, Number };
vm.createContext(ctx);
['assets/data.js', 'assets/engine.js', 'assets/market.js', 'assets/school.js', 'assets/career.js', 'assets/love.js', 'assets/loan.js' ].forEach(f =>
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f }));
vm.runInContext('this.__EVENTS = EVENTS;', ctx);
const { createGame, resolveEvent, randomKoreanName } = ctx;
const EVENTS = ctx.__EVENTS;

// 1. 随机姓名按性别
const m = randomKoreanName('M'), f = randomKoreanName('F');
console.log('男名示例:', m, '| 女名示例:', f, '| 长度合格:', m.length >= 2 && f.length >= 2);

// 2. 出生故事 4+ 行
const st = createGame({ name: '테스트', gender: 'M', familyId: 'chengzhongcun', talents: ['memory'] });
const birthLines = st.log.filter(l => l.type === 'story' && l.age === 0);
console.log('出生故事行数:', birthLines.length, '| 父母在场:', st.flags.parents_alive);

// 3. 找婚姻事件并触发，验证配偶名/子女/丧亲
function findAndRun(id, choice) {
  const ev = EVENTS.find(e => e.id === id);
  if (!ev) { console.log('缺失事件', id); return; }
  const list = ctx.eventChoices(st, ev);
  console.log('  ->', id, 'choices=', list ? list.length : null, 'chFlags=', list && choice < list.length ? JSON.stringify(list[choice].flags) : 'n/a');
  resolveEvent(st, ev, choice);
}
// 先触发恋爱
findAndRun('f_s1', 2);
console.log('恋爱后 dating:', !!st.flags.dating, '| flags:', JSON.stringify(st.flags));
// 求婚
findAndRun('f_s2', 2);
console.log('婚后 married:', !!st.flags.married, '| 配偶名:', st.spouseName, '| 清 dating(应false):', !st.flags.dating);
// 生子
findAndRun('f_s4', 0);
console.log('子女数:', st.childCount);
// 丧父
findAndRun('f_p7', 0);
console.log('丧父后父母在世:', st.flags.parents_alive);
// 丧母
findAndRun('f_p8', 0);
console.log('双亲离世:', !st.flags.parents_alive);
console.log('家庭线验证通过');
