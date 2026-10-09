// 修复 engine.js 中误入的 \` 与 \$ 转义（只针对 v6.2.2 lifeEpitaph 段落）
const fs = require('fs');
const path = require('path');
const P = path.join(__dirname, '../assets/engine.js');
let s = fs.readFileSync(P, 'utf8');
const i = s.indexOf('v6.2.2 动态一生大结局文本生成器');
const j = s.indexOf('function finish(state) {', i);
const seg = s.slice(i, j);
const n1 = (seg.match(/\\`/g) || []).length;
const n2 = (seg.match(/\\\$\{/g) || []).length;
const fixed = seg.split('\\`').join('`').split('\\${').join('${');
s = s.slice(0, i) + fixed + s.slice(j);
fs.writeFileSync(P, s);
console.log('fixed backtick:', n1, ', dollar:', n2);
