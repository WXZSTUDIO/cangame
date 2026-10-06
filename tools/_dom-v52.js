/* v5.2 UI 冒烟（jsdom）：天赋浏览/搜索、退学确认弹窗、同学 tab 常驻、辞职读书弹窗 */
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
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://cangame.test/', virtualConsole: vc, pretendToBeVisual: true });
const w = dom.window;
w.addEventListener('error', e => errors.push('window.error: ' + e.message));
w.eval(['assets/data.js', 'assets/market.js', 'assets/engine.js', 'assets/school.js',
  'assets/career.js', 'assets/love.js', 'assets/loan.js', 'assets/ui.js']
  .map(f => fs.readFileSync(path.join(root, f), 'utf8'))
  .concat([
    'window.__getState = function(){ return STATE; };',
    'window.__call = function(n,a){ return eval(n).apply(null,a); };',
    'window.__eval = function(x){ return eval(x); };'
  ])
  .join('\n;\n'));
w.document.dispatchEvent(new w.Event('DOMContentLoaded'));

let fail = 0;
const ok = (c, name, extra) => { console.log(c ? '  ✓' : '  ✗', name, extra == null ? '' : extra); if (!c) fail++; };
const click = (el) => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
const $ = (id) => w.document.getElementById(id);
const call = (n, a) => w.eval(n).apply(null, a || []);   // const 不挂 window，得在 window 作用域里 eval 取

console.log('== 创建页：天赋浏览与搜索 ==');
click($('btnNew'));
const rolled = w.document.querySelectorAll('#talentList .talent').length;
ok(rolled === 12, '默认抽 12 张', rolled);
click($('btnTalentAll'));
const all = w.document.querySelectorAll('#talentList .talent').length;
ok(all === w.__eval('TALENTS.length'), `浏览全部 → ${w.__eval('TALENTS.length')} 张`, all);
const search = $('talentSearch');
search.value = '记忆';
search.dispatchEvent(new w.Event('input', { bubbles: true }));
const hit = w.document.querySelectorAll('#talentList .talent').length;
ok(hit > 0 && hit < all, '搜索「记忆」命中部分', hit);
search.value = 'zzz不存在';
search.dispatchEvent(new w.Event('input', { bubbles: true }));
ok($('talentList').innerHTML.indexOf('没有匹配') > 0, '无结果时有提示');

console.log('== 开局 ==');
$('inputName').value = '张伟';
click($('btnStart'));
const S = () => w.__getState();
ok(!!S(), '进入游戏');

console.log('== 上学期间求职 → 弹退学确认 ==');
S().age = 16; S().job = '高中生'; S().edu = S().edu || {};
S().edu.hs = 'hs_ord'; S().edu.stopped = false;
call('uiApplyJob', ['rider']);
const boxOpen = () => $('confirmBox').classList.contains('open');
ok(boxOpen(), '弹出二次确认（不能继续升学）', $('confirmTitle').textContent);
click($('confirmNo'));
ok(!boxOpen(), '点「再想想」不生效');
ok(call('isEnrolled',[S()]), '确认前仍是在读状态');
call('uiApplyJob', ['rider']);
click($('confirmOk'));
ok(!boxOpen() && S().edu.stopped === true, '确认后退学');
ok(S().job !== '高中生', '退学后不再是学生身份', S().job);
ok(!call('isEnrolled',[S()]), '退学后不再是在读');

console.log('== 工作时升学 → 弹辞职确认 ==');
{
  const s = S();
  s.age = 20; s.job = '外卖骑手'; s.career = { id: 'rider', level: 0, years: 2 };
  s.edu = { hs: 'hs_none', uni: 'u_fail', eduLevel: 1, study: 0 };
  const fake = { type: 'exam', exam: { kind: 'gao', title: 't', score: 300, full: 700, options: [{ id: 'u_yiben', name: '普通一本', desc: '', years: 4, minScore: 66 }], text: 'x' } };
  s.pending = fake;
  call('chooseExam', [0]);
  ok(boxOpen(), '弹出去念书就要辞职的确认', $('confirmTitle').textContent);
  click($('confirmOk'));
  ok(!s.career, '确认后已辞职', s.job);
}

console.log('== 同学毕业后仍在人际页 ==');
{
  const s = S();
  s.edu = { hs: 'hs_key', uni: 'u_yiben', eduLevel: 4, study: 20, major: '计算机', gradAge: null, stopped: false };
  s.classmates = [
    { key: 'nerd', name: '李雷', gender: 'M', affinity: 55, charm: 60, stage: 'high', lastTouch: -1 },
    { key: 'art', name: '韩梅梅', gender: 'F', affinity: 62, charm: 70, stage: 'uni', lastTouch: -1 }
  ];
  call('setRelTab', ['classmate']);
  const cards = w.document.querySelectorAll('#view-rel .rel-card');
  ok(cards.length === 2, '渲染 2 位同学', cards.length);
  const txt = w.document.getElementById('view-rel').textContent;
  ok(txt.indexOf('高中同学') > 0 && txt.indexOf('大学同学') > 0, '标注了所属阶段');
  ok(txt.indexOf('老同学') > 0, '毕业后标为老同学');
}

console.log('== 恋人页：点名字即互动 ==');
{
  const s = S();
  s.age = 24; s.stats.MONEY = 50000000;
  s.love = { candidates: [{ name: '小雅', gender: 'F', age: 24, look: 70, charm: 70, tp: 'warm', bg: 'mid', src: '相亲', affinity: 40, alive: true, lastTouch: -1, touches: 0, pregnant: false }], partner: null, met: [] };
  call('showGameView', ['rel']);
  call('setRelTab', ['love']);
  const nameEl = w.document.querySelector('#view-rel .rel-name.tap');
  ok(!!nameEl, '恋人名字可点击');
  const before = s.love.candidates[0].affinity;
  click(nameEl);
  ok(s.love.candidates[0].affinity > before, '点名字触发聊天涨好感', `${Math.round(before)} → ${Math.round(s.love.candidates[0].affinity)}`);
  const subs = Array.from(w.document.querySelectorAll('#view-rel .rel-sub')).map(e => e.textContent).join(' | ');
  ok(subs.indexOf('今年还能约 2 次') > 0, '互动后实时刷新剩余次数', subs.trim().slice(-34));
}

console.log(errors.length ? '\n运行时错误：' + errors.join(' | ') : '\n无运行时错误 ✅');
if (errors.length) fail += errors.length;
console.log(fail === 0 ? '全部通过 ✅' : `失败 ${fail} 项 ❌`);
process.exit(fail ? 1 : 0);
