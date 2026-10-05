/* =========================================================
 *  CANGAME · UI 层（含存档）
 * ========================================================= */

const LS = {
  auto: 'cangame_autosave_v1',
  slots: 'cangame_slots_v1',
  pref: 'cangame_pref_v1'
};

let STATE = null;
let TALENT_POOL = [];
let SELECTED = [];
let CREATE_POINTS = 10;

/* ---------- 存档 ---------- */
function lsGet(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }

function autosave() {
  if (!STATE) return;
  STATE.updatedAt = Date.now();
  lsSet(LS.auto, STATE);
}
function loadAuto() { return lsGet(LS.auto); }
function hasSave() {
  const a = loadAuto();
  return !!(a && a.stats);
}
function getSlots() {
  const s = lsGet(LS.slots);
  if (!s || !Array.isArray(s.slots)) return [null, null, null];
  while (s.slots.length < 3) s.slots.push(null);
  return s;
}
function setSlots(slots) { lsSet(LS.slots, { slots }); }
function saveToSlot(i) {
  if (!STATE) return;
  const slots = getSlots();
  slots[i] = JSON.parse(JSON.stringify(STATE));
  slots[i].slotSavedAt = Date.now();
  setSlots(slots);
  toast(`已存入存档槽 ${i + 1}`);
}
function loadSlot(i) {
  const slots = getSlots();
  if (!slots[i]) return;
  STATE = slots[i];
  lsSet(LS.auto, STATE);
  enterGame();
  toast(`已读取存档槽 ${i + 1}`);
}
function delSlot(i) {
  const slots = getSlots();
  slots[i] = null;
  setSlots(slots);
  renderSaveManager();
}
function exportSave() {
  if (!STATE) return;
  const txt = btoa(unescape(encodeURIComponent(JSON.stringify(STATE))));
  document.getElementById('exportBox').value = txt;
  document.getElementById('exportBox').select();
  try { document.execCommand('copy'); } catch (e) { }
  toast('存档码已生成并复制，可粘贴保存');
}
function importSave() {
  const txt = document.getElementById('exportBox').value.trim();
  if (!txt) { toast('请先粘贴存档码'); return; }
  try {
    const obj = JSON.parse(decodeURIComponent(escape(atob(txt))));
    if (!obj || !obj.stats) throw 0;
    STATE = obj;
    lsSet(LS.auto, STATE);
    enterGame();
    closeModal();
    toast('存档导入成功');
  } catch (e) { toast('存档码无效'); }
}

/* ---------- 通用 UI ---------- */
function $(id) { return document.getElementById(id); }
function esc(s) { return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 1800);
}
function showScreen(id) {
  ['screen-title', 'screen-create', 'screen-game', 'screen-market', 'screen-end'].forEach(s => {
    $(s).classList.toggle('active', s === id);
  });
  window.scrollTo(0, 0);
}
function openModal() { $('modal').classList.add('open'); renderSaveManager(); }
function closeModal() { $('modal').classList.remove('open'); }

/* ---------- 标题页 ---------- */
function renderTitle() {
  const btn = $('btnContinue');
  const save = loadAuto();
  if (save && !save.finished) {
    btn.style.display = '';
    btn.innerHTML = `继续人生 <span class="sub">${save.name} · ${START_YEAR + save.age}년 · ${save.age}세 · ${fmtMoney(save.stats.MONEY)}</span>`;
  } else {
    btn.style.display = 'none';
  }
}

/* ---------- 创建角色 ---------- */
function startCreate() {
  TALENT_POOL = rollTalents(10);
  SELECTED = [];
  CREATE_POINTS = 10;
  const pref = lsGet(LS.pref) || {};
  $('inputName').value = pref.name || randomName();
  document.querySelectorAll('[name=gender]').forEach(r => r.checked = (r.value === (pref.gender || 'M')));
  renderFamilies();
  renderTalents();
  showScreen('screen-create');
}

function randomName() {
  const s = ['김', '박', '이', '최', '정', '강', '조', '윤', '장', '한'];
  const g = ['민준', '서준', '도윤', '예준', '시우', '하준', '지호', '지훈', '준서', '건우'];
  return s[randInt(0, s.length - 1)] + g[randInt(0, g.length - 1)];
}

function renderFamilies() {
  const wrap = $('familyList');
  wrap.innerHTML = '';
  FAMILIES.forEach(f => {
    const d = document.createElement('div');
    d.className = 'fam';
    d.innerHTML = `<div class="fam-name">${esc(f.name)}</div><div class="fam-desc">${esc(f.desc)}</div>` +
      `<div class="fam-eff">${describeEffects(f.eff).join(' · ') || '—'}</div>`;
    d.onclick = () => {
      document.querySelectorAll('.fam').forEach(x => x.classList.remove('sel'));
      d.classList.add('sel');
      d.dataset.sel = '1';
      wrap.dataset.pick = f.id;
    };
    wrap.appendChild(d);
  });
  wrap.dataset.pick = FAMILIES[0].id;
  wrap.firstChild.classList.add('sel');
}

function renderTalents() {
  const wrap = $('talentList');
  wrap.innerHTML = '';
  TALENT_POOL.forEach(t => {
    const d = document.createElement('div');
    const sel = SELECTED.indexOf(t.id) >= 0;
    const afford = sel || (CREATE_POINTS - t.cost) >= 0;
    d.className = 'talent' + (sel ? ' sel' : '') + (afford ? '' : ' no');
    const costTxt = t.cost > 0 ? `消耗 ${t.cost} 点` : (t.cost < 0 ? `返还 ${-t.cost} 点` : '免费');
    d.innerHTML = `<div class="t-head"><span class="t-name">${esc(t.name)}</span><span class="t-cost">${costTxt}</span></div>` +
      `<div class="t-desc">${esc(t.desc)}</div>` +
      `<div class="t-eff">${describeEffects(t.eff).join(' · ') || ''}</div>`;
    d.onclick = () => {
      const i = SELECTED.indexOf(t.id);
      if (i >= 0) { CREATE_POINTS += t.cost; SELECTED.splice(i, 1); }
      else if ((CREATE_POINTS - t.cost) >= 0) { CREATE_POINTS -= t.cost; SELECTED.push(t.id); }
      else { toast('点数不足'); return; }
      $('points').textContent = CREATE_POINTS;
      renderTalents();
    };
    wrap.appendChild(d);
  });
  $('points').textContent = CREATE_POINTS;
}

function rerollTalents() {
  TALENT_POOL = rollTalents(10);
  SELECTED = [];
  CREATE_POINTS = 10;
  renderTalents();
  toast('已重新抽取天赋');
}

function confirmCreate() {
  const name = ($('inputName').value || '').trim() || randomName();
  const gender = (document.querySelector('[name=gender]:checked') || {}).value || 'M';
  const familyId = $('familyList').dataset.pick || FAMILIES[0].id;
  lsSet(LS.pref, { name, gender });
  STATE = createGame({ name, gender, familyId, talents: SELECTED.slice() });
  autosave();
  enterGame();
}

/* ---------- 游戏页 ---------- */
function enterGame() {
  if (STATE) marketMigrate(STATE);
  showScreen('screen-game');
  if (STATE.finished && STATE.ending) { renderEnd(); return; }
  if (!STATE.log.length) { /* noop */ }
  renderStats();
  renderStream();
  // 恢复当前待展示内容
  if (STATE.pending) renderItem(STATE.pending);
  else renderIdle();
}

function renderStats() {
  const s = STATE.stats;
  const box = $('statList');
  let html = '';
  STATS.forEach(st => {
    const v = s[st.key];
    let max = 120;
    if (['INT', 'STR', 'CHA', 'WILL'].indexOf(st.key) >= 0) max = 120;
    const pct = clamp(v / max * 100, 0, 100);
    const cls = st.key === 'STRESS' ? (v > 60 ? 'bad' : '') : (st.key === 'HP' ? (v < 30 ? 'bad' : 'hp') : '');
    html += `<div class="stat" title="${esc(st.hint)}">
      <div class="s-label"><span>${esc(st.name)}</span><b>${Math.round(v)}</b></div>
      <div class="bar"><i class="${cls}" style="width:${pct}%"></i></div></div>`;
  });
  box.innerHTML = html;

  const rbox = $('resList');
  const m = marketMigrate(STATE);
  const debtHtml = m.debt > 0 ? `<div class="res debt"><span>대출 贷款</span><b>-${fmtMoney(m.debt)}</b></div>` : '';
  const propHtml = m.props.length ? `<div class="res"><span>보유자산 持有资产</span><b>${m.props.length} 项 · ${fmtMoney(propValue(STATE))}</b></div>` : '';
  const stockHtml = m.stocks.length ? `<div class="res"><span>주식 持股</span><b>${fmtMoney(stockValue(STATE))}</b></div>` : '';
  rbox.innerHTML = `
    <div class="res"><span>나이 年龄</span><b>${STATE.age}세 · ${fmtYear(STATE)}년</b></div>
    <div class="res"><span>신분 身份</span><b>${esc(STATE.job || defaultJob(STATE.age))}</b></div>
    <div class="res money"><span>현금 现金</span><b>${fmtMoney(s.MONEY)}</b></div>
    <div class="res net"><span>순자산 净资产</span><b>${fmtMoney(netWorth(STATE))}</b></div>
    ${debtHtml}${propHtml}${stockHtml}
    <div class="res"><span>인맥 人脉</span><b>${Math.round(s.NET)}</b></div>
    <div class="res"><span>명성 声望</span><b>${Math.round(s.FAME)}</b></div>
    <div class="res"><span>太星好感</span><b>${Math.round(s.LOY)}</b></div>
    ${STATE.investments.length ? `<div class="res inv"><span>持有投资</span><b>${STATE.investments.map(i => i.name.split('·')[0].trim() + ' ' + fmtMoney(i.amount) + '（剩' + i.yearsLeft + '年）').join('，')}</b></div>` : ''}
  `;
  const tags = [];
  if (STATE.flags.past_life) tags.push('전생의 기억');
  if (STATE.flags.revenge) tags.push('복수심');
  if (STATE.flags.taeseong_staff) tags.push('太星社员');
  if (STATE.flags.taeseong_inner) tags.push('财阀核心');
  if (STATE.flags.gangnam_owner) tags.push('江南业主');
  if (STATE.flags.took_over) tags.push('太星之主');
  if (STATE.flags.exposed) tags.push('曝光者');
  $('tagList').innerHTML = tags.map(t => `<span class="tag">${esc(t)}</span>`).join('');
  $('heroName').textContent = `${STATE.name} · ${STATE.gender === 'M' ? '남' : '여'} · ${esc(STATE.familyName)}`;
}

function renderStream() {
  const box = $('stream');
  box.innerHTML = STATE.log.map(l => {
    const cls = 'line ' + (l.type || 'story');
    return `<div class="${cls}"><span class="y">${l.year}년 ${l.age}세</span>${esc(l.text)}</div>`;
  }).join('');
  box.scrollTop = box.scrollHeight;
}

function renderIdle() {
  $('card').innerHTML = `
    <div class="card-inner">
      <div class="card-year">${fmtYear(STATE)}년 · ${STATE.age}세 · ${esc(STATE.job || defaultJob(STATE.age))}</div>
      <p class="card-text">时间还在走。准备好迎接下一年了吗？</p>
    </div>`;
  $('actions').innerHTML = `<button class="btn primary" onclick="advance()">下一年 ▸</button>`;
}

function renderItem(item) {
  STATE.pending = item;
  let html = '';
  if (item.type === 'event') {
    const ev = item.ev;
    html = `<div class="card-inner">
      <div class="card-year">${fmtYear(STATE)}년 · ${STATE.age}세</div>
      <p class="card-text">${esc(ev.text)}</p></div>`;
    const list = eventChoices(STATE, ev) || [];
    const btns = list.map((c, i) => {
      const r = c.risk || 2;
      let sub = '';
      if (c.gamble) {
        const g = c.gamble;
        sub = `<span class="gamble">${Math.round(g.p * 100)}% 성공 · ${describeEffects(g.win).join(' ') || '—'} ／ 실패 ${describeEffects(g.lose).join(' ') || '—'}</span>`;
      } else {
        const d = describeEffects(c.eff);
        if (d.length) sub = `<span class="gamble">${d.join(' · ')}</span>`;
      }
      return `<button class="btn choice c-risk${r}" onclick="choose(${i})">${esc(c.text)}<span class="risk r${r}">风险${riskLabel(r)}</span>${sub}</button>`;
    }).join('');
    $('actions').innerHTML = btns || `<button class="btn primary" onclick="choose(-1)">继续 ▸</button>`;
  } else if (item.type === 'invest') {
    html = `<div class="card-inner invest">
      <div class="card-year">투자 投资 · ${fmtYear(STATE)}년</div>
      <p class="card-text">${esc(item.text).replace(/\n/g, '<br>')}</p></div>`;
    $('actions').innerHTML = item.choices.map((c, i) =>
      `<button class="btn choice ${c.disabled ? 'dis' : ''}" ${c.disabled ? 'disabled' : ''} onclick="investChoice(${i})">${esc(c.text)}</button>`).join('');
  } else {
    html = `<div class="card-inner"><div class="card-year">${item.year}년</div><p class="card-text">新的一年开始了。</p></div>`;
    $('actions').innerHTML = `<button class="btn primary" onclick="advance()">继续 ▸</button>`;
  }
  $('card').innerHTML = html;
  renderStats();
  renderStream();
  autosave();
}

function advance() {
  if (!STATE || STATE.finished) return;
  let item = step(STATE);
  // 跳过纯年份头，直接进入内容
  let guard = 0;
  while (item && item.type === 'year' && guard++ < 5) {
    pushLog(STATE, `── ${item.year}년 · ${item.age}세 ──`, 'year');
    item = step(STATE);
  }
  if (!item || item.type === 'end') { finishGame(); return; }
  renderItem(item);
}

function choose(i) {
  const item = STATE.pending;
  if (!item || item.type !== 'event') return;
  resolveEvent(STATE, item.ev, i);
  STATE.pending = null;
  renderStats();
  renderStream();
  autosave();
  if (STATE.finished) { finishGame(); return; }
  if (STATE.queue && STATE.queue.length) renderItem(STATE.queue.shift());
  else renderIdle();
}

function investChoice(i) {
  const item = STATE.pending;
  if (!item || item.type !== 'invest') return;
  const c = item.choices[i];
  if (!c || c.disabled) return;
  resolveInvest(STATE, c);
  STATE.pending = null;
  renderStats();
  renderStream();
  autosave();
  if (STATE.queue && STATE.queue.length) renderItem(STATE.queue.shift());
  else renderIdle();
}

function finishGame() {
  if (!STATE.finished) finish(STATE);
  autosave();
  renderEnd();
}

/* ---------- 结局页 ---------- */
function renderEnd() {
  showScreen('screen-end');
  const e = STATE.ending || ENDINGS[ENDINGS.length - 1];
  const score = STATE.score != null ? STATE.score : scoreOf(STATE);
  const rank = STATE.rank || grade(score);
  $('endRank').textContent = rank;
  $('endRank').className = 'rank rank-' + rank;
  $('endTitle').textContent = e.title;
  $('endText').textContent = e.text;
  $('endScore').textContent = score + ' / 100';
  const s = STATE.stats;
  $('endStats').innerHTML = `
    <div><span>순자산 净资产</span><b>${fmtMoney(worthOf(STATE))}</b></div>
    <div><span>현금 现金</span><b>${fmtMoney(s.MONEY)}</b></div>
    <div><span>巅峰净资产</span><b>${fmtMoney(STATE.peak.NET || STATE.peak.MONEY)}</b></div>
    <div><span>보유자산 资产</span><b>${fmtMoney(propValue(STATE))}</b></div>
    <div><span>주식 持股</span><b>${fmtMoney(stockValue(STATE))}</b></div>
    <div><span>대출 贷款</span><b>${(STATE.market && STATE.market.debt) ? '-' + fmtMoney(STATE.market.debt) : '—'}</b></div>
    <div><span>声望</span><b>${Math.round(s.FAME)}</b></div>
    <div><span>人脉</span><b>${Math.round(s.NET)}</b></div>
    <div><span>智力 / 意志</span><b>${Math.round(s.INT)} / ${Math.round(s.WILL)}</b></div>
    <div><span>享年</span><b>${STATE.age}세 · ${fmtYear(STATE)}년</b></div>`;
  const hl = STATE.log.filter(l => l.type === 'story' || l.type === 'money').slice(-40);
  $('endReview').innerHTML = hl.map(l => `<div class="line ${l.type}"><span class="y">${l.year}년</span>${esc(l.text)}</div>`).join('');
}

/* ---------- 存档管理 ---------- */
function renderSaveManager() {
  const slots = getSlots();
  const box = $('slotList');
  box.innerHTML = slots.map((s, i) => {
    if (!s) return `<div class="slot empty">
      <div class="slot-t">存档槽 ${i + 1} <span class="sub">空</span></div>
      <div class="slot-b"><button class="btn small" onclick="saveToSlot(${i})">存入当前进度</button></div></div>`;
    return `<div class="slot">
      <div class="slot-t">存档槽 ${i + 1} <span class="sub">${s.name} · ${START_YEAR + s.age}년 · ${s.age}세 · ${fmtMoney(s.stats.MONEY)}</span></div>
      <div class="slot-b">
        <button class="btn small" onclick="loadSlot(${i})">读取</button>
        <button class="btn small" onclick="saveToSlot(${i})">覆盖</button>
        <button class="btn small danger" onclick="delSlot(${i})">删除</button>
      </div></div>`;
  }).join('');
}

/* ---------- 市场页 ---------- */
let MARKET_TAB = 'house';

function openMarket() {
  if (!STATE) { toast('先开始一段人生'); return; }
  if (!marketOpen(STATE)) {
    toast(STATE.age < MARKET_META.minAge ? `${MARKET_META.minAge}세 之后才能进入市场` : '人生已经结束');
    return;
  }
  showScreen('screen-market');
  renderMarket();
}

function backToGame() {
  showScreen('screen-game');
  renderStats();
  if (STATE.pending) renderItem(STATE.pending); else renderIdle();
}

function renderMarket() {
  const m = marketMigrate(STATE);
  const y = fmtYear(STATE);
  $('marketYear').textContent = `${y}년 · ${STATE.age}세 · 基准利率 ${(rateAt(y) * 100).toFixed(1)}%`;
  const sum = marketSummary(STATE);
  $('marketWallet').innerHTML = `
    <div><span>현금 现金</span><b>${fmtMoney(sum.cash)}</b></div>
    <div><span>순자산 净资产</span><b>${fmtMoney(sum.net)}</b></div>
    <div><span>보유자산 资产</span><b>${fmtMoney(sum.props)}</b></div>
    <div><span>주식 持股</span><b>${fmtMoney(sum.stocks)}</b></div>
    <div class="${sum.debt > 0 ? 'debt' : ''}"><span>대출 贷款</span><b>${sum.debt > 0 ? '-' + fmtMoney(sum.debt) : '—'}</b></div>`;
  document.querySelectorAll('.mtab').forEach(b => b.classList.toggle('active', b.dataset.tab === MARKET_TAB));
  const body = $('marketBody');
  if (MARKET_TAB === 'house') body.innerHTML = renderHouseTab();
  else if (MARKET_TAB === 'car') body.innerHTML = renderCarTab();
  else if (MARKET_TAB === 'good') body.innerHTML = renderGoodTab();
  else if (MARKET_TAB === 'stock') body.innerHTML = renderStockTab();
  else body.innerHTML = renderHoldTab();
}

function renderHouseTab() {
  const y = fmtYear(STATE);
  const rate = rateAt(y);
  let html = `<div class="mk-note">房价随年代上涨，也会遇到 IMF、金融危机这类暴跌。买房可贷款，首付越低、利息越重。</div>`;
  HOUSES.forEach(h => {
    if (y < h.minYear) return;
    const unit = housePrice(STATE, h);
    const ratio = (h.base > 0) ? ((unit / h.base)) : 1;
    const up = Math.round((ratio - 1) * 100);
    const meta = `较 1985년 ${up >= 0 ? '+' : ''}${up}% · 年化 ${(h.growth * 100).toFixed(1)}%` +
      (h.rent ? ` · 租金 ${(h.rent * 100).toFixed(1)}%/年` : '') +
      (h.upkeep ? ` · 维护 ${(h.upkeep * 100).toFixed(1)}%/年` : ' · 无维护费') +
      (h.cha ? ` · 魅力 ${h.cha > 0 ? '+' : ''}${h.cha}` : '') +
      (h.net ? ` · 人脉 +${h.net}` : '') +
      ` · ${h.jeonse ? '전세 押金制（退租返还）' : '可贷款'}`;
    const buttons = h.jeonse
      ? `<button class="btn small" onclick="uiBuyHouse('${h.id}',1)">签约入住</button>`
      : `<button class="btn small" onclick="uiBuyHouse('${h.id}',0.3)">首付 30% · ${fmtMoney(unit * 0.3)}</button>
         <button class="btn small" onclick="uiBuyHouse('${h.id}',0.5)">首付 50% · ${fmtMoney(unit * 0.5)}</button>
         <button class="btn small primary" onclick="uiBuyHouse('${h.id}',1)">全款 ${fmtMoney(unit)}</button>`;
    html += `<div class="mk-item">
      <div class="mk-top"><span class="mk-name">${esc(h.name)}${h.tag ? `<span class="mk-tag">${esc(h.tag)}</span>` : ''}</span><span class="mk-price">${fmtMoney(unit)}</span></div>
      <div class="mk-desc">${esc(h.desc)}</div>
      <div class="mk-meta">${meta}${h.jeonse ? '' : ` · 贷款年息 ${(rate * 100).toFixed(1)}%`}</div>
      <div class="mk-btns">${buttons}</div>
    </div>`;
  });
  return html || '<div class="mk-empty">这一年还没有可交易的房产。</div>';
}

function renderCarTab() {
  const y = fmtYear(STATE);
  let html = `<div class="mk-note">车是消耗品：每年折旧，还要保险与保养。它给的是魅力、人脉，以及别人看你的眼神。</div>`;
  CARS.forEach(c => {
    if (y < c.minYear) return;
    const unit = carPrice(STATE, c);
    html += `<div class="mk-item">
      <div class="mk-top"><span class="mk-name">${esc(c.name)}</span><span class="mk-price">${fmtMoney(unit)}</span></div>
      <div class="mk-desc">${esc(c.desc)}</div>
      <div class="mk-meta">年折旧 ${(c.dep * 100).toFixed(0)}% · 年养车 ${(c.upkeep * 100).toFixed(0)}% · 魅力 ${c.cha > 0 ? '+' : ''}${c.cha}` +
      (c.net ? ` · 人脉 +${c.net}` : '') + `</div>
      <div class="mk-btns">
        <button class="btn small" onclick="uiBuyCar('${c.id}',0.3)">首付 30% · ${fmtMoney(unit * 0.3)}</button>
        <button class="btn small primary" onclick="uiBuyCar('${c.id}',1)">全款 ${fmtMoney(unit)}</button>
      </div></div>`;
  });
  return html || '<div class="mk-empty">这一年还没有可买的车。</div>';
}

function renderGoodTab() {
  const y = fmtYear(STATE);
  let html = `<div class="mk-note">金条、土地、名表、商铺经营权……有些涨得慢，有些能把人送上天或者送进地下室。</div>`;
  GOODS.forEach(g => {
    if (y < g.minYear) return;
    const unit = goodPrice(STATE, g);
    const meta = `年化 ${(g.growth * 100).toFixed(1)}% · 波动 ${(g.vol * 100).toFixed(0)}%` +
      (g.rent ? ` · 收益 ${(g.rent * 100).toFixed(1)}%/年` : '') +
      (g.upkeep ? ` · 维护 ${(g.upkeep * 100).toFixed(1)}%/年` : '') +
      (g.cha ? ` · 魅力 +${g.cha}` : '') + (g.net ? ` · 人脉 +${g.net}` : '') +
      (g.safe ? ' · 保本' : '') + (g.tag ? ` · ${esc(g.tag)}` : '');
    html += `<div class="mk-item">
      <div class="mk-top"><span class="mk-name">${esc(g.name)}${g.tag ? `<span class="mk-tag">${esc(g.tag)}</span>` : ''}</span><span class="mk-price">${fmtMoney(unit)}</span></div>
      <div class="mk-desc">${esc(g.desc)}</div>
      <div class="mk-meta">${meta}</div>
      <div class="mk-btns">
        <button class="btn small" onclick="uiBuyGood('${g.id}',1)">买入 ×1</button>
        <button class="btn small" onclick="uiBuyGood('${g.id}',5)">买入 ×5 · ${fmtMoney(unit * 5)}</button>
      </div></div>`;
  });
  return html || '<div class="mk-empty">这一年还没有可买的资产。</div>';
}

function sparkline(hist) {
  if (!hist || hist.length < 2) return '';
  const min = Math.min.apply(null, hist), max = Math.max.apply(null, hist);
  const span = (max - min) || 1;
  return `<div class="spark">` + hist.map(p => {
    const h = 4 + Math.round((p - min) / span * 16);
    return `<i style="height:${h}px"></i>`;
  }).join('') + `</div>`;
}

function renderStockTab() {
  const m = marketMigrate(STATE);
  const y = fmtYear(STATE);
  const shock = STOCK_SHOCKS[y];
  let html = '';
  if (shock) {
    html += `<div class="mk-alert ${shock.k >= 0 ? 'up' : 'down'}">${y}년 ${esc(shock.t)} — ${esc(shock.d)}</div>`;
  }
  html += `<div class="mk-note">买股票前先看一眼年份。1997、2000、2008、2020 都有名字，也有尸体。</div>`;
  STOCKS.forEach(s => {
    if (y < s.minYear) return;
    const p = m.prices[s.id];
    const prev = m.prev[s.id] || p;
    const chg = prev ? (p / prev - 1) : 0;
    const pos = m.stocks.find(x => x.id === s.id);
    const cls = chg >= 0 ? 'up' : 'down';
    html += `<div class="mk-item stock">
      <div class="mk-top">
        <span class="mk-name">${esc(s.name)} <span class="mk-code">${s.code}</span></span>
        <span class="mk-price ${cls}">${fmtMoney(p)} <small>${chg >= 0 ? '+' : ''}${(chg * 100).toFixed(1)}%</small></span>
      </div>
      <div class="mk-desc">${esc(s.desc)}</div>
      <div class="mk-meta">${esc(s.sector)} · 年化 ${(s.growth * 100).toFixed(1)}% · 波动 ${(s.vol * 100).toFixed(0)}%` +
      (s.div ? ` · 分红 ${(s.div * 100).toFixed(1)}%` : '') +
      (pos ? ` · 持有 ${pos.shares}주（市值 ${fmtMoney(pos.shares * p)}）` : '') + `</div>
      ${sparkline(m.hist[s.id])}
      <div class="mk-btns">
        <button class="btn small" onclick="uiBuyStock('${s.id}',10)">买 10주 · ${fmtMoney(p * 10)}</button>
        <button class="btn small" onclick="uiBuyStock('${s.id}',100)">买 100주 · ${fmtMoney(p * 100)}</button>
        <button class="btn small" onclick="uiBuyStock('${s.id}',0)">全押买入</button>
        ${pos ? `<button class="btn small" onclick="uiSellStock('${s.id}',0.5)">卖一半</button>
                  <button class="btn small warn" onclick="uiSellStock('${s.id}',1)">清仓</button>` : ''}
      </div></div>`;
  });
  return html || '<div class="mk-empty">这一年还没有可交易的股票。</div>';
}

function renderHoldTab() {
  const m = marketMigrate(STATE);
  let html = `<div class="mk-note">持有是要付代价的：房产要维护费和利息，车每年折旧。右下角可卖出或还贷。</div>`;
  if (!m.props.length && !m.stocks.length) return html + '<div class="mk-empty">你名下还没有任何资产。</div>';
  m.props.forEach(p => {
    const ref = propRef(p);
    const gain = p.buyPrice ? (p.value - p.buyPrice) / p.buyPrice : 0;
    const cls = gain >= 0 ? 'up' : 'down';
    const fee = Math.round(p.value * MARKET_META.propTax);
    const net = p.value - fee - p.loan;
    html += `<div class="mk-item hold">
      <div class="mk-top"><span class="mk-name">${esc(p.name)}${p.qty > 1 ? ' ×' + p.qty : ''}</span>
        <span class="mk-price ${cls}">${fmtMoney(p.value)} <small>${gain >= 0 ? '+' : ''}${(gain * 100).toFixed(0)}%</small></span></div>
      <div class="mk-meta">${p.buyYear}년 买入 · 成本 ${fmtMoney(p.buyPrice)}` +
      (p.loan > 0 ? ` · 剩余贷款 ${fmtMoney(p.loan)}` : '') +
      (ref && ref.rent ? ` · 年租金 ${fmtMoney(p.value * ref.rent)}` : '') +
      (ref && ref.upkeep ? ` · 年维护 ${fmtMoney(p.value * ref.upkeep)}` : '') + `</div>
      <div class="mk-btns"><button class="btn small warn" onclick="uiSellProp(${p.uid})">卖出 · 到手 ${fmtMoney(net)}</button></div>
    </div>`;
  });
  m.stocks.forEach(pos => {
    const s = STOCKS.find(x => x.id === pos.id);
    if (!s) return;
    const p = m.prices[pos.id];
    const val = pos.shares * p;
    const gain = pos.cost ? (val - pos.cost) / pos.cost : 0;
    const cls = gain >= 0 ? 'up' : 'down';
    html += `<div class="mk-item hold">
      <div class="mk-top"><span class="mk-name">${esc(s.name)}</span>
        <span class="mk-price ${cls}">${fmtMoney(val)} <small>${gain >= 0 ? '+' : ''}${(gain * 100).toFixed(0)}%</small></span></div>
      <div class="mk-meta">${pos.shares}주 · 成本 ${fmtMoney(pos.cost)} · 现价 ${fmtMoney(p)}</div>
      <div class="mk-btns">
        <button class="btn small" onclick="uiSellStock('${pos.id}',0.5)">卖一半</button>
        <button class="btn small warn" onclick="uiSellStock('${pos.id}',1)">清仓</button>
      </div></div>`;
  });
  if (m.debt > 0) {
    html += `<div class="mk-item debt-box">
      <div class="mk-top"><span class="mk-name">대출 贷款总额</span><span class="mk-price">-${fmtMoney(m.debt)}</span></div>
      <div class="mk-meta">年利率 ${(rateAt(fmtYear(STATE)) * 100).toFixed(1)}% · 每年利息 ${fmtMoney(m.debt * rateAt(fmtYear(STATE)))}</div>
      <div class="mk-btns">
        <button class="btn small" onclick="uiRepay(0.25)">还 25%</button>
        <button class="btn small" onclick="uiRepay(1)">全部还清</button>
      </div></div>`;
  }
  return html;
}

/* ---------- 交易动作 ---------- */
function afterTrade(res) {
  if (res && res.ok === false) toast(res.msg || '操作失败');
  else if (res && res.ok) toast('成交');
  renderMarket();
  renderStats();
  renderStream();
  autosave();
}
function uiBuyHouse(id, ratio) { afterTrade(buyProp(STATE, 'house', id, ratio, 1)); }
function uiBuyCar(id, ratio) { afterTrade(buyProp(STATE, 'car', id, ratio, 1)); }
function uiBuyGood(id, qty) { afterTrade(buyProp(STATE, 'good', id, 1, qty)); }
function uiSellProp(uid) { afterTrade(sellProp(STATE, uid)); }
function uiRepay(r) { afterTrade(repayDebt(STATE, Math.round((STATE.market.debt || 0) * r))); }
function uiBuyStock(id, n) {
  const p = STATE.market.prices[id];
  let shares = n;
  if (!n) shares = Math.floor(STATE.stats.MONEY / (p * (1 + MARKET_META.stockFee)));
  afterTrade(buyStock(STATE, id, shares));
}
function uiSellStock(id, r) {
  const pos = STATE.market.stocks.find(x => x.id === id);
  if (!pos) return;
  afterTrade(sellStock(STATE, id, r >= 1 ? pos.shares : Math.floor(pos.shares * r)));
}

/* ---------- 初始化 ---------- */
function init() {
  renderTitle();
  showScreen('screen-title');
  $('btnNew').onclick = startCreate;
  $('btnContinue').onclick = () => {
    STATE = loadAuto();
    if (!STATE) { toast('没有可继续的存档'); return; }
    enterGame();
  };
  $('btnSaves').onclick = openModal;
  $('btnHow').onclick = () => { $('howBox').classList.toggle('open'); };
  $('btnBackTitle').onclick = () => { renderTitle(); showScreen('screen-title'); };
  $('btnReroll').onclick = rerollTalents;
  $('btnStart').onclick = confirmCreate;
  $('btnBackFromCreate').onclick = () => { renderTitle(); showScreen('screen-title'); };
  $('btnMarket').onclick = openMarket;
  $('btnMarketBack').onclick = backToGame;
  document.querySelectorAll('.mtab').forEach(b => {
    b.onclick = () => { MARKET_TAB = b.dataset.tab; renderMarket(); };
  });
  $('btnSaveGame').onclick = () => { autosave(); toast('已自动保存到本机缓存'); };
  $('btnSaves2').onclick = openModal;
  $('btnRestart').onclick = () => {
    if (confirm('放弃当前人生，重新开始？')) { localStorage.removeItem(LS.auto); STATE = null; renderTitle(); showScreen('screen-title'); }
  };
  $('modalClose').onclick = closeModal;
  $('btnExport').onclick = exportSave;
  $('btnImport').onclick = importSave;
  $('btnAgain').onclick = () => { startCreate(); };
  $('btnEndTitle').onclick = () => { renderTitle(); showScreen('screen-title'); };
  document.querySelectorAll('[name=gender]').forEach(r => r.onchange = () => { });
  // 键盘：空格/回车推进
  document.addEventListener('keydown', e => {
    if (!$('screen-game').classList.contains('active')) return;
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
    if (e.code === 'Space' || e.code === 'Enter') {
      const btns = $('actions').querySelectorAll('button:not([disabled])');
      if (btns.length === 1) { e.preventDefault(); btns[0].click(); }
    }
  });
}
document.addEventListener('DOMContentLoaded', init);
