/* 只读探针：ENDINGS 表是否含 end_dead（F-01 的根因证据） */
const { loadEngine, exportApi } = require('./reg-lib.js');
const { ctx } = loadEngine();
const A = exportApi(ctx);
const END = (A && A.ENDINGS) || [];
console.log('ENDINGS 总数 = ' + END.length);
['end_dead', 'end_elder', 'end_ill'].forEach(k =>
  console.log('  含 ' + k + ' ? ' + (END.some(e => e.id === k) ? 'YES' : 'NO')));
console.log('ids: ' + END.map(e => e.id).join(', '));
