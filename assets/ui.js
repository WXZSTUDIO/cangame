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
  ['screen-title', 'screen-create', 'screen-game', 'screen-end'].forEach(s => {
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
  rbox.innerHTML = `
    <div class="res"><span>나이 年龄</span><b>${STATE.age}세 · ${fmtYear(STATE)}년</b></div>
    <div class="res"><span>신분 身份</span><b>${esc(STATE.job || defaultJob(STATE.age))}</b></div>
    <div class="res money"><span>자산 资产</span><b>${fmtMoney(s.MONEY)}</b></div>
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
    const btns = (ev.choices || []).map((c, i) =>
      `<button class="btn choice" onclick="choose(${i})">${esc(c.text)}</button>`).join('');
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
    <div><span>最终资产</span><b>${fmtMoney(s.MONEY)}</b></div>
    <div><span>巅峰资产</span><b>${fmtMoney(STATE.peak.MONEY)}</b></div>
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
