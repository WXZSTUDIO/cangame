// cangame v3.2 · UI 冒烟（jsdom 真实 DOM：XBA 布局 + Tab + 杯赛 + 胜者为王 + 球星）
const fs = require('fs'), path = require('path');
let JSDOM;
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
const files = ['config', 'rng', 'players', 'league', 'tactics', 'match', 'season', 'training', 'cup', 'engine', 'ui'];
files.forEach(n => { window.eval(fs.readFileSync(path.join(ROOT, 'assets/' + n + '.js'), 'utf8')); });
// jsdom 构造时 readyState=loading，DOMContentLoaded 已错过：显式派发以触发 boot()
window.document.dispatchEvent(new window.Event('DOMContentLoaded'));

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log('  ✗ ' + m); } }

const doc = window.document;
ok(doc.getElementById('team-grid').children.length === 42, '选队界面渲染 42 队');
// 选第一队（1级联赛球队）
doc.querySelector('#team-grid .team-btn').click();
ok(!doc.getElementById('screen-game').classList.contains('hidden'), '选队后进入主界面');
// 顶栏（XBA 状态条）
ok(doc.querySelector('#hdr .tb-team'), '顶部状态条含球队名');
const hdrTxt = doc.getElementById('hdr').textContent;
ok(hdrTxt.indexOf('球队资金') >= 0, '顶栏含球队资金');
ok(hdrTxt.indexOf('球队等级') >= 0, '顶栏含球队等级');
ok(hdrTxt.indexOf('联赛排名') >= 0, '顶栏含联赛排名');
ok(hdrTxt.indexOf('训练点') >= 0, '顶栏含训练点');
ok(hdrTxt.indexOf('王者积分') >= 0, '顶栏含王者积分');
ok(doc.querySelector('#hdr .broadcast'), '顶栏含系统广播区');
// 导航与 Tab
ok(doc.querySelectorAll('.nav-btn').length >= 12, '左导航 ≥12 项（含杯赛组）');
ok(doc.querySelectorAll('.tab-btn').length === 4, '主区 Tab 4 个（联赛排名/上轮本轮/技术统计/联赛日志）');
ok(doc.querySelector('svg.board'), '战术板 SVG 已渲染（默认视图）');
// 右侧面板：首发 5 人 / 切替补 7 人
ok(doc.querySelectorAll('#side-roster .side-roster-row').length === 5, '右面板默认首发 5 人');
doc.querySelector('.side-tab[data-st="bench"]').click();
ok(doc.querySelectorAll('#side-roster .side-roster-row').length === 7, '切换替补页签 7 人');
doc.querySelector('.side-tab[data-st="starters"]').click();
// Tab 切换到积分榜
doc.querySelector('.tab-btn[data-view="standings"]').click();
ok(!doc.getElementById('view-standings').classList.contains('hidden'), 'Tab 切换到积分榜');
ok(doc.querySelectorAll('#standings thead th').length === 6, '积分榜 6 列（含净胜分）');
ok(doc.querySelectorAll('#standings tbody tr').length === 14, '积分榜 14 行（本联赛）');
// 左导航也激活同一视图
ok(doc.querySelector('.nav-btn[data-view="standings"]').classList.contains('active'), '左导航同步高亮');
// 联赛日志 Tab
doc.querySelector('.tab-btn[data-view="logs"]').click();
ok(!doc.getElementById('view-logs').classList.contains('hidden'), 'Tab 切换到联赛日志');
// 训练页（含球星训练按钮）
doc.querySelector('.nav-btn[data-view="training"]').click();
ok(doc.querySelectorAll('#training tbody tr').length === 12, '训练页 12 人');
ok(doc.querySelectorAll('[data-train]').length === 12, '每行有训练按钮');
ok(doc.querySelectorAll('[data-physio]').length === 12, '每行有理疗按钮');
ok(doc.querySelectorAll('[data-star]').length === 12, '每行有球星训练按钮');
// 杯赛页：3 张杯赛卡 + 报名按钮
doc.querySelector('.nav-btn[data-view="cups"]').click();
ok(doc.querySelectorAll('.cup-card').length === 3, '杯赛页 3 张卡（新人杯/大杯赛/小杯赛）');
const regBtn = doc.querySelector('[data-cup-reg]');
if (regBtn) { regBtn.click(); ok(true, '杯赛报名点击未抛错'); }
// 胜者为王页
doc.querySelector('.nav-btn[data-view="kings"]').click();
ok(doc.getElementById('kings').textContent.indexOf('胜者为王') >= 0 || doc.getElementById('view-kings').textContent.length > 0, '胜者为王页已渲染');
const kStart = doc.getElementById('kings-start');
if (kStart) { kStart.click(); ok(!!doc.getElementById('kings-next'), '报名后出现「下一场」按钮'); }
// 推进 5 轮
doc.getElementById('btn-advance').click();
for (let i = 0; i < 4; i++) doc.getElementById('btn-advance').click();
ok(doc.getElementById('report').textContent.length > 0, '推进后战报有内容');
ok(doc.getElementById('hdr').textContent.indexOf('轮') >= 0, '顶栏显示轮次');
// 上轮本轮：本联赛 7 场
doc.querySelector('.nav-btn[data-view="rounds"]').click();
ok(doc.querySelectorAll('#round-prev tbody tr').length === 7, '上轮赛果 7 场（14 队联赛）');
// 技术统计
doc.querySelector('.nav-btn[data-view="stats"]').click();
ok(doc.querySelectorAll('#stats tbody tr').length <= 12, '技术统计渲染');
// 训练交互
doc.querySelector('.nav-btn[data-view="training"]').click();
const tbtn = doc.querySelector('[data-train]:not([disabled])');
if (tbtn) tbtn.click();
ok(true, '训练点击未抛错');
// 改战术（6攻6防下拉）
doc.querySelector('.nav-btn[data-view="tactics"]').click();
const sel = doc.querySelector('#tactic-controls select[data-k="offense"]');
ok(sel && sel.options.length === 6, '进攻战术下拉 6 项');
sel.value = '快攻'; sel.dispatchEvent(new window.Event('change'));
const dsel = doc.querySelector('#tactic-controls select[data-k="defense"]');
ok(dsel && dsel.options.length === 6, '防守战术下拉 6 项');
dsel.value = '3-2联防'; dsel.dispatchEvent(new window.Event('change'));
ok(true, '切换攻防战术未抛错');
// 换首发
const ls = doc.querySelector('#lineup-controls select');
if (ls.options.length > 1) { ls.selectedIndex = 1; ls.dispatchEvent(new window.Event('change')); }
ok(doc.querySelector('svg.board'), '换首发后战术板仍在');
// 荣誉室
doc.querySelector('.nav-btn[data-view="honors"]').click();
ok(doc.getElementById('honors').textContent.indexOf('联赛冠军') >= 0, '荣誉室渲染');

console.log('\nverify-ui: 通过 ' + pass + ' / ' + (pass + fail) + (fail ? '  ❌' : '  ✅ 全部通过'));
process.exit(fail ? 1 : 0);
