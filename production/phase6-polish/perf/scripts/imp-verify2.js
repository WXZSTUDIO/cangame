/* IMP-01 第二批验收：A-06 晋升链、R-01 迁移、R-02 存档失败提示、
 * O-04/R-04 属性转义、O-03 前置（pagehide/visibilitychange 兜底）。
 *
 * 注意：Windows 下 bash -e 传中文会乱码 → 一律写成 .js 文件执行。
 */
const H = require('./harness');

const lines = [];
const say = (s) => { lines.push(s); console.log(s); };
let pass = 0, fail = 0;
const ok = (cond, name, extra) => {
  if (cond) { pass++; say('  ✓ ' + name + (extra ? ' — ' + extra : '')); }
  else { fail++; say('  ✗ ' + name + (extra ? ' — ' + extra : '')); }
};

say('# IMP-01 第二批验收（A-06 晋升 / R-01 / R-02 / O-04 / O-03 前置）');
say('');
say('生成时间：' + new Date().toISOString());
say('');

/* ============ 1. A-06 晋升链：孤儿职称进入阶梯后 careerTick 能晋升 ============ */
say('## 1. A-06 晋升链：`JOB_ALIAS` 落地的职称能否被 `careerTick()` 晋升');
{
  const V = H.loadVM(false);
  const alias = V.run('(typeof JOB_ALIAS !== "undefined") ? JSON.parse(JSON.stringify(JOB_ALIAS)) : null');
  ok(!!alias, '`JOB_ALIAS` 映射表已存在', alias ? Object.keys(alias).length + ' 条' : '');

  if (alias) {
    const rows = V.run(`(function(){
      var keys = Object.keys(JOB_ALIAS);
      return keys.map(function(title){
        var st = createGame({ gender: 'M', talents: [] });
        st.age = 25;
        st.stats.STR = 60; st.stats.INT = 80; st.stats.NET = 60; st.stats.LOY = 60; st.stats.MNY = 40;
        setJob(st, title);
        var after = { job: st.job, career: st.career ? { id: st.career.id, level: st.career.level } : null };
        var maxLv = 0;
        if (after.career) {
          var c = CAREERS.find(function(x){ return x.id === after.career.id; });
          if (c && c.ladder) maxLv = c.ladder.length;
        }
        var promoted = false, peak = after.career ? after.career.level : 0;
        for (var y = 0; y < 20; y++) {
          st.age++;
          if (typeof careerTick === 'function') careerTick(st);
          if (st.career && st.career.level > peak) { peak = st.career.level; promoted = true; }
          if (!st.career) break;
        }
        // ladder 是 0 基索引：length=5 → 合法级为 0..4，顶级是 maxLv-1
        var atTop = after.career && maxLv > 0 && after.career.level >= maxLv - 1;
        return { 孤儿职称: title, 落地职称: after.job, 阶梯: after.career ? after.career.id : null,
                 起始级: after.career ? after.career.level : 0, 阶梯顶级: maxLv,
                 '20年后级': st.career ? st.career.level : null,
                 可晋升: promoted, 已在顶: atTop };
      });
    })()`);
    say('');
    say('| 孤儿职称 | 落地职称 | 阶梯 | 起始级 | 阶梯顶级 | 20 年后 | 判定 |');
    say('|---|---|---|---:|---:|---:|---|');
    rows.forEach(r => say('| ' + r.孤儿职称 + ' | ' + r.落地职称 + ' | ' + r.阶梯 + ' | ' +
      r.起始级 + ' | ' + r.阶梯顶级 + ' | ' + r['20年后级'] + ' | ' +
      (r.已在顶 ? '✓ 已在终端级（无从晋升）' : (r.可晋升 ? '✓ 可晋升' : '✗ 卡死')) + ' |'));
    say('');
    ok(rows.every(r => r.阶梯 !== null), '全部孤儿职称都落进了 CAREERS 阶梯',
      rows.filter(r => r.阶梯 === null).map(r => r.孤儿职称).join('/') || '无遗漏');
    const stuck = rows.filter(r => !r.可晋升 && !r.已在顶);
    ok(stuck.length === 0, '非顶级的落地职称都能被 `careerTick()` 晋升',
      stuck.map(r => r.孤儿职称).join('/') || '无卡死');
    const tops = rows.filter(r => r.已在顶);
    if (tops.length) say('  > 注：' + tops.map(r => '`' + r.孤儿职称 + '`').join('、') +
      ' 映射后落在索引 ' + tops.map(r => r.起始级).join('/') + '，而该 ladder 共 ' + tops[0].阶梯顶级 +
      ' 级（索引 0..' + (tops[0].阶梯顶级 - 1) + '），已是终端级，无从再晋升，属正确行为。');
  }
}

/* ============ 2. R-01 旧档字段迁移 ============ */
say('');
say('## 2. R-01 · 旧存档字段兜底（`log` / `queue` / `flags` 必补）');
{
  const V = H.loadVM(false);
  const r = V.run(`(function(){
    var out = [];
    ['log','queue','flags'].forEach(function(f){
      var st = createGame({ gender: 'M', talents: [] });
      st.age = 30;
      delete st[f];
      var err = null;
      try { migrateState(st); } catch (e) { err = e.name + ': ' + e.message; }
      var restored = f === 'flags'
        ? (st.flags && st.flags.parents_alive !== undefined)
        : Array.isArray(st[f]);
      out.push({ 删除字段: f, 抛错: err || '无', 补回: restored });
    });
    return out;
  })()`);
  r.forEach(x => ok(x.补回 && x.抛错 === '无', '删除 `' + x.删除字段 + '` 后 `migrateState()` 补回', x.抛错));
}

/* ============ 3. R-02 存档失败要有提示 + 返回值 ============ */
say('');
say('## 3. R-02 · localStorage 写入失败：可感知 + 可判定');
{
  const src = H.read('assets/ui.js');
  ok(/function\s+lsSet[\s\S]{0,400}?return\s+true[\s\S]{0,400}?return\s+false/.test(src),
    '`lsSet()` 返回布尔值，调用方能判定成功与否');
  ok(/let\s+_storageBroken\s*=\s*false/.test(src), '有「只提示一次」的闩锁 `_storageBroken`');
  ok(/save-broken/.test(src), '存档按钮会挂 `save-broken` 视觉标记');
  ok(/console\.error/.test(src), '失败时落 `console.error`，便于线上取证');

  const { window: w } = H.loadJSDOM();
  const r = w.eval(`(function(){
    // 先建一局，否则 autosave() 会在 if(!STATE) 处直接返回 false
    STATE = createGame({ name: '存储测试', gender: 'M', familyId: null, talents: [] });
    STATE.age = 31;
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { throw new DOMException('quota', 'QuotaExceededError'); }
    });
    var threw = null, ret = '?';
    try { ret = String(autosave()); } catch (e) { threw = e.name; }
    var btn = document.getElementById('btnSaveGame');
    return { threw: threw, ret: ret, cls: btn ? btn.className : '(按钮不存在)' };
  })()`);
  ok(r.threw === null, '`autosave()` 在写入抛错时不冒泡（try/catch 生效）', r.threw || '未抛错');
  ok(r.ret === 'false', '`autosave()` 写入失败时返回 `false`', '实测返回 ' + r.ret);
  ok(/save-broken/.test(r.cls), '失败后 `#btnSaveGame` 挂上了 `save-broken`', 'className = "' + r.cls + '"');
}

/* ============ 4. O-04 / R-04 属性上下文转义 ============ */
say('');
say('## 4. O-04 / R-04 · 属性上下文转义 `escAttr()`');
{
  const src = H.read('assets/ui.js');
  ok(/function\s+escAttr/.test(src), '新增 `escAttr()`');
  const body = (src.match(/function\s+escAttr\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/) || [])[1] || '';
  ok(/&amp;/.test(body) && /&lt;/.test(body) && /&gt;/.test(body), '`escAttr()` 覆盖 `& < >`');
  ok(/&#39;|&apos;/.test(body), "`escAttr()` 覆盖单引号 ' → &#39;");
  ok(/&quot;|&#34;/.test(body), '`escAttr()` 覆盖双引号 `"`');

  /* 按「属性」而非按「行」判定：一行里可能既有属性插值又有文本插值，
   * 后者用 esc() 才是对的。逐行判定会把正确代码误判成错。 */
  const ATTR_RE = /\b(aria-label|title|placeholder|alt|data-[a-z-]+)\s*=\s*"([^"]*)"/g;
  const hits = [];
  src.split('\n').forEach((line, i) => {
    // 跳过注释行（注释里会引用旧写法作说明，不该当成真实代码）
    const trimmed = line.trim();
    if (/^\/\*/.test(trimmed) || /^\*/.test(trimmed) || /^\/\//.test(trimmed)) return;
    let m;
    ATTR_RE.lastIndex = 0;
    while ((m = ATTR_RE.exec(line)) !== null) {
      const attrVal = m[2];
      if (!/\$\{/.test(attrVal)) continue;
      hits.push({ line: i + 1, attr: m[1], fns: (attrVal.match(/\$\{[^}]*\}/g) || []).join(' ') });
    }
  });
  say('');
  say('  共扫描到 **' + hits.length + '** 处「属性里带插值」，逐处确认：');
  hits.forEach(h => {
    const good = /escAttr\(/.test(h.fns) && !/\besc\(/.test(h.fns);
    ok(good, 'ui.js:' + h.line + ' `' + h.attr + '`', h.fns.slice(0, 64));
  });
  ok(hits.length >= 4, '覆盖了任务书点名的 4 处（1 × aria-label + 3 × title）',
    '实测 ' + hits.length + ' 处');

  const { window: w } = H.loadJSDOM();
  const r = w.eval([
    '(function(){',
    '  var payloads = [',
    '    \'" onload="__P"\',',
    '    \'"><script>__P</script>\',',
    '    "\' onmouseover=\'__P\'",',
    '    \'"><img src=x onerror=__P>\'',
    '  ];',
    '  var bad = [];',
    '  payloads.forEach(function(p){',
    '    var d = document.createElement("div");',
    '    d.innerHTML = portraitSVG(p, "M", 30, {});',
    '    var el = d.querySelector("svg");',
    '    var attrs = el ? Array.from(el.attributes).map(function(a){ return a.name; }) : [];',
    '    if (/onload|onerror|onmouseover|__P|<script/i.test(attrs.join(","))) bad.push(p + " -> " + attrs.join(","));',
    '  });',
    '  return { bad: bad, sample: escAttr("\\"\'&<>") };',
    '})()'
  ].join('\n'));
  ok(r.bad.length === 0, '4 组注入 payload 全部未突破 SVG 属性边界', r.bad.join(' | ') || '4/4 干净');
  ok(r.sample === '&quot;&#39;&amp;&lt;&gt;', '`escAttr()` 输出符合预期', JSON.stringify(r.sample));
}

/* ============ 5. O-03 前置：关页兜底 ============ */
say('');
say('## 5. O-03 前置 · 关页/切后台时的存档兜底（本批只埋点，不改节流）');
{
  const src = H.read('assets/ui.js');
  ok(/function\s+markDirty/.test(src), '新增 `markDirty()`（标记脏，不立即写盘）');
  ok(/function\s+flushSave/.test(src), '新增 `flushSave()`（立即落盘）');
  ok(/function\s+autosaveNow/.test(src), '新增 `autosaveNow()`（显式同步写）');
  ok(/SAVE_DEBOUNCE_MS\s*=\s*0/.test(src), '`SAVE_DEBOUNCE_MS = 0`，本批保持行为不变（仅搭骨架）');
  ok(/addEventListener\(\s*'pagehide'/.test(src), '注册 `pagehide`（iOS Safari 唯一可靠时机）');
  ok(/visibilitychange/.test(src) && /hidden/.test(src), '注册 `visibilitychange` 且判断 `document.hidden`');
  ok(/addEventListener\(\s*'beforeunload'/.test(src), '注册 `beforeunload` 兜底');
  const nowN = (src.match(/autosaveNow\(\)/g) || []).length;
  ok(nowN >= 2, '关键节点（人生结束 / 手动存）走 `autosaveNow()` 同步写', nowN + ' 处调用');

  const { window: w } = H.loadJSDOM();
  const r = w.eval(`(function(){
    STATE = createGame({ name: '兜底', gender: 'M', familyId: null, talents: [] });
    STATE.age = 33;
    var before = null, after = null, midway = null;
    try { before = localStorage.getItem(LS.auto); } catch (e) { }
    markDirty();
    try { midway = localStorage.getItem(LS.auto); } catch (e) { }
    flushSave();
    try { after = localStorage.getItem(LS.auto); } catch (e) { }
    return { wrote: !!after, changed: before !== after, midSame: before === midway,
             hasAge: !!after && after.indexOf('33') >= 0 };
  })()`);
  ok(r.wrote, '`markDirty()` + `flushSave()` 后 localStorage 有存档');
  ok(r.changed, '存档内容确实被更新（不是旧值）');
  ok(r.hasAge, '落盘的存档里带着当前进度（age=33）');
  say('  > `SAVE_DEBOUNCE_MS = 0` 时 `markDirty()` 会立即合流（实测 midSame=' + r.midSame +
    '），节流值留给 O-03 开启，本批不改行为。');
}

say('');
say('## 汇总');
say('');
say('通过 ' + pass + ' 项，失败 ' + fail + ' 项 → ' + (fail === 0 ? '✅ 全绿' : '❌ 有 ' + fail + ' 项未过'));
require('fs').writeFileSync(
  require('path').join(__dirname, 'imp-verify2.out.txt'),
  lines.join('\n') + '\n', 'utf8'
);
say('[已写出] imp-verify2.out.txt');
