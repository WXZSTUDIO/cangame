/* =========================================================
 * REG-13 真实存档 fixture 的形状来源
 * 本地 cangame **不是 git 仓库**（.git 不存在，deploy 走 .sync 缓存），
 * 但远端 GitHub `WXZSTUDIO/cangame` 有完整提交历史（每次 deploy 都推）。
 * 本脚本按 commit SHA 拉取各版本的 assets/engine.js，从 createGame() 的
 * state 字面量里抽出「顶层字段集合」，作为 **真实的存档形状** 写进
 * out/version-shapes.json，供 REG-13 构造版本级旧存档样本。
 * 只读远端 + 只写 out/，不碰 assets/。
 * ========================================================= */
const fs = require('fs');
const path = require('path');
const https = require('https');

const OUT = path.join(__dirname, 'out');
const OWNER = 'WXZSTUDIO', REPO = 'cangame';

/* 版本 → commit SHA（由 `list_commits(path=assets/engine.js)` 取得） */
const VERSIONS = [
  { tag: 'v4.x（pre-5.0）', sha: 'f6291b9c97c52584abb68dba8746b5f9acb12e00', msg: 'fix: 缓存busting+崩溃可见提示+防御式init; feat: 未成年免负债/家庭账簿/遗产继承三选一' },
  { tag: 'v5.0.0', sha: 'e2d4ab751ad470edffd917b8536857cdcfe5d93c', msg: 'v5.0.0 中考高考·职业晋升·恋爱同学·贷款寿命·中国化出身' },
  { tag: 'v5.3.0', sha: 'a24460bd5afa4902dd98f14adee86f5ebaf16b83', msg: 'feat: v5.3.0 恋爱对象随年龄增长 / 离婚与婚外关系 / …' },
  { tag: 'v5.4.0', sha: '2099a58cf234f7d6fe9d7ed997d7f0097a9003b5', msg: 'v5.4.0：恩师年龄 / 61 专业对口 / 毕业自选出路 / …' },
  { tag: 'v5.5.0（当前）', sha: 'efefd09744a13e7ecce3179f0efdb7ed1dfb64b5', msg: 'v5.5.0：父亲随你姓 / 分手 / 职业运动员 / …' }
];

function get(url) {
  return new Promise((res, rej) => {
    https.get(url, { headers: { 'User-Agent': 'cangame-qa' } }, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) { get(r.headers.location).then(res, rej); return; }
      if (r.statusCode !== 200) { r.resume(); rej(new Error('HTTP ' + r.statusCode)); return; }
      let d = '';
      r.setEncoding('utf8');
      r.on('data', c => { d += c; });
      r.on('end', () => res(d));
    }).on('error', rej);
  });
}

/* 从 createGame() 里抽 state 字面量的顶层字段（缩进 4 空格的 `key:`） */
function extractFields(src) {
  const at = src.indexOf('function createGame');
  if (at < 0) return null;
  const body = src.slice(at, at + 12000);
  const start = body.indexOf('const state = {');
  if (start < 0) return null;
  // state 字面量以缩进 2 空格的 `};` 结束
  const end = body.indexOf('\n  };', start);
  const lit = end > 0 ? body.slice(start, end) : body.slice(start, start + 6000);
  const fields = [];
  const re = /^ {4}([A-Za-z_$][\w$]*):/gm;
  let m;
  while ((m = re.exec(lit))) fields.push(m[1]);
  // market 由 marketInit(state) 在创建后挂上，不在字面量里
  if (/marketInit\(state\)/.test(body) && fields.indexOf('market') < 0) fields.push('market');
  return fields;
}

(async () => {
  const out = [];
  for (const v of VERSIONS) {
    const url = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${v.sha}/assets/engine.js`;
    try {
      const src = await get(url);
      const fields = extractFields(src);
      if (!fields) { console.log('  [SKIP] ' + v.tag + ' —— 没解析出 createGame'); continue; }
      out.push({ tag: v.tag, sha: v.sha, msg: v.msg, bytes: src.length, fields: fields });
      console.log('  [OK] ' + v.tag + '  ' + src.length + ' bytes · ' + fields.length + ' 个顶层字段');
    } catch (e) {
      console.log('  [FAIL] ' + v.tag + ' —— ' + e.message);
    }
  }
  fs.writeFileSync(path.join(OUT, 'version-shapes.json'), JSON.stringify(out, null, 2), 'utf8');

  /* 版本间差异（新增 / 移除的字段）—— 这正是 migrateState 需要兜底的部分 */
  console.log('\n===== 版本间字段差异 =====');
  for (let i = 1; i < out.length; i++) {
    const a = new Set(out[i - 1].fields), b = new Set(out[i].fields);
    const added = out[i].fields.filter(f => !a.has(f));
    const removed = out[i - 1].fields.filter(f => !b.has(f));
    console.log('\n' + out[i - 1].tag + '  →  ' + out[i].tag);
    console.log('  新增：' + (added.length ? added.join(', ') : '（无）'));
    console.log('  移除：' + (removed.length ? removed.join(', ') : '（无）'));
  }
  console.log('\n已写出 out/version-shapes.json');
})();
