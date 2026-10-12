// cangame v3 · UI 冒烟（jsdom 真实 DOM，覆盖 ui.js 渲染与交互）
const fs = require('fs'), path = require('path');
let JSDOM;
// 受控 node 忽略 NODE_PATH，直接用已知绝对路径（本机 workspace）
const JSDOM_PATHS = [
  'C:/Users/ro3ea/.workbuddy/binaries/node/workspace/node_modules/jsdom',
  path.join(process.cwd(), '..', '..', 'node_modules', 'jsdom')
];
for (const p of JSDOM_PATHS) { try { ({ JSDOM } = require(p)); break; } catch (e) { } }
if (!JSDOM) { console.log('⚠ 无 jsdom，跳过 UI 冒烟'); process.exit(0); }

const ROOT = process.cwd();
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;
const files = ['config', 'rng', 'players', 'league', 'tactics', 'match', 'season', 'engine', 'ui'];
files.forEach(n => { window.eval(fs.readFileSync(path.join(ROOT, 'assets/' + n + '.js'), 'utf8')); });
// jsdom 构造时已触发 DOMContentLoaded，这里显式启动 UI
if (window.renderPick) window.renderPick();
if (window.document.readyState !== 'complete') window.document.dispatchEvent(new window.Event('DOMContentLoaded'));

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log('  ✗ ' + m); } }

const doc = window.document;
ok(doc.getElementById('team-grid').children.length === 30, '选队界面渲染 30 队');
// 选第一队
doc.querySelector('#team-grid .team-btn').click();
ok(!doc.getElementById('screen-game').classList.contains('hidden'), '选队后进入主界面');
ok(doc.querySelector('svg.board'), '战术板 SVG 已渲染');
ok(doc.querySelectorAll('#tactic-controls select').length === 4, '4 个战术下拉');
ok(doc.querySelectorAll('#lineup-controls select').length === 5, '5 个首发下拉');
ok(doc.querySelectorAll('#standings tbody tr').length === 30, '积分榜 30 行');
ok(doc.querySelectorAll('#roster tbody tr').length === 12, '阵容 12 人');
// 推进 5 轮
for (let i = 0; i < 5; i++) doc.getElementById('btn-advance').click();
ok(doc.getElementById('report').textContent.length > 0, '推进后战报有内容');
ok(doc.querySelector('#hdr .rec').textContent.indexOf('常规赛') >= 0, '头部显示赛季进度');
// 改战术不报错
const sel = doc.querySelector('#tactic-controls select[data-k="pace"]');
sel.value = '快'; sel.dispatchEvent(new window.Event('change'));
ok(true, '切换战术未抛错');
// 换首发不报错
const ls = doc.querySelector('#lineup-controls select');
if (ls.options.length > 1) { ls.selectedIndex = 1; ls.dispatchEvent(new window.Event('change')); }
ok(doc.querySelector('svg.board'), '换首发后战术板仍在');

console.log('\nverify-ui: 通过 ' + pass + ' / ' + (pass + fail) + (fail ? '  ❌' : '  ✅ 全部通过'));
process.exit(fail ? 1 : 0);
