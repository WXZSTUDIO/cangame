/* 无头 UI 冒烟测试（jsdom）：走完 标题 → 捏人 → 整局 → 结局 */
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
vc.on('jsdomError', e => { if (!/scrollTo|Not implemented/.test(e.message)) errors.push('jsdomError: ' + e.message); });
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  url: 'https://cangame.test/',
  virtualConsole: vc,
  pretendToBeVisual: true
});
const w = dom.window;
w.addEventListener('error', e => errors.push('window.error: ' + e.message));

// 必须在同一次 eval 中执行：共享 top-level const 词法作用域
w.eval(['assets/data.js', 'assets/market.js', 'assets/engine.js', 'assets/ui.js']
  .map(f => fs.readFileSync(path.join(root, f), 'utf8'))
  .concat(['window.__getState = function(){ return STATE; };'])
  .join('\n;\n'));
w.document.dispatchEvent(new w.Event('DOMContentLoaded'));

function click(el) { el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); }
function activeScreen() {
  return ['screen-title', 'screen-create', 'screen-game', 'screen-market', 'screen-end']
    .find(id => w.document.getElementById(id).classList.contains('active'));
}

// 1 → 创建页
click(w.document.getElementById('btnNew'));
console.log('进入:', activeScreen());

// 2 → 选天赋 + 出身
const tals = w.document.querySelectorAll('#talentList .talent');
click(tals[0]); click(tals[1]);
const fams = w.document.querySelectorAll('#familyList .fam');
click(fams[2]);
click(w.document.getElementById('btnStart'));
console.log('进入:', activeScreen());

// 3 → 一路推进到结局（中途进入市场做买卖）
let steps = 0, traded = 0, viewChecked = false;
while (activeScreen() === 'screen-game' && steps++ < 800) {
  // 对局中途检查底部导航视图（人际关系 / 工作）
  if (steps === 5 && !viewChecked) {
    viewChecked = true;
    click(w.document.getElementById('dockRel'));
    console.log('人际关系视图:', w.document.getElementById('view-rel').style.display !== 'none',
      '| 卡片数:', w.document.querySelectorAll('#view-rel .rel-card').length);
    w.document.querySelectorAll('#view-rel .rel-act:not([disabled])').forEach(b => click(b));
    w.document.querySelector('.rel-tab:nth-child(2)').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    console.log('朋友卡片数:', w.document.querySelectorAll('#view-rel .rel-card').length);
    click(w.document.getElementById('dockJob'));
    console.log('工作视图:', w.document.getElementById('view-job').style.display !== 'none',
      '| 工作卡:', w.document.querySelectorAll('#view-job .job-card').length);
    click(w.document.getElementById('dockNext'));
    console.log('回主视图:', w.document.getElementById('view-main').style.display !== 'none');
  }
  // 25 岁后试着进市场买一次房 / 买一次股
  const stNow = w.__getState();
  if (stNow && stNow.age >= 22 && traded < 4 && steps % 7 === 0) {
    click(w.document.getElementById(traded % 2 === 0 ? 'dockStock' : 'dockShop'));
    if (activeScreen() === 'screen-market') {
      const tab = traded % 2 === 0 ? 'stock' : 'house';
      const items = w.document.querySelectorAll('#marketBody .mk-item .btn');
      if (items.length) {
        click(items[0]);
        traded++;
        console.log('  市场成交 #' + traded + ' | tab=' + tab + ' | ' + w.document.getElementById('marketWallet').textContent.replace(/\s+/g, ' ').slice(0, 70));
      }
      click(w.document.getElementById('btnMarketBack'));
    }
  }
  const btns = [...w.document.querySelectorAll('#actions button')].filter(b => !b.disabled);
  if (!btns.length) { click(w.document.getElementById('actions').querySelector('button')) || null; }
  if (!btns.length) break;
  click(btns[btns.length > 1 ? Math.floor(Math.random() * btns.length) : 0]);
}
console.log('市场成交次数:', traded);
console.log('推进次数:', steps, '| 最终页:', activeScreen());

const st = w.__getState();
console.log('结局:', st && st.ending ? st.ending.title : '(无)');
console.log('年龄:', st && st.age, '| 现金:', st && w.fmtMoney(st.stats.MONEY),
  '| 净资产:', st && w.fmtMoney(w.netWorth(st)), '| 评分:', st && st.score);
console.log('持有资产:', st && st.market.props.length, '项 | 持仓:', st && st.market.stocks.length,
  '只 | 贷款:', st && w.fmtMoney(st.market.debt));
console.log('结局页标题:', w.document.getElementById('endTitle').textContent);
console.log('存档写入:', !!w.localStorage.getItem('cangame_autosave_v1'));

// 4 → 存档槽 / 导出导入
w.document.getElementById('btnSaves2').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
const slotBtns = w.document.querySelectorAll('#slotList .btn');
console.log('存档槽按钮数:', slotBtns.length);

console.log(errors.length ? '❌ 运行时错误:\n' + errors.slice(0, 10).join('\n') : '✅ 无运行时错误');
process.exit(errors.length ? 1 : 0);
