/* v6.4 补丁（career.js 部分，可重复执行） */
const fs = require('fs'), path = require('path');
const P = path.join(__dirname, '..', 'assets', 'career.js');
let c = fs.readFileSync(P, 'utf8');
const orig = c;

const HALF = { INT: 1, STR: 1, CHA: 1, WILL: 1, NET: 1, FAME: 1 };
function scaleThreshold(k, v) {
  if (HALF[k]) return Math.round(v * 0.5);
  if (k === 'HP' || k === 'STRESS') return Math.round(v * 100 / 120);
  if (k === 'LOY') return Math.round((v + 50) / 2);
  return v;
}

/* 1. need 门槛按新上限重标定 */
let needN = 0;
c = c.replace(/need: \{([^}]*)\}/g, (m, inner) => {
  const out = inner.replace(/(\b(?:INT|STR|CHA|WILL|NET|FAME|HP|STRESS|LOY)\s*:\s*)(-?\d+)/g,
    (mm, keyPart, num) => {
      const key = keyPart.split(':')[0].trim();
      needN++;
      return keyPart + scaleThreshold(key, parseInt(num, 10));
    });
  return 'need: {' + out + '}';
});

/* 2. 绩效公式系数：属性折半后权重翻倍，LOY 按 1.5 倍 */
c = c.replace('+ s.LOY * 0.35', '+ s.LOY * 0.525');
c = c.replace('+ s.INT * 0.22', '+ s.INT * 0.44');
c = c.replace('+ s.NET * 0.16', '+ s.NET * 0.32');
c = c.replace('+ s.WILL * 0.14', '+ s.WILL * 0.28');

/* 3. 收入公式分母：属性折半 → 分母折半 */
c = c.replace('stats: { INT: 520, NET: 1000, LOY: 1100 }', 'stats: { INT: 260, NET: 500, LOY: 733 }');
c = c.replace('freelance: { INT: 400, NET: 800 }', 'freelance: { INT: 200, NET: 400 }');

/* 4. 重复职称改名（JOBS 表按 title 唯一，旧逻辑后者覆盖前者，会让医生拿到精神科的工资） */
c = c.replace("{ title: '青训队员', sal: 7500000, cost: 8000000 }", "{ title: '电竞青训生', sal: 7500000, cost: 8000000 }");
c = c.replace("{ title: '住院医师', sal: 22000000, cost: 18000000 }", "{ title: '精神科住院医师', sal: 22000000, cost: 18000000 }");
c = c.replace("{ title: '主治医师', sal: 42000000, cost: 26000000 }", "{ title: '精神科主治医师', sal: 42000000, cost: 26000000 }");
c = c.replace("{ title: '副主任医师', sal: 70000000, cost: 34000000 }", "{ title: '精神科副主任医师', sal: 70000000, cost: 34000000 }");

/* 5. buildJobTable() 挪到文件末尾（原先在 CAREERS.push 之前 → 导演等职业没进工资表） */
c = c.replace('/* ---------- 初始化：把职业阶梯展开进 JOBS ---------- */\nbuildJobTable();\n',
  '/* ---------- 初始化：把职业阶梯展开进 JOBS —— 调用已挪到文件末尾（v6.4） ---------- */\n');

/* 6. careerIncome / freelanceIncome 兜底 */
c = c.replace(`function careerIncomeParts(state) {
  const j = JOBS[state.job] || { salary: 0, cost: 12000000 };`,
  `function careerIncomeParts(state) {
  const j = jobEntry(state, state.job);`);
c = c.replace(`function freelanceIncome(state) {
  const j = JOBS[state.job] || { salary: 0, cost: 12000000 };`,
  `function freelanceIncome(state) {
  const j = jobEntry(state, state.job);`);

/* 7. 末尾追加 jobEntry + buildJobTable() */
if (c.indexOf('function jobEntry(') < 0) {
  c += `
/* =========================================================
 * v6.4.0 职业工资表修复
 * ---------------------------------------------------------
 * 旧 bug：buildJobTable() 原先在文件中间（CAREERS 数组定义之后、
 * v6.0/v6.3 的 CAREERS.push 之前）就调用了，于是导演、飞行员等
 * 全部后加职业的职称从未注册进 JOBS → careerIncome 走
 * \`JOBS[job] || {salary:0}\` 兜底 → 这些职业年薪恒为 0。
 * 修法：调用挪到文件末尾，并给收入函数加一层职业阶梯回落。
 * ========================================================= */
function jobEntry(state, jobName) {
  const j = JOBS[jobName];
  if (j) return j;
  const c = state && state.career ? careerById(state.career.id) : null;
  if (c) {
    const lv = Math.max(0, Math.min(c.ladder.length - 1, state.career.level || 0));
    return { salary: c.ladder[lv].sal, cost: c.ladder[lv].cost, career: c.id };
  }
  return { salary: 0, cost: 12000000 };
}
buildJobTable();
`;
}

fs.writeFileSync(P, c);
console.log('career.js patched | need thresholds rescaled:', needN, '| changed:', c !== orig);
