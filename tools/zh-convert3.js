/* 第三轮：清理第二轮产生的「中文 中文」重复 */
const fs = require('fs');
const path = require('path');
const FILES = ['assets/data.js', 'assets/market.js', 'assets/engine.js', 'assets/ui.js',
               'assets/school.js', 'assets/career.js', 'assets/love.js', 'assets/loan.js', 'index.html'];
FILES.forEach(f => {
  const p = path.join(__dirname, '..', f);
  if (!fs.existsSync(p)) return;
  let src = fs.readFileSync(p, 'utf8');
  // '甲 甲' -> '甲'
  src = src.replace(/'([^'']{2,12}) \1'/g, "'$1'");
  // "甲 甲" -> "甲"
  src = src.replace(/"([^""]{2,12}) \1"/g, '"$1"');
  // 句子内部的重复短语（中文以空格分隔的重复）
  src = src.replace(/([一-鿿]{2,8}) \1(?=[^\u4e00-\u9fff]|$|，|。|、)/g, '$1');
  fs.writeFileSync(p, src, 'utf8');
  console.log(f + ' done');
});
console.log('round3 done');
