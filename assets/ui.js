// cangame v3.1 · 界面（XBA 三栏架构：顶栏 + 左导航 + 主区 Tab + 右侧球员面板）
var G = null;
var curView = 'tactics';
var BOARD_POS = { PG: [150, 235], SG: [250, 120], SF: [250, 350], PF: [350, 160], C: [350, 310] };

function ui_teamNumbers(team) {
  const map = {};
  team.players.forEach(function (p, i) { map[p.id] = i + 1; });
  return map;
}

function boot() {
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', function () { bindNav(); renderPick(); }); return; }
  bindNav(); renderPick();
}

function renderPick() {
  const grid = document.getElementById('team-grid');
  const rng = makeRNG(CONFIG.SEED_DEFAULT);
  const teams = buildLeague(rng); // 仅用于展示队名/颜色
  grid.innerHTML = '';
  teams.forEach(function (t) {
    const b = document.createElement('button');
    b.className = 'team-btn';
    b.innerHTML = '<span><span class="dot" style="background:' + t.color + '"></span><b>' + t.name + '</b></span><small>' + t.conf + ' · ' + t.div + '</small>';
    b.onclick = function () { startGame(t.id); };
    grid.appendChild(b);
  });
  document.getElementById('screen-pick').classList.remove('hidden');
  document.getElementById('screen-game').classList.add('hidden');
}

function startGame(teamId) {
  G = engine_newGame(CONFIG.SEED_DEFAULT, teamId);
  curView = 'tactics';
  document.getElementById('screen-pick').classList.add('hidden');
  document.getElementById('screen-game').classList.remove('hidden');
  renderAll();
}

function renderAll() {
  renderTopbar(); renderNavTeam(); renderBoard(); renderReport();
  renderRounds(); renderStandings(); renderStats(); renderTraining();
  renderFinance(); renderRoster(); renderSideRoster(); renderChampion();
  switchView(curView);
}

/* ---------- 顶部状态条（XBA 逆向：赛季/轮次 · 球队 · 资金 · 等级 · 排名）---------- */
function renderTopbar() {
  const t = teamById(G, G.humanTeamId);
  const phaseTxt = G.phase === 'REGULAR' ? ('第 ' + (G.round + 1) + '/' + G.totalRounds + ' 轮')
    : G.phase === 'PLAYOFF' ? ('季后赛 · ' + (G.playoff ? G.playoff.names[G.playoff.round] : ''))
      : '赛季结束';
  const rows = seasonStandings(G);
  const myRank = rows.find(function (r) { return r.team.id === t.id; }).rank;
  const btnLabel = G.phase === 'CHAMPION' ? '新赛季' : '进行下一轮';
  document.getElementById('hdr').innerHTML =
    '<div class="tb-item tb-team">' + t.name + '</div>' +
    '<div class="tb-item"><small>赛程</small><b>' + phaseTxt + '</b></div>' +
    '<div class="tb-item"><small>战绩</small><b>' + t.wins + '胜' + t.losses + '负</b></div>' +
    '<div class="tb-item"><small>球队资金</small><b class="num">¥' + G.finance.cash.toLocaleString() + '</b></div>' +
    '<div class="tb-item"><small>球队等级</small><b>' + teamLevel(G.finance.cash) + '</b></div>' +
    '<div class="tb-item"><small>联赛排名</small><b>' + myRank + '/30</b></div>' +
    '<div class="tb-item"><small>训练点</small><b class="accent">' + G.trainPts + '</b></div>' +
    '<button class="btn btn-primary" id="btn-advance">' + btnLabel + '</button>';
  document.getElementById('btn-advance').onclick = onAdvance;
}

function renderNavTeam() {
  const t = teamById(G, G.humanTeamId);
  document.getElementById('nav-team').innerHTML = t.city + ' · ' + t.nick + '<br>' + t.conf + '联盟 ' + t.div;
}

function onAdvance() {
  if (G.phase === 'CHAMPION') { renderPick(); return; }
  engine_advanceRound(G);
  renderAll();
}

/* ---------- 左导航视图切换 ---------- */
function switchView(v) {
  curView = v;
  document.querySelectorAll('.nav-btn').forEach(function (b) {
    b.classList.toggle('active', b.dataset.view === v);
  });
  document.querySelectorAll('.main .view').forEach(function (el) { el.classList.add('hidden'); });
  const target = document.getElementById('view-' + v);
  if (target) target.classList.remove('hidden');
}

function bindNav() {
  document.querySelectorAll('.nav-btn').forEach(function (b) {
    b.onclick = function () { switchView(b.dataset.view); };
  });
}

/* ---------- 战术板 ---------- */
function courtSVG() {
  return '<rect class="court" x="20" y="20" width="460" height="430" rx="8"/>' +
    '<circle class="court" cx="452" cy="235" r="9"/>' +
    '<path class="court-dim" d="M302 85 A150 150 0 0 0 302 385"/>' +
    '<path class="court" d="M392 175 A60 60 0 0 0 392 295"/>' +
    '<line class="court-dim" x1="20" y1="235" x2="452" y2="235"/>';
}
function renderBoard() {
  const team = teamById(G, G.humanTeamId);
  const nums = ui_teamNumbers(team);
  let svg = '<svg class="board" viewBox="0 0 500 470" role="img" aria-label="战术板半场">' + courtSVG();
  team.lineup.slice(0, 5).forEach(function (id) {
    const p = team.players.find(function (x) { return x.id === id; });
    if (!p) return;
    const pos = p.pos;
    const posv = BOARD_POS[pos] || [200, 235];
    svg += '<g class="token home" data-id="' + p.id + '" data-pos="' + pos + '" transform="translate(' + posv[0] + ',' + posv[1] + ')">' +
      '<title>' + p.name + ' · ' + pos + '</title><circle r="15"></circle>' +
      '<text>' + nums[p.id] + '</text></g>';
  });
  svg += '</svg>';
  document.getElementById('board').innerHTML = svg;
  attachDrag();

  // 战术选择
  const tac = team.tactics;
  const opts = function (list, cur) {
    return list.map(function (v) { return '<option' + (v === cur ? ' selected' : '') + '>' + v + '</option>'; }).join('');
  };
  document.getElementById('tactic-controls').innerHTML =
    tc('节奏', 'pace', CONFIG.TACTICS.PACE, tac.pace, opts) +
    tc('进攻倾向', 'offense', CONFIG.TACTICS.OFFENSE, tac.offense, opts) +
    tc('防守策略', 'defense', CONFIG.TACTICS.DEFENSE, tac.defense, opts) +
    tc('轮换频率', 'rotation', CONFIG.TACTICS.ROTATION, tac.rotation, opts);
  document.querySelectorAll('#tactic-controls select').forEach(function (sel) {
    sel.onchange = function () {
      engine_setTactics(G, G.humanTeamId, { pace: q('pace'), offense: q('offense'), defense: q('defense'), rotation: q('rotation') });
    };
  });

  // 阵容（谁首发 = 真实机制）
  let lc = '';
  for (let i = 0; i < 5; i++) {
    const cur = team.lineup[i];
    const opts2 = team.players.map(function (p) {
      return '<option value="' + p.id + '"' + (p.id === cur ? ' selected' : '') + '>' + p.name + ' · ' + p.pos + ' · O' + p.overall + (p.injury > 0 ? ' (伤)' : '') + '</option>';
    }).join('');
    lc += '<div class="lc"><label>首发 ' + (i + 1) + '</label><select data-slot="' + i + '">' + opts2 + '</select></div>';
  }
  document.getElementById('lineup-controls').innerHTML = lc;
  document.querySelectorAll('#lineup-controls select').forEach(function (sel) {
    sel.onchange = function () {
      const slot = +sel.dataset.slot;
      team.lineup[slot] = sel.value;
      renderBoard(); renderSideRoster();
    };
  });
}
function tc(label, key, list, cur, optsFn) {
  return '<div class="tc"><label>' + label + '</label><select data-k="' + key + '">' + optsFn(list, cur) + '</select></div>';
}
function q(key) { const s = document.querySelector('#tactic-controls select[data-k="' + key + '"]'); return s ? s.value : null; }

function attachDrag() {
  const svg = document.querySelector('svg.board'); if (!svg) return;
  const tokens = svg.querySelectorAll('.token');
  tokens.forEach(function (g) {
    g.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const sx = 500 / rect.width, sy = 470 / rect.height;
      function move(ev) {
        let x = (ev.clientX - rect.left) * sx, y = (ev.clientY - rect.top) * sy;
        x = clamp(x, 60, 440); y = clamp(y, 60, 410);
        g.setAttribute('transform', 'translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ')');
      }
      function up(ev) {
        const rect2 = svg.getBoundingClientRect();
        let x = (ev.clientX - rect2.left) * (500 / rect2.width), y = (ev.clientY - rect2.top) * (470 / rect2.height);
        x = clamp(x, 60, 440); y = clamp(y, 60, 410);
        BOARD_POS[g.dataset.pos] = [Math.round(x), Math.round(y)];
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
      }
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
    });
  });
}

/* ---------- 战报 ---------- */
function renderReport() {
  const el = document.getElementById('report');
  if (!G.lastResult) { el.innerHTML = '<p class="sub">点击「进行下一轮」开始第一场比赛。</p>'; return; }
  const r = G.lastResult;
  const ht = teamById(G, r.homeId), at = teamById(G, r.awayId);
  const humanIsHome = r.homeId === G.humanTeamId;
  const won = (humanIsHome && r.hScore > r.aScore) || (!humanIsHome && r.aScore > r.hScore);
  const tag = won ? '<span class="tag win">胜</span>' : '<span class="tag lose">负</span>';
  const box = humanIsHome ? r.hBox : r.aBox;
  const players = Object.values(box.players).sort(function (a, b) { return b.pts - a.pts; }).slice(0, 3);
  const top = players.map(function (p) { return p.name + ' ' + p.pts + '分'; }).join(' · ');
  const pbp = (r.log || []).slice(-60).map(function (l) { return '<div>' + l + '</div>'; }).join('');
  el.innerHTML = '<div class="score-big">' + ht.name + ' <span class="num">' + r.hScore + '</span> : <span class="num">' + r.aScore + '</span> ' + at.name + ' ' + tag + '</div>' +
    '<div class="sub" style="margin-top:6px">本场最佳：' + top + '</div>' +
    '<div class="pbp">' + pbp + '</div>';
}

/* ---------- 上轮·本轮（XBA「上轮本轮」Tab）---------- */
function renderRounds() {
  const prev = document.getElementById('round-prev'), next = document.getElementById('round-next');
  if (!G.lastResults || !G.lastResults.length) {
    prev.innerHTML = '<p class="sub">赛季尚未开始。</p>';
  } else {
    let html = '<table><thead><tr><th>主队</th><th>比分</th><th>客队</th><th>胜者</th></tr></thead><tbody>';
    G.lastResults.forEach(function (r) {
      const ht = teamById(G, r.homeId), at = teamById(G, r.awayId);
      const you = r.homeId === G.humanTeamId || r.awayId === G.humanTeamId;
      html += '<tr' + (you ? ' class="you"' : '') + '><td>' + ht.name + '</td><td class="num">' + r.hScore + ':' + r.aScore + '</td><td>' + at.name + '</td><td>' + teamById(G, r.winner).name + '</td></tr>';
    });
    prev.innerHTML = html + '</tbody></table>';
  }
  if (G.phase === 'REGULAR' && G.schedule[G.round]) {
    let html = '<table><thead><tr><th>主队</th><th>客队</th></tr></thead><tbody>';
    G.schedule[G.round].forEach(function (g) {
      const you = g[0] === G.humanTeamId || g[1] === G.humanTeamId;
      html += '<tr' + (you ? ' class="you"' : '') + '><td>' + teamById(G, g[0]).name + '</td><td>' + teamById(G, g[1]).name + '</td></tr>';
    });
    next.innerHTML = html + '</tbody></table>';
  } else {
    next.innerHTML = '<p class="sub">季后赛阶段，对阵见冠军/战报页。</p>';
  }
}

/* ---------- 积分榜（XBA 列：排名/球队/胜/负/积分/得失分）---------- */
function renderStandings() {
  const rows = seasonStandings(G);
  let html = '<table><thead><tr><th>#</th><th>球队</th><th>胜</th><th>负</th><th>积分</th><th>得失分</th></tr></thead><tbody>';
  rows.forEach(function (row) {
    const t = row.team;
    const you = t.id === G.humanTeamId ? ' class="you"' : '';
    const pts = t.wins * 2 + t.losses; // 胜 2 分负 1 分（FIBA/CBA 惯例）
    const diff = t.pf - t.pa;
    html += '<tr' + you + '><td>' + row.rank + '</td><td>' + t.name + '</td><td class="num">' + t.wins + '</td><td class="num">' + t.losses + '</td><td class="num">' + pts + '</td><td class="num">' + (diff > 0 ? '+' : '') + diff + '</td></tr>';
  });
  html += '</tbody></table>';
  document.getElementById('standings').innerHTML = html;
}

/* ---------- 技术统计（我队上一场 box score）---------- */
function renderStats() {
  const el = document.getElementById('stats');
  const r = G.lastResult;
  if (!r) { el.innerHTML = '<p class="sub">打完第一场后展示。</p>'; return; }
  const humanIsHome = r.homeId === G.humanTeamId;
  const box = humanIsHome ? r.hBox : r.aBox;
  const opp = humanIsHome ? r.aBox : r.hBox;
  const rows = Object.values(box.players).sort(function (a, b) { return b.pts - a.pts; });
  let html = '<table><thead><tr><th>球员</th><th>位</th><th>得分</th><th>篮板</th><th>助攻</th><th>抢断</th><th>失误</th><th>投篮</th></tr></thead><tbody>';
  rows.forEach(function (p) {
    html += '<tr><td>' + p.name + '</td><td>' + p.pos + '</td><td class="num">' + p.pts + '</td><td class="num">' + p.reb + '</td><td class="num">' + p.ast + '</td><td class="num">' + p.stl + '</td><td class="num">' + p.to + '</td><td class="num">' + p.fgm + '/' + p.fga + '</td></tr>';
  });
  html += '</tbody></table>';
  html += '<p class="stat-note">对手合计 ' + Object.values(opp.players).reduce(function (s, p) { return s + p.pts; }, 0) + ' 分 · 球队篮板 ' + box.teamReb + ' · 抢断 ' + box.teamStl + '</p>';
  el.innerHTML = html;
}

/* ---------- 球员训练 + 理疗（XBA 逆向：训练点制）---------- */
function renderTraining() {
  const T = CONFIG.TRAINING;
  document.getElementById('train-info').innerHTML =
    '训练点 <b class="num accent">' + G.trainPts + '</b>（每轮比赛：胜 +' + T.POINTS_PER_WIN + ' / 负 +' + T.POINTS_PER_LOSS +
    '）· 每次训练消耗 ' + T.COST_POINTS + ' 点、体力 ' + T.COST_STAMINA + '、心情 ' + T.COST_MOOD +
    ' · 理疗 ¥' + T.PHYSIO_CASH + '（体力 +' + T.PHYSIO_STAMINA + ' 心情 +' + T.PHYSIO_MOOD + '）';
  const t = teamById(G, G.humanTeamId);
  const attrNames = { SHO: '投篮', TRE: '三分', DRV: '运球', PAS: '传球', REB: '篮板', DEF: '防守', SPD: '速度', STA: '体能', IQ: '球商', CLU: '关键' };
  let html = '<table><thead><tr><th>球员</th><th>位</th><th>综合</th><th>体力</th><th>心情</th><th>训练项目</th><th></th><th></th></tr></thead><tbody>';
  t.players.slice().sort(function (a, b) { return b.overall - a.overall; }).forEach(function (p) {
    const trainDisabled = G.trainPts < T.COST_POINTS || p.injury > 0 || p.stamina < T.COST_STAMINA + 10;
    const physioDisabled = G.finance.cash < T.PHYSIO_CASH;
    html += '<tr><td>' + p.name + (p.injury > 0 ? ' <span class="tag warn">伤' + p.injury + '</span>' : '') + '</td><td>' + p.pos + '</td>' +
      '<td class="num">' + p.overall + '</td><td class="num">' + Math.round(p.stamina) + '</td>' +
      '<td class="num">' + Math.round(p.mood || 70) + '</td>' +
      '<td><select data-pid="' + p.id + '" class="train-attr">' +
      T.ATTRS.map(function (k) { return '<option value="' + k + '">' + (attrNames[k] || k) + ' ' + p.a[k] + '</option>'; }).join('') +
      '</select></td>' +
      '<td><button class="mini-btn" data-train="' + p.id + '"' + (trainDisabled ? ' disabled' : '') + '>训练</button></td>' +
      '<td><button class="mini-btn" data-physio="' + p.id + '"' + (physioDisabled ? ' disabled' : '') + '>理疗</button></td></tr>';
  });
  html += '</tbody></table>';
  document.getElementById('training').innerHTML = html;
  document.querySelectorAll('[data-train]').forEach(function (b) {
    b.onclick = function () {
      const pid = b.dataset.train;
      const sel = document.querySelector('.train-attr[data-pid="' + pid + '"]');
      const res = training_apply(G, pid, sel.value);
      if (!res.ok) { b.textContent = { 'no-points': '点不足', 'injured': '伤病中', 'too-tired': '太疲惫', 'capped': '已满' }[res.reason] || '失败'; setTimeout(renderTraining, 900); return; }
      renderAll();
    };
  });
  document.querySelectorAll('[data-physio]').forEach(function (b) {
    b.onclick = function () {
      const res = training_physio(G, b.dataset.physio);
      if (res.ok) renderAll();
    };
  });
}

/* ---------- 财务（XBA 三大收入拆分）---------- */
function renderFinance() {
  const t = teamById(G, G.humanTeamId);
  const sal = t.players.reduce(function (s, p) { return s + p.salary; }, 0);
  const over = sal > G.finance.salaryCap;
  const rev = G.finance.revenue || { ad: 0, gate: 0, jersey: 0 };
  const rows = [
    ['球队资金', '¥' + G.finance.cash.toLocaleString(), G.finance.cash < CONFIG.FINANCE.BANKRUPT ? 'warn' : ''],
    ['— 广告收入', '+' + rev.ad + ' 万', ''],
    ['— 主场门票', '+' + rev.gate + ' 万', ''],
    ['— 球衣销售', '+' + rev.jersey + ' 万', ''],
    ['累计支出', '-' + G.finance.expense + ' 万', ''],
    ['工资总额', sal + ' 万', over ? 'warn' : ''],
    ['工资帽', G.finance.salaryCap + ' 万', ''],
    ['球队等级', teamLevel(G.finance.cash), '']
  ];
  let html = rows.map(function (r) {
    return '<div class="fin-row"><span>' + r[0] + '</span><span class="num ' + r[2] + '">' + r[1] + '</span></div>';
  }).join('');
  if (over) html += '<p class="warn" style="font-size:var(--fs-xs);margin:8px 0 0">⚠ 工资超帽，注意财务健康。</p>';
  document.getElementById('finance').innerHTML = html;
}

/* ---------- 名册 ---------- */
function renderRoster() {
  const t = teamById(G, G.humanTeamId);
  let html = '<table><thead><tr><th>球员</th><th>位</th><th>年龄</th><th>综合</th><th>年薪</th><th>状态</th></tr></thead><tbody>';
  t.players.slice().sort(function (a, b) { return b.overall - a.overall; }).forEach(function (p) {
    const status = p.injury > 0 ? '<span class="tag warn">伤' + p.injury + '轮</span>'
      : (p.stamina < 40 ? '<span class="tag lose">疲</span>' : '<span class="tag win">就绪</span>');
    html += '<tr><td>' + p.name + ' <small class="sub">' + p.trait + '</small></td><td>' + p.pos + '</td><td class="num">' + p.age + '</td>' +
      '<td class="num">' + p.overall + '<div class="bar"><i style="width:' + p.overall + '%"></i></div></td>' +
      '<td class="num">' + p.salary + '</td><td>' + status + '</td></tr>';
  });
  html += '</tbody></table>';
  document.getElementById('roster').innerHTML = html;
}

/* ---------- 右侧球员面板（常驻：名/位/评分）---------- */
function renderSideRoster() {
  const t = teamById(G, G.humanTeamId);
  let html = '';
  t.players.slice().sort(function (a, b) { return b.overall - a.overall; }).forEach(function (p) {
    const inj = p.injury > 0 ? ' <span class="tag warn">伤</span>' : '';
    html += '<div class="side-roster-row"><span class="pos">' + p.pos + '</span><span style="flex:1">' + p.name + inj + '</span><span class="ovr">' + p.overall + '</span></div>';
  });
  document.getElementById('side-roster').innerHTML = html;
}

/* ---------- 冠军 ---------- */
function renderChampion() {
  const el = document.getElementById('champion');
  if (G.phase !== 'CHAMPION') { el.classList.add('hidden'); return; }
  const champ = teamById(G, G.playoff.champion);
  const you = champ.id === G.humanTeamId;
  el.classList.remove('hidden');
  el.innerHTML = '<h2>' + (you ? '🏆 你夺得了总冠军！' : '🏆 ' + champ.name + ' 夺得总冠军') + '</h2>' +
    '<p class="sub">' + champ.name + ' 本赛季战绩 ' + champ.wins + ' 胜 ' + champ.losses + ' 负。点击「新赛季」可重开一局。</p>';
}

boot();
