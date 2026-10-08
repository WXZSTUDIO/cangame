/* =========================================================
 * 共用基准脚手架
 *  - loadVM()    : 把 8 个模块按线上 <script> 顺序灌进一个干净 V8 context
 *  - loadJSDOM() : 用 jsdom 起真实 DOM，逐个注入脚本（和浏览器一致）
 * 纯剖析用途，不写任何源文件。
 * ========================================================= */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..', '..', '..', '..');

const MODULES = [
  'assets/data.js',
  'assets/market.js',
  'assets/engine.js',
  'assets/school.js',
  'assets/career.js',
  'assets/love.js',
  'assets/loan.js',
  'assets/ui.js'
];

function read(file) { return fs.readFileSync(path.join(ROOT, file), 'utf8'); }

function fileStats() {
  const list = ['assets/style.css'].concat(MODULES);
  return list.map(f => {
    const buf = fs.readFileSync(path.join(ROOT, f));
    const src = buf.toString('utf8');
    return {
      file: f,
      bytes: buf.length,
      lines: src.split('\n').length,
      gzip: zlib.gzipSync(buf, { level: 9 }).length,
      brotli: zlib.brotliCompressSync(buf).length
    };
  });
}

/* ---------- A. 裸 V8 context（只跑逻辑层，UI 层会因为没有 DOM 而跳过） ---------- */
function loadVM(withUI) {
  const ctx = vm.createContext({ console, setTimeout, clearTimeout, TextEncoder, TextDecoder });
  const names = withUI ? MODULES : MODULES.filter(m => m !== 'assets/ui.js');
  const per = [];
  for (const m of names) {
    const code = read(m);
    const t0 = process.hrtime.bigint();
    const s = new vm.Script(code, { filename: m });
    const t1 = process.hrtime.bigint();
    s.runInContext(ctx);
    const t2 = process.hrtime.bigint();
    per.push({
      file: m,
      compileMs: Number(t1 - t0) / 1e6,
      execMs: Number(t2 - t1) / 1e6,
      bytes: Buffer.byteLength(code, 'utf8')
    });
  }
  return {
    ctx, per,
    get(name) { return vm.runInContext(name, ctx); },
    run(code) { return vm.runInContext(code, ctx); }
  };
}

/* ---------- B. jsdom 真 DOM（UI/渲染类基准用） ---------- */
function loadJSDOM(opts) {
  opts = opts || {};
  const NODE_WS = process.env.NODE_WS || 'C:/Users/ro3ea/.workbuddy/binaries/node/workspace';
  const { JSDOM, VirtualConsole } = require(path.join(NODE_WS, 'node_modules', 'jsdom'));
  const html = read('index.html');
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => {
    if (/Not implemented|scrollTo/.test(e.message)) return;
    errors.push('jsdomError: ' + e.message);
  });
  vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'https://cangame.test/',
    virtualConsole: vc,
    pretendToBeVisual: !!opts.visual
  });
  const w = dom.window;
  w.addEventListener('error', e => errors.push('window.error: ' + e.message));

  const per = [];
  const round = opts.mutate || 0;
  for (const m of MODULES) {
    const code = read(m) + '\n/*__bench_round_' + round + '__*/\n';
    const el = w.document.createElement('script');
    el.textContent = code;
    const t0 = process.hrtime.bigint();
    w.document.body.appendChild(el);
    const t1 = process.hrtime.bigint();
    per.push({ file: m, totalMs: Number(t1 - t0) / 1e6, bytes: Buffer.byteLength(code, 'utf8') });
  }
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  return { dom, window: w, doc: w.document, errors, per };
}

/* ---------- 计时小工具 ---------- */
function ms(bigint) { return Number(bigint) / 1e6; }
function now() { return process.hrtime.bigint(); }

function bench(label, iter, fn) {
  // 预热一轮，避免第一次的 JIT / 惰性编译算进来
  fn();
  const ts = [];
  for (let i = 0; i < iter; i++) {
    const t0 = now();
    fn();
    ts.push(ms(now() - t0));
  }
  ts.sort((a, b) => a - b);
  return {
    label,
    iter,
    min: ts[0],
    p50: ts[Math.floor(ts.length * 0.5)],
    p95: ts[Math.min(ts.length - 1, Math.floor(ts.length * 0.95))],
    max: ts[ts.length - 1],
    avg: ts.reduce((a, b) => a + b, 0) / ts.length
  };
}

function fmt(n, d) { return Number(n).toFixed(d == null ? 3 : d); }
function table(rows, cols) {
  const widths = {};
  cols.forEach(c => { widths[c] = Math.max(c.length, ...rows.map(r => String(r[c] == null ? '' : r[c]).length)); });
  const line = cols.map(c => '-'.repeat(widths[c])).join('-+-');
  const head = cols.map(c => c.padEnd(widths[c])).join(' | ');
  const body = rows.map(r => cols.map(c => String(r[c] == null ? '' : r[c]).padEnd(widths[c])).join(' | '));
  return [head, line].concat(body).join('\n');
}

module.exports = { ROOT, MODULES, read, fileStats, loadVM, loadJSDOM, bench, ms, now, fmt, table };
