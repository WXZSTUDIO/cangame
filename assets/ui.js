/* =========================================================
 * CANGAME · UI 层（含存档）
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
let CONFIRM_CB = null;
let TALENT_ALL = false;   // 天赋面板：是否浏览全部
let SHOW_MORE_STATS = false; // 属性条：是否展开次要属性
let LAST_ACH = 0;            // 上一次渲染时的成就数（用于弹徽章）

/* ---------- 通用确认弹窗（求学 vs 工作这类互斥选择用） ---------- */
function uiConfirm(title, body, okText, cb) {
  CONFIRM_CB = cb;
  const box = $('confirmBox');
  if (!box) { if (cb) cb(); return; }
  $('confirmTitle').textContent = title;
  $('confirmBody').innerHTML = body;
  $('confirmOk').textContent = okText || '确定';
  box.classList.add('open');
}
function uiConfirmOk() {
  const box = $('confirmBox');
  if (box) box.classList.remove('open');
  const cb = CONFIRM_CB; CONFIRM_CB = null;
  if (cb) cb();
}
function uiConfirmNo() {
  const box = $('confirmBox');
  if (box) box.classList.remove('open');
  CONFIRM_CB = null;
}

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

/* ---------- 崩溃兜底：任何脚本错误都要看得见，不能「点了没反应」 ---------- */
function showCrash(msg) {
  const el = document.getElementById('crash');
  const text = '⚠️ 脚本出错了：' + msg + '　请刷新页面；若反复出现，请清空浏览器缓存后再试。';
  if (el) { el.textContent = text; el.classList.add('show'); }
  try { console.error('[cangame] ' + msg); } catch (e) { }
}
window.addEventListener('error', e => showCrash(e.message || 'unknown error'));
window.addEventListener('unhandledrejection', e => showCrash(String(e.reason)));

/* ---------- 通用 UI ---------- */
function $(id) { return document.getElementById(id); }
/* 容错绑定：单个元素缺失不再导致后续所有按钮失效 */
function bind(id, fn) {
  const el = $(id);
  if (!el) { try { console.warn('[cangame] 缺少元素 #' + id); } catch (e) { } return; }
  try { el.onclick = fn; } catch (e) { showCrash(e.message); }
}
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
  document.body.dataset.screen = id;
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
    btn.innerHTML = `继续人生 <span class="sub">${save.name} · ${(save.startYear || START_YEAR) + save.age} 年 · ${save.age}岁 · ${fmtMoney(save.stats.MONEY)}</span>`;
  } else {
    btn.style.display = 'none';
  }
}

/* ---------- 创建角色 ---------- */
function startCreate() {
  TALENT_POOL = rollTalents(12);
  SELECTED = [];
  CREATE_POINTS = 10;
  TALENT_ALL = false;
  const ta = $('btnTalentAll'); if (ta) ta.textContent = '📖 浏览全部';
  const tq = $('talentSearch'); if (tq) tq.value = '';
  const pref = lsGet(LS.pref) || {};
  $('inputName').value = pref.name || randomName(pref.gender || 'M');
  document.querySelectorAll('[name=gender]').forEach(r => r.checked = (r.value === (pref.gender || 'M')));
  renderFamilies();
  renderTalents();
  renderPriorities();
  showScreen('screen-create');
}

function randomName(gender) {
  return randomKoreanName(gender || (document.querySelector('[name=gender]:checked') || {}).value || 'M');
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
      document.querySelectorAll('#familyList .fam').forEach(x => x.classList.remove('sel'));
      d.classList.add('sel');
      d.dataset.sel = '1';
      wrap.dataset.pick = f.id;
    };
    wrap.appendChild(d);
  });
  wrap.dataset.pick = FAMILIES[0].id;
  wrap.firstChild.classList.add('sel');
}

function renderPriorities() {
  const wrap = $('priorityList');
  wrap.innerHTML = '';
  PRIORITIES.forEach(p => {
    const d = document.createElement('div');
    d.className = 'fam';
    d.innerHTML = `<div class="fam-name">${esc(p.name)}</div><div class="fam-desc">${esc(p.desc)}</div>`;
    d.onclick = () => {
      wrap.querySelectorAll('.fam').forEach(x => x.classList.remove('sel'));
      d.classList.add('sel');
      wrap.dataset.pick = p.key;
    };
    wrap.appendChild(d);
  });
  wrap.dataset.pick = PRIORITIES[0].key;
  wrap.firstChild.classList.add('sel');
}

function renderTalents() {
  const wrap = $('talentList');
  wrap.innerHTML = '';
  const q = (($('talentSearch') || {}).value || '').trim();
  let list;
  if (TALENT_ALL) {
    list = TALENTS.slice();
    if (q) {
      list = list.filter(t => (t.name || '').indexOf(q) >= 0 || (t.desc || '').indexOf(q) >= 0 || (t.tag || '').indexOf(q) >= 0);
    } else {
      // 没搜索词时按标签分组排一遍，看起来整齐
      const order = ['核心', '脑力', '体魄', '心性', '人际', '财运', '才华', '背景', '负面'];
      list = list.slice().sort((a, b) => (order.indexOf(a.tag || '') + 1 || 99) - (order.indexOf(b.tag || '') + 1 || 99));
    }
  } else {
    list = TALENT_POOL.filter(t => !q || (t.name || '').indexOf(q) >= 0 || (t.desc || '').indexOf(q) >= 0 || (t.tag || '').indexOf(q) >= 0);
  }
  const hint = $('talentHint');
  if (hint) {
    hint.innerHTML = TALENT_ALL
      ? `全部 ${TALENTS.length} 种天赋${q ? ` · 匹配「${esc(q)}」${list.length} 种` : ' · 按类别排序，可用搜索框过滤'}`
      : `随机抽出 ${TALENT_POOL.length} 种（共 ${TALENTS.length} 种可选）${q ? ` · 匹配「${esc(q)}」${list.length} 种` : ''}`;
  }
  list.forEach(t => {
    const d = document.createElement('div');
    const sel = SELECTED.indexOf(t.id) >= 0;
    const afford = sel || (CREATE_POINTS - t.cost) >= 0;
    d.className = 'talent' + (sel ? ' sel' : '') + (afford ? '' : ' no');
    const costTxt = t.cost > 0 ? `消耗 ${t.cost} 点` : (t.cost < 0 ? `返还 ${-t.cost} 点` : '免费');
    d.innerHTML = `<div class="t-head"><span class="t-name">${t.tag ? `<i class="t-tag">${esc(t.tag)}</i>` : ''}${esc(t.name)}</span><span class="t-cost">${costTxt}</span></div>` +
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
  if (!list.length) wrap.innerHTML = `<div class="rel-empty">没有匹配「${esc(q)}」的天赋。</div>`;
  $('points').textContent = CREATE_POINTS;
}

function rerollTalents() {
  TALENT_POOL = rollTalents(12);
  SELECTED = [];
  CREATE_POINTS = 10;
  renderTalents();
  toast('已重新抽取天赋');
}

function confirmCreate() {
  const name = ($('inputName').value || '').trim() || randomName();
  const gender = (document.querySelector('[name=gender]:checked') || {}).value || 'M';
  const familyId = $('familyList').dataset.pick || FAMILIES[0].id;
  const priority = $('priorityList').dataset.pick || 'balance';
  lsSet(LS.pref, { name, gender });
  STATE = createGame({ name, gender, familyId, priority, talents: SELECTED.slice() });
  autosave();
  enterGame();
}

function rerollName() {
  const gender = (document.querySelector('[name=gender]:checked') || {}).value || 'M';
  $('inputName').value = randomName(gender);
  toast('已随机一个名字');
}

/* ---------- 游戏页 ---------- */
let GAME_VIEW = 'main'; // main | job | rel
let REL_TAB = 'family'; // family | friends

function enterGame() {
  if (STATE) { marketMigrate(STATE); migrateState(STATE); }
  showScreen('screen-game');
  if (STATE.finished && STATE.ending) { renderEnd(); return; }
  showGameView('main');
  renderStats();
  renderStream();
  // 恢复当前待展示内容
  if (STATE.pending) renderItem(STATE.pending);
  else renderIdle();
}

function ageAvatar(age, gender) {
  if (age <= 6) return '👶';
  if (age <= 12) return gender === 'F' ? '👧' : '👦';
  if (age <= 18) return gender === 'F' ? '👩' : '🧑';
  if (age <= 59) return gender === 'F' ? '👩‍💼' : '👨‍💼';
  return gender === 'F' ? '👵' : '👴';
}

function renderStats() {
  const s = STATE.stats;
  $('hudAvatar').textContent = ageAvatar(STATE.age, STATE.gender);
  $('hudName').textContent = `${STATE.name} · ${STATE.gender === 'M' ? '男' : '女'} · ${STATE.familyName.split(' ')[0]}`;
  $('hudAge').textContent = `${STATE.age} / ${END_AGE}岁 · ${fmtYear(STATE)} 年 · ${STATE.job || defaultJob(STATE.age)}`;
  $('hudCash').textContent = fmtMoney(s.MONEY);
  $('hudWorth').textContent = fmtMoney(netWorth(STATE));

  // 属性条：只露 6 项核心属性，次要的点「＋更多」展开
  const chip = (st) => {
    const v = Math.round(s[st.key] === undefined ? 60 : s[st.key]);
    const bad = st.warn ? !!st.warn(v) : false;
    return `<span class="m ${bad ? 'bad' : ''}" title="${esc(st.hint || st.name)}"><i>${st.name}</i><b>${v}</b></span>`;
  };
  let stripHtml = (typeof CORE_STATS !== 'undefined' ? CORE_STATS : []).map(chip).join('');
  if (SHOW_MORE_STATS) {
    stripHtml += `<span class="m-sep"></span>` +
      (typeof MORE_STATS !== 'undefined' ? MORE_STATS : []).map(chip).join('');
  }
  stripHtml += `<span class="m more" onclick="toggleMoreStats()">${SHOW_MORE_STATS ? '− 收起' : '＋ 更多'}</span>`;
  $('metricStrip').innerHTML = stripHtml;

  // 新解锁的成就弹一下徽章
  const nAch = (STATE.achievements || []).length;
  if (nAch > LAST_ACH && typeof ACHIEVEMENTS !== 'undefined') {
    const a = ACHIEVEMENTS.find(x => x.id === STATE.achievements[nAch - 1]);
    if (a) toast(`🏅 成就 · ${a.icon} ${a.name}`);
  }
  LAST_ACH = nAch;

  const tags = [];
  const edu = STATE.edu || {};
  if (edu.uni && edu.uni !== 'u_fail') {
    const u = UNIVERSITIES.find(x => x.id === edu.uni);
    if (u) tags.push('🎓 ' + u.name + (edu.major ? ' · ' + edu.major : ''));
  } else if (edu.hs) {
    const h = HIGH_SCHOOLS.find(x => x.id === edu.hs);
    if (h) tags.push('🏫 ' + h.name);
  }
  if (edu.mid != null) tags.push('中考 ' + edu.mid + '分');
  if (edu.gao != null) tags.push('高考 ' + edu.gao + '分');
  if (STATE.career) tags.push('💼 ' + STATE.job);
  if (STATE.flags.past_life) tags.push('前世记忆');
  if (STATE.flags.ambition) tags.push('燃烧的野心');
  if (STATE.flags.gangnam_owner) tags.push('有房业主');
  if (STATE.flags.dating) tags.push('恋爱中');
  if (STATE.flags.married) tags.push('已婚');
  if (STATE.flags.widowed) tags.push('丧偶');
  if (!STATE.flags.parents_alive) tags.push('丧亲');
  if (STATE.childCount) tags.push('子女 ' + STATE.childCount + ' 人');
  if (STATE.grandCount) tags.push('孙辈 ' + STATE.grandCount + ' 人');
  if (STATE.age < 18) tags.push('未成年（家庭负担）');
  if (!STATE.flags.orphan && (STATE.family && STATE.family.debt > 0)) tags.push(`家里欠 ${fmtMoney(STATE.family.debt)}`);
  if (STATE.ill) tags.push(`⚠ 生病：${STATE.ill.name}（${illStageCn(STATE.ill.stage)}·${STATE.ill.years || 0}年）`);
  if (STATE.achievements && STATE.achievements.length) tags.push(`🏅 成就 ${STATE.achievements.length}/${(typeof ACHIEVEMENTS !== 'undefined' ? ACHIEVEMENTS.length : 0)}`);
  if (loanTotal(STATE) > 0) tags.push('欠款中');
  if (STATE.credit != null && STATE.credit < 60) tags.push('征信不良');
  if (STATE.grief) tags.push('悲伤中：' + STATE.grief.reason);
  if (STATE.pet && STATE.pet.alive) tags.push(STATE.pet.type === 'cat' ? '宠物猫' : '宠物狗');
  $('tagList').innerHTML = tags.map(t => `<span class="tag">${esc(t)}</span>`).join('');
}

/* =========================================================
 * 韩式证件照头像：同一个人一辈子是同一张脸，但会随着年龄变化
 * seed 由名字推导，所以不需要改存档
 * ========================================================= */
function hashStr(s) {
  let h = 2166136261;
  s = String(s || '?');
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0);
}

function portraitSVG(name, gender, age, opt) {
  opt = opt || {};
  const h = hashStr(name + '|' + (gender || 'X'));
  const age0 = typeof age === 'number' ? age : 20;
  const SKIN = ['#FADFC8', '#F5CFAE', '#EDBC95', '#DDA87C', '#C9905F', '#F2D6B8'];
  const HAIR = ['#241C16', '#3A2A1E', '#5B3A21', '#7A4A22', '#171412', '#8E5A2A', '#4A3B2E'];
  const CLOTH = ['#7DCAF6', '#A293FF', '#FFBBF4', '#00917A', '#F47575', '#FFDA57', '#2B3A55', '#E8E2D4'];
  const BG = ['#FFE9C7', '#DDF1FF', '#F4E4FF', '#FFE1F5', '#E4F5EC', '#FFE0E0', '#FFF6D6'];
  const skin = SKIN[h % SKIN.length];
  const hair = (age0 >= 58) ? '#CFCBC4' : HAIR[(h >> 3) % HAIR.length];
  const hair2 = (age0 >= 58) ? '#B9B5AE' : hair;
  const cloth = CLOTH[(h >> 6) % CLOTH.length];
  const bg = BG[(h >> 9) % BG.length];
  const hairStyle = (opt.forceStyle != null) ? opt.forceStyle : (h % 5);
  const isF = String(gender).toUpperCase() === 'F';
  const kid = age0 < 13;
  const old = age0 >= 58;
  const elder = age0 >= 72;
  const glasses = ((h >> 5) % 6 === 0) || old;
  const blush = kid || age0 < 20;

  // 头身比：小孩头大，成年人正常
  const rx = kid ? 27 : 25;
  const ry = kid ? 30 : 29;
  const cy = kid ? 50 : 48;
  const cx = 50;

  let hairShape = '';
  if (hairStyle === 0) {           // 短发
    hairShape = `<path d="M${cx - rx - 1},${cy - 2} a${rx + 1},${ry} 0 0 1 ${(rx + 1) * 2},0 l0,-4 a${rx + 1},${ry + 3} 0 0 0 -${(rx + 1) * 2},0 z" fill="${hair}"/>` +
      `<path d="M${cx - rx},${cy - 10} q${rx},-26 ${rx * 2},0 q-${rx},-14 -${rx * 2},0 z" fill="${hair}"/>`;
  } else if (hairStyle === 1) {    // 长发
    hairShape = `<ellipse cx="${cx}" cy="${cy + 6}" rx="${rx + 5}" ry="${ry + 8}" fill="${hair2}"/>` +
      `<path d="M${cx - rx},${cy - 8} q${rx},-28 ${rx * 2},0 q-${rx},-16 -${rx * 2},0 z" fill="${hair}"/>`;
  } else if (hairStyle === 2) {    // 丸子头
    hairShape = `<circle cx="${cx}" cy="${cy - ry - 5}" r="8" fill="${hair2}"/>` +
      `<path d="M${cx - rx},${cy - 8} q${rx},-28 ${rx * 2},0 q-${rx},-16 -${rx * 2},0 z" fill="${hair}"/>`;
  } else if (hairStyle === 3) {    // 齐刘海
    hairShape = `<path d="M${cx - rx - 1},${cy - 6} q0,-30 ${rx + 1},-30 q${rx + 1},0 ${rx + 1},30 q-${rx + 4},-8 -${rx * 2 - 4},4 z" fill="${hair}"/>` +
      `<rect x="${cx - rx - 1}" y="${cy - 26}" width="${(rx + 1) * 2}" height="12" rx="6" fill="${hair}"/>`;
  } else {                          // 寸头 / 背头
    hairShape = `<path d="M${cx - rx - 1},${cy - 4} q0,-32 ${rx + 1},-32 q${rx + 1},0 ${rx + 1},32 q-${rx},-12 -${rx * 2},0 z" fill="${hair}"/>`;
  }

  // 眉眼：年纪越大，眉越垂、眼越细
  const eyeY = cy + 2;
  const eyeDx = 10;
  const eyeR = old ? 1.7 : 2.4;
  const browY = cy - 8;
  const eyes = `<circle cx="${cx - eyeDx}" cy="${eyeY}" r="${eyeR}" fill="#20190F"/>
    <circle cx="${cx + eyeDx}" cy="${eyeY}" r="${eyeR}" fill="#20190F"/>`;
  const brows = `<path d="M${cx - eyeDx - 5},${browY} q5,${old ? 3 : -2} 10,0" stroke="${hair2}" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M${cx + eyeDx - 5},${browY} q5,${old ? 3 : -2} 10,0" stroke="${hair2}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  const mouth = old
    ? `<path d="M${cx - 7},${cy + 17} q7,-3 14,0" stroke="#A9785F" stroke-width="2" fill="none" stroke-linecap="round"/>`
    : `<path d="M${cx - 7},${cy + 15} q7,5 14,0" stroke="#B4634F" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
  const blushS = blush ? `<ellipse cx="${cx - 17}" cy="${cy + 9}" rx="5" ry="3" fill="#F79BA6" opacity=".45"/>
    <ellipse cx="${cx + 17}" cy="${cy + 9}" rx="5" ry="3" fill="#F79BA6" opacity=".45"/>` : '';
  const glass = glasses ? `<g stroke="#2B2B2B" stroke-width="1.6" fill="rgba(255,255,255,.28)">
      <circle cx="${cx - eyeDx}" cy="${eyeY}" r="7"/><circle cx="${cx + eyeDx}" cy="${eyeY}" r="7"/>
      <path d="M${cx - eyeDx + 7},${eyeY} h${(eyeDx - 7) * 2}" fill="none"/></g>` : '';
  const wrinkle = old ? `<g stroke="#B08C74" stroke-width="1.1" fill="none" opacity=".7">
      <path d="M${cx - 22},${eyeY - 1} q-3,-3 -6,-1"/><path d="M${cx + 22},${eyeY - 1} q3,-3 6,-1"/>
      <path d="M${cx - 12},${cy + 24} q12,3 24,0"/></g>` : '';
  const forehead = elder ? `<g stroke="#B08C74" stroke-width="1" fill="none" opacity=".55">
      <path d="M${cx - 14},${cy - 16} q14,-3 28,0"/></g>` : '';
  const earring = (isF && !kid && (h >> 7) % 3 === 0)
    ? `<circle cx="${cx - rx - 1}" cy="${cy + 12}" r="2.2" fill="#F2C744"/><circle cx="${cx + rx + 1}" cy="${cy + 12}" r="2.2" fill="#F2C744"/>` : '';

  return `<svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" aria-label="${esc(name || '')}">
    <rect width="100" height="100" fill="${bg}"/>
    <path d="M18,100 q0,-26 32,-26 q32,0 32,26 z" fill="${cloth}"/>
    <path d="M42,74 h16 v10 h-16 z" fill="${skin}"/>
    ${isF && !kid ? `<path d="M${cx - rx - 2},${cy - 6} q0,34 8,42 q-16,-4 -18,-42 z" fill="${hair2}"/><path d="M${cx + rx + 2},${cy - 6} q0,34 -8,42 q16,-4 18,-42 z" fill="${hair2}"/>` : ''}
    <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${skin}"/>
    ${hairShape}
    ${brows}${eyes}${glass}${blushS}${mouth}${wrinkle}${forehead}${earring}
  </svg>`;
}

/* 包装成可放进 rel-ava 的方块 */
function personAvatar(name, gender, age, cls, opt) {
  return `<span class="rel-ava pic ${cls || ''}">${portraitSVG(name, gender, age, opt)}</span>`;
}

/* ---------- 视图切换 ---------- */
function showGameView(v) {
  GAME_VIEW = v;
  $('view-main').style.display = v === 'main' ? '' : 'none';
  $('view-job').style.display = v === 'job' ? '' : 'none';
  $('view-rel').style.display = v === 'rel' ? '' : 'none';
  document.querySelectorAll('.dock-btn').forEach(b => b.classList.remove('active'));
  if (v === 'job') { $('dockJob').classList.add('active'); renderJobView(); }
  if (v === 'rel') { $('dockRel').classList.add('active'); renderRelView(); }
  syncDockBtn();
}

/* 中间那颗大钮：在人生界面是「下一年」，在别的界面是「返回人生」 */
function syncDockBtn() {
  const b = $('dockNext');
  if (!b) return;
  const home = (GAME_VIEW === 'main');
  const ic = b.querySelector('.d-ic');
  const tx = b.querySelector('.d-tx');
  if (ic) ic.textContent = home ? '▶' : '↩';
  if (tx) tx.textContent = home ? '下一年' : '返回人生';
  b.classList.toggle('back', !home);
}

/* ---------- 工作视图：职业与晋升 / 求职 / 贷款 / 相亲 ---------- */
function renderJobView() {
  const s = STATE.stats;
  const edu = STATE.edu || {};
  const c = STATE.career ? careerById(STATE.career.id) : null;
  const m = marketMigrate(STATE);
  const j = JOBS[STATE.job] || { salary: 0, cost: 12000000 };
  const income = STATE.career ? careerIncome(STATE) : Math.round(j.salary * (1 + s.INT / 400) * (1 + s.NET / 800));
  const cost = livingCost(STATE);

  // 当前职业卡
  let curHtml = '';
  if (c) {
    const lv = STATE.career.level;
    curHtml = c.ladder.map((l, i) => {
      const on = i === lv;
      const up = i < lv;
      return `<span class="step ${on ? 'on' : (up ? 'up' : '')}">${esc(l.title)}</span>`;
    }).join('<span class="arrow">›</span>');
  }
  const eduTxt = EDU_LEVELS[edu.eduLevel || 0];
  const promoTxt = c
    ? `在职 ${STATE.career.years} 年 · ${STATE.career.years >= CAREER_META.promoMinYears ? '今年可参与晋升评定' : `再干 ${CAREER_META.promoMinYears - STATE.career.years} 年才能评职级`}`
    : (STATE.age < 16 ? '还没到工作的年纪' : '目前没有正式职业');

  const talHtml = (STATE.talents || []).map(id => {
    const t = talentById(id);
    return t ? `<span class="tag">${esc(t.name)}</span>` : '';
  }).join('');

  // 求职列表
  let offerHtml = '';
  if (STATE.age >= CAREER_META.minWorkAge) {
    const offers = jobOffers(STATE);
    offers.sort((a, b) => (b.okEdu && b.okStat && b.okFlag ? 1 : 0) - (a.okEdu && a.okStat && a.okFlag ? 1 : 0));
    offerHtml = `<div class="job-sec">求职 · 按学历与能力筛选（学历：${esc(eduTxt)}）</div>
      <div class="offer-list">` + offers.map(o => {
      const ok = o.okEdu && o.okStat && o.okFlag;
      const reason = !o.okEdu ? `需 ${EDU_LEVELS[o.career.edu]}` : (!o.okStat ? o.miss : (!o.okFlag ? '缺少入行机缘' : ''));
      const sal0 = o.career.ladder[o.entry].sal;
      return `<div class="offer ${ok ? '' : 'no'}">
        <div class="of-top"><span class="of-name">${esc(o.career.name)}</span>
          <span class="of-sal">${ok ? '起步 ' + fmtMoney(sal0) + ' / 年' : esc(reason)}</span></div>
        <div class="of-desc">${esc(o.career.desc)}</div>
        <div class="of-meta">${esc(o.career.cat)} · 门槛 ${EDU_LEVELS[o.career.edu]} · ${o.career.ladder.length} 级职级${o.career.risk >= 2 ? ' · 风险较高' : ''}</div>
        ${ok ? `<button class="btn small primary" onclick="uiApplyJob('${o.career.id}')">应聘 · ${esc(o.title)}</button>` : ''}
      </div>`;
    }).join('') + `</div>`;
  }

  // 贷款
  const loans = STATE.loans || [];
  const prodHtml = loanProducts(STATE).map(x => {
    const can = x.avail && x.max > 0;
    return `<div class="offer ${can ? '' : 'no'}">
      <div class="of-top"><span class="of-name">${x.p.icon} ${esc(x.p.name)}</span>
        <span class="of-sal">${can ? '额度 ' + fmtMoney(x.max) : esc(x.why || '暂不可用')}</span></div>
      <div class="of-desc">${esc(x.p.desc)}</div>
      <div class="of-meta">年利率 ${(x.rate * 100).toFixed(1)}% · ${x.p.years} 年${x.p.danger >= 3 ? ' · ⚠ 高危' : ''}</div>
      ${can ? `<div class="of-btns">
        <button class="btn small" onclick="uiBorrow('${x.p.id}',${Math.round(x.max * 0.3)})">借 30%</button>
        <button class="btn small" onclick="uiBorrow('${x.p.id}',${Math.round(x.max * 0.6)})">借 60%</button>
        <button class="btn small ${x.p.danger >= 3 ? 'warn' : 'primary'}" onclick="uiBorrow('${x.p.id}',${x.max})">借满</button>
      </div>` : ''}
    </div>`;
  }).join('');
  const myLoanHtml = loans.length
    ? loans.map((l, i) => `<div class="offer hold">
        <div class="of-top"><span class="of-name">${l.icon || '💰'} ${esc(l.name)}</span>
          <span class="of-sal">-${fmtMoney(l.left)}</span></div>
        <div class="of-meta">${l.startYear} 年借入 · 年息 ${(l.rate * 100).toFixed(1)}% · 每年约还 ${fmtMoney(annualPayment(l))}${l.overdue ? ' · ⚠ 逾期 ' + l.overdue + ' 次' : ''}</div>
        <div class="of-btns">
          <button class="btn small" onclick="uiRepayLoan(${i},${Math.round(l.left * 0.3)})">还 30%</button>
          <button class="btn small primary" onclick="uiRepayLoan(${i},${l.left})">一次还清</button>
        </div></div>`).join('')
    : '<div class="job-sub">你名下没有贷款。</div>';

  const fin = STATE.family || { assets: 0, debt: 0 };
  const famDebt = Math.round(fin.debt || 0);
  const scale = (typeof tableAt === 'function') ? tableAt(FIN_SCALE, fmtYear(STATE)) : 1;
  const lotCost = Math.round(LOTTERY.cost * scale);
  const famHtml = STATE.flags.orphan
    ? `<div class="job-sec">家庭账簿</div><div class="job-sub">你在福利院长大，没有一本属于父母的账簿。</div>`
    : `<div class="job-sec">家庭账簿 · ${fmtYear(STATE)} 年</div>
       <div class="job-grid">
         <div class="job-cell"><i>家庭年收入</i><b>${fmtMoney(fin.income || 0)}</b></div>
         <div class="job-cell"><i>家庭年支出</i><b>${fmtMoney(fin.spend || 0)}</b></div>
         <div class="job-cell"><i>家庭资产</i><b>${fmtMoney(fin.assets || 0)}</b></div>
         <div class="job-cell"><i>家庭负债</i><b style="color:${famDebt > 0 ? 'var(--red)' : 'inherit'}">${famDebt > 0 ? '-' + fmtMoney(famDebt) : '—'}</b></div>
         <div class="job-cell"><i>今年结余</i><b style="color:${(fin.delta || 0) < 0 ? 'var(--red)' : 'inherit'}">${(fin.delta || 0) >= 0 ? '+' : ''}${fmtMoney(fin.delta || 0)}</b></div>
         <div class="job-cell"><i>今年还债</i><b>${fmtMoney(fin.repaid || 0)}</b></div>
         <div class="job-cell"><i>父亲 / 母亲</i><b>${parentStatus(STATE, 'father')} / ${parentStatus(STATE, 'mother')}</b></div>
         <div class="job-cell"><i>继承状态</i><b>${STATE.flags.inherit_full ? '全额继承' : (STATE.flags.inherit_limited ? '限定继承' : (STATE.flags.inherit_none ? '已放弃继承' : '未发生'))}</b></div>
       </div>
       ${fin.act && fin.actYear === STATE.age ? `<div class="job-sub" style="margin-top:8px">今年家里：${esc(fin.act.text)}</div>` : ''}
       ${STATE.age < 18 ? `<div class="job-sub" style="margin-top:8px">未成年：生活与学费由家里承担，你不用操心钱，也不用背债。18岁起才开始自己记账。</div>` : ''}`;

  // 健康 / 就医
  const ill = STATE.ill;
  const illRef = ill ? (ILLNESS.find(x => x.id === ill.id) || ILLNESS[0]) : null;
  const cClinic = ill ? illTreatCost(STATE, illRef, ill.stage, 'clinic') : 0;
  const cHosp = ill ? illTreatCost(STATE, illRef, ill.stage, 'hospital') : 0;
  const healthHtml = `<div class="job-card">
    <div class="job-sec">🩺 身体</div>
    ${ill
      ? `<div class="job-sub ill-name">${esc(ill.name)} · ${illStageCn(ill.stage)} · 已经拖了 ${ill.years || 0} 年</div>
         <div class="job-sub">${esc(illRef.desc)}不治会逐年加重：初期 → 中期 → 重度 → 危重，到危重就可能直接带走你。</div>
         <div class="of-btns" style="margin-top:8px">
           <button class="btn small" onclick="uiTreat('clinic')">去诊所 · ${fmtMoney(cClinic)}</button>
           <button class="btn small primary" onclick="uiTreat('hospital')">住院治疗 · ${fmtMoney(cHosp)}</button>
         </div>`
      : `<div class="job-sub">目前没有病。健康 ${Math.round(s.HP)} · 压力 ${Math.round(s.STRESS)}。<br>健康低于 55 就容易被病找上门；一旦得病要尽快治，拖到危重就晚了。</div>`}
  </div>`;

  // 彩票（一年一张）
  const canLot = STATE.lotteryYear !== STATE.age;
  const lotteryHtml = `<div class="job-card">
    <div class="job-sec">🎟 彩票</div>
    <div class="job-sub">一年一张，${fmtMoney(lotCost)}。中不中全看命——头奖概率千分之一。</div>
    <div class="of-btns" style="margin-top:8px">
      <button class="btn small primary" ${canLot ? '' : 'disabled'} onclick="uiLottery()">${canLot ? '买一张' : '今年买过了'}</button>
    </div>
  </div>`;

  // 成就徽章墙
  const got = STATE.achievements || [];
  const achHtml = `<div class="job-card">
    <div class="job-sec">🏅 成就 ${got.length} / ${ACHIEVEMENTS.length}</div>
    <div class="ach-wall">${ACHIEVEMENTS.map(a => {
      const on = got.indexOf(a.id) >= 0;
      return `<span class="ach ${on ? 'on' : ''}" title="${esc(a.name + '：' + a.desc)}">${a.icon}<i>${esc(a.name)}</i></span>`;
    }).join('')}</div>
  </div>`;

  $('view-job').innerHTML = `
    <div class="job-card">
      <div class="job-title">💼 ${esc(STATE.job)}${c ? `　<span class="of-meta">${esc(c.cat)}</span>` : ''}</div>
      <div class="job-sub">${fmtYear(STATE)} 年 · ${STATE.age}岁 · 学历 ${esc(eduTxt)}${edu.major ? '（' + esc(edu.major) + '）' : ''} · ${esc(promoTxt)}</div>
      ${curHtml ? `<div class="ladder">${curHtml}</div>` : ''}
      <div class="job-grid">
        <div class="job-cell"><i>年收入</i><b>${fmtMoney(income)}</b></div>
        <div class="job-cell"><i>年支出</i><b>${fmtMoney(cost)}</b></div>
        <div class="job-cell"><i>现金</i><b>${fmtMoney(s.MONEY)}</b></div>
        <div class="job-cell"><i>净资产</i><b>${fmtMoney(netWorth(STATE))}</b></div>
        <div class="job-cell"><i>口碑 / 人脉 / 声望</i><b>${Math.round(s.LOY)} / ${Math.round(s.NET)} / ${Math.round(s.FAME)}</b></div>
        <div class="job-cell"><i>征信分</i><b style="color:${STATE.credit < 60 ? 'var(--red)' : 'inherit'}">${Math.round(STATE.credit == null ? 100 : STATE.credit)}</b></div>
        ${m.debt > 0 ? `<div class="job-cell"><i>房贷车贷（年息 ${(rateAt(fmtYear(STATE)) * 100).toFixed(1)}%）</i><b style="color:var(--red)">-${fmtMoney(m.debt)}</b></div>` : ''}
      </div>
      ${talHtml ? `<div class="job-sec">持有天赋</div><div class="job-talents">${talHtml}</div>` : ''}
    </div>
    ${STATE.age >= 20 && !STATE.flags.married ? `<div class="job-card">
      <div class="job-sec">相亲</div>
      <div class="job-sub">托人介绍一个对象，见面费 ${fmtMoney(LOVE_META.matchCost)}。介绍的质量和你的条件挂钩。</div>
      <div class="of-btns" style="margin-top:8px"><button class="btn small primary" onclick="uiMatchmaker()">安排一次相亲</button></div>
    </div>` : ''}
    ${offerHtml ? `<div class="job-card">${offerHtml}</div>` : ''}
    <div class="job-card">
      <div class="job-sec">贷款</div>
      <div class="job-sub">借钱容易还钱难。逾期会砸掉征信，也会砸掉名声。</div>
      <div class="offer-list" style="margin-top:8px">${prodHtml}</div>
      <div class="job-sec" style="margin-top:12px">我的欠款</div>
      <div class="offer-list">${myLoanHtml}</div>
    </div>
    <div class="job-card">${famHtml}</div>
    ${healthHtml}
    ${STATE.age >= 12 ? lotteryHtml : ''}
    ${achHtml}`;
}

function parentStatus(state, which) {
  const p = state.parents && state.parents[which];
  if (!p) return '—';
  return p.alive ? `${p.name}（${p.age}岁·${p.job || '工作'}）` : `${p.name}（已故）`;
}

/* 父母健康的人话描述 */
function hpText(v) {
  if (v == null) return '';
  if (v >= 80) return '身体硬朗';
  if (v >= 60) return '还行';
  if (v >= 40) return '有点毛病';
  if (v >= 20) return '身体不好';
  return '病着';
}

/* 家庭账簿卡（人际 → 家人 顶部） */
function familyLedgerCard() {
  if (STATE.flags.orphan) return '';
  const fin = STATE.family || { assets: 0, debt: 0 };
  const debt = Math.round(fin.debt || 0);
  const both = STATE.parents && (!STATE.parents.father || !STATE.parents.father.alive) && (!STATE.parents.mother || !STATE.parents.mother.alive);
  return `<div class="ledger">
    <div class="ledger-t">🏠 家里的账簿 · ${fmtYear(STATE)} 年</div>
    <div class="ledger-grid">
      <div><i>年收入</i><b>${fmtMoney(fin.income || 0)}</b></div>
      <div><i>年支出</i><b>${fmtMoney(fin.spend || 0)}</b></div>
      <div><i>资产</i><b>${fmtMoney(fin.assets || 0)}</b></div>
      <div><i>负债</i><b class="${debt > 0 ? 'red' : ''}">${debt > 0 ? '-' + fmtMoney(debt) : '—'}</b></div>
      <div><i>今年结余</i><b class="${(fin.delta || 0) < 0 ? 'red' : ''}">${(fin.delta || 0) >= 0 ? '+' : ''}${fmtMoney(fin.delta || 0)}</b></div>
      <div><i>今年还债</i><b>${fmtMoney(fin.repaid || 0)}</b></div>
    </div>
    <div class="ledger-sub">${both ? '父母都不在了，这本账已经合上了。' : '父母还在过日子：每年有收入、有开销、有利息，也会出事——账是活的。'}</div>
    ${fin.act && fin.actYear === STATE.age ? `<div class="ledger-sub">今年家里：${esc(fin.act.text)}</div>` : ''}
  </div>`;
}

/* 最近家里发生的事（取近 3 条） */
function familyRecentLog() {
  const lines = (STATE.log || []).filter(l => l.type === 'fam').slice(-3);
  if (!lines.length) return '';
  return `<div class="ledger-log">${lines.map(l => `<div>${l.year} 年 · ${esc(l.text)}</div>`).join('')}</div>`;
}

/* ---------- 人际关系视图：家人 / 同学 / 朋友 / 恋人 ---------- */
function renderRelView() {
  const touch = STATE.socialTouch || {};
  const canTouch = (key) => touch[key] !== STATE.age;
  const cards = [];
  let extra = '';

  if (REL_TAB === 'family') {
    extra = `<div class="of-btns" style="padding:0 4px 10px">
      <button class="btn small" onclick="uiSocialAll('family')">🔁 一键陪家里人各一次</button>
    </div>`;
    extra += familyLedgerCard() + familyRecentLog();
    const ps = STATE.parents;
    if (!ps) {
      cards.push({ ava: '🏛', cls: 'amber', name: '福利院', sub: '你在这里长大。档案袋上没有父母的名字，只有一排编号。', dead: true });
    } else {
      if (ps.father) {
        cards.push(ps.father.alive
          ? { avaSvg: personAvatar(ps.father.name, 'M', ps.father.age, ''), name: `父亲 · ${ps.father.name}`, sub: `${ps.father.age}岁 · ${ps.father.job || '工人'} · ${hpText(ps.father.hp)} · 亲近 ${Math.round(ps.father.affinity)}%。他不爱说话，但每次你出事，第一个到的是他。`, key: 'father' }
          : { avaSvg: personAvatar(ps.father.name, 'M', ps.father.age, 'amber'), name: `父亲 · ${ps.father.name}`, sub: `已故。走得那年 ${ps.father.age}岁。`, dead: true });
      }
      if (ps.mother) {
        cards.push(ps.mother.alive
          ? { avaSvg: personAvatar(ps.mother.name, 'F', ps.mother.age, ''), name: `母亲 · ${ps.mother.name}`, sub: `${ps.mother.age}岁 · ${ps.mother.job || '工人'} · ${hpText(ps.mother.hp)} · 亲近 ${Math.round(ps.mother.affinity)}%。她记得你所有的口味。`, key: 'mother' }
          : { avaSvg: personAvatar(ps.mother.name, 'F', ps.mother.age, 'amber'), name: `母亲 · ${ps.mother.name}`, sub: `已故。走得那年 ${ps.mother.age}岁。`, dead: true });
      }
    }
    const oppG = STATE.gender === 'M' ? 'F' : 'M';
    if (STATE.ex) {
      cards.push({
        avaSvg: personAvatar(STATE.ex.name, oppG, (STATE.ex.age || STATE.age), 'amber'),
        name: `前任 · ${STATE.ex.name}`,
        sub: `${STATE.ex.at}岁那年离的${STATE.ex.reason ? '（' + esc(STATE.ex.reason) + '）' : ''}。${STATE.childCount ? '孩子的事，你们还得见面。' : '从此你们只在别人的婚礼上遇见。'}`, dead: true
      });
    }
    if (STATE.flags.married && STATE.spouse) {
      const sp = STATE.spouse;
      cards.push(sp.alive
        ? {
          avaSvg: personAvatar(sp.name, oppG, sp.age, 'green'), name: sp.name,
          sub: `${sp.age}岁 · 感情 ${Math.round(sp.affinity || 60)}%。携手走过半生的人。`, key: 'spouse',
          multi: `<button class="rel-act" onclick="uiSpouse(0)">陪伴</button>
            <button class="rel-act" onclick="uiSpouse(1)">约会 ${fmtMoney(Math.round(LOVE_META.dateCost * 0.7))}</button>
            <button class="rel-act" onclick="uiSpouse(2)">送礼 ${fmtMoney(Math.round(LOVE_META.giftCost * 0.6))}</button>`
        }
        : { avaSvg: personAvatar(sp.name, oppG, sp.age, 'amber'), name: sp.name, sub: '先你一步走了。余生你带着两个人的份活着。', dead: true });
    } else if (STATE.flags.married) {
      cards.push({ avaSvg: personAvatar(STATE.spouseName || '配偶', oppG, STATE.age, 'green'), name: STATE.spouseName || '配偶', sub: '携手走过半生的人。', key: 'spouse' });
    } else if (STATE.flags.dating) {
      cards.push({ avaSvg: personAvatar('恋人', oppG, STATE.age, 'green'), name: '恋人', sub: '交往中。关系是要经营的。', key: 'spouse' });
    }
    if (STATE.childCount) {
      cards.push({
        ava: '👶', cls: '', name: `孩子 × ${STATE.childCount}`,
        sub: STATE.grandCount ? `他们很棒——你已经是 ${STATE.grandCount} 个孙辈的祖辈了。` : '正在长大。陪伴错过了就回不来了。',
        key: 'child'
      });
    }
    if (STATE.pet) {
      cards.push(STATE.pet.alive
        ? { ava: STATE.pet.type === 'cat' ? '🐱' : '🐶', cls: 'amber', name: `${STATE.pet.name}（${STATE.pet.type === 'cat' ? '猫' : '狗'}）`, sub: '已经陪伴你很多年。', key: 'pet' }
        : { ava: '🌈', cls: 'amber', name: `${STATE.pet.name}`, sub: '去了彩虹桥。谢谢你陪过它。', dead: true });
    }
  } else if (REL_TAB === 'classmate') {
    const all = STATE.classmates || [];
    const stage = schoolStageOf(STATE);
    const stageName = stageCn(stage);
    const mates = all.filter(c => c.stage === stage);
    const alumni = all.filter(c => c.stage !== stage);
    extra = `<div class="rel-sub" style="padding:0 4px 8px">${
      all.length ? `通讯录里一共 ${all.length} 位同学。${stage ? `现在念${stageName}，同班 ${mates.length} 人。` : '你已经离开学校了，这些人现在是「老同学」。'}`
        : '还没有认识的同学。上初中会自动分班。'}</div>`;
    if (all.length) {
      extra += `<div class="of-btns" style="padding:0 4px 10px">
        <button class="btn small" onclick="uiSocialAll('classmate')">🔁 一键和所有人叙一遍</button>
        ${STATE.age < EXAM_META.gaoAge && !((STATE.edu || {}).stopped) ? `<button class="btn small primary" onclick="uiCram()">📚 熬夜刷题（学习投入 +）</button>` : ''}
      </div>`;
    }
    if (stage === 'uni') {
      extra += `<div class="job-sec" style="padding:4px">校园活动（每年每项一次）</div><div class="offer-list">` +
        UNI_ACTIVITIES.map(a => {
          const done = (STATE.uniTouch || {})[a.id] === STATE.age;
          const lock = a.condMinAge && STATE.age < a.condMinAge;
          return `<div class="offer ${done || lock ? 'no' : ''}">
            <div class="of-top"><span class="of-name">${esc(a.name)}</span><span class="of-sal">${done ? '今年做过了' : (lock ? a.condMinAge + '岁后' : '')}</span></div>
            <div class="of-desc">${esc(a.desc)}</div>
            ${!done && !lock ? `<button class="btn small primary" onclick="uiUniAct('${a.id}')">就这个</button>` : ''}
          </div>`;
        }).join('') + `</div>`;
    }
    if (alumni.length) {
      extra += `<div class="job-sec" style="padding:4px">老同学（毕业后还留着联系方式的 ${alumni.length} 人）</div>`;
    }
    // 在校的排前面，老同学按阶段排后面
    const order = mates.concat(alumni);
    order.forEach((c) => {
      const i = all.indexOf(c);
      const t = CLASSMATE_TYPES.find(x => x.key === c.key) || { label: '同学', ava: '🧑' };
      const gone = c.stage !== stage;
      cards.push({
        avaSvg: personAvatar(c.name, c.gender, c.age || STATE.age, gone ? 'amber' : ''),
        name: `${c.name} · ${t.label}${c.gender !== STATE.gender ? ' ♡' : ''}`,
        sub: `${stageCn(c.stage)}同学${gone ? ' · 已毕业' : ' · 同班'} · ${c.age || STATE.age}岁 · 好感 ${Math.round(c.affinity)}% · 颜值 ${c.charm} · ${t.line || ''}`,
        key: 'classmate:' + i,
        off: c.lastTouch === STATE.age,
        act: c.lastTouch === STATE.age ? '今年见过了' : (gone ? '约一次' : '互动'),
        extraBtn: (c.gender !== STATE.gender && c.affinity >= 12 && STATE.age >= 12)
          ? `<button class="btn tiny" onclick="uiCrush(${i})">${STATE.flags.married ? '对 TA 心动' : '追求 TA'}</button>` : ''
      });
    });
  } else if (REL_TAB === 'love') {
    const lv = loveInit(STATE);
    if (lv.candidates.length) {
      extra = `<div class="of-btns" style="padding:0 4px 10px">
        <button class="btn small" onclick="uiSocialAll('lover')">🔁 一键问候所有在意的人</button>
      </div>`;
    }
    if (STATE.flags.married && STATE.spouse) {
      const sp = STATE.spouse;
      cards.push(sp.alive
        ? {
          avaSvg: personAvatar(sp.name, STATE.gender === 'M' ? 'F' : 'M', sp.age, 'green'), name: sp.name,
          sub: `感情 ${Math.round(sp.affinity || 60)}% · ${sp.age}岁 · ${sp.job || ''}`, key: 'spouse',
          multi: `<button class="rel-act" onclick="uiSpouse(0)">陪伴</button>
            <button class="rel-act" onclick="uiSpouse(1)">约会 ${fmtMoney(Math.round(LOVE_META.dateCost * 0.7))}</button>
            <button class="rel-act" onclick="uiSpouse(2)">送礼 ${fmtMoney(Math.round(LOVE_META.giftCost * 0.6))}</button>`
        }
        : { avaSvg: personAvatar(sp.name, STATE.gender === 'M' ? 'F' : 'M', sp.age, 'amber'), name: sp.name, sub: '已经不在了。', dead: true });
      if (sp.alive) {
        extra += `<div class="of-btns" style="padding:0 4px 10px">
          <button class="btn small" onclick="uiBaby()">🍼 要一个孩子</button>
          <button class="btn small danger" onclick="uiDivorce()">💔 提出离婚</button>
        </div>`;
      }
    }
    if (!STATE.flags.married && STATE.age >= LOVE_META.marryAge - 2) {
      extra += `<div class="of-btns" style="padding:0 4px 10px">
        <button class="btn small primary" onclick="uiMatchmaker()">💌 托人相亲（${fmtMoney(LOVE_META.matchCost)}）</button>
      </div>`;
    }
    if (STATE.age >= 18) {
      extra += `<div class="of-btns" style="padding:0 4px 10px">
        <button class="btn small ${STATE.flags.married ? 'danger' : ''}" onclick="uiMeetOutside()">🌙 ${STATE.flags.married ? '在外面认识一个人（外遇）' : '主动去认识一个人'}</button>
      </div>`;
    }
    if (lv.candidates.length) {
      extra += `<div class="rel-sub" style="padding:0 4px 8px">同一个对象一年最多见 ${LOVE_META.touchesPerYear} 次：<b>点名字就能聊天</b>，约会和送礼要花钱但涨得更多。</div>`;
    }
    const married = !!STATE.flags.married;
    lv.candidates.forEach((l, i) => {
      const left = (l.lastTouch !== STATE.age) ? LOVE_META.touchesPerYear : Math.max(0, LOVE_META.touchesPerYear - (l.touches || 0));
      const can = left > 0 && l.alive !== false;
      const intimateBtns = l.affinity >= LOVE_META.touchAffinity && !l.pregnant
        ? `<button class="rel-act" onclick="uiIntimate(${i},0)">${married ? '越界' : '亲密'}</button>
           <button class="rel-act safe" onclick="uiIntimate(${i},1)">${married ? '越界' : '亲密'} · 做好措施 ${fmtMoney(LOVE_META.safeCost)}</button>`
        : '';
      const taken = married || !!STATE.flags.dating;
      const affairBtns = (taken && l.affinity >= LOVE_META.touchAffinity)
        ? (l.secret
          ? `<button class="rel-act" onclick="uiEndAffair(${i})">🛑 收手</button>`
          : `<button class="rel-act" onclick="uiStartAffair(${i})">🌙 偷情（长期）</button>`)
        : '';
      cards.push({
        avaSvg: personAvatar(l.name, l.gender, l.age, married ? 'amber' : 'green'),
        name: l.name,
        sub: `${loverLabel(l)} · ${l.age}岁 · 好感 <b>${Math.round(l.affinity)}%</b>${l.pregnant ? ' · ⚠ 怀孕了' : ''}` +
          `${married ? ' · <b style="color:var(--red)">婚外</b>' : ''}${l.secret ? ' · <b style="color:var(--red)">偷情中 · 随时可能被发现</b>' : ''} · 今年还能约 ${left} 次`,
        key: null,
        click: can ? `uiLove(${i},'chat')` : '',
        multi: can ? `
          <button class="rel-act" onclick="uiLove(${i},'chat')">聊天</button>
          <button class="rel-act" onclick="uiLove(${i},'date')">约会 ${fmtMoney(LOVE_META.dateCost)}</button>
          <button class="rel-act" onclick="uiLove(${i},'gift')">送礼 ${fmtMoney(LOVE_META.giftCost)}</button>
          ${intimateBtns}
          ${affairBtns}
          ${!married && l.affinity >= LOVE_META.marryAffinity && STATE.age >= LOVE_META.marryAge ? `<button class="rel-act" onclick="uiPropose(${i})">求婚</button>` : ''}
        ` : '<span class="rel-act dis">今年的次数用完了</span>'
      });
    });
  } else if (REL_TAB === 'good') {
    const eth = Math.round(STATE.stats.ETH || 50);
    extra = `<div class="rel-sub" style="padding:0 4px 8px">道德 ${eth}。它不是只能往下掉——<b>每一件善事今年只能做一次</b>。` +
      `${eth < 40 ? '你现在已经站在不太好看的那一边了，做点什么还来得及。' : ''}</div>`;
    const tp = STATE.goodTouch || {};
    GOOD_DEEDS.forEach(d => {
      const done = tp[d.id] === STATE.age;
      const young = STATE.age < (d.minAge || 0);
      const poor = (d.cost || 0) > (STATE.stats.MONEY || 0);
      const off = done || young || poor;
      cards.push({
        avaSvg: `<span class="rel-ava ${done ? 'amber' : ''}" style="font-size:24px">${d.icon}</span>`,
        name: d.name,
        sub: `${esc(d.desc)}　→ 道德 +${d.eff.ETH}${d.cost ? ` · 花费 ${fmtMoney(d.cost)}` : ' · 不花钱'}` +
          (young ? ` · ${d.minAge} 岁以后` : (poor ? ' · 钱不够' : (done ? ' · 今年做过了' : ''))),
        key: null,
        multi: off ? '<span class="rel-act dis">今年做不了</span>'
          : `<button class="rel-act" onclick="uiGoodDeed('${d.id}')">就做这个</button>`
      });
    });
  } else {
    const list = STATE.friends || [];
    if (list.length) {
      extra = `<div class="of-btns" style="padding:0 4px 10px">
        <button class="btn small" onclick="uiSocialAll('friend')">🔁 一键和所有朋友聚一次</button>
      </div>`;
    }
    list.forEach((f, i) => {
      const t = FRIEND_TYPES.find(x => x.key === f.key);
      cards.push({
        avaSvg: personAvatar(f.name, f.gender || (hashStr(f.name) % 2 ? 'F' : 'M'), f.age, f.alive === false ? 'amber' : ''),
        name: `${f.name} · ${t ? t.label : '朋友'}`,
        sub: f.alive === false ? '已经不在了。' : `好感度 ${Math.round(f.affinity)}% · ${f.age || 20}岁 · ${t ? t.line : ''}`,
        key: f.alive === false ? null : 'friend:' + i,
        dead: f.alive === false
      });
    });
  }

  $('view-rel').innerHTML = `
    <div class="rel-head">
      <button class="rel-tab ${REL_TAB === 'family' ? 'active' : ''}" onclick="setRelTab('family')">👪 家人</button>
      <button class="rel-tab ${REL_TAB === 'classmate' ? 'active' : ''}" onclick="setRelTab('classmate')">🎒 同学</button>
      <button class="rel-tab ${REL_TAB === 'friends' ? 'active' : ''}" onclick="setRelTab('friends')">🧑‍🤝‍🧑 朋友</button>
      <button class="rel-tab ${REL_TAB === 'love' ? 'active' : ''}" onclick="setRelTab('love')">💘 恋人</button>
      <button class="rel-tab ${REL_TAB === 'good' ? 'active' : ''}" onclick="setRelTab('good')">🙏 向善</button>
    </div>
    ${extra}
    <div class="rel-list">
      ${cards.length ? cards.map(c => `
        <div class="rel-card">
          ${c.avaSvg || `<span class="rel-ava ${c.cls}">${c.ava}</span>`}
          <div class="rel-info">
            <div class="rel-name ${c.click ? 'tap' : ''}" ${c.click ? `onclick="${c.click}"` : ''}>${esc(c.name)}</div>
            <div class="rel-sub">${c.sub}</div>
            ${c.extraBtn || ''}
          </div>
          ${c.multi ? `<div class="rel-multi">${c.multi}</div>`
            : (c.dead || !c.key ? '' : `<button class="rel-act" ${(canTouch(c.key) && !c.off) ? '' : 'disabled'} onclick="uiSocial('${c.key}')">${(canTouch(c.key) && !c.off) ? (c.act || '互动') : '今年已互动'}</button>`)}
        </div>`).join('')
      : `<div class="rel-empty">${REL_TAB === 'love' ? '还没有在意的人。去同学里看看，或者托人相个亲。' : (REL_TAB === 'classmate' ? '这个阶段没有同学。' : '这一世还很孤独。去生活里遇见一些人吧。')}</div>`}
    </div>`;
}

function setRelTab(t) { REL_TAB = t; renderRelView(); }

function afterAct(msg) {
  if (msg) toast(msg);
  renderStats();
  renderStream();
  if (GAME_VIEW === 'rel') renderRelView();
  if (GAME_VIEW === 'job') renderJobView();
  autosave();
}

function uiSocial(key) {
  const parts = key.split(':');
  if (parts[0] === 'classmate') {
    const r = classmateAct(STATE, Number(parts[1]));
    if (!r.ok) { toast(r.msg || '现在不行'); return; }
    afterAct('互动成功');
    return;
  }
  const r = socialAct(STATE, parts[0], parts.length > 1 ? Number(parts[1]) : undefined);
  if (!r.ok) { toast(r.msg || '现在不行'); return; }
  afterAct('互动成功');
}

/* 配偶 / 恋人：陪伴 / 约会 / 送礼（真的会涨感情） */
function uiSpouse(mode) {
  const r = socialAct(STATE, 'spouse', mode || 0);
  if (!r.ok) { toast(r.msg || '现在不行'); return; }
  afterAct('感情 +');
}

/* 外遇 / 邂逅：主动去外面认识一个人 */
function uiMeetOutside() {
  const r = meetOutside(STATE);
  if (!r.ok) { toast(r.msg || '现在不行'); return; }
  afterAct(STATE.flags.married ? '你认识了一个不该认识的人' : '新的邂逅');
}

/* 偷情 / 长期外遇 */
function uiStartAffair(i) {
  const r = startAffair(STATE, i);
  if (!r.ok) { toast(r.msg || '现在不行'); return; }
  afterAct('你们开始了见不得光的那部分');
}

function uiEndAffair(i) {
  const r = endAffair(STATE, i);
  if (!r.ok) { toast(r.msg || '现在不行'); return; }
  afterAct('你收手了');
}

/* 做件好事：道德是可以主动攒的 */
function uiGoodDeed(id) {
  const r = doGoodDeed(STATE, id);
  if (!r.ok) { toast(r.msg || '现在不行'); return; }
  afterAct('道德 +');
}

function uiSocialAll(kind) {
  const r = socialActAll(STATE, kind);
  if (!r.ok) { toast(r.n ? '' : (kind === 'friend' ? '今年都见过了' : '今年都聊过了')); return; }
  afterAct(`和 ${r.n} 个人走了一圈`);
}

function uiCram() {
  const r = cramSchool(STATE);
  if (!r.ok) { toast(r.msg || '现在不行'); return; }
  afterAct('刷题完成');
}

function uiUniAct(id) {
  const r = doUniActivity(STATE, id);
  if (!r.ok) { toast(r.msg || '现在不行'); return; }
  afterAct('度过了这一年');
}

function uiCrush(i) {
  const r = meetFromClassmate(STATE, i);
  if (!r.ok) { toast(r.msg || '现在不行'); return; }
  afterAct('TA 进入了你的名单');
}

function uiLove(i, kind) {
  const r = loveAct(STATE, i, kind);
  if (!r.ok) { toast(r.msg || '现在不行'); return; }
  afterAct('好感 +');
}

function uiIntimate(i, safe) {
  const r = loveIntimate(STATE, i, !!safe);
  if (!r.ok) { toast(r.msg || '现在不行'); return; }
  if (r.pregnant) {
    const l = (STATE.love.candidates || [])[i];
    STATE.queue = STATE.queue || [];
    STATE.queue.unshift({ type: 'event', ev: makePregnantEvent(STATE, l) });
    toast('出事了……');
  }
  if (r.caught) toast('好像有人看见了……');
  afterAct(r.pregnant ? null : (r.affair ? '这一步，回不了头' : '你们走到了一起'));
}

function uiDivorce() {
  const sp = STATE.spouse || {};
  const worth = netWorth(STATE);
  uiConfirm('确定要离婚吗',
    `你和 <b>${esc(sp.name || 'TA')}</b> 的婚姻将就此结束。<br>` +
    `大致要分走 <b>${fmtMoney(Math.round(Math.max(0, worth) * 0.3))}</b> 上下的家产，孩子的抚养权也不一定归你。<br>` +
    `感情、名声、安全感都会掉一截——但日子是你自己的。这一步不可撤销。`,
    '离婚', () => {
      const r = divorce(STATE, '过不下去了');
      if (!r.ok) { toast(r.msg || '现在不行'); return; }
      afterAct('离了');
      if (GAME_VIEW === 'rel') renderRelView();
    });
}

function uiTreat(level) {
  const r = treatIllness(STATE, level);
  if (!r.ok) { toast(r.msg || '治不了'); return; }
  afterAct(r.cured ? '病好了' : '还没断根');
}

function uiLottery() {
  const r = buyLottery(STATE);
  if (!r.ok) { toast(r.msg || '买不了'); return; }
  afterAct(r.win > 0 ? `${r.name}：${fmtMoney(r.win)}` : '没中');
}

function toggleMoreStats() {
  SHOW_MORE_STATS = !SHOW_MORE_STATS;
  renderStats();
}

function uiPropose(i) {
  const r = propose(STATE, i);
  if (!r.ok) { toast(r.msg || '现在不行'); return; }
  afterAct('结婚了！');
}

function uiMatchmaker() {
  const r = meetByMatchmaker(STATE);
  if (!r.ok) { toast(r.msg || '现在不行'); return; }
  if (GAME_VIEW !== 'rel') { REL_TAB = 'love'; }
  afterAct('安排了一次见面');
}

function uiBaby() {
  const r = tryBaby(STATE);
  if (!r.ok) { toast(r.msg || '现在不行'); return; }
  afterAct(r.baby ? '孩子出生了' : '再等等吧');
}

function uiApplyJob(id) {
  // 还在上学却要去上班：必须明确「退学」的代价
  if (typeof isEnrolled === 'function' && isEnrolled(STATE)) {
    const offer = jobOffers(STATE).find(o => o.career.id === id);
    const jobName = offer ? offer.title : '';
    uiConfirm('这样就不能继续升学了',
      `你现在还是<b>${esc(enrolledText(STATE))}</b>。签下 ${esc(jobName || '这份工作')}，就意味着<b>退学</b>——<br>` +
      `之后不会再有中考、高考，也没法再回学校拿学历。这一步是不可逆的。`,
      '退学去上班', () => {
        dropOut(STATE, jobName);
        const r = applyJob(STATE, id);
        if (!r.ok) { toast(r.msg || '现在不行'); renderStats(); renderStream(); return; }
        afterAct('入职：' + r.title);
        if (GAME_VIEW === 'job') renderJobView();
      });
    return;
  }
  const r = applyJob(STATE, id);
  if (!r.ok) { toast(r.msg || '现在不行'); return; }
  afterAct('入职：' + r.title);
}

function uiBorrow(id, amount) {
  const r = borrow(STATE, id, amount);
  if (!r.ok) { toast(r.msg || '借不到'); return; }
  afterAct('钱到账了');
}

function uiRepayLoan(i, amount) {
  const r = repayLoan(STATE, i, amount);
  if (!r.ok) { toast(r.msg || '还不上'); return; }
  afterAct('还款成功');
}
function renderStream() {
  const box = $('stream');
  box.innerHTML = STATE.log.map(l => {
    const cls = 'line ' + (l.type || 'story');
    return `<div class="${cls}"><span class="y">${l.year} 年 ${l.age}岁</span>${esc(l.text)}</div>`;
  }).join('');
  box.scrollTop = box.scrollHeight;
}

function renderIdle() {
  $('card').innerHTML = `
    <div class="card-inner">
      <div class="card-year">${fmtYear(STATE)} 年 · ${STATE.age}岁 · ${esc(STATE.job || defaultJob(STATE.age))}</div>
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
      <div class="card-year">${fmtYear(STATE)} 年 · ${STATE.age}岁</div>
      <p class="card-text">${esc(ev.text)}</p></div>`;
    const list = eventChoices(STATE, ev) || [];
    const btns = list.map((c, i) => {
      const r = c.risk || 2;
      let sub = '';
      if (c.gamble) {
        const g = c.gamble;
        sub = `<span class="gamble">${Math.round(g.p * 100)}% · ${describeEffects(g.win).join(' ') || '—'} ／ ${describeEffects(g.lose).join(' ') || '—'}</span>`;
      } else {
        const d = describeEffects(c.eff);
        if (d.length) sub = `<span class="gamble">${d.join(' · ')}</span>`;
      }
      return `<button class="btn choice c-risk${r}" onclick="choose(${i})">${esc(c.text)}<span class="risk r${r}">风险${riskLabel(r)}</span>${sub}</button>`;
    }).join('');
    $('actions').innerHTML = btns || `<button class="btn primary" onclick="choose(-1)">继续 ▸</button>`;
  } else if (item.type === 'exam') {
    const ex = item.exam;
    if (ex.quiz && !ex.quiz.done) {
      // 常识统考：一道一道答（A/B/C/D 答题卡）
      const qz = ex.quiz;
      const q = qz.qs[qz.i];
      const LETTERS = ['A', 'B', 'C', 'D'];
      const OPT_COLORS = ['', 'o-gold', 'o-blue', 'o-teal', 'o-pink'];
      html = `<div class="card-inner exam">
        <div class="card-year">${fmtYear(STATE)} 年 · ${STATE.age}岁 · ${esc(ex.title)} · 第 ${qz.i + 1}/${qz.qs.length} 题 · 答对 ${qz.correct}</div>
        <p class="quiz-q">${esc(q.q)}</p>
        <div class="quiz-progress"><i style="width:${Math.round(qz.i / qz.qs.length * 100)}%"></i></div>
      </div>`;
      $('actions').innerHTML = q.opts.map((o, k) =>
        `<button class="btn choice quiz-opt" onclick="answerExam(${k})"><span class="quiz-letter ${OPT_COLORS[k + 1]}">${LETTERS[k]}</span>${esc(o)}</button>`
      ).join('');
      $('card').innerHTML = html;
      renderStats(); renderStream(); autosave();
      return;
    }
    html = `<div class="card-inner exam">
      <div class="card-year">${fmtYear(STATE)} 年 · ${STATE.age}岁 · ${esc(ex.title)}</div>
      ${ex.score != null ? `<div class="exam-score">${ex.score}<small> / ${ex.full}</small></div>` : ''}
      <p class="card-text">${esc(ex.text).replace(/\n/g, '<br>')}</p></div>`;
    $('actions').innerHTML = (ex.options || []).map((o, i) => {
      const meta = o.minScore != null ? `录取线 ${Math.round(o.minScore / 100 * (ex.full || 100))}` : '';
      if (o.locked) {
        return `<button class="btn choice dis" disabled>${esc(o.name)}
          <span class="gamble">${esc(o.desc)}</span>
          <span class="risk r3">进不去 · ${esc(o.lockReason || '条件不够')}</span></button>`;
      }
      return `<button class="btn choice" onclick="chooseExam(${i})">${esc(o.name)}
        <span class="gamble">${esc(o.desc)}</span>
        ${meta ? `<span class="risk r2">${meta}</span>` : ''}</button>`;
    }).join('');
  } else if (item.type === 'invest') {
    html = `<div class="card-inner invest">
      <div class="card-year">投资机会 · ${fmtYear(STATE)} 年</div>
      <p class="card-text">${esc(item.text).replace(/\n/g, '<br>')}</p></div>`;
    $('actions').innerHTML = item.choices.map((c, i) =>
      `<button class="btn choice ${c.disabled ? 'dis' : ''}" ${c.disabled ? 'disabled' : ''} onclick="investChoice(${i})">${esc(c.text)}</button>`).join('');
  } else {
    html = `<div class="card-inner"><div class="card-year">${item.year} 年</div><p class="card-text">新的一年开始了。</p></div>`;
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
    pushLog(STATE, `── ${item.year} 年 · ${item.age}岁 ──`, 'year');
    item = step(STATE);
  }
  if (!item || item.type === 'end') { finishGame(); return; }
  renderItem(item);
}

function answerExam(k) {
  const item = STATE.pending;
  if (!item || item.type !== 'exam') return;
  const r = answerExamQ(STATE, k);
  if (!r.ok) { toast('现在不能作答'); return; }
  renderItem(item); // 下一题或放榜，都在同一个卡片里
}

function chooseExam(i) {
  const item = STATE.pending;
  if (!item || item.type !== 'exam') return;
  // 还在答题阶段时，把点击当答案处理
  if (item.exam.quiz && !item.exam.quiz.done) { answerExam(i); return; }
  const opt = item.exam.options && item.exam.options[i];
  // 工作的人跑去上学：得先把工作辞了
  if (opt && (opt.years || 0) > 0 && STATE.career) {
    const c = careerById(STATE.career.id);
    uiConfirm('去念书就得放下工作',
      `你已经在<b>${esc(c ? c.name : '这家公司')}</b>站稳了脚（${esc(STATE.job)}）。<br>` +
      `去 <b>${esc(opt.name)}</b> 报到意味着<b>辞职</b>——职级清零，这行的人脉与口碑也会留下缺口。<br>` +
      `读完再出来，靠的是新学历从头起步。`,
      '辞职去报到', () => {
        quitForSchool(STATE, opt.name);
        doChooseExam(i);
      });
    return;
  }
  doChooseExam(i);
}

function doChooseExam(i) {
  resolveExam(STATE, i);
  renderStats();
  renderStream();
  autosave();
  if (STATE.queue && STATE.queue.length) renderItem(STATE.queue.shift());
  else renderIdle();
}

function choose(i) {
  const item = STATE.pending;
  if (!item || item.type !== 'event') return;
  // 已经在工作，却选了「考研」这类要回学校的路：先把工作辞掉
  if (choiceNeedsQuit(item.ev, i) && STATE.career) {
    const c = careerById(STATE.career.id);
    const ev = item.ev;
    uiConfirm('考研就得辞掉工作',
      `你现在是 <b>${esc(STATE.job)}</b>${c ? `（${esc(c.name)}）` : ''}。<br>` +
      `全日制读研意味着<b>辞职</b>：这三年没有收入，职场人脉与口碑也会慢慢凉下来。<br>` +
      `换来的是一个更高的学历起点。`,
      '辞职去考研', () => { quitForSchool(STATE, '研究生'); doChoose(i); });
    return;
  }
  doChoose(i);
}

/* 判断某个选项是否「要回学校读书」（从而必须辞职） */
function choiceNeedsQuit(ev, i) {
  const ch = (ev.choices || [])[i];
  if (!ch) return false;
  if (ch.study) return true;
  const fl = ch.flags || [];
  if (fl.indexOf('kaoyan_try') >= 0 || fl.indexOf('kaoyan_ok') >= 0) return true;
  return false;
}

function doChoose(i) {
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
  const edu = STATE.edu || {};
  const uniName = edu.uni && edu.uni !== 'u_fail' ? (UNIVERSITIES.find(x => x.id === edu.uni) || {}).name : '';
  $('endStats').innerHTML = `
    <div><span>净资产</span><b>${fmtMoney(worthOf(STATE))}</b></div>
    <div><span>现金</span><b>${fmtMoney(s.MONEY)}</b></div>
    <div><span>巅峰净资产</span><b>${fmtMoney(STATE.peak.NET || STATE.peak.MONEY)}</b></div>
    <div><span>不动产</span><b>${fmtMoney(propValue(STATE))}</b></div>
    <div><span>持股</span><b>${fmtMoney(stockValue(STATE))}</b></div>
    <div><span>房贷车贷</span><b>${(STATE.market && STATE.market.debt) ? '-' + fmtMoney(STATE.market.debt) : '—'}</b></div>
    <div><span>个人贷款</span><b>${loanTotal(STATE) > 0 ? '-' + fmtMoney(loanTotal(STATE)) : '—'}</b></div>
    <div><span>学历</span><b>${esc(EDU_LEVELS[edu.eduLevel || 0])}${uniName ? ' · ' + esc(uniName) : ''}</b></div>
    <div><span>最终职业</span><b>${esc(STATE.job || '—')}</b></div>
    <div><span>声望 / 人脉</span><b>${Math.round(s.FAME)} / ${Math.round(s.NET)}</b></div>
    <div><span>智力 / 意志</span><b>${Math.round(s.INT)} / ${Math.round(s.WILL)}</b></div>
    <div><span>道德 / 心情</span><b>${Math.round(s.ETH || 0)} / ${Math.round(s.MOOD || 0)}</b></div>
    <div><span>享年</span><b>${STATE.age}岁 · ${fmtYear(STATE)} 年</b></div>`;
  const got = STATE.achievements || [];
  let achHtml = '';
  if (typeof ACHIEVEMENTS !== 'undefined') {
    achHtml = `<h3 class="sec">🏅 成就 ${got.length} / ${ACHIEVEMENTS.length}</h3>
      <div class="ach-wall end-ach">${ACHIEVEMENTS.map(a => {
        const on = got.indexOf(a.id) >= 0;
        return `<span class="ach ${on ? 'on' : ''}" title="${esc(a.name + '：' + a.desc)}">${a.icon}<i>${esc(a.name)}</i></span>`;
      }).join('')}</div>`;
  }
  $('endAch').innerHTML = achHtml;
  const hl = STATE.log.filter(l => l.type === 'story' || l.type === 'money').slice(-40);
  $('endReview').innerHTML = hl.map(l => `<div class="line ${l.type}"><span class="y">${l.year} 年</span>${esc(l.text)}</div>`).join('');
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
      <div class="slot-t">存档槽 ${i + 1} <span class="sub">${s.name} · ${(s.startYear || START_YEAR) + s.age} 年 · ${s.age}岁 · ${fmtMoney(s.stats.MONEY)}</span></div>
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
    toast(STATE.age < MARKET_META.minAge ? `${MARKET_META.minAge}岁 之后才能进入市场` : '人生已经结束');
    return;
  }
  showScreen('screen-market');
  renderMarket();
}

function backToGame() {
  showScreen('screen-game');
  showGameView('main');
  renderStats();
  if (STATE.pending) renderItem(STATE.pending); else renderIdle();
}

function openMarketTab(tab) {
  MARKET_TAB = tab;
  openMarket();
}

function renderMarket() {
  const m = marketMigrate(STATE);
  const y = fmtYear(STATE);
  $('marketYear').textContent = `${y} 年 · ${STATE.age}岁 · 基准利率 ${(rateAt(y) * 100).toFixed(1)}%`;
  const sum = marketSummary(STATE);
  $('marketWallet').innerHTML = `
    <div><span>现金</span><b>${fmtMoney(sum.cash)}</b></div>
    <div><span>净资产</span><b>${fmtMoney(sum.net)}</b></div>
    <div><span>不动产</span><b>${fmtMoney(sum.props)}</b></div>
    <div><span>持股</span><b>${fmtMoney(sum.stocks)}</b></div>
    <div class="${sum.debt > 0 ? 'debt' : ''}"><span>贷款</span><b>${sum.debt > 0 ? '-' + fmtMoney(sum.debt) : '—'}</b></div>`;
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
    const meta = `较 1985 年 ${up >= 0 ? '+' : ''}${up}% · 年化 ${(h.growth * 100).toFixed(1)}%` +
      (h.rent ? ` · 租金 ${(h.rent * 100).toFixed(1)}%/年` : '') +
      (h.upkeep ? ` · 维护 ${(h.upkeep * 100).toFixed(1)}%/年` : ' · 无维护费') +
      (h.cha ? ` · 魅力 ${h.cha > 0 ? '+' : ''}${h.cha}` : '') +
      (h.net ? ` · 人脉 +${h.net}` : '') +
      ` · ${h.jeonse ? '租房（押一付三）' : '可贷款'}`;
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
    html += `<div class="mk-alert ${shock.k >= 0 ? 'up' : 'down'}">${y} 年 ${esc(shock.t)} — ${esc(shock.d)}</div>`;
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
      (pos ? ` · 持有 ${pos.shares}股（市值 ${fmtMoney(pos.shares * p)}）` : '') + `</div>
      ${sparkline(m.hist[s.id])}
      <div class="mk-btns">
        <button class="btn small" onclick="uiBuyStock('${s.id}',10)">买 10股 · ${fmtMoney(p * 10)}</button>
        <button class="btn small" onclick="uiBuyStock('${s.id}',100)">买 100股 · ${fmtMoney(p * 100)}</button>
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
      <div class="mk-meta">${p.buyYear} 年 买入 · 成本 ${fmtMoney(p.buyPrice)}` +
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
      <div class="mk-meta">${pos.shares}股 · 成本 ${fmtMoney(pos.cost)} · 现价 ${fmtMoney(p)}</div>
      <div class="mk-btns">
        <button class="btn small" onclick="uiSellStock('${pos.id}',0.5)">卖一半</button>
        <button class="btn small warn" onclick="uiSellStock('${pos.id}',1)">清仓</button>
      </div></div>`;
  });
  if (m.debt > 0) {
    html += `<div class="mk-item debt-box">
      <div class="mk-top"><span class="mk-name">贷款总额</span><span class="mk-price">-${fmtMoney(m.debt)}</span></div>
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
  bind('btnNew', startCreate);
  bind('btnContinue', () => {
    STATE = loadAuto();
    if (!STATE) { toast('没有可继续的存档'); return; }
    enterGame();
  });
  bind('btnSaves', openModal);
  bind('btnSavesTop', openModal);
  bind('btnHow', () => { $('howBox').classList.toggle('open'); });
  bind('btnBackTitle', () => { renderTitle(); showScreen('screen-title'); });
  // 「浏览全部」模式：列出所有天赋，配合搜索框筛选
  bind('btnTalentAll', () => {
    TALENT_ALL = !TALENT_ALL;
    const b = $('btnTalentAll');
    if (b) b.textContent = TALENT_ALL ? '📖 全部（再点收回）' : '📖 浏览全部';
    renderTalents();
    toast(TALENT_ALL ? `已展开全部 ${TALENTS.length} 种天赋` : '已收回随机推荐');
  });
  bind('btnTalentRoll', () => { TALENT_ALL = false; const b = $('btnTalentAll'); if (b) b.textContent = '📖 浏览全部'; rerollTalents(); });
  bind('btnReroll', rerollTalents);
  // 输关键词时自动切到「全部」，否则搜到的很可能不在当前这一批里
  const tq = $('talentSearch');
  if (tq) tq.oninput = () => { if ((tq.value || '').trim()) TALENT_ALL = true; renderTalents(); };
  bind('btnRerollName', rerollName);
  bind('btnStart', confirmCreate);
  bind('btnBackFromCreate', () => { renderTitle(); showScreen('screen-title'); });
  bind('btnMarketBack', backToGame);
  document.querySelectorAll('.mtab').forEach(b => {
    b.onclick = () => { MARKET_TAB = b.dataset.tab; renderMarket(); };
  });
  bind('btnSaveGame', () => { autosave(); toast('已自动保存到本机缓存'); });
  bind('btnSaves2', openModal);
  bind('btnRestart', () => {
    if (confirm('放弃当前人生，重新开始？')) { localStorage.removeItem(LS.auto); STATE = null; renderTitle(); showScreen('screen-title'); }
  });
  // HUD 资产胶囊 → 市场持有页
  bind('pillCash', () => openMarketTab('hold'));
  bind('pillWorth', () => openMarketTab('hold'));
  // 底部导航
  bind('dockJob', () => { if (STATE && !STATE.finished) showGameView(GAME_VIEW === 'job' ? 'main' : 'job'); });
  bind('dockRel', () => { if (STATE && !STATE.finished) showGameView(GAME_VIEW === 'rel' ? 'main' : 'rel'); });
  bind('dockStock', () => openMarketTab('stock'));
  bind('dockShop', () => openMarketTab('house'));
  bind('dockNext', () => {
    if (!STATE || STATE.finished) return;
    // 不在人生界面时，这颗钮是「返回人生」——未成年点开人际也能回来
    if (GAME_VIEW !== 'main') { showGameView('main'); return; }
    advance();
  });
  bind('modalClose', closeModal);
  bind('btnExport', exportSave);
  bind('btnImport', importSave);
  bind('btnAgain', () => { startCreate(); });
  bind('btnEndTitle', () => { renderTitle(); showScreen('screen-title'); });
  document.querySelectorAll('[name=gender]').forEach(r => r.onchange = () => { });
  // 键盘：空格/回车推进
  document.addEventListener('keydown', e => {
    if (!$('screen-game').classList.contains('active')) return;
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
    if (e.code === 'Space' || e.code === 'Enter') {
      const btns = $('actions').querySelectorAll('button:not([disabled])');
      if (GAME_VIEW === 'main' && btns.length === 1) { e.preventDefault(); btns[0].click(); }
    }
  });
}
document.addEventListener('DOMContentLoaded', init);
