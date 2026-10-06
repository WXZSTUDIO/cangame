/* 一次性脚本：给对口职业加 major 字段（按中文锚点匹配，避免 node -e 乱码） */
const fs = require('fs');
const path = require('path');
const f = path.join(__dirname, '..', 'assets', 'career.js');
let src = fs.readFileSync(f, 'utf8');

const patches = [
  ["id: 'programmer', name: '程序员', cat: '互联网', edu: 3, risk: 1, need: { INT: 40 },",
   "id: 'programmer', name: '程序员', cat: '互联网', edu: 3, risk: 1, need: { INT: 40 }, major: ['理工'],"],
  ["id: 'hacker', name: '黑客 / 安全研究员', cat: '灰色', edu: 3, risk: 3, need: { INT: 55 },",
   "id: 'hacker', name: '黑客 / 安全研究员', cat: '灰色', edu: 3, risk: 3, need: { INT: 55 }, major: ['理工'],"],
  ["id: 'ai', name: 'AI 算法工程师', cat: '互联网', edu: 5, risk: 2, need: { INT: 65 },",
   "id: 'ai', name: 'AI 算法工程师', cat: '互联网', edu: 5, risk: 2, need: { INT: 65 }, major: ['理工'],"],
  ["id: 'ecom', name: '电商运营', cat: '互联网', edu: 2, risk: 2, need: { INT: 28 },",
   "id: 'ecom', name: '电商运营', cat: '互联网', edu: 2, risk: 2, need: { INT: 28 }, major: ['金融', '理工'],"],
  ["id: 'accountant', name: '会计', cat: '财务', edu: 2, risk: 1, need: { INT: 30 },",
   "id: 'accountant', name: '会计', cat: '财务', edu: 2, risk: 1, need: { INT: 30 }, major: ['金融'],"],
  ["id: 'finance', name: '投行 / 券商', cat: '金融', edu: 4, risk: 2, need: { INT: 55, CHA: 35 },",
   "id: 'finance', name: '投行 / 券商', cat: '金融', edu: 4, risk: 2, need: { INT: 55, CHA: 35 }, major: ['金融'],"],
  ["id: 'doctor', name: '医生', cat: '医疗', edu: 4, risk: 1, need: { INT: 55 },",
   "id: 'doctor', name: '医生', cat: '医疗', edu: 4, risk: 1, need: { INT: 55 }, major: ['医学'],"],
  ["id: 'nurse', name: '护士', cat: '医疗', edu: 2, risk: 1, need: {},",
   "id: 'nurse', name: '护士', cat: '医疗', edu: 2, risk: 1, need: {}, major: ['医学'],"],
  ["id: 'lawyer', name: '律师', cat: '法律', edu: 3, risk: 2, need: { INT: 50 },",
   "id: 'lawyer', name: '律师', cat: '法律', edu: 3, risk: 2, need: { INT: 50 }, major: ['法律'],"],
  ["id: 'teacher', name: '中小学教师', cat: '教育', edu: 3, risk: 0, need: { INT: 40 },",
   "id: 'teacher', name: '中小学教师', cat: '教育', edu: 3, risk: 0, need: { INT: 40 }, major: ['师范'],"],
  ["id: 'designer', name: 'UI / 视觉设计师', cat: '互联网', edu: 3, risk: 1, need: { INT: 30 },",
   "id: 'designer', name: 'UI / 视觉设计师', cat: '互联网', edu: 3, risk: 1, need: { INT: 30 }, major: ['艺术'],"]
];

let done = 0;
patches.forEach(([a, b]) => {
  if (src.indexOf(a) === -1) { console.log('MISS:', a.slice(0, 30)); return; }
  src = src.replace(a, b);
  done++;
});
fs.writeFileSync(f, src, 'utf8');
console.log('patched:', done, '/', patches.length);
