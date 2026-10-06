/* 线上冒烟测试：直接加载已部署页面，点击走完一局 */
const path = require('path');
const { JSDOM, VirtualConsole, ResourceLoader } = require(path.join(
  'C:/Users/ro3ea/.workbuddy/binaries/node/workspace', 'node_modules', 'jsdom'));

const URL_ = process.argv[2] || 'https://wxzstudio.github.io/cangame/';
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => { if (!/Not implemented/.test(e.message)) errors.push('jsdomError: ' + e.message); });
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

JSDOM.fromURL(URL_, {
  runScripts: 'dangerously',
  resources: 'usable',
  pretendToBeVisual: true,
  virtualConsole: vc
}).then(dom => {
  const w = dom.window;
  setTimeout(() => {
    const click = el => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    const screen = () => ['screen-title', 'screen-create', 'screen-game', 'screen-market', 'screen-end']
      .find(id => w.document.getElementById(id) && w.document.getElementById(id).classList.contains('active'));
    click(w.document.getElementById('btnNew'));
    const tals = w.document.querySelectorAll('#talentList .talent');
    if (tals.length < 5) errors.push('天赋未渲染');
    click(tals[0]); click(tals[1]);
    click(w.document.querySelectorAll('#familyList .fam')[1]);
    click(w.document.getElementById('btnStart'));
    let n = 0, traded = 0;
    while (screen() === 'screen-game' && n++ < 800) {
      // 成年后定期进市场做一笔买卖，验证市场页全流程
      if (n % 6 === 0 && traded < 6) {
        const mk = w.document.getElementById(traded % 2 === 0 ? 'dockShop' : 'dockStock');
        if (mk) {
          click(mk);
          if (screen() === 'screen-market') {
            const tabs = ['house', 'car', 'good', 'stock'];
            const tab = tabs[traded % tabs.length];
            const t = w.document.querySelector('.mtab[data-tab="' + tab + '"]');
            if (t) click(t);
            const btns = [...w.document.querySelectorAll('#marketBody .mk-item button')].filter(b => !b.disabled);
            if (btns.length) { click(btns[0]); traded++; }
            click(w.document.getElementById('btnMarketBack'));
          }
        }
      }
      const btns = [...w.document.querySelectorAll('#actions button')].filter(b => !b.disabled);
      if (!btns.length) break;
      click(btns[Math.floor(Math.random() * btns.length)]);
    }
    console.log('推进:', n, '| 到达:', screen(), '| 市场成交:', traded);
    console.log('结局:', w.document.getElementById('endTitle').textContent || '(未结束)');
    console.log(errors.length ? '❌ ' + errors.slice(0, 5).join('\n') : '✅ 线上页面无运行时错误');
    process.exit(errors.length ? 1 : 0);
  }, 2500);
}).catch(e => { console.error('加载失败:', e.message); process.exit(1); });
