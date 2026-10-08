/* =========================================================
 * 验收门准入证明器 · 故障注入（fault injection）
 * ---------------------------------------------------------
 * 规则（主理人 10-08 立）：
 *   任何门在进入门集之前，必须附一条「它在缺陷存在时会红」的证明。
 *   证明不了的，不配叫验收门，只能标为观察项。
 *
 * 绿门没有历史反证可查（它从没红过），所以只能**主动造一个缺陷**，
 * 看这道门会不会红。本脚本在「引擎 API 出口」上挂故障，然后重跑指定用例：
 *   注入后该断言由 PASS 翻 FAIL  → 有判定力，可作验收门（红端证明成立）
 *   注入后仍然 PASS             → 永绿门，降级为观察项
 *
 * 实现方式：在 require('./regression-run.js') 之前，先改写 reg-lib.exportApi，
 * 让回归套件拿到的 A 是「带故障的 A」。regression-run.js 在 require 时做的解构
 * 会取到改写后的版本 —— 因此**不需要改动 regression-run.js 一个字**。
 *
 * ⚠️ 只能挂在「回归套件通过 A.xxx 调用」的函数上（step / cramSchool / careerIncome /
 *    scoreOf / finish …）。引擎内部按闭包互相调用的函数（如 pickEvents）挂不上，
 *    那些门改用「历史反证 / 构造论证」证明。
 *
 * 用法：
 *   node fault-inject.js --cases=REG-00 --fault=crash-step
 *   node fault-inject.js --cases=REG-01,REG-12 --fault=hp-drain --n=60
 * 产物：stdout（断言级）+ out/fi-<fault>.json（用例级）
 * 只读 assets/，不修改任何游戏源码。
 * ========================================================= */
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const arg = (k, d) => {
  const m = argv.find(s => s.startsWith('--' + k + '='));
  return m ? m.split('=')[1] : d;
};
const FAULT = arg('fault', 'none');
const CASES = arg('cases', '');
const N = arg('n', '60');
/* 同一故障跑不同用例集时用来区分产物，避免互相覆盖 */
const TAG = arg('tag', '');

/* ---------------- 故障清单 ---------------- */
const FAULTS = {
  'none': { desc: '无故障（基线对照）', apply() {} },

  /* ① 崩溃：让 A.step 在 30 岁那一年抛异常 —— 模拟「某个年龄段有未捕获异常」 */
  'crash-step': {
    desc: 'A.step 在 30 岁抛异常（模拟未捕获异常）',
    apply(A) {
      const o = A.step;
      A.step = function (st) { if (st.age === 30) throw new Error('INJECT: step boom'); return o(st); };
    }
  },

  /* ①b 晚发崩溃：45 岁抛异常。
   *     与 ① 的区别：REG-00 的「可复现性自检」用 makeRealSave() 只跑到 35 岁且**不在 try 里**，
   *     ① 会让它整条用例「执行异常」而拿不到断言级结果；①b 绕开它，专门打「1000 局零崩溃」这道门。 */
  'crash-late': {
    desc: 'A.step 在 45 岁抛异常（晚发崩溃，避开 REG-00 的 makeRealSave）',
    apply(A) {
      const o = A.step;
      A.step = function (st) { if (st.age === 45) throw new Error('INJECT: late boom'); return o(st); };
    }
  },

  /* ② NaN 泄漏：50 岁起把 stats.MONEY 写成 NaN（NaN 会污染后续所有加减，永不自愈） */
  'nan-money': {
    desc: '50 岁起 stats.MONEY = NaN（模拟脏入参污染数值链）',
    apply(A) {
      const o = A.step;
      A.step = function (st) { const r = o(st); if (st.age >= 50) st.stats.MONEY = NaN; return r; };
    }
  },

  /* ③ 死因字段失效：把 ending.cause 抹掉 —— 复现 F-01 的形态，验证哨兵会不会叫 */
  'cause-drop': {
    desc: '抹掉 ending.cause（复现 F-01：死因字段失效）',
    apply(A) {
      const o = A.step;
      A.step = function (st) { const r = o(st); if (st.finished && st.ending) delete st.ending.cause; return r; };
    }
  },

  /* ④ HP 抽干：20 岁后 HP 恒为 12 —— 打「30 岁 HP 中位」与「平均寿命」两道门 */
  'hp-drain': {
    desc: '20 岁后 stats.HP 恒为 12（模拟修复过猛把人修死）',
    apply(A) {
      const o = A.step;
      A.step = function (st) { const r = o(st); if (st.age >= 20 && st.stats) st.stats.HP = 12; return r; };
    }
  },

  /* ⑤ 评分压平：把 st.score 钉死为 80 —— 打「评分标准差」门
   *    （只改 A.scoreOf 不够：st.score 由 finish 写入，sim 优先读 st.score） */
  'flat-score': {
    desc: 'st.score 恒为 80（模拟评分失去区分度）',
    apply(A) {
      const os = A.step, of = A.finish;
      A.step = function (st) { const r = os(st); st.score = 80; return r; };
      A.finish = function (st) { const r = of(st); st.score = 80; return r; };
      A.scoreOf = function () { return 80; };
    }
  },

  /* ⑥ 薪资公式改坏：careerIncome ×1.3 —— 打「静态复现」门 */
  'career-130': {
    desc: 'A.careerIncome 结果 ×1.3（模拟薪资公式多乘一项）',
    apply(A) {
      const o = A.careerIncome;
      A.careerIncome = function (st) { return o(st) * 1.3; };
    }
  },

  /* ⑦ forceEnd 回退：把最终结局 id 改成 end_dead —— 打「forceEnd 不应作为最终结局」 */
  'forceend-restore': {
    desc: '把最终结局 id 改回 end_dead（模拟 S-04 被回退）',
    apply(A) {
      const o = A.step;
      A.step = function (st) { const r = o(st); if (st.finished && st.ending) st.ending.id = 'end_dead'; return r; };
    }
  },

  /* ⑧ 补习有害（弱）：每次补习反而扣 4 点学习 —— 打「自变量有效 / 30 岁收入比 / 高考分单调」三门 */
  'cram-penalty': {
    desc: '每次 cramSchool 后 study −4（模拟「补习有害」缺陷 · 弱剂量）',
    apply(A) {
      const o = A.cramSchool;
      A.cramSchool = function (st) { const r = o(st); st.edu.study = (st.edu.study || 0) - 4; return r; };
    }
  },

  /* ⑬ 全年无内容：把 exam / event / invest 三种产出全部改判为 year，
   *     模拟「事件表抽不中 / 内容断供」，打 REG-06 的「全年龄空转率」门 */
  'no-content': {
    desc: 'A.step 的 exam / event / invest 产出全部改判为 year（模拟内容断供）',
    apply(A) {
      const o = A.step;
      A.step = function (st) {
        const r = o(st);
        if (r && (r.type === 'exam' || r.type === 'event' || r.type === 'invest')) return { type: 'year' };
        return r;
      };
    }
  },

  /* ⑩ 不可复现：createGame 带一个进程内自增计数 —— 模拟「跨局状态残留」，
   *     同一种子跑两次得到两份不同的人生，打 REG-00 / REG-13 的「可复现」门 */
  'nondet': {
    desc: 'A.createGame 注入自增计数（模拟跨局状态残留，同种子两次结果不同）',
    apply(A) {
      let c = 0;
      const o = A.createGame;
      A.createGame = function (cfg) { const st = o(cfg); st.stats.INT = (st.stats.INT || 0) + (++c % 7); return st; };
    }
  },

  /* ⑪ 迁移抛错：migrateState 直接 throw —— 打 REG-13 的「迁移不抛错」×11 */
  'migrate-throw': {
    desc: 'A.migrateState 抛异常（模拟迁移链路未兜底）',
    apply(A) { A.migrateState = function () { throw new Error('INJECT: migrate boom'); }; }
  },

  /* ⑫ 迁移产 NaN：migrateState 后把 MONEY 写成 NaN —— 打 REG-13 的「迁移后无 NaN」×11 */
  'migrate-nan': {
    desc: 'A.migrateState 后 stats.MONEY = NaN（模拟迁移把脏值带进存档）',
    apply(A) {
      const o = A.migrateState;
      A.migrateState = function (s) { const r = o(s); if (s && s.stats) s.stats.MONEY = NaN; return r; };
    }
  },

  /* ⑨ 补习有毒（强）：补习既扣学习又扣 INT（INT 直接进薪资公式）—— 检验 ⑧ 打不翻的门到底有没有判定力 */
  'cram-toxic': {
    desc: '每次 cramSchool 后 study −6 且 INT −30（模拟「补习有害」缺陷 · 强剂量）',
    apply(A) {
      const o = A.cramSchool;
      A.cramSchool = function (st) {
        const r = o(st);
        st.edu.study = (st.edu.study || 0) - 6;
        st.stats.INT = Math.max(1, (st.stats.INT || 0) - 30);
        return r;
      };
    }
  }
};

const F = FAULTS[FAULT];
if (!F) { console.error('未知故障：' + FAULT + '；可用：' + Object.keys(FAULTS).join(', ')); process.exit(2); }

/* ---------------- 挂钩：改写 reg-lib.exportApi ---------------- */
const lib = require('./reg-lib.js');
const origExportApi = lib.exportApi;
lib.exportApi = function (ctx) {
  const A = origExportApi(ctx);
  F.apply(A);
  return A;
};

/* ---------------- 捕获 stdout ---------------- */
const OUT = path.join(__dirname, 'out');
const lines = [];
const origLog = console.log;
console.log = function () {
  const s = Array.prototype.slice.call(arguments).join(' ');
  lines.push(s);
  origLog(s);
};

console.log('#### FAULT=' + FAULT + '  ' + F.desc + '  ####');

const args = [];
if (CASES) CASES.split(',').forEach(c => args.push(c.trim()));
args.push('--n=' + N);
process.argv = [process.argv[0], path.join(__dirname, 'regression-run.js')].concat(args);
require('./regression-run.js');

console.log = origLog;

/* ---------------- 解析断言级结果 ---------------- */
const res = [];
let cur = null;
lines.forEach(raw => {
  const l = raw.trim();
  let m = l.match(/^REG-\d\d · /);
  if (m) { cur = l; return; }
  m = l.match(/^\[(PASS|FAIL)\]\s+(.*?)\s*(?:<<\s*(.*))?$/);
  if (m && cur) res.push({ case: cur.split(' ')[0], pass: m[1] === 'PASS', name: m[2].trim(), detail: (m[3] || '').trim() });
});

const KEY = FAULT + (TAG ? '-' + TAG : '');
fs.writeFileSync(path.join(OUT, 'fi-' + KEY + '.json'),
  JSON.stringify({ fault: KEY, faultName: FAULT, desc: F.desc, n: N, cases: CASES, assertions: res }, null, 2), 'utf8');
console.log('\n[fi] 已写出 out/fi-' + KEY + '.json（断言 ' + res.length + ' 条）');
