/* v5.4 UI 冒烟（jsdom）：dock 返回人生 / 韩式头像 / 向善页 / 放榜全学校 / 配偶互动按钮 / 外遇页 */
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
const call = (n, a) => w.eval(n).apply(null, a || []);
const txt = (id) => $(id).textContent.replace(/\s+/g, ' ');
const S = () => w.__getState();

console.log('== 开局 ==');
click($('btnNew'));
$('inputName').value = '张伟';
click($('btnStart'));
ok(!!S(), '进入游戏');

console.log('== 8. dock 中间钮：人生界面=下一年，其他界面=返回人生 ==');
{
  const label = () => $('dockNext').querySelector('.d-tx').textContent;
  ok(label() === '下一年', '人生界面显示「下一年」', label());
  click($('dockRel'));
  ok(label() === '返回人生', '人际界面变成「返回人生」', label());
  ok($('dockNext').classList.contains('back'), '按钮带 back 样式');
  const age0 = S().age;
  click($('dockNext'));
  ok(S().age === age0, '点它不推进年份（只是回来）', `${age0} → ${S().age}`);
  ok(label() === '下一年', '回到人生界面又变回「下一年」', label());
  ok($('view-main').style.display === '', '人生视图已显示');
  ok($('view-rel').style.display === 'none', '人际视图已隐藏');
  // 未成年也能回来
  S().age = 10;
  click($('dockRel'));
  ok(label() === '返回人生', '未成年点人际也有返回钮');
  click($('dockNext'));
  ok(label() === '下一年' && $('view-main').style.display === '', '未成年能回到主页面');
  click($('dockJob'));
  ok(label() === '返回人生', '工作界面也是「返回人生」');
  click($('dockNext'));
  ok(label() === '下一年', '工作界面点它也能回来');
}

console.log('== 13. 韩式头像：每个人一张脸，随年龄变化 ==');
{
  const s = S();
  s.age = 30;
  s.friends = [
    { key: 'colleague', name: '王磊', gender: 'M', age: 32, affinity: 55, alive: true },
    { key: 'teacher', name: '金美善', gender: 'F', age: 58, affinity: 70, alive: true }
  ];
  s.classmates = [{ key: 'nerd', name: '赵敏', gender: 'F', age: 30, affinity: 40, stage: 'uni', charm: 70 }];
  call('setRelTab', ['friends']);
  const svgs = w.document.querySelectorAll('#view-rel .rel-ava.pic svg');
  ok(svgs.length >= 2, '朋友卡渲染出头像 SVG', svgs.length + ' 个');
  const a = w.__call('portraitSVG', ['王磊', 'M', 32, {}]);
  const b = w.__call('portraitSVG', ['王磊', 'M', 32, {}]);
  ok(a === b, '同一个人每次生成同一张脸（由名字决定）');
  const young = w.__call('portraitSVG', ['王磊', 'M', 9, {}]);
  const old = w.__call('portraitSVG', ['王磊', 'M', 78, {}]);
  ok(young !== old, '年龄不同，脸不一样');
  ok(old.indexOf('#D9D5CE') >= 0, '老年白发', '');
  ok((old.match(/stroke-linejoin|<path|<polyline/g) || []).length > (young.match(/stroke-linejoin|<path|<polyline/g) || []).length, '老年多了皱纹线', '');
  ok(young.indexOf('opacity=".95"') >= 0, '少年有腮红', '');
  const other = w.__call('portraitSVG', ['李娜', 'F', 30, {}]);
  ok(a !== other, '不同的人是不同的脸');
  ok(/viewBox="0 0 100 100"/.test(a), '是标准 SVG 头像');
  // 恋人 / 配偶 / 家人也是头像
  s.spouse = { name: '林静', age: 29, affinity: 62, alive: true, since: 28 };
  s.flags.married = true; s.spouseName = '林静';
  call('setRelTab', ['love']);
  ok(w.document.querySelectorAll('#view-rel .rel-ava.pic svg').length >= 1, '配偶也是头像');
  call('setRelTab', ['family']);
  ok(w.document.querySelectorAll('#view-rel .rel-ava.pic svg').length >= 2, '父母也是头像');
}

console.log('== 4 / 12. 配偶互动按钮 + 外遇 ==');
{
  const s = S();
  s.stats.MONEY = 500000000;
  s.spouse.affinity = 40;
  call('setRelTab', ['love']);
  const btns = Array.from(w.document.querySelectorAll('#view-rel .rel-act')).filter(b => /陪伴|约会|送礼/.test(b.textContent));
  ok(btns.length >= 3, '配偶卡有 陪伴 / 约会 / 送礼', btns.map(b => b.textContent.trim()).join(' | '));
  const a0 = s.spouse.affinity;
  click(btns[0]);
  ok(S().spouse.affinity > a0, '点「陪伴」感情真的涨', `${Math.round(a0)} → ${Math.round(S().spouse.affinity)}`);
  const a1 = S().spouse.affinity;
  const d = Array.from(w.document.querySelectorAll('#view-rel .rel-act')).filter(b => /约会/.test(b.textContent))[0];
  click(d);
  ok(S().spouse.affinity > a1, '点「约会」继续涨', `${Math.round(a1)} → ${Math.round(S().spouse.affinity)}`);
  const outside = Array.from(w.document.querySelectorAll('#view-rel button')).filter(b => /外面认识一个人/.test(b.textContent));
  ok(outside.length === 1, '有「在外面认识一个人（外遇）」入口');
  const n0 = (w.__eval('loveInit(STATE).candidates') || []).length;
  click(outside[0]);
  const lv = w.__eval('loveInit(STATE).candidates');
  ok(lv.length === n0 + 1, '点了真的多一个人', `${n0} → ${lv.length}`);
  ok(lv[lv.length - 1].outside === true, '标记为婚外');
}

console.log('== 9. 向善页：道德能主动攒 ==');
{
  const s = S();
  s.stats.ETH = 42;
  const tabs = Array.from(w.document.querySelectorAll('#view-rel .rel-tab')).map(b => b.textContent.trim());
  ok(tabs.some(t => /向善/.test(t)), '人际页有「向善」页签', tabs.join(' | '));
  call('setRelTab', ['good']);
  const t = txt('view-rel');
  ok(/道德/.test(t), '显示当前道德值');
  ok(/捡到的钱包|福利院|志愿者|献血|支教/.test(t), '列出善事清单');
  const e0 = S().stats.ETH;
  const doBtn = Array.from(w.document.querySelectorAll('#view-rel .rel-act')).filter(b => /就做这个/.test(b.textContent))[0];
  ok(!!doBtn, '有可点的善事按钮');
  click(doBtn);
  ok(S().stats.ETH > e0, '做完道德上涨', `${Math.round(e0)} → ${Math.round(S().stats.ETH)}`);
  call('setRelTab', ['good']); // 重新渲染
  const again = Array.from(w.document.querySelectorAll('#view-rel .rel-act')).filter(b => /就做这个/.test(b.textContent));
  const dis = Array.from(w.document.querySelectorAll('#view-rel .rel-act')).filter(b => /今年做不了/.test(b.textContent));
  ok(dis.length >= 1, '做过的今年变成不可点', `${again.length} 可点 / ${dis.length} 已做`);
}

console.log('== 10. 放榜：列出所有学校，进不去的写明原因 ==');
{
  const s = S();
  s.age = 15;
  s.edu.hs = null; s.edu.uni = null; s.edu.stopped = false;
  const item = w.__call('makeExamEvent', [s, 'mid']);
  s.pending = item;
  for (let i = 0; i < 5; i++) w.__call('answerExamQ', [s, 0]);
  call('renderItem', [item]);
  const btns = Array.from(w.document.querySelectorAll('#actions button'));
  const schools = w.__eval('HIGH_SCHOOLS').length;
  ok(btns.length === schools, '所有学校都列出来了', `${btns.length}/${schools}`);
  const locked = btns.filter(b => b.disabled);
  ok(locked.length > 0, '进不去的被禁用', locked.length + ' 所');
  const reason = locked.map(b => b.textContent.replace(/\s+/g, ' ').trim()).join(' / ');
  ok(/进不去/.test(reason), '写明「进不去」');
  ok(/分数不够/.test(reason) || /不够/.test(reason), '写明原因', reason.slice(0, 90));
  const open = btns.filter(b => !b.disabled);
  ok(open.length >= 1, '至少有一条能走');
  const age0 = s.age;
  click(open[0]);
  ok(!!s.edu.hs, '点能走的学校会录取', s.edu.hs);
}

console.log('== 11. 艺术高中与表演系可选 ==');
{
  const hs = w.__eval('HIGH_SCHOOLS').map(h => h.name);
  ok(hs.some(n => /艺术高中/.test(n)), '高中列表含艺术高中', hs.join(' / '));
  const unis = w.__eval('UNIVERSITIES');
  ok(unis.some(u => (u.major || []).indexOf('表演') >= 0), '本科有表演系');
  // 填志愿：一次给到 6 个专业，并写出路
  const s = S();
  s.age = 18;
  s.edu.uni = 'u_yiben'; s.edu.hs = 'hs_ord';
  const ev = w.__call('makeMajorEvent', [s, w.__eval('UNIVERSITIES').find(u => u.id === 'u_yiben')]);
  ok(ev.choices.length >= 5, '志愿一次给 5 个以上专业', ev.choices.length + ' 个');
  ok(ev.choices.some(c => /出路/.test(c.text)), '写明每个专业的出路', ev.choices[0].text);
}

console.log('== 14. 做好措施的价格 ==');
{
  const cost = w.__eval('LOVE_META.safeCost');
  ok(cost <= 30000, '措施成本已下调', w.__eval('fmtMoney(' + cost + ')'));
}

console.log(errors.length ? '运行时错误 ❌\n' + errors.join('\n') : '无运行时错误 ✅');
if (errors.length) fail += errors.length;
console.log(fail === 0 ? '\n全部通过 ✅' : `\n失败 ${fail} 项 ❌`);
process.exit(fail ? 1 : 0);
