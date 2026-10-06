/* 浏览器保真度测试：4 个脚本各自独立加载（与线上 <script> 标签一致），
   捕获所有 window error / 内联 handler 报错，并断言关键节点有可见文本。 */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require(path.join(
  process.env.NODE_WS || 'C:/Users/ro3ea/.workbuddy/binaries/node/workspace',
  'node_modules', 'jsdom'
));

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => {
  if (/Not implemented|scrollTo/.test(e.message)) return;
  errors.push('jsdomError: ' + e.message + (e.detail ? '\n  ' + String(e.detail).split('\n')[0] : ''));
});
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  url: 'https://cangame.test/',
  virtualConsole: vc,
  pretendToBeVisual: true
});
const w = dom.window;
w.addEventListener('error', e => errors.push('window.error: ' + e.message));

// 与线上一致：按顺序插入 4 个独立 <script>
['assets/data.js', 'assets/market.js', 'assets/engine.js',
 'assets/school.js', 'assets/career.js', 'assets/love.js', 'assets/loan.js', 'assets/ui.js'].forEach(f => {
  const el = w.document.createElement('script');
  el.textContent = fs.readFileSync(path.join(root, f), 'utf8');
  w.document.body.appendChild(el);
});
w.document.dispatchEvent(new w.Event('DOMContentLoaded'));

function click(el) { if (el) el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); }
function activeScreen() {
  return ['screen-title', 'screen-create', 'screen-game', 'screen-market', 'screen-end']
    .find(id => w.document.getElementById(id).classList.contains('active'));
}
function txt(id) { return (w.document.getElementById(id).textContent || '').trim(); }

const fail = [];
function ok(cond, label) { console.log((cond ? '  ✓ ' : '  ✗ ') + label); if (!cond) fail.push(label); }

console.log('== 初始化 ==');
ok(typeof w.init === 'function', 'init 已定义（全局可达）');
ok(typeof w.advance === 'function', 'advance 全局可达（内联 onclick 需要）');
ok(w.document.getElementById('btnNew').onclick != null, 'btnNew 已绑定');
ok(w.document.getElementById('btnStart').onclick != null, 'btnStart 已绑定');
ok(w.document.getElementById('dockNext').onclick != null, 'dockNext 已绑定');

console.log('== 进入创建页 ==');
click(w.document.getElementById('btnNew'));
ok(activeScreen() === 'screen-create', '切到创建页');
ok(w.document.querySelectorAll('#familyList .fam').length > 0, '出身卡渲染');
ok(w.document.querySelectorAll('#talentList .talent').length > 0, '天赋卡渲染');
ok(w.document.querySelectorAll('#priorityList .fam').length > 0, '擅长领域渲染');

console.log('== 选天赋并出生 ==');
const tals = w.document.querySelectorAll('#talentList .talent');
click(tals[0]); click(tals[1]);
click(w.document.getElementById('btnStart'));
ok(activeScreen() === 'screen-game', '进入游戏页');
ok(txt('hudName').length > 0, 'HUD 姓名有文字: ' + txt('hudName'));
ok(txt('hudAge').length > 0, 'HUD 年龄有文字: ' + txt('hudAge'));
ok(txt('metricStrip').length > 0, '底部指标条有内容');
ok(txt('stream').length > 0, '事件流有文字（出生故事）');
ok(txt('card').length > 0, '卡片有文字');
ok(w.document.querySelectorAll('#actions button').length > 0, '操作区有按钮');

console.log('== 推进 30 年 ==');
let steps = 0;
while (activeScreen() === 'screen-game' && steps++ < 200) {
  const btns = [...w.document.querySelectorAll('#actions button')].filter(b => !b.disabled);
  if (!btns.length) break;
  click(btns[Math.floor(Math.random() * btns.length)]);
  if (steps === 10) {
    click(w.document.getElementById('dockRel'));
    ok(w.document.getElementById('view-rel').style.display !== 'none', '人际关系视图可打开');
    ok(w.document.querySelectorAll('#view-rel .rel-card').length > 0, '人际卡片有内容');
    click(w.document.getElementById('dockJob'));
    ok(w.document.getElementById('view-job').style.display !== 'none', '工作视图可打开');
    ok(txt('view-job').indexOf('家庭账簿') >= 0, '工作视图展示家庭账簿（资产/负债）');
    click(w.document.getElementById('dockNext'));
  }
}
ok(steps > 20, '连续推进 ' + steps + ' 步未卡死');
ok(txt('stream').length > 50, '事件流持续产出文字');

console.log('\n' + (errors.length ? '❌ 运行时错误:\n' + errors.slice(0, 12).join('\n') : '✅ 无运行时错误'));
console.log(fail.length ? '❌ 断言失败 ' + fail.length + ' 项: ' + fail.join(' / ') : '✅ 全部断言通过');
process.exit(errors.length || fail.length ? 1 : 0);
