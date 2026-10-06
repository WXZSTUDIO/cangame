/* 家庭财务 / 未成年免负债 / 遗产继承 测试 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const ctx = { console, Math, JSON, Date, isNaN, parseInt, Number };
vm.createContext(ctx);
['assets/data.js', 'assets/market.js', 'assets/engine.js'].forEach(f => {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
});
vm.runInContext('this.__X = { FAMILIES: FAMILIES };', ctx);
const FAMILIES = ctx.__X.FAMILIES;
const {
  createGame, resolveEvent, eventChoices, makeInheritanceEvent,
  initFamilyFin, yearBase, fmtMoney
} = ctx;

const fail = [];
function ok(cond, label, extra) {
  console.log((cond ? '  ✓ ' : '  ✗ ') + label + (extra ? '  → ' + extra : ''));
  if (!cond) fail.push(label);
}

console.log('== 1. 家庭账簿初始化（按出生年代缩放） ==');
let allFin = true;
FAMILIES.forEach(f => {
  const st = createGame({ name: 't', gender: 'M', familyId: f.id, startYear: 1985, talents: [] });
  if (!(st.family && typeof st.family.assets === 'number' && typeof st.family.debt === 'number')) allFin = false;
});
ok(allFin, '8 个出身全部生成家庭账簿');
const early = initFamilyFin('banjiha', 1955);
const late = initFamilyFin('banjiha', 2005);
ok(late.assets > early.assets * 10, '年代缩放生效（1955 vs 2005）',
  `${fmtMoney(early.assets)} → ${fmtMoney(late.assets)}`);
const orphan = createGame({ name: 't', gender: 'M', familyId: 'orphan', startYear: 1985, talents: [] });
ok(orphan.flags.parents_alive === false, '孤儿出身：父母不在');

console.log('\n== 2. 未成年不背债（0–17岁 个人现金不因生活支出减少） ==');
const kid = createGame({ name: 't', gender: 'M', familyId: 'banjiha', startYear: 1985, talents: [] });
let dropped = false;
let startMoney = kid.stats.MONEY;
for (let a = 1; a <= 17; a++) {
  kid.age = a;
  kid.job = (a <= 6) ? '婴儿' : (a <= 12) ? '小学生' : (a <= 15) ? '初中生' : '高中生';
  const before = kid.stats.MONEY;
  yearBase(kid);
  if (kid.stats.MONEY < before) dropped = true;
}
ok(!dropped, '0–17岁 个人现金未被生活支出扣减',
  `起始 ${fmtMoney(startMoney)} → 17岁 ${fmtMoney(kid.stats.MONEY)}`);
ok(kid.family.assets >= 0 && kid.family.debt >= 0, '家庭账簿数值有效',
  `资产 ${fmtMoney(kid.family.assets)} / 负债 ${fmtMoney(kid.family.debt)}`);
ok(kid.family.debt > 0 || kid.family.assets < initFamilyFin('banjiha', 1985).assets,
  '家庭确实承担了抚养开销');

console.log('\n== 3. 父母离世 → 继承三选一 ==');
function makeAdult(familyId) {
  const st = createGame({ name: 't', gender: 'M', familyId: familyId, startYear: 1985, talents: [] });
  st.age = 45; st.job = '会社员';
  st.family = initFamilyFin(familyId, 1985);
  return st;
}
const a1 = makeAdult('prof');
resolveEvent(a1, { id: 'test_kp', text: '父母走了。', killParents: true }, -1);
ok(a1.flags.parents_alive === false, '父母标记已翻转');
ok(!!(a1.queue && a1.queue[0] && String(a1.queue[0].ev.id).indexOf('inherit_at_') === 0),
  '继承事件已排入队首');
const iev = a1.queue[0].ev;
ok((eventChoices(a1, iev) || []).length === 3, '继承有 3 个选项');
console.log('   prof 家底：遗产 ' + fmtMoney(initFamilyFin('prof', 1985).assets) +
  ' / 债务 ' + fmtMoney(initFamilyFin('prof', 1985).debt));

// 全额继承
const aFull = makeAdult('prof');
resolveEvent(aFull, { id: 'test_kp', killParents: true }, -1);
const mFull = aFull.stats.MONEY;
const expectFull = aFull.family.assets - aFull.family.debt;
resolveEvent(aFull, aFull.queue.shift().ev, 0);
ok(aFull.stats.MONEY === Math.round(mFull + expectFull), '全额继承：净资产已过户',
  `${fmtMoney(mFull)} + ${fmtMoney(expectFull)} → ${fmtMoney(aFull.stats.MONEY)}`);
ok(aFull.flags.inherit_full === true, '标记 inherit_full');
ok(aFull.family.debt === 0 && aFull.family.assets === 0, '继承后家庭账簿结清');

// 限定继承（债务 > 遗产时不倒贴）
const aLim = makeAdult('banjiha');
resolveEvent(aLim, { id: 'test_kp', killParents: true }, -1);
const mLim = aLim.stats.MONEY;
const expectLim = Math.max(0, aLim.family.assets - Math.min(aLim.family.debt, aLim.family.assets));
resolveEvent(aLim, aLim.queue.shift().ev, 1);
ok(aLim.stats.MONEY === Math.round(mLim + expectLim), '限定继承：只还遗产范围内的债',
  `+${fmtMoney(expectLim)}`);
ok(aLim.flags.inherit_limited === true, '标记 inherit_limited');

// 放弃继承
const aNon = makeAdult('banjiha');
const mNon = aNon.stats.MONEY;
resolveEvent(aNon, { id: 'test_kp', killParents: true }, -1);
resolveEvent(aNon, aNon.queue.shift().ev, 2);
ok(aNon.flags.inherit_none === true, '标记 inherit_none');
ok(aNon.stats.MONEY === mNon, '放弃继承：现金分文未动', fmtMoney(aNon.stats.MONEY));
ok(aNon.family.debt === 0, '放弃继承：家庭债务清零');

console.log('\n== 4. 未成年丧亲 → 亲戚处理后事 ==');
const minor = createGame({ name: 't', gender: 'M', familyId: 'single', startYear: 1990, talents: [] });
minor.age = 10;
minor.family.debt = 50000000;
resolveEvent(minor, { id: 'test_kp2', killParents: true }, -1);
ok(minor.family.debt === 0, '未成年：债务勾销');
ok(!(minor.queue || []).some(q => q.ev && String(q.ev.id).indexOf('inherit_at_') === 0),
  '未成年：不触发继承选择');

console.log('\n== 5. 继承事件文案 ==');
const demo = makeInheritanceEvent(makeAdult('rentier'));
ok(demo.text.indexOf('遗产') >= 0 && demo.text.indexOf('债务') >= 0, '文案含遗产与债务金额');
ok(demo.choices.every(c => c.text && c.text.length > 4), '三个选项文案完整');

console.log('\n' + (fail.length ? '❌ 失败 ' + fail.length + ' 项: ' + fail.join(' / ') : '✅ 全部通过'));
process.exit(fail.length ? 1 : 0);
