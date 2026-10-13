// cangame v3.2 · 界面（XBA 布局：顶栏 + 左导航树 + 主区 Tab + 右侧首发替补面板）
var G = null;
var curView = 'tactics';
var curSideTab = 'starters';
var BOARD_POS = { PG: [150, 235], SG: [250, 120], SF: [250, 350], PF: [350, 160], C: [350, 310] };
var ATTR_CN = { SHO: '投篮', TRE: '三分', DRV: '运球', PAS: '传球', REB: '篮板', DEF: '防守', SPD: '速度', STA: '体能', IQ: '球商', CLU: '关键' };

function ui_teamNumbers(team) {
  const map = {};
  team.players.forEach(function (p, i) { map[p.id] = i + 1; });
  return map;
}
function ui_leagueName(team) {
  return team.level === 1 ? '1级联赛' : (team.leagueId === 'L2a' ? '2级联赛A组' : '2级联赛B组');
}
function starHTML(p) {
  return p.star ? ' <span class="star" title="球星 ' + p.star + ' 星">★' + p.star + '</span>' : '';
}

function boot() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { bindNav(); bindTabs(); bindSideTabs(); renderPick(); });
    return;
  }
  bindNav(); bindTabs(); bindSideTabs(); renderPick();
}

function renderPick() {
  const grid = document.getElementById('team-grid');
  const rng = makeRNG(CONFIG.SEED_DEFAULT);
  const teams = buildLeague(rng);
  grid.innerHTML = '';
  teams.forEach(function (t) {
    const b = document.createElement('button');
    b.className = 'team-btn';
    b.innerHTML = '<span><span class="dot" style="background:' + t.color + '"></span><b>' + t.name + '</b></span><small>' +
      (t.level === 1 ? '1级联赛' : '2级联赛') + '</small>';
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
  renderRounds(); renderStandings(); renderStats(); renderLogs();
  renderCups(); renderChampionship(); renderKings(); renderTraining();
  renderFinance(); renderHonors(); renderRoster(); renderSideRoster(); renderSeasonEnd();
  renderTransfer(); renderManager(); renderRecord(); renderHistory(); renderAlliance(); renderSupreme(); renderBet();
  switchView(curView);
}

/* ---------- 顶部状态条（球队 · 赛程 · 战绩 · 资金 · 等级 · 排名 · 训练点 · 王者积分 + 系统广播）---------- */
function renderTopbar() {
  const t = teamById(G, G.humanTeamId);
  const phaseTxt = G.phase === 'REGULAR' ? ('第' + G.season + '赛季 第 ' + (G.round + 1) + '/' + G.totalRounds + ' 轮')
    : G.phase === 'SEASON_END' ? '第' + (G.season - 1) + '赛季已结束' : '';
  const stand = seasonStandings(G, t.leagueId);
  const myRank = stand.findIndex(function (r) { return r.team.id === t.id; }) + 1;
  const btnLabel = G.phase === 'SEASON_END' ? '开始新赛季' : '进行下一轮';
  const broadcast = G.log.length ? G.log[G.log.length - 1] : '';
  document.getElementById('hdr').innerHTML =
    '<div class="tb-item tb-team">' + t.name + '</div>' +
    '<div class="tb-item"><small>赛程</small><b>' + phaseTxt + '</b></div>' +
    '<div class="tb-item"><small>战绩</small><b>' + t.wins + '胜' + t.losses + '负</b></div>' +
    '<div class="tb-item"><small>球队资金</small><b class="num">¥' + G.finance.cash.toLocaleString() + '</b></div>' +
    '<div class="tb-item"><small>球队等级</small><b>' + teamLevel(G.finance.cash) + '</b></div>' +
    '<div class="tb-item"><small>联赛排名</small><b>' + (myRank > 0 ? myRank + '/14' : '-') + '</b></div>' +
    '<div class="tb-item"><small>训练点</small><b class="accent">' + G.trainPts + '</b></div>' +
    '<div class="tb-item"><small>王者积分</small><b class="star">' + G.kingsPts + '</b></div>' +
    '<div class="tb-item"><small>威望</small><b class="star">' + (G.prestige || 0) + '</b></div>' +
    '<div class="tb-item"><small>球迷</small><b>' + (G.fans || 0).toLocaleString() + '</b></div>' +
    '<button class="btn btn-primary" id="btn-advance">' + btnLabel + '</button>' +
    '<div class="broadcast">📣 ' + broadcast + '</div>';
  document.getElementById('btn-advance').onclick = onAdvance;
}

function renderNavTeam() {
  const t = teamById(G, G.humanTeamId);
  document.getElementById('nav-team').innerHTML = t.city + ' · ' + t.nick + '<br>' + ui_leagueName(t);
}

function onAdvance() {
  engine_advanceRound(G);
  renderAll();
}

/* ---------- 视图切换（左导航 + 主区 Tab 共用）---------- */
function switchView(v) {
  curView = v;
  document.querySelectorAll('.nav-btn, .tab-btn').forEach(function (b) {
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
function bindTabs() {
  document.querySelectorAll('.tab-btn').forEach(function (b) {
    b.onclick = function () { switchView(b.dataset.view); };
  });
}
function bindSideTabs() {
  document.querySelectorAll('.side-tab').forEach(function (b) {
    b.onclick = function () {
      curSideTab = b.dataset.st;
      document.querySelectorAll('.side-tab').forEach(function (x) { x.classList.toggle('active', x === b); });
      renderSideRoster();
    };
  });
}

/* ---------- 战术板（6攻 × 6防）---------- */
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
    const posv = BOARD_POS[p.pos] || [200, 235];
    svg += '<g class="token home" data-id="' + p.id + '" data-pos="' + p.pos + '" transform="translate(' + posv[0] + ',' + posv[1] + ')">' +
      '<title>' + p.name + ' · ' + p.pos + '</title><circle r="15"></circle>' +
      '<text>' + nums[p.id] + '</text></g>';
  });
  svg += '</svg>';
  document.getElementById('board').innerHTML = svg;
  attachDrag();

  const tac = team.tactics;
  const opts = function (list, cur) {
    return list.map(function (v) { return '<option' + (v === cur ? ' selected' : '') + '>' + v + '</option>'; }).join('');
  };
  document.getElementById('tactic-controls').innerHTML =
    tc('进攻战术', 'offense', CONFIG.TACTICS.OFFENSE, tac.offense, opts) +
    tc('防守战术', 'defense', CONFIG.TACTICS.DEFENSE, tac.defense, opts) +
    tc('轮换频率', 'rotation', CONFIG.TACTICS.ROTATION, tac.rotation, opts);
  document.querySelectorAll('#tactic-controls select').forEach(function (sel) {
    sel.onchange = function () {
      engine_setTactics(G, G.humanTeamId, { offense: q('offense'), defense: q('defense'), rotation: q('rotation') });
    };
  });

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
      team.lineup[+sel.dataset.slot] = sel.value;
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
  svg.querySelectorAll('.token').forEach(function (g) {
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
  const cup = G.lastCupResult, kg = G.lastKingsResult;
  const lg = G.lastResult;
  // 优先显示最近进行的一场（杯赛/王者/联赛以最后状态覆盖）
  if (!lg && !cup && !kg) { el.innerHTML = '<p class="sub">点击「进行下一轮」开始第一场比赛。</p>'; return; }
  function block(title, res, tag) {
    const ht = teamById(G, res.homeId), at = teamById(G, res.awayId);
    const humanIsHome = res.homeId === G.humanTeamId;
    const won = (humanIsHome && res.hScore > res.aScore) || (!humanIsHome && res.aScore > res.hScore);
    const players = Object.values(humanIsHome ? res.hBox : res.aBox.players).sort(function (a, b) { return b.pts - a.pts; }).slice(0, 3);
    const top = players.map(function (p) { return p.name + ' ' + p.pts + '分'; }).join(' · ');
    const pbp = (res.log || []).slice(-40).map(function (l) { return '<div>' + l + '</div>'; }).join('');
    return '<h3 class="sub">' + title + '</h3><div class="score-big">' + ht.name + ' <span class="num">' + res.hScore +
      '</span> : <span class="num">' + res.aScore + '</span> ' + at.name + ' <span class="tag ' + (won ? 'win' : 'lose') + '">' + tag + '</span></div>' +
      '<div class="sub" style="margin-top:6px">本场最佳：' + top + '</div><div class="pbp">' + pbp + '</div>';
  }
  let html = '';
  if (kg && kg.res) html += block('胜者为王 · 第 ' + kg.streak + ' 场（对手 ' + kg.opp + '）', kg.res, kg.won ? '胜' : '负');
  if (cup && cup.res) html += block(cup.cup + ' · ' + (cup.roundIdx >= cup.totalRounds - 1 ? '决赛' : '第' + (cup.roundIdx + 1) + '轮'), cup.res, cup.won ? '胜' : '负');
  if (lg) html += block('联赛', lg, (lg.winner === G.humanTeamId) ? '胜' : '负');
  el.innerHTML = html;
}

/* ---------- 上轮·本轮（本联赛）---------- */
function myLeague(state) {
  const t = teamById(state, state.humanTeamId);
  return t.leagueId;
}
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
  const myLg = myLeague(G);
  if (G.phase === 'REGULAR' && G.schedule[myLg] && G.schedule[myLg][G.round]) {
    let html = '<table><thead><tr><th>主队</th><th>客队</th></tr></thead><tbody>';
    G.schedule[myLg][G.round].forEach(function (g) {
      const you = g[0] === G.humanTeamId || g[1] === G.humanTeamId;
      html += '<tr' + (you ? ' class="you"' : '') + '><td>' + teamById(G, g[0]).name + '</td><td>' + teamById(G, g[1]).name + '</td></tr>';
    });
    next.innerHTML = html + '</tbody></table>';
  } else {
    next.innerHTML = '<p class="sub">赛季已结束。</p>';
  }
}

/* ---------- 积分榜（本联赛 14 队 · 胜率/净胜分 · 升降级区着色）---------- */
function renderStandings() {
  const myLg = myLeague(G);
  const lg = G.leagues[myLg];
  document.getElementById('standings-title').textContent = lg.name + ' · 积分榜（前' + (lg.level === 1 ? '—' : '2升级') + (lg.level === 1 ? '后4降级' : '') + '）';
  const rows = seasonStandings(G, myLg);
  let html = '<table><thead><tr><th>排名</th><th>球队</th><th>胜</th><th>负</th><th>积分</th><th>净胜分</th></tr></thead><tbody>';
  rows.forEach(function (row, i) {
    const t = row.team;
    const you = t.id === G.humanTeamId ? ' class="you"' : '';
    let zone = '';
    if (lg.level === 2 && i < CONFIG.LEAGUE.PROMOTE_PER_LEAGUE) zone = ' <span class="tag win">升</span>';
    if (lg.level === 1 && i >= 14 - CONFIG.LEAGUE.RELEGATE_PER_LEAGUE) zone = ' <span class="tag lose">降</span>';
    const pts = t.wins * 2 + t.losses;
    const diff = t.pf - t.pa;
    html += '<tr' + you + '><td>' + (i + 1) + zone + '</td><td>' + t.name + '</td><td class="num">' + t.wins + '</td><td class="num">' + t.losses + '</td><td class="num">' + pts + '</td><td class="num">' + (diff > 0 ? '+' : '') + diff + '</td></tr>';
  });
  html += '</tbody></table>';
  document.getElementById('standings').innerHTML = html;
}

/* ---------- 技术统计（本赛季累积：MVP综合/得分/篮板/助攻/抢断/封盖）---------- */
function renderStats() {
  const el = document.getElementById('stats');
  const t = teamById(G, G.humanTeamId);
  const keys = Object.keys(G.seasonStats || {});
  if (!keys.length) { el.innerHTML = '<p class="sub">打完首轮后展示本赛季累积技术统计。</p>'; return; }
  const rows = keys.map(function (pid) {
    const p = t.players.find(function (x) { return x.id === pid; });
    const s = G.seasonStats[pid];
    const g = Math.max(1, s.gp);
    const mvp = Math.round((s.pts + s.reb * 1.2 + s.ast * 1.5 + s.stl * 2 + s.blk * 2) / g * 10) / 10;
    return { name: p ? p.name : pid, pos: p ? p.pos : '-', overall: p ? p.overall : 0, mvp: mvp, pts: s.pts, reb: s.reb, ast: s.ast, stl: s.stl, blk: s.blk, gp: s.gp };
  }).sort(function (a, b) { return b.mvp - a.mvp; });
  let html = '<p class="sub">本赛季我队球员累积技术统计（按 MVP 综合排序）</p>';
  html += '<table><thead><tr><th>MVP</th><th>球员</th><th>位</th><th>综合</th><th>得分</th><th>篮板</th><th>助攻</th><th>抢断</th><th>封盖</th><th>场</th></tr></thead><tbody>';
  rows.forEach(function (r) {
    html += '<tr><td class="num">' + r.mvp + '</td><td>' + r.name + '</td><td>' + r.pos + '</td><td class="num">' + r.overall + '</td>' +
      '<td class="num">' + r.pts + '</td><td class="num">' + r.reb + '</td><td class="num">' + r.ast + '</td><td class="num">' + r.stl + '</td><td class="num">' + r.blk + '</td><td class="num">' + r.gp + '</td></tr>';
  });
  html += '</tbody></table>';
  el.innerHTML = html;
}

/* ---------- 联赛日志 ---------- */
function renderLogs() {
  const el = document.getElementById('logs');
  const items = G.log.slice(-60).reverse();
  el.innerHTML = items.length
    ? items.map(function (l) { return '<div class="log-line">' + l + '</div>'; }).join('')
    : '<p class="sub">暂无日志。</p>';
}

/* ---------- 街球杯赛 ---------- */
function renderCups() {
  const el = document.getElementById('cups');
  let html = '';
  CONFIG.CUP.TYPES.forEach(function (def) {
    const cup = G.cups[def.id];
    const status = cup.done ? '已结束' : (cup.roundIdx > 0 ? '进行中' : (G.round + 1 <= cup.rounds[0] ? '报名中' : '未报名'));
    html += '<div class="cup-card"><div class="cup-head"><b>' + cup.name + '</b>' +
      '<span class="sub">' + cup.desc + '</span><span class="tag ' + (cup.done ? '' : 'win') + '">' + status + '</span></div>';
    html += '<div class="sub">开赛轮：第 ' + cup.rounds.join(' / ') + ' 轮 · 冠军奖 ¥' + cup.prize[0] + ' + ' + cup.kings + ' 王者积分</div>';
    if (!cup.registered && cup.roundIdx === 0 && !cup.done && !(cup.only === 'first-season' && G.season > 1)) {
      html += '<button class="mini-btn" data-cup-reg="' + cup.id + '">报名参赛</button>';
    }
    if (cup.myResult) {
      if (cup.myResult.champion) html += '<div class="star">🏆 你夺得了本届' + cup.name + '冠军！</div>';
      else html += '<div class="sub">你的战绩：' + (cup.myResult.won ? '胜' : '止步') + '（详见「联赛比赛」页）</div>';
    }
    // 对阵表（已抽签的轮次）
    if (cup.bracket) {
      const names = ['淘汰赛', '1/4决赛', '半决赛', '决赛'];
      cup.bracket.forEach(function (pairs, ri) {
        if (!pairs) return;
        html += '<div class="bracket-r"><b>' + (names[names.length - pairs.length] || ('第' + (ri + 1) + '轮')) + '</b>' +
          pairs.map(function (pair) {
            const a = teamById(G, pair[0]), b = teamById(G, pair[1]);
            return '<span>' + (a ? a.name : '?') + ' vs ' + (b ? b.name : '?') + '</span>';
          }).join('　') + '</div>';
      });
    }
    html += '</div>';
  });
  el.innerHTML = html;
  document.querySelectorAll('[data-cup-reg]').forEach(function (b) {
    b.onclick = function () {
      const res = cup_register(G, b.dataset.cupReg);
      if (res.ok) renderAll();
      else b.textContent = { 'not-rookie': '仅第一赛季', 'already': '已报名', 'closed': '已截止' }[res.reason] || '不可报名';
    };
  });
}

/* ---------- 胜者为王 ---------- */
function renderKings() {
  const el = document.getElementById('kings');
  const K = CONFIG.KINGS;
  const run = G.kings;
  let html = '<p class="sub">连续淘汰赛：最多 ' + K.MAX_STREAK + ' 场，输一场积分清零。连胜 3 / 6 / 9 场后可主动领取全额王者积分；中途退出只保留 ' + (K.EXIT_KEEP_PCT * 100) + '%。每场消耗体力 ' + K.STAMINA_COST + '。当前王者积分：<b class="star">' + G.kingsPts + '</b></p>';
  if (run && run.active) {
    html += '<div class="cup-head"><b>进行中：' + run.streak + ' 连胜</b><span class="sub">已积累 ' + run.pts + ' 积分 / ¥' + run.cash + '</span></div>';
    const canClaim = K.CLAIM_AT.indexOf(run.streak) >= 0;
    html += '<button class="mini-btn" id="kings-next">下一场（对手自动匹配）</button> ' +
      '<button class="mini-btn" id="kings-claim"' + (canClaim ? '' : ' title="非里程碑退出只保留 60%"') + '>' + (canClaim ? '领取（里程碑）' : '退出并领取 60%') + '</button>';
  } else {
    html += '<button class="mini-btn" id="kings-start">报名开战</button>';
  }
  if (G.lastKingsResult && G.lastKingsResult.res) {
    const kr = G.lastKingsResult;
    html += '<p class="stat-note">上一场：' + (kr.won ? '✔ 战胜 ' : '✘ 不敌 ') + kr.opp + '（' + kr.res.hScore + ':' + kr.res.aScore + '）</p>';
  }
  el.innerHTML = html;
  const bs = document.getElementById('kings-start');
  if (bs) bs.onclick = function () { kings_start(G); renderAll(); };
  const bn = document.getElementById('kings-next');
  if (bn) bn.onclick = function () { kings_next(G); renderAll(); switchView('kings'); };
  const bc = document.getElementById('kings-claim');
  if (bc) bc.onclick = function () { kings_claim(G); renderAll(); switchView('kings'); };
}

/* ---------- 球员训练 + 理疗 + 球星训练营 ---------- */
function renderTraining() {
  const T = CONFIG.TRAINING, S = CONFIG.STAR;
  document.getElementById('train-info').innerHTML =
    '训练点 <b class="num accent">' + G.trainPts + '</b>（胜 +' + T.POINTS_PER_WIN + ' / 负 +' + T.POINTS_PER_LOSS + '）· 训练消耗 ' + T.COST_POINTS + ' 点 / 体力' + T.COST_STAMINA + ' / 心情' + T.COST_MOOD +
    ' · 理疗 ¥' + T.PHYSIO_CASH + '（体力+' + T.PHYSIO_STAMINA + ' 心情+' + T.PHYSIO_MOOD + '）' +
    '<br>⭐ 球星训练营：消耗王者积分 + 资金，每升一级属性最高 +' + (S.GAIN_PCT_MAX * 100) + '%（可降级重训）。当前王者积分 <b class="star">' + G.kingsPts + '</b>';
  const t = teamById(G, G.humanTeamId);
  let html = '<table><thead><tr><th>球员</th><th>位</th><th>综合</th><th>体力</th><th>心情</th><th>训练项目</th><th>训练</th><th>理疗</th><th>球星训练</th></tr></thead><tbody>';
  t.players.slice().sort(function (a, b) { return b.overall - a.overall; }).forEach(function (p) {
    const trainDisabled = G.trainPts < T.COST_POINTS || p.injury > 0 || p.stamina < T.COST_STAMINA + 10;
    const physioDisabled = G.finance.cash < T.PHYSIO_CASH;
    const cost = star_cost((p.star || 0) + 1);
    const starDisabled = (p.star || 0) >= S.MAX_LEVEL || G.kingsPts < cost.kings || G.finance.cash < cost.cash;
    const starLabel = (p.star || 0) >= S.MAX_LEVEL ? '满星' : '升星(' + cost.kings + '积分/¥' + cost.cash + ')';
    html += '<tr><td>' + p.name + starHTML(p) + (p.injury > 0 ? ' <span class="tag warn">伤' + p.injury + '</span>' : '') + '</td><td>' + p.pos + '</td>' +
      '<td class="num">' + p.overall + '</td><td class="num">' + Math.round(p.stamina) + '</td>' +
      '<td class="num">' + Math.round(p.mood || 70) + '</td>' +
      '<td><select data-pid="' + p.id + '" class="train-attr">' +
      T.ATTRS.map(function (k) { return '<option value="' + k + '">' + (ATTR_CN[k] || k) + ' ' + p.a[k] + '</option>'; }).join('') +
      '</select></td>' +
      '<td><button class="mini-btn" data-train="' + p.id + '"' + (trainDisabled ? ' disabled' : '') + '>训练</button></td>' +
      '<td><button class="mini-btn" data-physio="' + p.id + '"' + (physioDisabled ? ' disabled' : '') + '>理疗</button></td>' +
      '<td><button class="mini-btn" data-star="' + p.id + '"' + (starDisabled ? ' disabled' : '') + '>' + starLabel + '</button>' +
      ((p.star || 0) > 0 ? ' <button class="mini-btn" data-star-down="' + p.id + '">降级</button>' : '') +
      '</td></tr>';
  });
  html += '</tbody></table>';
  document.getElementById('training').innerHTML = html;
  document.querySelectorAll('[data-train]').forEach(function (b) {
    b.onclick = function () {
      const pid = b.dataset.train;
      const sel = document.querySelector('.train-attr[data-pid="' + pid + '"]');
      const res = training_apply(G, pid, sel.value);
      if (!res.ok) { b.textContent = { 'no-points': '点不足', 'injured': '伤病中', 'too-tired': '太疲惫', 'capped': '已满' }[res.reason] || '失败'; setTimeout(renderTraining, 900); return; }
      renderAll(); switchView('training');
    };
  });
  document.querySelectorAll('[data-physio]').forEach(function (b) {
    b.onclick = function () {
      const res = training_physio(G, b.dataset.physio);
      if (res.ok) { renderAll(); switchView('training'); }
    };
  });
  document.querySelectorAll('[data-star]').forEach(function (b) {
    b.onclick = function () {
      const res = training_star(G, b.dataset.star);
      if (res.ok) { renderAll(); switchView('training'); }
      else { b.textContent = { 'no-kings': '积分不足', 'no-cash': '资金不足', 'max': '满星' }[res.reason] || '失败'; }
    };
  });
  document.querySelectorAll('[data-star-down]').forEach(function (b) {
    b.onclick = function () {
      const res = training_starDowngrade(G, b.dataset.starDown);
      if (res.ok) { renderAll(); switchView('training'); }
    };
  });
}

/* ---------- 财务 · 经营（细化：票价/上座率/广告位/球衣）---------- */
function renderFinance() {
  const t = teamById(G, G.humanTeamId);
  const sal = t.players.reduce(function (s, p) { return s + p.salary; }, 0);
  const over = sal > G.finance.salaryCap;
  const rev = G.finance.revenue || { ad: 0, gate: 0, jersey: 0 };
  const adSlots = Math.floor((G.fans || 0) / 4000) + 1;
  const PR = CONFIG.PRICE;
  const priceOpt = PR.options.find(function (o) { return o.key === G.finance.ticketPrice; }) || PR.options[1];
  const att = clamp(priceOpt.att * (1 + (G.prestige || 0) / 600 + (G.fans || 0) / 200000), 0.6, 0.95);
  const stars = t.players.filter(function (p) { return p.star; }).length;
  const extremes = t.players.filter(function (p) { return p.isExtreme; }).length;

  // 票价控制
  let ctrl = '<div class="sub">主场票价：<select id="ticket-price">';
  PR.options.forEach(function (o) { ctrl += '<option value="' + o.key + '"' + (o.key === G.finance.ticketPrice ? ' selected' : '') + '>' + o.label + '（上座率约 ' + Math.round(o.att * 100) + '%）</option>'; });
  ctrl += '</select> <span class="sub">当前预估上座率 ' + Math.round(att * 100) + '%</span></div>';

  const rows = [
    ['球队资金', '¥' + G.finance.cash.toLocaleString(), G.finance.cash < CONFIG.FINANCE.BANKRUPT ? 'warn' : ''],
    ['— 广告收入', '+' + rev.ad + '（' + adSlots + ' 广告位）', ''],
    ['— 主场门票', '+' + rev.gate + '（¥' + priceOpt.price + '×' + CONFIG.FINANCE.STADIUM_CAP + '×' + Math.round(att * 100) + '%）', ''],
    ['— 球衣销售', '+' + rev.jersey + '（球星 ' + stars + ' / 极限 ' + extremes + '）', ''],
    ['累计支出', '-' + G.finance.expense, ''],
    ['工资总额', '' + sal, over ? 'warn' : ''],
    ['工资帽', '' + G.finance.salaryCap, ''],
    ['球队等级', teamLevel(G.finance.cash), ''],
    ['球迷数量', (G.fans || 0).toLocaleString() + '（广告位 ' + adSlots + '）', ''],
    ['威望', '' + (G.prestige || 0), '']
  ];
  let html = ctrl;
  html += rows.map(function (r) {
    return '<div class="fin-row"><span>' + r[0] + '</span><span class="num ' + r[2] + '">' + r[1] + '</span></div>';
  }).join('');
  html += '<p class="sub" style="margin-top:10px">经营提示：票价越低上座率越高，但单价低；中价（¥55）通常净收入最佳（上座率约 88%）。球迷与威望放大广告与票房；球星/极限球员拉升球衣销量。</p>';
  if (over) html += '<p class="warn" style="font-size:var(--fs-xs);margin:8px 0 0">⚠ 工资超帽，注意财务健康。</p>';
  document.getElementById('finance').innerHTML = html;
  const sel = document.getElementById('ticket-price');
  if (sel) sel.onchange = function () { G.finance.ticketPrice = sel.value; renderFinance(); };
}

/* ---------- 荣誉室 ---------- */
function renderHonors() {
  const el = document.getElementById('honors');
  const t = teamById(G, G.humanTeamId);
  let html = '<div class="fin-row"><span>联赛冠军</span><span class="num">' + t.titles + ' 次</span></div>';
  if (!G.trophies.length) html += '<p class="sub">还没有奖杯。去杯赛页面报名，赢下你的第一座奖杯！</p>';
  else {
    html += '<table><thead><tr><th>赛季</th><th>奖杯</th></tr></thead><tbody>';
    G.trophies.slice().reverse().forEach(function (tr) {
      html += '<tr><td>第' + tr.season + '赛季</td><td>🏆 ' + tr.name + '</td></tr>';
    });
    html += '</tbody></table>';
  }
  el.innerHTML = html;
}

/* ---------- 名册 ---------- */
function renderRoster() {
  const t = teamById(G, G.humanTeamId);
  let html = '<table><thead><tr><th>球员</th><th>位</th><th>年龄</th><th>综合</th><th>年薪</th><th>合同</th><th>状态</th><th>极限球衣</th></tr></thead><tbody>';
  t.players.slice().sort(function (a, b) { return b.overall - a.overall; }).forEach(function (p) {
    const status = p.injury > 0 ? '<span class="tag warn">伤' + p.injury + '轮</span>'
      : (p.stamina < 40 ? '<span class="tag lose">疲</span>' : '<span class="tag win">就绪</span>');
    const jerseyCell = p.isExtreme
      ? '#' + (p.jersey != null ? p.jersey : '?') + ' <button class="mini-btn" data-jersey="' + p.id + '">刷球衣</button>'
      : '<span class="sub">—</span>';
    html += '<tr><td>' + p.name + starHTML(p) + ' <small class="sub">' + p.trait + '</small></td><td>' + p.pos + '</td><td class="num">' + p.age + '</td>' +
      '<td class="num">' + p.overall + '<div class="bar"><i style="width:' + p.overall + '%"></i></div></td>' +
      '<td class="num">' + p.salary + '</td><td class="num">' + p.contractYears + '年</td><td>' + status + '</td><td>' + jerseyCell + '</td></tr>';
  });
  html += '</tbody></table>';
  document.getElementById('roster').innerHTML = html;
  document.querySelectorAll('[data-jersey]').forEach(function (b) {
    b.onclick = function () {
      const res = transfer_jersey(G, b.dataset.jersey);
      if (res.ok) { renderAll(); switchView('roster'); }
    };
  });
}

/* ---------- 右侧球员面板（首发/替补页签）---------- */
function renderSideRoster() {
  const t = teamById(G, G.humanTeamId);
  const starters = t.lineup.map(function (id) { return t.players.find(function (p) { return p.id === id; }); }).filter(Boolean);
  const bench = t.players.filter(function (p) { return t.lineup.indexOf(p.id) < 0; });
  const list = curSideTab === 'bench' ? bench : starters;
  let html = '';
  list.forEach(function (p) {
    const inj = p.injury > 0 ? ' <span class="tag warn">伤</span>' : '';
    html += '<div class="side-roster-row"><span class="pos">' + p.pos + '</span><span style="flex:1">' + p.name + starHTML(p) + inj + '</span><span class="ovr">' + p.overall + '</span></div>';
  });
  document.getElementById('side-roster').innerHTML = html;
}

/* ---------- 赛季结束（冠军 + 升降级 + 新赛季按钮）---------- */
function renderSeasonEnd() {
  const el = document.getElementById('season-end');
  if (G.phase !== 'SEASON_END' || !G.seasonSummary) { el.classList.add('hidden'); return; }
  const s = G.seasonSummary;
  const champ = teamById(G, s.champion);
  const you = s.champion === G.humanTeamId;
  el.classList.remove('hidden');
  el.innerHTML = '<h2>' + (you ? '🏆 你夺得了第 ' + (G.season - 1) + ' 赛季 1级联赛冠军！' : '🏆 ' + champ.name + ' 夺得第 ' + (G.season - 1) + ' 赛季冠军') + '</h2>' +
    '<p class="sub">你的最终排名：' + (s.humanRank ? '第 ' + s.humanRank + ' 位' : '-') + '</p>' +
    '<p class="sub">⬆ 升入 1级：' + (s.promoted.join('、') || '—') + '</p>' +
    '<p class="sub">⬇ 降至 2级：' + (s.relegated.join('、') || '—') + '</p>' +
    '<p class="sub">赛程与杯赛已重置，点击顶部「开始新赛季」继续。</p>';
}

/* ---------- 冠军杯赛（512 人制单淘汰 + 报名三阶段）---------- */
function renderChampionship() {
  const el = document.getElementById('championship');
  const C = CONFIG.CHAMPIONSHIP;
  const c = G.championship;
  if (!c || !c.opened) {
    el.innerHTML = '<p class="sub">冠军杯为职业队顶级杯赛：每赛季第 ' + C.openRound + ' 轮开放报名。' +
      '报名分三阶段——<b>优先邀请函</b>（各级联赛前 2）→ <b>盟邀请函</b>（联盟排名资格）→ <b>全员可报</b>。' +
      '最终 ' + C.size + ' 强单淘汰，夺冠即封王。当前尚未开放。</p>';
    return;
  }
  let html = '<div class="sub">阶段：<b>' + championship_phaseText(G) + '</b></div>';
  if (c.humanEntry) {
    const tag = { priority: '优先邀请函（联赛前2）', alliance: '盟邀请函（联盟资格）', open: '全员自由报名' }[c.humanEntry];
    html += '<div class="star">🎫 你已以「' + tag + '」身份入围 ' + C.size + ' 强！</div>';
  }

  if (c.bracket) {
    const totalRounds = Math.log2(c.size);
    html += '<p class="sub">淘汰赛进度：第 ' + (c.roundIdx + 1) + ' / ' + totalRounds + ' 轮' + (c.done ? '（已决出冠军）' : '') + '</p>';
    // 玩家下一轮对手
    if (!c.done && c.bracket[c.roundIdx]) {
      const pair = c.bracket[c.roundIdx].find(function (p) { return p[0] === 'HUMAN' || p[1] === 'HUMAN'; });
      if (pair) {
        const oppId = pair[0] === 'HUMAN' ? pair[1] : pair[0];
        const opp = c.byId[oppId];
        html += '<div class="sub">⚔ 本轮对手：' + (opp ? opp.name : oppId) + '</div>';
      }
    }
    if (c.myResult) html += '<p class="stat-note">最近一场（第 ' + (c.myResult.round + 1) + ' 轮）：' + (c.myResult.won ? '✔ 胜 ' : '✘ 负 ') + (c.myResult.opp || '') + '（' + c.myResult.hScore + ':' + c.myResult.aScore + '）</p>';
    if (c.done && c.champion === 'HUMAN') html += '<div class="star">🏆 你夺得「冠军杯」总冠军！+¥' + C.championPrize.cash + ' +' + C.championPrize.prestige + ' 威望 +' + C.championPrize.kings + ' 王者积分</div>';
    else if (c.done) html += '<div class="star">🏆 冠军杯总冠军：' + (c.byId[c.champion] ? c.byId[c.champion].name : c.champion) + '</div>';
  } else if (c.phase === 'open' && !c.humanEntry && (G.round + 1) >= C.phase3Round) {
    html += '<button class="mini-btn" id="champ-reg-open">全员报名参赛</button>';
  } else if (!c.humanEntry) {
    html += '<p class="sub">你尚未获得入围资格：先冲联赛前 2（优先邀请函），或加入联盟（盟邀请函），或等第 ' + C.phase3Round + ' 轮全员开放。</p>';
  }
  el.innerHTML = html;
  const rb = document.getElementById('champ-reg-open');
  if (rb) rb.onclick = function () { const res = championship_registerOpen(G); if (res.ok) renderAll(); else { rb.textContent = { 'already': '已入围', 'too-early': '未到时间', 'closed': '已截止' }[res.reason] || '不可报名'; } };
}

/* ---------- 转会市场 ---------- */
function renderTransfer() {
  document.getElementById('train-info-tf').innerHTML =
    '球队资金 <b class="num accent">¥' + G.finance.cash.toLocaleString() + '</b> · 系统球员池（含极限球员，标 ⚡）。买入即入替补，满员则替换综合最低者并回收半价。';
  const pool = G.transferPool || [];
  if (!pool.length) { document.getElementById('transfer').innerHTML = '<p class="sub">转会窗口已关闭（球员均已签走）。</p>'; return; }
  let html = '<table><thead><tr><th>球员</th><th>位</th><th>综合</th><th>身价</th><th>购入</th></tr></thead><tbody>';
  pool.slice().sort(function (a, b) { return b.overall - a.overall; }).forEach(function (p) {
    const can = G.finance.cash >= p.marketPrice;
    const ext = p.isExtreme ? ' <span class="star">⚡极限</span>' : '';
    html += '<tr><td>' + p.name + ext + ' <small class="sub">' + p.trait + '</small></td><td>' + p.pos + '</td><td class="num">' + p.overall +
      '<div class="bar"><i style="width:' + p.overall + '%"></i></div></td>' +
      '<td class="num">¥' + p.marketPrice.toLocaleString() + '</td>' +
      '<td><button class="mini-btn" data-buy="' + p.id + '"' + (can ? '' : ' disabled') + '>买入</button></td></tr>';
  });
  html += '</tbody></table>';
  document.getElementById('transfer').innerHTML = html;
  document.querySelectorAll('[data-buy]').forEach(function (b) {
    b.onclick = function () {
      const res = transfer_buy(G, b.dataset.buy);
      if (res.ok) { renderAll(); switchView('transfer'); }
      else b.textContent = { 'no-cash': '资金不足', 'no-player': '已下架' }[res.reason] || '失败';
    };
  });
}

/* ---------- 经理名片 ---------- */
function renderManager() {
  const t = teamById(G, G.humanTeamId);
  const el = document.getElementById('manager');
  let html = '<div class="fin-row"><span>执教球队</span><span class="num">' + t.name + '</span></div>';
  html += '<div class="fin-row"><span>所属联赛</span><span class="num">' + ui_leagueName(t) + '</span></div>';
  html += '<div class="fin-row"><span>王者积分</span><span class="num star">' + G.kingsPts + '</span></div>';
  html += '<div class="fin-row"><span>威望</span><span class="num star">' + (G.prestige || 0) + '</span></div>';
  html += '<div class="fin-row"><span>球迷</span><span class="num">' + (G.fans || 0).toLocaleString() + '</span></div>';
  html += '<div class="fin-row"><span>奖杯总数</span><span class="num">' + G.trophies.length + '</span></div>';
  html += '<div class="fin-row"><span>当前战绩</span><span class="num">' + t.wins + ' 胜 ' + t.losses + ' 负</span></div>';
  el.innerHTML = html;
}

/* ---------- 我的战绩 ---------- */
function renderRecord() {
  const el = document.getElementById('record');
  const t = teamById(G, G.humanTeamId);
  let html = '<p class="sub">第 ' + G.season + ' 赛季 · ' + ui_leagueName(t) + ' · 第 ' + (G.phase === 'REGULAR' ? (G.round + 1) : '—') + ' 轮</p>';
  html += '<div class="fin-row"><span>本赛季战绩</span><span class="num">' + t.wins + ' 胜 ' + t.losses + ' 负</span></div>';
  html += '<div class="fin-row"><span>净胜分</span><span class="num">' + (t.pf - t.pa > 0 ? '+' : '') + (t.pf - t.pa) + '</span></div>';
  html += '<div class="fin-row"><span>历史夺冠</span><span class="num">' + t.titles + ' 次</span></div>';
  if (G.seasonSummary) {
    html += '<div class="fin-row"><span>上季排名</span><span class="num">' + (G.seasonSummary.humanRank || '-') + ' 位</span></div>';
    html += '<div class="fin-row"><span>上季冠军</span><span class="num">' + (teamById(G, G.seasonSummary.champion) || {}).name + '</span></div>';
  }
  const cups = (G.trophies || []).filter(function (x) { return x.kind === 'cup' || x.kind === 'championship'; });
  html += '<h3 class="sub">已夺杯赛</h3>';
  html += cups.length ? '<ul class="trophy-list">' + cups.slice().reverse().map(function (tr) { return '<li>🏆 第' + tr.season + '赛季 · ' + tr.name + '</li>'; }).join('') + '</ul>'
    : '<p class="sub">暂无杯赛奖杯，去杯赛页面争冠吧。</p>';
  el.innerHTML = html;
}

/* ---------- 历史积分排行 ---------- */
function renderHistory() {
  const el = document.getElementById('history');
  let html = '<p class="sub">胜者为王「历史积分排行」为跨服榜单（需联网对战）。本端为单机模拟，展示你当前的王者积分战绩：</p>';
  html += '<table><thead><tr><th>名次</th><th>经理</th><th>王者积分</th><th>威望</th></tr></thead><tbody>';
  html += '<tr class="you"><td>1</td><td>你（' + teamById(G, G.humanTeamId).name + '）</td><td class="num star">' + G.kingsPts + '</td><td class="num">' + (G.prestige || 0) + '</td></tr>';
  html += '</tbody></table>';
  html += '<p class="sub">提示：王者积分为你所有（道具/盟战/历史）积分总和；使用历史积分会影响本榜排名。</p>';
  el.innerHTML = html;
}

/* ---------- 联盟系统（首页 / 盟战 / 联盟威望 / 联盟杯赛 / 至尊杯邀请函）---------- */
function renderAlliance() {
  const el = document.getElementById('alliance');
  const A = CONFIG.ALLIANCE;
  if (!G.alliance) {
    let html = '<p class="sub">联盟是你的工会。创建或加入一个联盟，参与 <b>盟战</b> 攒联盟威望，凭排名争夺 <b>至尊杯邀请函</b>。</p>';
    html += '<div class="sub">创建联盟：<input id="alliance-name" maxlength="8" placeholder="联盟名" style="width:120px" /> <button class="mini-btn" id="alliance-create">创建</button></div>';
    html += '<h3 class="sub">或加入现有联盟（按威望排序）</h3>';
    const ranked = G.alliances.slice().sort(function (a, b) { return b.prestige - a.prestige; });
    html += '<table><thead><tr><th>联盟</th><th>威望</th><th>实力</th><th></th></tr></thead><tbody>';
    ranked.forEach(function (al) {
      html += '<tr><td>' + al.name + '</td><td class="num">' + al.prestige + '</td><td class="num">' + al.rating + '</td>' +
        '<td><button class="mini-btn" data-alliance-join="' + al.id + '">加入</button></td></tr>';
    });
    html += '</tbody></table>';
    el.innerHTML = html;
    document.getElementById('alliance-create').onclick = function () {
      const name = document.getElementById('alliance-name').value.trim();
      const res = alliance_create(G, name);
      if (res.ok) renderAll(); else { document.getElementById('alliance-create').textContent = '已加入'; }
    };
    document.querySelectorAll('[data-alliance-join]').forEach(function (b) {
      b.onclick = function () { const res = alliance_join(G, b.dataset.allianceJoin); if (res.ok) renderAll(); };
    });
    return;
  }
  const my = G.alliance;
  const ranked = G.alliances.slice().sort(function (a, b) { return b.prestige - a.prestige; });
  const myRank = ranked.findIndex(function (x) { return x.id === my.id; }) + 1;
  let html = '<div class="fin-row"><span>我的联盟</span><span class="num">' + my.name + '</span></div>';
  html += '<div class="fin-row"><span>联盟威望</span><span class="num star">' + my.prestige + '</span></div>';
  html += '<div class="fin-row"><span>联盟排名</span><span class="num">' + myRank + ' / ' + G.alliances.length + '</span></div>';
  html += '<div class="fin-row"><span>至尊杯资格</span><span class="num">' + (G.supremeInvite ? '✅ 已获邀请函' : '需进入前 ' + A.supremeTopN + ' 名') + '</span></div>';
  html += '<button class="mini-btn" id="alliance-leave">退出联盟</button>';

  // 盟战状态
  html += '<h3 class="sub">盟战（每 ' + A.warGap + ' 轮一场，胜场 +' + A.warPrestige + ' 联盟威望 / +' + A.warKings + ' 王者积分）</h3>';
  html += '<p class="sub">最近一场盟战：第 ' + (G.allianceWar ? G.allianceWar.lastRound : 0) + ' 轮' + (G.log.filter(function (l) { return l.indexOf('盟战') >= 0; }).slice(-1)[0] ? '（' + G.log.filter(function (l) { return l.indexOf('盟战') >= 0; }).slice(-1)[0] + '）' : '') + '</p>';

  // 联盟杯赛
  html += '<h3 class="sub">联盟杯赛（每赛季一次，联盟代表淘汰赛）</h3>';
  if (!G.allianceCup) html += '<p class="sub">第 ' + A.cupRound + ' 轮开赛。</p>';
  else if (G.allianceCup.done) html += '<p class="sub">本赛季联盟杯赛冠军：' + (G.allianceCup.byId[G.allianceCup.champion] ? G.allianceCup.byId[G.allianceCup.champion].name : G.allianceCup.champion) + (G.allianceCup.champion === my.id ? '（你的联盟！）' : '') + '</p>';
  else html += '<p class="sub">进行中：第 ' + (G.allianceCup.roundIdx + 1) + ' 轮' + (G.allianceCup.myResult ? '（你' + (G.allianceCup.myResult.won ? '胜' : '负') + ' ' + G.allianceCup.myResult.opp + '）' : '') + '</p>';

  // 联盟排名榜
  html += '<h3 class="sub">联盟威望排行（前 ' + A.supremeTopN + ' 名获至尊杯邀请函）</h3>';
  html += '<table><thead><tr><th>排名</th><th>联盟</th><th>威望</th><th>资格</th></tr></thead><tbody>';
  ranked.forEach(function (al, i) {
    const you = al.id === my.id ? ' class="you"' : '';
    const qual = i < A.supremeTopN ? ' <span class="tag win">至尊杯</span>' : '';
    html += '<tr' + you + '><td>' + (i + 1) + qual + '</td><td>' + al.name + '</td><td class="num">' + al.prestige + '</td><td>' + (i < A.supremeTopN ? '✅' : '—') + '</td></tr>';
  });
  html += '</tbody></table>';
  el.innerHTML = html;
  const bl = document.getElementById('alliance-leave');
  if (bl) bl.onclick = function () { alliance_leave(G); renderAll(); };
}

function renderSupreme() {
  const el = document.getElementById('supreme');
  const A = CONFIG.ALLIANCE;
  if (!G.alliance) {
    el.innerHTML = '<p class="sub">至尊杯为联盟荣誉之战：每赛季联盟排名前 ' + A.supremeTopN + ' 获 <b>至尊杯邀请函</b>，代表联盟出战淘汰赛。先加入联盟并攒威望吧。</p>';
    return;
  }
  if (!G.supremeInvite) {
    const ranked = G.alliances.slice().sort(function (a, b) { return b.prestige - a.prestige; });
    const myRank = ranked.findIndex(function (x) { return x.id === G.alliance.id; }) + 1;
    el.innerHTML = '<p class="sub">你的联盟当前排名第 ' + myRank + ' / ' + G.alliances.length + '，需进入前 ' + A.supremeTopN + ' 名方可获得至尊杯邀请函（多打盟战攒威望）。</p>';
    return;
  }
  let html = '<div class="star">🎫 你的联盟已获至尊杯邀请函！</div>';
  if (!G.supremeCup) html += '<p class="sub">至尊杯第 ' + A.supremeRound + ' 轮开战（联盟代表淘汰赛）。</p>';
  else if (G.supremeCup.done) html += '<div class="star">👑 至尊杯冠军：' + (G.supremeCup.byId[G.supremeCup.champion] ? G.supremeCup.byId[G.supremeCup.champion].name : G.supremeCup.champion) + (G.supremeCup.champion === G.alliance.id ? '（你的联盟问鼎！+¥' + A.supremePrize.cash + ' +' + A.supremePrize.prestige + ' 威望 +' + A.supremePrize.kings + ' 王者积分）' : '') + '</div>';
  else html += '<p class="sub">进行中：第 ' + (G.supremeCup.roundIdx + 1) + ' 轮' + (G.supremeCup.myResult ? '（你' + (G.supremeCup.myResult.won ? '胜' : '负') + ' ' + G.supremeCup.myResult.opp + '）' : '') + '</p>';
  el.innerHTML = html;
}

/* ---------- 有奖竞猜 ---------- */
function renderBet() {
  const el = document.getElementById('bet');
  const featured = bet_featured(G);
  let html = '<p class="sub">押注下轮焦点对阵（单注最多押资金 ' + Math.round(CONFIG.BET.maxStakePct * 100) + '%）。比赛结束后自动结算，命中按赔率收回。</p>';
  if (!featured.length) {
    html += '<p class="sub">当前无可用竞猜场次（非赛季中或非焦点对阵）。</p>';
  } else {
    html += '<table><thead><tr><th>主队</th><th>客队</th><th>主胜赔率</th><th>客胜赔率</th><th>押注</th></tr></thead><tbody>';
    featured.forEach(function (m) {
      html += '<tr><td>' + m.home + '</td><td>' + m.away + '</td>' +
        '<td class="num">' + m.oddHome + '</td><td class="num">' + m.oddAway + '</td>' +
        '<td><button class="mini-btn" data-bet-h="' + m.homeId + '" data-bet-a="' + m.awayId + '">押主</button> ' +
        '<button class="mini-btn" data-bet-a2="' + m.awayId + '" data-bet-h2="' + m.homeId + '">押客</button></td></tr>';
    });
    html += '</tbody></table>';
  }
  // 已押注列表
  const bets = G.bets || [];
  if (bets.length) {
    html += '<h3 class="sub">我的竞猜（' + bets.filter(function (b) { return !b.resolved; }).length + ' 未结算）</h3>';
    html += '<table><thead><tr><th>对阵</th><th>押注</th><th>赔率</th><th>状态</th></tr></thead><tbody>';
    bets.slice().reverse().forEach(function (b) {
      const ht = teamById(G, b.homeId), at = teamById(G, b.awayId);
      const pickName = b.pick === b.homeId ? (ht ? ht.name : b.homeId) : (at ? at.name : b.awayId);
      const st = b.resolved ? (b.won ? '<span class="tag win">命中 +¥' + b.payout + '</span>' : '<span class="tag lose">落空</span>') : '<span class="sub">待结算</span>';
      html += '<tr><td>' + (ht ? ht.name : b.homeId) + ' vs ' + (at ? at.name : b.awayId) + '</td><td>押 ' + pickName + ' ¥' + b.amount + '</td><td class="num">' + b.odd + '</td><td>' + st + '</td></tr>';
    });
    html += '</tbody></table>';
  }
  el.innerHTML = html;
  document.querySelectorAll('[data-bet-h]').forEach(function (b) {
    b.onclick = function () { doBet(b.dataset.betH, b.dataset.betA, b.dataset.betH); };
  });
  document.querySelectorAll('[data-bet-a2]').forEach(function (b) {
    b.onclick = function () { doBet(b.dataset.betH2, b.dataset.betA2, b.dataset.betA2); };
  });
}
function doBet(homeId, awayId, pick) {
  const amt = Math.max(1000, Math.round(G.finance.cash * CONFIG.BET.maxStakePct / 2));
  const res = bet_place(G, homeId, awayId, pick, amt);
  if (res.ok) { renderAll(); switchView('bet'); }
  else { alert({ 'min': '至少押 ¥1000', 'over-stake': '超过单注上限', 'no-cash': '资金不足', 'closed': '已停盘', 'dup': '该场已押' }[res.reason] || '不可押注'); }
}

boot();
