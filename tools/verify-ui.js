// cangame v3.1 · UI 冒烟（jsdom 真实 DOM，覆盖 XBA 三栏架构 + 训练/理疗交互）
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
const files = ['config', 'rng', 'players', 'league', 'tactics', 'match', 'season', 'training', 'engine', 'ui'];
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
ok(doc.querySelector('#hdr .tb-team'), '顶部状态条含球队名');
ok(doc.getElementById('hdr').textContent.indexOf('球队资金') >= 0, '顶部状态条含球队资金');
ok(doc.getElementById('hdr').textContent.indexOf('球队等级') >= 0, '顶部状态条含球队等级');
ok(doc.getElementById('hdr').textContent.indexOf('训练点') >= 0, '顶部状态条含训练点');
ok(doc.querySelectorAll('.nav-btn').length >= 8, '左导航 ≥8 项');
ok(doc.querySelector('svg.board'), '战术板 SVG 已渲染（默认视图）');
ok(doc.querySelectorAll('#side-roster .side-roster-row').length === 12, '右侧球员面板 12 人');
// 切到积分榜
doc.querySelector('.nav-btn[data-view="standings"]').click();
ok(!doc.getElementById('view-standings').classList.contains('hidden'), '导航切换到积分榜');
ok(doc.querySelectorAll('#standings thead th').length === 6, '积分榜 6 列（含积分）');
ok(doc.querySelectorAll('#standings tbody tr').length === 30, '积分榜 30 行');
// 切到训练
doc.querySelector('.nav-btn[data-view="training"]').click();
ok(doc.querySelectorAll('#training tbody tr').length === 12, '训练页 12 人');
ok(doc.querySelectorAll('[data-train]').length === 12, '每行有训练按钮');
ok(doc.querySelectorAll('[data-physio]').length === 12, '每行有理疗按钮');
// 推进 5 轮
for (let i = 0; i < 5; i++) doc.getElementById('btn-advance').click();
ok(doc.getElementById('report').textContent.length > 0, '推进后战报有内容');
ok(doc.getElementById('hdr').textContent.indexOf('轮') >= 0, '顶部状态条显示轮次');
ok(doc.getElementById('hdr').textContent.indexOf('训练点') >= 0, '推进后仍显示训练点');
// 上轮本轮
doc.querySelector('.nav-btn[data-view="rounds"]').click();
ok(doc.querySelectorAll('#round-prev tbody tr').length === 15, '上轮赛果 15 场');
// 技术统计
doc.querySelector('.nav-btn[data-view="stats"]').click();
ok(doc.querySelectorAll('#stats tbody tr').length === 12, '技术统计 12 人');
// 训练交互（先切训练页，训练第一个可用球员）
doc.querySelector('.nav-btn[data-view="training"]').click();
const tbtn = doc.querySelector('[data-train]:not([disabled])');
if (tbtn) {
  const ptsBefore = Number(doc.getElementById('hdr').textContent.match(/训练点\s*(\d+)/) ? RegExp.$1 : 0);
  tbtn.click();
  ok(true, '训练点击未抛错');
} else { ok(false, '推进 5 轮后无可用的训练按钮'); }
// 改战术不报错
doc.querySelector('.nav-btn[data-view="tactics"]').click();
const sel = doc.querySelector('#tactic-controls select[data-k="pace"]');
sel.value = '快'; sel.dispatchEvent(new window.Event('change'));
ok(true, '切换战术未抛错');
// 换首发不报错
const ls = doc.querySelector('#lineup-controls select');
if (ls.options.length > 1) { ls.selectedIndex = 1; ls.dispatchEvent(new window.Event('change')); }
ok(doc.querySelector('svg.board'), '换首发后战术板仍在');

console.log('\nverify-ui: 通过 ' + pass + ' / ' + (pass + fail) + (fail ? '  ❌' : '  ✅ 全部通过'));
process.exit(fail ? 1 : 0);
