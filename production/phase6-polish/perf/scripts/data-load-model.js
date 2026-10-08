/* =========================================================
 * data.js 拆分方案 · 首屏收益模型
 * ---------------------------------------------------------
 * 只读。把五种加载策略在三种网络档位下的关键路径算成具体毫秒数。
 *
 * 所有体积取自 data-size-probe.out.txt（实测 gzip / brotli）。
 * 模型是**显式的、可审计的** —— 参数和假设全部摊开写，不藏在代码里。
 * ========================================================= */
const fs = require('fs');
const path = require('path');

const lines = [];
const say = (s) => { lines.push(s); console.log(s); };
const kb = (n) => n / 1024;

/* ---------------- 实测体积（gzip, KB） ---------------- */
const SZ = {
  html: 6.6, css: 6.5,
  data: 53.6, market: 9.6, engine: 33.9, school: 9.5,
  career: 9.3, love: 9.9, loan: 2.7, ui: 31.6
};
/* data.js 内部构成（实测） */
const DATA_EVENTS = 31.1;          // 五个事件池合计 gzip
const DATA_CONST = SZ.data - DATA_EVENTS;   // 常量表 22.5
/* 事件池按「窗口开启段」的分布（实测，data-age-window.out.txt） */
const EV_BAND = {
  '童年 0-6': 17, '学生 7-18': 59, '成年 19-60': 160, '晚年 61+': 5
};
const EV_TOT = 241;

/* ---------------- 网络档位 ---------------- */
const NETS = [
  { name: '4G 良好', bps: 10e6, rtt: 50, conn: 6 },
  { name: '3G 弱网', bps: 1.5e6, rtt: 150, conn: 6 },
  { name: '2G 极差', bps: 400e3, rtt: 300, conn: 4 }
];

/* ---------------- 传输模型 ----------------
 * 单资源：RTT（握手+首字节）+ size/BW
 * 并行下载：LPT 装箱到 conn 条连接（近似浏览器的连接上限） */
function xfer(sizeKb, net) {
  return net.rtt + (sizeKb * 1024 * 8) / net.bps * 1000;
}
function parallel(sizes, net, extraRtt) {
  // extraRtt：额外串行段数（如「先拿 HTML 才发现 CSS」）
  const bins = new Array(net.conn).fill(0);
  sizes.slice().sort((a, b) => b - a).forEach(s => {
    const i = bins.indexOf(Math.min.apply(null, bins));
    bins[i] += s;
  });
  const waveMs = Math.max.apply(null, bins.map(b => (b * 1024 * 8) / net.bps * 1000));
  return extraRtt * net.rtt + net.rtt + waveMs;   // 1 次握手 + 装箱后的最慢一条
}
function serial(sizes, net, extraRtt) {
  return sizes.reduce((a, s) => a + xfer(s, net), extraRtt * net.rtt);
}

say('# 首屏收益模型');
say('');
say('生成时间：' + new Date().toISOString());
say('');
say('## 0. 模型参数（全部实测，可审计）');
say('');
say('| 资源 | gzip (KB) |');
say('|---|---:|');
Object.keys(SZ).forEach(k => say('| ' + k + ' | ' + SZ[k] + ' |'));
say('');
say('- `data.js` 内部：事件池 **' + DATA_EVENTS.toFixed(1) + ' KB** + 常量表 **' +
  DATA_CONST.toFixed(1) + ' KB**');
say('- 事件窗口开启段分布：' + Object.keys(EV_BAND).map(k => k + ' ' + EV_BAND[k]).join('、'));
say('');
say('### 网络档位');
say('');
say('| 档位 | 带宽 | RTT | 并发连接 |');
say('|---|---:|---:|---:|');
NETS.forEach(n => say('| ' + n.name + ' | ' + (n.bps / 1e6).toFixed(1) + ' Mbps | ' +
  n.rtt + ' ms | ' + n.conn + ' |'));
say('');
say('> **模型假设（请按自己经验判断合不合理）**：'
  + '① 单资源耗时 = 1×RTT + 传输时间；'
  + '② 并行下载按 LPT 装箱近似浏览器的连接上限；'
  + '③ HTML 与 CSS 之间有 1 个串行 RTT（head 里才发现 CSS）；'
  + '④ 忽略 TLS 握手、DNS、服务端排队（对同档位横向比较影响不大）；'
  + '⑤ 忽略解析与执行时间（实测逻辑层编译+执行仅 8 ms，相对网络可忽略）。');
say('');

/* ---------------- 五种方案 ---------------- */
/* 首屏 FCP 关键路径：渲染阻塞资源（HTML + CSS + 同步脚本） */
/* 可玩 TTP 关键路径：全部逻辑层 + ui + 首屏需要的事件 */

const LOGIC = [SZ.market, SZ.engine, SZ.school, SZ.career, SZ.love, SZ.loan, SZ.ui];

const PLANS = [
  {
    id: 'P0', name: 'P0 · 现状（8 个同步脚本，无 defer）',
    fcp: (net) => serial([SZ.html, SZ.css, SZ.data].concat(LOGIC), net, 1),
    ttp: (net) => serial([SZ.html, SZ.css, SZ.data].concat(LOGIC), net, 1),
    note: '8 个脚本同步串行，全部阻塞渲染；HTML 解析完也要等脚本下完才画得出来。'
  },
  {
    id: 'P1', name: 'P1 · 只给 8 个脚本加 defer',
    fcp: (net) => serial([SZ.html, SZ.css], net, 1),
    ttp: (net) => serial([SZ.html, SZ.css], net, 1) + parallel([SZ.data].concat(LOGIC), net, 0),
    note: 'defer 保序、在 DOMContentLoaded 前执行，架构不用动；'
      + 'HTML 外壳（topbar「人生模拟」）先画出来，脚本并行下载。'
  },
  {
    id: 'P2', name: 'P2 · defer + 事件按人生阶段拆 4 个文件',
    fcp: (net) => serial([SZ.html, SZ.css], net, 1),
    ttp: (net) => serial([SZ.html, SZ.css], net, 1) +
      parallel([DATA_CONST + SZ.data - SZ.data + evKb('童年 0-6')].concat(LOGIC), net, 0),
    note: '首屏只下载「童年段」事件；其余三段随进度加载。需要把 241 条事件按年龄重新分组。'
  },
  {
    id: 'P3', name: 'P3 · defer + 事件抽 JSON + fetch 懒加载',
    fcp: (net) => serial([SZ.html, SZ.css], net, 1),
    ttp: (net) => serial([SZ.html, SZ.css], net, 1) +
      parallel([DATA_CONST].concat(LOGIC), net, 0) +
      net.rtt + (evKb('童年 0-6') * 1024 * 8) / net.bps * 1000,
    note: '事件全部转为 JSON，用 fetch 按需取。首屏连「童年段」都是异步的，'
      + '需要事件池能容忍「暂时为空」。'
  },
  {
    id: 'P4', name: 'P4 · defer + 单文件 + 事件池惰性初始化',
    fcp: (net) => serial([SZ.html, SZ.css], net, 1),
    ttp: (net) => serial([SZ.html, SZ.css], net, 1) + parallel([SZ.data].concat(LOGIC), net, 0),
    note: '文件不拆，只把「解析」推迟 —— 但 `<script>` 的解析即执行，'
      + '不拆文件就推迟不了下载，所以这一项对**首屏无效**，只对执行耗时有效。'
  }
];

function evKb(band) {
  return DATA_EVENTS * (EV_BAND[band] / EV_TOT);
}

say('## 1. 各方案关键路径耗时（ms）');
say('');
NETS.forEach(net => {
  say('### ' + net.name + '（' + (net.bps / 1e6).toFixed(1) + ' Mbps / RTT ' + net.rtt + ' ms）');
  say('');
  say('| 方案 | 首屏 FCP | 可开始游戏 | 相对 P0 的 FCP 收益 |');
  say('|---|---:|---:|---:|');
  const base = PLANS[0].fcp(net);
  PLANS.forEach(p => {
    const f = p.fcp(net), t = p.ttp(net);
    say('| ' + p.name + ' | **' + Math.round(f) + '** | ' + Math.round(t) + ' | ' +
      (Math.round(f) === Math.round(base) ? '—' :
        Math.round(base - f) + ' ms（−' + ((base - f) / base * 100).toFixed(0) + '%）') + ' |');
  });
  say('');
});

/* ---------------- S2 扩容后的推演 ---------------- */
say('## 2. S2 扩容到 500+ 条之后');
say('');
const GROW = 500 / EV_TOT;
say('事件数 241 → **500**（×' + GROW.toFixed(2) + '）。假设新增事件均匀分布，'
  + '事件池 gzip 从 ' + DATA_EVENTS.toFixed(1) + ' → **' + (DATA_EVENTS * GROW).toFixed(1) + ' KB**。');
say('');
say('| 方案 | 事件池 gzip | 首屏需下载的事件 | 首屏 FCP (3G) | 可开始游戏 (3G) |');
say('|---|---:|---:|---:|---:|');
const net3 = NETS[1];
[
  ['P0 现状', DATA_EVENTS * GROW, evKb('童年 0-6') * GROW + (DATA_EVENTS * GROW - DATA_EVENTS)],
  ['P1 只加 defer', DATA_EVENTS * GROW, DATA_EVENTS * GROW],
  ['P2 按阶段拆', DATA_EVENTS * GROW, evKb('童年 0-6') * GROW],
  ['P3 JSON + fetch', DATA_EVENTS * GROW, 0]
].forEach(([n, pool, first]) => {
  const isP0 = n.indexOf('P0') === 0;
  const fcp = isP0
    ? serial([SZ.html, SZ.css, DATA_CONST + pool].concat(LOGIC), net3, 1)
    : serial([SZ.html, SZ.css], net3, 1);
  const ttp = isP0
    ? fcp
    : serial([SZ.html, SZ.css], net3, 1) +
      parallel([DATA_CONST + (n.indexOf('P1') === 0 ? pool : first)].concat(LOGIC), net3, 0);
  say('| ' + n + ' | ' + pool.toFixed(1) + ' KB | ' + first.toFixed(1) + ' KB | ' +
    Math.round(fcp) + ' | ' + Math.round(ttp) + ' |');
});
say('');
say('> **这张表就是「加内容不加首屏时间」的量化说明**：'
  + 'P0 下事件翻倍会把首屏一起拖翻倍；P2 / P3 下首屏加载的事件量'
  + '只跟「当前所处人生阶段」有关，跟事件库总量**无关**。');
say('');

/* ---------------- 总传输量对比 ---------------- */
say('## 3. 总传输量（首屏之外，玩家完整玩一局）');
say('');
say('| 方案 | 首屏 | 完整一局（累计） | 说明 |');
say('|---|---:|---:|---|');
const totNow = SZ.html + SZ.css + SZ.data + LOGIC.reduce((a, b) => a + b, 0);
say('| P0 现状 | ' + totNow.toFixed(1) + ' KB | ' + totNow.toFixed(1) + ' KB | 一次性全下 |');
say('| P1 只加 defer | ' + (SZ.html + SZ.css).toFixed(1) + ' KB | ' + totNow.toFixed(1) +
  ' KB | 总量不变，只是不阻塞 |');
say('| P2 按阶段拆 | ' + (SZ.html + SZ.css).toFixed(1) + ' KB | ' +
  (totNow + 4 * 0.4).toFixed(1) + ' KB | 4 个事件文件各多一次请求头开销（约 0.4 KB/次） |');
say('| P3 JSON + fetch | ' + (SZ.html + SZ.css).toFixed(1) + ' KB | ' +
  (totNow + 4 * 0.4).toFixed(1) + ' KB | 同 P2 |');
say('');
say('> **关键**：P1~P3 都不减少总传输量，只改变「什么时候下」。'
  + '对**首屏**收益巨大，对**流量**零收益 —— 若目标是省流量，这几条都不是答案。');
say('');

fs.writeFileSync(path.join(__dirname, 'data-load-model.out.txt'), lines.join('\n') + '\n', 'utf8');
say('[已写出] data-load-model.out.txt');
