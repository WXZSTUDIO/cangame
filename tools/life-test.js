/* 人生线验证：随机投胎 / 活到100+ / 8项指标 / 宠物 / 擅长领域 / 孙辈 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = { console, Math, JSON, Date, isNaN, parseInt, Number };
vm.createContext(ctx);
['assets/data.js', 'assets/engine.js', 'assets/market.js'].forEach(f =>
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f }));
// const 声明不会挂到 vm context 上，需要显式导出
vm.runInContext('this.__EVENTS = EVENTS; this.__LIFE_METRICS = LIFE_METRICS; this.__PRIORITIES = PRIORITIES; this.__GAME_META = GAME_META;', ctx);
const { createGame, resolveEvent, eventChoices, step, resolveInvest, yearBase, matchEvent, fmtYear } = ctx;
const EVENTS = ctx.__EVENTS;
const LIFE_METRICS = ctx.__LIFE_METRICS;
const PRIORITIES = ctx.__PRIORITIES;
const GAME_META = ctx.__GAME_META;

let fail = 0;
function ok(cond, label, extra) {
  console.log((cond ? '  ✓ ' : '  ✗ ') + label + (extra !== undefined ? ' → ' + extra : ''));
  if (!cond) fail++;
}

/* 1. 随机出生年份 */
console.log('== 随机投胎 ==');
const years = [];
for (let i = 0; i < 200; i++) {
  const s = createGame({ name: '테스트', gender: 'M', familyId: 'banjiha' });
  years.push(s.startYear);
}
const minY = Math.min.apply(null, years), maxY = Math.max.apply(null, years);
const uniq = Array.from(new Set(years)).length;
ok(minY >= 1955 && maxY <= 2005, '出生年份落在 1955–2005', `min=${minY} max=${maxY}`);
ok(uniq > 30, '年份随机（去重数）', uniq + ' 种');
const s1 = createGame({ name: '테스트', gender: 'M', familyId: 'banjiha' });
ok(fmtYear(s1) === s1.startYear, 'fmtYear 跟随随机年份', fmtYear(s1) + '년');

/* 2. 8 项人生指标存在且有自然成长 */
console.log('== 8 项人生指标 ==');
['CUR', 'LOVE', 'SEC', 'AUTO', 'GROW'].forEach(k => {
  ok(s1.stats[k] !== undefined, '新增指标 ' + k + ' 已初始化', s1.stats[k]);
});
const met = ['HP', 'CUR', 'LOVE', 'SEC', 'FAME', 'AUTO', 'CHA', 'GROW'];
console.log('  LIFE_METRICS 面板项数:', (LIFE_METRICS || []).length, '| 键:', met.join(','));
ok((LIFE_METRICS || []).length === 8, 'LIFE_METRICS 共 8 项');
ok((PRIORITIES || []).length === 4, 'PRIORITIES 共 4 个方向');

// 跑到成年，指标应上升
{
  const st = createGame({ name: '테스트', gender: 'M', familyId: 'banjiha' });
  const before = Object.assign({}, st.stats);
  for (let i = 0; i < 20; i++) { st.age++; yearBase(st); }
  ok(st.stats.GROW > before.GROW, 'GROW 随年龄增长', before.GROW + ' → ' + Math.round(st.stats.GROW));
  ok(st.stats.CUR > before.CUR, 'CUR 童年/少年期上升', before.CUR + ' → ' + Math.round(st.stats.CUR));
}

/* 3. 宠物系统 */
console.log('== 宠物 ==');
{
  const st = createGame({ name: '테스트', gender: 'M', familyId: 'banjiha' });
  const pet1 = EVENTS.find(e => e.id === 'f2_pet1');
  st.age = 12;
  const list = eventChoices(st, pet1);
  ok(list && list.length === 3, '领养事件有 3 个选项');
  resolveEvent(st, pet1, 0); // 领养小狗
  ok(st.pet && st.pet.type === 'dog' && st.pet.alive, '领养狗成功', st.pet && st.pet.name);
  const loveBefore = st.stats.LOVE;
  st.age++; yearBase(st);
  ok(st.stats.LOVE > loveBefore, '宠物带来关爱增长', Math.round(loveBefore) + ' → ' + Math.round(st.stats.LOVE));
  // 猫咪也行
  const st2 = createGame({ name: '테스트', gender: 'F', familyId: 'single' });
  st2.age = 12;
  resolveEvent(st2, pet1, 1);
  ok(st2.pet && st2.pet.type === 'cat', '领养猫成功', st2.pet && st2.pet.name);
  // 宠物离世
  const pet3 = EVENTS.find(e => e.id === 'f2_pet3');
  st.age = 60;
  ok(matchEvent(st, pet3), '有宠物时「宠物离世」事件可抽到');
  resolveEvent(st, pet3, 1);
  ok(st.pet && st.pet.alive === false, '宠物离世生效');
  const st3 = createGame({ name: 'x', gender: 'M', familyId: 'orphan' });
  st3.age = 60;
  ok(!matchEvent(st3, pet3), '没养宠物时不会出现该事件');
}

/* 4. 擅长领域 priority 起作用 */
console.log('== 擅长领域 ==');
{
  function meanOf(prio, key, n) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const st = createGame({ name: '테스트', gender: 'M', familyId: 'banjiha', priority: prio });
      for (let y = 0; y < 40; y++) { st.age++; yearBase(st); }
      sum += st.stats[key];
    }
    return sum / n;
  }
  const loveR = meanOf('relation', 'LOVE', 20);
  const loveB = meanOf('balance', 'LOVE', 20);
  ok(loveR > loveB, 'relation 倾向的关爱高于 balance', Math.round(loveR) + ' vs ' + Math.round(loveB));
  const s1b = createGame({ name: '테스트', gender: 'M', familyId: 'banjiha', priority: 'career' });
  ok(s1b.priority === 'career', 'createGame 存入 priority', s1b.priority);
}

/* 5. 孙辈：孩子结婚 → 孙辈出生 → 含孙条件的事件可抽到 */
console.log('== 家庭：孩子结婚 → 孙辈 ==');
{
  const st = createGame({ name: '테스트', gender: 'M', familyId: 'banjiha' });
  st.flags.married = true; st.spouseName = '김서연'; st.childCount = 1;
  const ch5 = EVENTS.find(e => e.id === 'f2_ch5');
  st.age = 50;
  ok(matchEvent(st, ch5), '有子女时可抽到「孩子结婚」');
  resolveEvent(st, ch5, 1);
  ok(st.grandCount === 1, '孙辈计数 +1', st.grandCount);
  const gr1 = EVENTS.find(e => e.id === 'f2_gr1');
  st.age = 60;
  ok(matchEvent(st, gr1), '有孙辈后可抽到「含饴弄孙」事件');
  resolveEvent(st, gr1, 0);
  ok(st.stats.LOVE > 0, '天伦之乐提升关爱', Math.round(st.stats.LOVE));
}

/* 6. 跑到 100 岁以上（养老➜退休➜自然老死） */
console.log('== 寿命：0 → 100+ ==');
{
  const END_AGE = GAME_META.endAge;
  console.log('  endAge =', END_AGE);
  let maxAge = 0, reached100 = 0, retired = 0, deaths = {};
  for (let run = 0; run < 40; run++) {
    const st = createGame({ name: '테스트', gender: 'M', familyId: 'prof', priority: 'balance' });
    let guard = 0;
    while (!st.finished && guard++ < 2000) {
      const it = step(st);
      if (!it || it.type === 'end') break;
      if (it.type === 'event') {
        const list = eventChoices(st, it.ev);
        resolveEvent(st, it.ev, list ? 0 : undefined); // 稳健策略
      } else if (it.type === 'invest') {
        resolveInvest(st, it.choices[it.choices.length - 1]); // 放弃投资
      }
    }
    maxAge = Math.max(maxAge, st.age);
    if (st.age >= 100) reached100++;
    if (st.job === '退休') retired++;
    const t = st.ending ? st.ending.title : '无';
    deaths[t] = (deaths[t] || 0) + 1;
  }
  console.log('  结局分布:', JSON.stringify(deaths));
  ok(maxAge >= 100, '有人活到 100 岁以上', 'max=' + maxAge);
  ok(reached100 > 0, '活到百岁的局数次', reached100 + '/40');
  ok(retired > 0, '存在退休状态', retired + '/40');
}

console.log(fail === 0 ? '\n人生线全部验证通过' : '\n存在 ' + fail + ' 项未通过');
process.exit(fail === 0 ? 0 : 1);
