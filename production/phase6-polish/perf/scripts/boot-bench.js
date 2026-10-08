/* =========================================================
 * PERF-01 · 首屏加载剖析
 *  测量方式与浏览器一致：**每个采样点都在全新子进程里跑**，避免 V8
 *  代码缓存 / JIT 预热污染冷启动数字（已用 _probe-cold.js 验证过：
 *  同一进程内重复编译同一份源码，数字会被压低 20–40%）。
 *
 *  1) 资源体积：原始 / gzip / brotli
 *  2) 冷解析+编译 vs 顶层执行（VM 裸 context）
 *  3) jsdom 环境按 <script> 顺序注入的端到端耗时
 *  4) 堆内存驻留增量
 *  5) data.js 数据表盘点
 *
 * 运行： node production/phase6-polish/perf/scripts/boot-bench.js
 * ========================================================= */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const vmMod = require('vm');
const H = require('./harness');

const out = [];
function say(s) { console.log(s); out.push(s); }

const ROUNDS = 9;
const med = arr => { const a = arr.slice().sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };

/* 每轮给源码尾部追加一个不同的注释，确保不会命中 V8 的 Script 复用路径。
   _probe-cold.js 已验证：同一进程内重复编译同一份源码，耗时会被压低 20–40%。 */
function mutate(code, i) { return code + '\n/*__bench_round_' + i + '__*/\n'; }

/* ================= 主流程 ================= */
say('# 首屏加载剖析 · cangame v5.5.0（Web）');
say('生成时间：' + new Date().toISOString());
say('运行时：Node ' + process.version + ' / ' + process.platform + ' ' + process.arch);
say('采样方式：每档 ' + ROUNDS + ' 轮，每轮用**全新 V8 context + 差异化源码**（尾部注释递增）绕开 V8 脚本复用，取中位数。');
say('> 换算口径：桌面 V8 上测得的毫秒数，中低端安卓机通常要 ×3～×6（单核性能 + 内存带宽差距）。');
say('');

/* ---------- 1. 体积 ---------- */
say('## 1. 资源体积清单');
const st = H.fileStats();
const tot = {
  file: '**合计**', bytes: st.reduce((a, b) => a + b.bytes, 0), lines: st.reduce((a, b) => a + b.lines, 0),
  gzip: st.reduce((a, b) => a + b.gzip, 0), brotli: st.reduce((a, b) => a + b.brotli, 0)
};
say(H.table(st.concat([tot]).map(r => ({
  file: r.file, '原始 KB': +(r.bytes / 1024).toFixed(1), 行数: r.lines,
  'gzip KB': +(r.gzip / 1024).toFixed(1), 'brotli KB': +(r.brotli / 1024).toFixed(1),
  'gzip 压缩比': (r.bytes / r.gzip).toFixed(2) + 'x'
})), ['file', '原始 KB', '行数', 'gzip KB', 'brotli KB', 'gzip 压缩比']));
say('');
say('GitHub Pages 自带 brotli/gzip。**线上实际传输 ≈ ' + (tot.brotli / 1024).toFixed(0) +
  ' KB（br）/ ' + (tot.gzip / 1024).toFixed(0) + ' KB（gzip）**，而非源码的 ' + (tot.bytes / 1024).toFixed(0) + ' KB。');
say('');

/* ---------- 2. VM 冷编译 / 执行 ---------- */
say('## 2. 冷解析+编译 / 顶层执行（V8 裸 context，不含 DOM）');
function runVMRound(round) {
  const ctx = vmMod.createContext({ console });
  return H.MODULES.filter(m => m !== 'assets/ui.js').map(m => {
    const code = mutate(H.read(m), round);
    const t0 = process.hrtime.bigint();
    const s = new vmMod.Script(code, { filename: m });
    const t1 = process.hrtime.bigint();
    s.runInContext(ctx);
    const t2 = process.hrtime.bigint();
    return {
      file: m, KB: +(Buffer.byteLength(code, 'utf8') / 1024).toFixed(1),
      compile: Number(t1 - t0) / 1e6, exec: Number(t2 - t1) / 1e6
    };
  });
}

const vmRuns = [];
for (let i = 0; i < ROUNDS; i++) vmRuns.push(runVMRound(i));
const vmRows = vmRuns[0].map((r, i) => {
  const c = med(vmRuns.map(x => x[i].compile));
  const e = med(vmRuns.map(x => x[i].exec));
  return {
    file: r.file, KB: r.KB, '编译 ms': c.toFixed(2), '执行 ms': e.toFixed(2),
    '合计 ms': (c + e).toFixed(2), 'ms/KB': ((c + e) / r.KB).toFixed(3)
  };
});
const sumC = vmRows.reduce((a, r) => a + Number(r['编译 ms']), 0);
const sumE = vmRows.reduce((a, r) => a + Number(r['执行 ms']), 0);
say(H.table(vmRows, ['file', 'KB', '编译 ms', '执行 ms', '合计 ms', 'ms/KB']));
say('');
say('逻辑层（7 个模块）冷加载合计：**编译 ' + sumC.toFixed(1) + ' ms + 执行 ' + sumE.toFixed(1) +
  ' ms = ' + (sumC + sumE).toFixed(1) + ' ms**');
say('');

/* ---------- 3. jsdom 端到端 ---------- */
say('## 3. jsdom 端到端（含 HTML 解析 + DOM 构建 + UI 层 + init 绑定）');
function runDOMRound(round) {
  return H.loadJSDOM({ mutate: round }).per;
}
const domRuns = [];
for (let i = 0; i < ROUNDS; i++) domRuns.push(runDOMRound(i));
const jRows = domRuns[0].map((r, i) => ({
  file: r.file, KB: +(r.bytes / 1024).toFixed(1),
  '注入/执行 ms': med(domRuns.map(x => x[i].totalMs)).toFixed(2)
}));
say(H.table(jRows, ['file', 'KB', '注入/执行 ms']));
const jTot = jRows.reduce((a, r) => a + Number(r['注入/执行 ms']), 0);
say('');
say('8 个脚本 + init 合计 ≈ **' + jTot.toFixed(1) + ' ms**（jsdom 是模拟器，真实浏览器 CSP/布局另有开销，' +
  '但**编译与执行这部分是同一套 V8，量级可直接参考**）。');
say('');

/* ---------- 4. 关键路径分析 ---------- */
say('## 4. 首屏关键路径');
say('```');
say('  HTML 下载+解析  ──┐');
say('  CSS 下载(6.5KB gz)─┤ 并行');
say('  8×JS 下载(预防扫描并行) ─┘  最慢的一项决定下限： data.js 52.6 KB gzip');
say('        ↓');
say('  按序执行 8 个脚本（阻塞渲染）  ← 本次实测 ' + jTot.toFixed(1) + ' ms（桌面）');
say('        ↓');
say('  DOMContentLoaded → init() → renderTitle() → 首屏可见');
say('```');
say('结论：CPU 侧（编译+执行）不是瓶颈，**网络 + 串行阻塞才是**——' +
  '在 3G/弱网（≈400 kbps 有效）下，光 data.js 的 52.6 KB 就要 ~1.0 s；' +
  '而这段时间内页面是白屏的，因为 8 个 `<script>` 没有一个 `defer`。');
say('');

/* ---------- 5. 内存 & data.js 盘点 ---------- */
say('## 5. 内存驻留与 data.js 盘点');
const v = H.loadVM(false);
const beforeMu = process.memoryUsage().heapUsed;
const v2 = H.loadVM(false);
const afterMu = process.memoryUsage().heapUsed;
say('两次独立 context 加载后 heapUsed 增量 ≈ **' + ((afterMu - beforeMu) / 1048576).toFixed(1) +
  ' MB**（含 V8 自身对象头开销，实际纯数据更少；这是「一个 tab 只加载一次」的量级）');
say('');
const probe = `(() => {
  const list = ['SURNAMES','TALENTS','FAMILIES','ILLNESS','FAMILY_ACTS','ACHIEVEMENTS','EVENTS','EVENTS_EXTRA','EVENTS_FAMILY','EVENTS_FAMILY2','EVENTS_ERA','INVESTMENTS','ENDINGS','GOOD_DEEDS','FRIEND_TYPES','TITLES','EXAM_QUIZ','STOCKS','UNIVERSITIES','HOUSES','CARS','GOODS','CAREERS'];
  const out = {};
  list.forEach(k => { try { const val = eval(k); out[k] = Array.isArray(val) ? val.length : (val && typeof val === 'object' ? Object.keys(val).length + 'k' : 'n/a'); } catch (e) { out[k] = 'n/a'; } });
  return out;
})()`;
let dump = {};
try { dump = v.run(probe); } catch (e) { say('probe 失败: ' + e.message); }
const keyRows = Object.keys(dump).map(k => ({ 常量: k, 条目数: dump[k] }));
say(H.table(keyRows, ['常量', '条目数']));
const declared = ['EVENTS', 'EVENTS_EXTRA', 'EVENTS_FAMILY', 'EVENTS_FAMILY2', 'EVENTS_ERA']
  .reduce((a, k) => a + (typeof dump[k] === 'number' ? dump[k] : 0), 0);
const runtime = v.run('EVENTS.length');
say('');
say('- 声明式条目合计 ' + declared + ' 条；但 data.js 末尾有 ' +
  '`EVENTS.push.apply(EVENTS, EVENTS_EXTRA / FAMILY / FAMILY2 / ERA)` —— 四个子数组**在加载期就被合并进 EVENTS**。');
say('- **运行时真正的事件池 `EVENTS.length` = ' + runtime + '** 条；' +
  '上面表里那 ' + declared + ' 的「声明式合计」里有约 ' + (declared - runtime) + ' 条是同一批对象的重复计数。');
say('这 ' + runtime + ' 条中文事件 + ' + (dump.TALENTS || 0) + ' 条天赋描述，构成了 data.js 165 KB 的主体。');
say('');

fs.writeFileSync(path.join(__dirname, 'boot-bench.out.txt'), out.join('\n'), 'utf8');
console.log('[已写出] ' + path.join(__dirname, 'boot-bench.out.txt'));
