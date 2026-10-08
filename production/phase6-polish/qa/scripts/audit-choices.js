/* 选项质量审计：伪选择 / 支配选项 / 选项数分布 / 事件年龄覆盖
 * 用法：node audit-choices.js -> out/choices.md
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..', '..', '..');
const OUT = path.join(__dirname, 'out');

const ctx = {
  console, Math, JSON, Date, isNaN, isFinite, parseInt, parseFloat, Number, String, Array, Object, Boolean, RegExp, Error, Map, Set,
  setTimeout, clearTimeout,
  window: { addEventListener() {} },
  document: { addEventListener() {}, getElementById() { return null; }, querySelectorAll() { return []; }, querySelector() { return null; }, createElement() { return { style: {}, setAttribute() {}, appendChild() {} }; }, body: { appendChild() {}, classList: { add() {}, remove() {} } } },
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} }
};
vm.createContext(ctx);
['assets/data.js', 'assets/market.js', 'assets/engine.js', 'assets/school.js',
  'assets/career.js', 'assets/love.js', 'assets/loan.js', 'assets/ui.js']
  .forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));
const A = vm.runInContext(`({ EVENTS, ENDINGS, CHOICE_TEMPLATES, TALENTS, FAMILIES, GOOD_DEEDS, INVESTMENTS, UNI_ACTIVITIES, ILLNESS, ACHIEVEMENTS, eventChoices, createGame, scaleEff, CAREERS })`, ctx);

const L = []; const w = s => L.push(s);
w('# 选项质量审计（伪选择 / 支配项 / 覆盖率）\n');

/* ---- 1. 事件选项数分布 ---- */
const cnt = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
A.EVENTS.forEach(e => { const n = (e.choices || []).length; cnt[n] = (cnt[n] || 0) + 1; });
w(`\n## 1. 事件自带选项数分布（EVENTS 共 ${A.EVENTS.length} 条）\n`);
w('| 自带选项数 | 事件数 | 占比 | 说明 |');
w('|---|---|---|---|');
const note = {
  0: '走 eventChoices() 模板三选一（公式生成）',
  1: '单按钮叙事，无决策',
  2: '二选一',
  3: '标准三选一',
  4: '四选一'
};
Object.keys(cnt).forEach(k => w(`| ${k} | ${cnt[k]} | ${(cnt[k] / A.EVENTS.length * 100).toFixed(0)}% | ${note[k]} |`));
w(`\n**模板生成（无手写选项）的事件占比：${(cnt[0] / A.EVENTS.length * 100).toFixed(0)}%**`);

/* ---- 2. 手写三选项中「效果完全相同 / 几乎相同」的伪选择 ---- */
w('\n\n## 2. 手写选项中的伪选择（三条选项 eff 完全相同）\n');
const dup = [];
A.EVENTS.forEach(e => {
  const cs = e.choices || [];
  if (cs.length < 2) return;
  const keys = cs.map(c => JSON.stringify(c.eff || {}));
  const uniq = new Set(keys);
  if (uniq.size === 1 && keys[0] !== '{}') dup.push({ id: e.id, n: cs.length, eff: keys[0] });
  else if (uniq.size < cs.length) dup.push({ id: e.id, n: cs.length, eff: '部分重复 ' + uniq.size + '/' + cs.length });
});
if (!dup.length) w('无。');
else {
  w('| 事件 id | 选项数 | 情况 |');
  w('|---|---|---|');
  dup.slice(0, 40).forEach(d => w(`| ${d.id} | ${d.n} | \`${d.eff}\` |`));
  w(`\n共 ${dup.length} 条。`);
}

/* ---- 3. 手写选项中「空 eff / 无差异」 ---- */
w('\n\n## 3. 手写选项中 eff 为空（纯文本分支，无数值差异）的事件\n');
const empty = A.EVENTS.filter(e => (e.choices || []).length >= 2 && (e.choices || []).every(c => !c.eff || !Object.keys(c.eff).length));
w(`共 ${empty.length} 条：` + empty.slice(0, 30).map(e => e.id).join('、'));

/* ---- 4. 模板三选一：risk1/2/3 的支配关系 ---- */
w('\n\n## 4. 模板生成的三选一（eventChoices 无手写选项时的公式）\n');
w('```');
w('选项1（风险低）: eff = base × 0.6(增益) / ×0.45(减益), STRESS -2');
w('选项2（风险中）: eff = base × 1.0 / ×1.0');
w('选项3（风险高）: eff = base × 1.7 / ×1.35, STRESS +4, 附带 45% 概率赌注');
w('```');
w('\n赌注期望：MONEY 类 `0.45×(+1.5|M|) + 0.55×(-0.7|M|) = +0.29|M|`（正 EV）；');
w('非 MONEY 类 `0.45×(WILL5 INT4 NET5 FAME3) + 0.55×(HP-2 STRESS6 CHA-3)`。');
w('\n**结论：只要 base 是正向收益，选项3 的期望 ≥ 选项2 ≥ 选项1，理性玩家永远选 3；');
w('只要 base 是负向（坏事），选项1 的期望 ≥ 选项2 ≥ 选项3，理性玩家永远选 1。**');
w('即：模板三选一不是「风险/收益权衡」，而是「按事件好坏二选一的机械判断」，第三个选项恒为劣势项。\n');

/* ---- 5. 事件年龄覆盖：哪些年龄段事件稀少 ---- */
w('\n\n## 5. 事件库的年龄覆盖（按事件 age 区间计数，覆盖该年龄的事件条数）\n');
const cover = {};
for (let a = 0; a <= 100; a++) {
  let n = 0;
  A.EVENTS.forEach(e => {
    const g = e.age || [0, 100];
    if (a >= g[0] && a <= g[1]) n++;
  });
  cover[a] = n;
}
const bands = [[0, 6], [7, 12], [13, 18], [19, 25], [26, 35], [36, 45], [46, 55], [56, 65], [66, 75], [76, 100]];
w('| 年龄段 | 覆盖该段的事件条数 | 判定 |');
w('|---|---|---|');
bands.forEach(b => {
  const vals = []; for (let a = b[0]; a <= b[1]; a++) vals.push(cover[a]);
  const m = Math.round(vals.reduce((x, y) => x + y, 0) / vals.length);
  w(`| ${b[0]}-${b[1]} 岁 | ${m} | ${m < 10 ? '⚠ 内容稀薄' : (m < 25 ? '偏薄' : '充足')} |`);
});
w('\n各年龄精确值（每 5 岁）：' + [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90].map(a => `${a}岁=${cover[a]}`).join(' · '));

/* ---- 6. 事件权重：是否少数事件垄断 ---- */
w('\n\n## 6. 事件权重分布（w 字段）\n');
const ws = A.EVENTS.map(e => e.w == null ? 5 : e.w).sort((a, b) => b - a);
w(`- 最大权重 ${ws[0]}，最小 ${ws[ws.length - 1]}，中位 ${ws[Math.floor(ws.length / 2)]}`);
const top10 = ws.slice(0, 10).reduce((a, b) => a + b, 0);
const total = ws.reduce((a, b) => a + b, 0);
w(`- Top10 权重之和占总权重：${(top10 / total * 100).toFixed(1)}%`);
w(`- 权重为 0（仅由脚本强制触发，不进随机池）的事件：${ws.filter(x => x === 0).length} 条`);

/* ---- 7. 天赋 / 成就 / 出身 数量与可用性 ---- */
w('\n\n## 7. 可解锁内容清单\n');
w(`- 天赋 TALENTS：${A.TALENTS.length} 条`);
w(`- 出身 FAMILIES：${A.FAMILIES.length} 条`);
w(`- 成就 ACHIEVEMENTS：${A.ACHIEVEMENTS.length} 条`);
w(`- 向善行动 GOOD_DEEDS：${A.GOOD_DEEDS ? A.GOOD_DEEDS.length : 0} 条`);
w(`- 一次性投资 INVESTMENTS：${A.INVESTMENTS.length} 条`);
w(`- 大学活动 UNI_ACTIVITIES：${A.UNI_ACTIVITIES.length} 条`);
w(`- 疾病 ILLNESS：${A.ILLNESS.length} 条`);
w(`- 职业 CAREERS：${A.CAREERS.length} 条`);
w(`- 结局 ENDINGS：${A.ENDINGS.length} 条`);

/* ---- 8. 模板选项文本池大小（选项文案重复度）---- */
w('\n\n## 8. 模板选项文案池（CHOICE_TEMPLATES）大小 —— 决定「三选一」文案的重复感\n');
w('| 标签 | 文案组数 | 说明 |');
w('|---|---|---|');
for (const k in A.CHOICE_TEMPLATES) {
  const pool = A.CHOICE_TEMPLATES[k] || [];
  w(`| ${k} | ${pool.length} | ${pool.length <= 3 ? '⚠ 极易重复' : ''} |`);
}

fs.writeFileSync(path.join(OUT, 'choices.md'), L.join('\n'), 'utf8');
console.log('written choices.md', L.length, 'lines');
