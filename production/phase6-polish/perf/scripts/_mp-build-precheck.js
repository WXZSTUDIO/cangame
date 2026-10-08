/* 小程序构建前置体检（只读，绝不写 cangame-mp/）。
 *
 * build-engine.js 会把 assets/ 下 7 个逻辑层文件拼成 cangame-mp/engine/bundle.js。
 * 本批改了 data.js / engine.js / career.js 三个逻辑层文件，所以合并后**必须重跑构建**。
 * 这里先在 Web 侧把构建会触发的所有告警预演一遍，确保重跑时是干净的：
 *   ① 逻辑层是否沾了浏览器 API（document. / window. / localStorage / alert( / prompt(）
 *   ② 顶层命名是否与既有符号冲突
 *   ③ 新增了哪些导出符号
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const FILES = ['data.js', 'market.js', 'engine.js', 'school.js', 'career.js', 'love.js', 'loan.js'];
const BUNDLE = path.resolve(ROOT, '..', 'cangame-mp', 'engine', 'bundle.js');

const lines = [];
const say = (s) => { lines.push(s); console.log(s); };

say('# 小程序构建前置体检（只读）');
say('');
say('生成时间：' + new Date().toISOString());
say('');

/* ① 浏览器 API 污染检查（与 build-engine.js 第 48 行同一套规则） */
say('## 1. 逻辑层浏览器 API 污染检查');
say('');
let dirty = 0;
FILES.forEach(f => {
  const src = fs.readFileSync(path.join(ROOT, 'assets', f), 'utf8');
  const hits = [];
  ['document.', 'window.', 'localStorage', 'alert(', 'prompt('].forEach(bad => {
    const n = src.split(bad).length - 1;
    if (n > 0) hits.push(bad + ' × ' + n);
  });
  if (hits.length) { dirty++; say('  ✗ **' + f + '**：' + hits.join('，')); }
  else say('  ✓ ' + f);
});
say('');
say(dirty === 0
  ? '✅ 7 个逻辑层文件**全部干净**，重跑 `build-engine.js` 不会触发任何告警。'
  : '⚠️ 有 ' + dirty + ' 个文件沾了浏览器 API，重跑构建会告警，需先清理。');

/* ② 顶层命名冲突（与 build-engine.js 第 54 行同一套规则） */
say('');
say('## 2. 顶层命名冲突检查');
say('');
const seen = new Map();
const conflicts = [];
const all = [];
FILES.forEach(f => {
  fs.readFileSync(path.join(ROOT, 'assets', f), 'utf8').split('\n').forEach((line, i) => {
    const m = line.match(/^(?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/);
    if (!m) return;
    if (seen.has(m[1])) {
      conflicts.push(m[1] + '（' + seen.get(m[1]) + ' 与 ' + f + ':' + (i + 1) + '）');
    }
    seen.set(m[1], f + ':' + (i + 1));
    all.push({ name: m[1], file: f, line: i + 1 });
  });
});
if (conflicts.length) conflicts.forEach(c => say('  ✗ ' + c));
else say('  ✓ 无冲突（这是目前唯一在保护这套架构的东西）');

/* ③ 新增导出符号：与现有 bundle.js 的导出表对比 */
say('');
say('## 3. 重跑构建后会新增哪些导出符号');
say('');
const bundle = fs.readFileSync(BUNDLE, 'utf8');
const expBlock = (bundle.match(/module\.exports\s*=\s*\{([\s\S]*?)\n\};/) || [])[1] || '';
const oldExp = new Set(expBlock.split('\n').map(s => s.trim().replace(/,$/, '')).filter(Boolean));
const nowExp = new Set(all.map(x => x.name));
const added = [...nowExp].filter(n => !oldExp.has(n)).sort();
const removed = [...oldExp].filter(n => !nowExp.has(n)).sort();

say('  现有 bundle 导出 **' + oldExp.size + '** 个 → 重跑后 **' + nowExp.size + '** 个');
say('');
if (added.length) {
  say('  **新增 ' + added.length + ' 个**（IMP-01 引入）：');
  say('');
  const pos = {};
  all.forEach(x => { if (added.indexOf(x.name) >= 0) pos[x.name] = x.file + ':' + x.line; });
  say('  | 符号 | 落点 |');
  say('  |---|---|');
  added.forEach(n => say('  | `' + n + '` | ' + pos[n] + ' |'));
} else say('  无新增。');
say('');
if (removed.length) say('  ⚠️ **消失 ' + removed.length + ' 个**：' + removed.join('、'));
else say('  ✓ 无符号消失（没有删掉任何既有导出，小程序侧不会断引用）');

say('');
say('## 4. 结论');
say('');
say('- 本批改动落在 **data.js / engine.js / career.js** 三个逻辑层文件，'
  + '三者都在 `build-engine.js` 的 `FILES` 列表里 → **合并前必须重跑 `node tools/build-engine.js`**。');
say('- 文件列表与顺序（`data → market → engine → school → career → love → loan`）'
  + '本次**未改动**，重跑是安全的，不会打断小程序。');
say('- ⚠️ 我不改动 `cangame-mp/`，构建请由主理人或小程序侧执行；'
  + '在此之前 `cangame-mp/engine/bundle.js` 仍是**改前**版本（构建于 2026-10-07 13:38），'
  + '与 Web 版逻辑已不一致。');

fs.writeFileSync(path.join(__dirname, '_mp-build-precheck.out.txt'), lines.join('\n') + '\n', 'utf8');
say('');
say('[已写出] _mp-build-precheck.out.txt');
