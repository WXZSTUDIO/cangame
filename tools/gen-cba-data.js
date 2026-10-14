// cangame v3.5 · CBA 初始化脚本生成器（阶段3 交付物：SQL / JSON）
// 数据源唯一真源 = assets/cba-data.js，本脚本派生，避免多处手抄漂移。
// 用法: node tools/gen-cba-data.js        → 输出到 data/
//
// 说明：
//  · 队名：真实可核实的 CBA 历史队 / 次级(NBL/ABL)队，可直接入库。
//  · 球员：本作为止为**占位数据**（由 genPlayer 程序化生成），非真实名单。
//         2000-2025 逐季真实名单 AI 无法准确编造，一律标 todo_verify=1，须人工核对后启用。
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'data');

// 加载唯一真源（cba-data.js 依赖 teamById，仅取常量即可，补一个空实现防报错）
const ctx = { console, Math, Array, Object, String, Number };
vm.createContext(ctx);
vm.runInContext('function teamById(){return null;}', ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets', 'cba-data.js'), 'utf8'), ctx);
const { CBA_L1_TEAMS, CBA_L2_TEAMS } = ctx;

// 球员字段（对齐 genPlayer + 用户工单要求字段）
const PLAYER_FIELDS = [
  ['name', 'VARCHAR(64)', '球员名', '占位生成，TODO 人工核对'],
  ['team_id', 'VARCHAR(32)', '球队', '外键 → cba_team.id'],
  ['season', 'INT', '赛季', '起始 2000'],
  ['pos', "ENUM('PG','SG','SF','PF','C')", '位置', ''],
  ['height', 'SMALLINT', '身高(cm)', 'genPlayer 按位置区间'],
  ['weight', 'SMALLINT', '体重(kg)', 'height*(0.44~0.52)'],
  ['birthday', 'DATE', '生日', '按年龄反推'],
  ['age', 'TINYINT', '年龄', ''],
  ['overall', 'TINYINT', '综合', ''],
  ['potential', 'TINYINT', '潜力', 'overall + 0~16（≤22岁 +6）'],
  ['salary', 'INT', '工资', ''],
  ['iq', 'TINYINT', '意识', 'a.IQ'],
  ['is_rookie', 'TINYINT(1)', '新秀', 'ROOKIE_AGE 判定'],
  ['is_fa', 'TINYINT(1)', '自由球员', ''],
  ['todo_verify', 'TINYINT(1)', '待人工核对', '占位数据恒为 1']
];

function teams() {
  const out = [];
  CBA_L1_TEAMS.forEach((t, i) => out.push({ id: 'L1' + String(i + 1).padStart(2, '0'), league_id: 'L1', tier: 1, city: t.city, nick: t.nick, name: t.city + t.nick, todo_verify: 0 }));
  CBA_L2_TEAMS.forEach((t, i) => {
    const lg = i < 14 ? 'L2a' : 'L2b';
    const idx = (i % 14) + 1;
    out.push({ id: lg + String(idx).padStart(2, '0'), league_id: lg, tier: 2, city: t.city, nick: t.nick, name: t.city + t.nick, todo_verify: 0 });
  });
  return out;
}

function json() {
  return {
    meta: {
      source: 'assets/cba-data.js',
      generated_by: 'tools/gen-cba-data.js',
      generated_at: new Date().toISOString().slice(0, 10),
      note: '队名为真实可核实队名；球员为占位数据(todo_verify=true)，2000-2025 真实名单须人工核对。',
      season_start: 2000
    },
    teams: teams(),
    player_schema: PLAYER_FIELDS.reduce((o, f) => (o[f[0]] = { type: f[1], cn: f[2], note: f[3] }, o), {}),
    players: []
  };
}

function esc(s) { return String(s).replace(/'/g, "''"); }

function sql() {
  const L = [];
  L.push('-- cangame v3.5 · CBA 初始化脚本（由 tools/gen-cba-data.js 从 assets/cba-data.js 派生，勿手改）');
  L.push('-- 队名真实可核实；球员为占位数据(todo_verify=1)，须人工核对后启用。');
  L.push('');
  L.push('CREATE TABLE IF NOT EXISTS cba_team (');
  L.push('  id         VARCHAR(32) PRIMARY KEY,');
  L.push('  league_id  VARCHAR(8)  NOT NULL COMMENT \'L1 / L2a / L2b\',');
  L.push('  tier       TINYINT     NOT NULL COMMENT \'1=一级 2=二级\',');
  L.push('  city       VARCHAR(32) NOT NULL,');
  L.push('  nick       VARCHAR(32) NOT NULL,');
  L.push('  name       VARCHAR(64) NOT NULL,');
  L.push('  todo_verify TINYINT(1) NOT NULL DEFAULT 0');
  L.push(') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;');
  L.push('');
  L.push('CREATE TABLE IF NOT EXISTS cba_player (');
  L.push('  id          BIGINT AUTO_INCREMENT PRIMARY KEY,');
  PLAYER_FIELDS.forEach((f, i) => {
    const comma = i === PLAYER_FIELDS.length - 1 ? '' : ',';
    L.push('  ' + f[0].padEnd(13) + f[1].padEnd(28) + (f[3] ? 'COMMENT \'' + f[2] + '：' + f[3] + '\'' : 'COMMENT \'' + f[2] + '\'') + comma);
  });
  L.push(') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;');
  L.push('');
  L.push('-- 球队种子数据（42 队）');
  L.push('INSERT INTO cba_team (id, league_id, tier, city, nick, name, todo_verify) VALUES');
  L.push(teams().map(t => "  ('" + t.id + "','" + t.league_id + "'," + t.tier + ",'" + esc(t.city) + "','" + esc(t.nick) + "','" + esc(t.name) + "',0)").join(',\n') + ';');
  L.push('');
  L.push('-- 球员：本版不灌入真实名单（AI 无法准确编造 2000-2025 逐季名单）。');
  L.push('-- 真实名单补录后按 cba_player 字段插入，并把 todo_verify 置 0；');
  L.push('-- 未补录前由前端 genPlayer 程序化生成，落库时保持 todo_verify=1。');
  L.push('-- 导入后自检：SELECT league_id, COUNT(*) FROM cba_team GROUP BY league_id;  -- 期望 L1=14 / L2a=14 / L2b=14');
  return L.join('\n') + '\n';
}

fs.mkdirSync(OUT, { recursive: true });
const j = json();
fs.writeFileSync(path.join(OUT, 'cba-teams.json'), JSON.stringify(j, null, 2) + '\n', 'utf8');
fs.writeFileSync(path.join(OUT, 'cba-init.sql'), sql(), 'utf8');
console.log('已生成 data/cba-teams.json（' + j.teams.length + ' 队）');
console.log('已生成 data/cba-init.sql');
