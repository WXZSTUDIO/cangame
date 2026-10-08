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
/* IMP-01 · R-02：原来的 catch 是空的，写失败时玩家完全不知情 ——
 * 隐私模式 / 配额写满时他会以为存了，下次回来「继续游戏」按钮就消失了。
 * 现在写失败要：① 明确提示一次 ② 返回值让调用方能知道 ③ 控制台留痕。 */
let _storageBroken = false;
function lsSet(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); return true; }
  catch (e) {
    if (!_storageBroken) {
      _storageBroken = true;
      try {
        toast('本机无法保存进度（浏览器禁止存储或空间已满），这一局可能不会被记住');
        console.error('[cangame] storage write failed', e);
      } catch (_) { }
    }
    return false;
  }
}

function autosave() {
  if (!STATE) return false;
  STATE.updatedAt = Date.now();
  const ok = lsSet(LS.auto, STATE);
  if (!ok) { try { const b = $('btnSaveGame'); if (b) b.classList.add('save-broken'); } catch (_) { } }
  return ok;
}

/* ---------- 存档写入口：脏标记 + 延迟合流（IMP-01 · O-03 的硬前置） ----------
 * 这一批**不改写入时机**，SAVE_DEBOUNCE_MS 仍是 0，markDirty() 等价于立刻 autosave()。
 * 但要先把「调用点 → markDirty / autosaveNow」这条链路铺好，并把 pagehide /
 * visibilitychange 兜底埋好 —— 这样第二批做存档节流时只改这一个常量，
 * 不用再回去挨个换调用点，也不会漏掉「切后台就丢档」这个坑。 */
const SAVE_DEBOUNCE_MS = 0;      // ← 第二批（O-03）把它改成 400 即开启节流
let _saveDirty = false;
let _saveTimer = 0;

function markDirty() {
  if (!STATE) return false;
  _saveDirty = true;
  if (SAVE_DEBOUNCE_MS > 0) {
    if (!_saveTimer) _saveTimer = setTimeout(flushSave, SAVE_DEBOUNCE_MS);
    return true;
  }
  return flushSave();
}

/* 关键节点（人生结束 / 刚出生 / 用户点了💾）与「切后台/关页」兜底都走这个，永远同步 */
function autosaveNow() {
  if (!STATE) return false;
  _saveDirty = true;
  return flushSave();
}

function flushSave() {
  if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = 0; }
  if (!_saveDirty) return false;
  _saveDirty = false;
  return autosave();
}

/* 手机上一按 Home / 一切标签，页面可能再也不会回来 —— 这里必须补一刀 */
window.addEventListener('pagehide', function () { flushSave(); });
document.addEventListener('visibilitychange', function () {
  if (document.visibilityState === 'hidden') flushSave();
});
window.addEventListener('beforeunload', function () { flushSave(); });
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
/* 文本上下文：只转义 & < > 就够（旧行为，保持不变） */
function esc(s) { return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
/* 属性上下文：必须连引号一起转义。
 * IMP-01 · R-04：原来只用 esc()，而它被大量用在双引号属性里
 * （旧代码是 `aria-label="${esc(name)}"` / `title="${esc(...)}"`）。
 * 玩家姓名（#inputName，10 字符、不限字符集，且孩子姓氏继承自 state.name[0]）
 * 里带一个双引号就能突破属性边界，往 SVG 元素上注入 onload / onerror 这类
 * 事件处理器属性。所有属性上下文一律改用 escAttr()。 */
function escAttr(s) {
  return String(s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
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
  // v6.1：门阀特权威 talent 点时，这一世天赋点 16
  const pendPerk = (typeof prestigeInfo === 'function') ? prestigeInfo().perk : null;
  CREATE_POINTS = pendPerk === 'perk_talent' ? 16 : 10;
  TALENT_ALL = false;
  const ta = $('btnTalentAll'); if (ta) ta.textContent = '📖 浏览全部';
  const tq = $('talentSearch'); if (tq) tq.value = '';
  const pref = lsGet(LS.pref) || {};
  $('inputName').value = pref.name || randomName(pref.gender || 'M');
  document.querySelectorAll('[name=gender]').forEach(r => r.checked = (r.value === (pref.gender || 'M')));
  renderPrestige();
  renderFamilies();
  renderTalents();
  renderPriorities();
  showScreen('screen-create');
}

/* ---------- v6.1 出生页 · 门阀声望面板 ---------- */
function renderPrestige() {
  const box = $('prestigePanel');
  if (!box || typeof prestigeInfo !== 'function') return;
  const info = prestigeInfo();
  const perkObj = (typeof PRESTIGE_PERKS !== 'undefined' && info.perk) ? PRESTIGE_PERKS.find(p => p.id === info.perk) : null;
  let cryoHtml = '';
  if (info.cryo) {
    const ready = (typeof cryoReady === 'function') && cryoReady();
    const wait = Math.max(0, (info.cryo.thawGen || 0) - (info.gen || 0));
    cryoHtml = `<div class="rel-sub" style="margin-top:8px">🧊 冷冻舱：<b>${esc(info.cryo.name)}</b> 自 ${info.cryo.frozenYear} 年沉睡。` +
      (ready ? '医学已经攻克当年的绝症——<b>点「出生 ▸」，以 TA 的身份醒来</b>。'
        : `还需再传 ${wait} 代人，医学才能治好当年的病。`) + `</div>`;
  }
  box.innerHTML = `
    <div class="prestige-head"><b>🏛 门阀 · 第 ${info.gen + 1} 代</b>
      <span class="prestige-pts">✦ ${info.prestige} 声望</span></div>
    <div class="rel-sub" style="margin-top:2px">每一代人的成就都会折成家族声望（永久保留），在投胎前兑换成下一世的先天特权。</div>
    ${info.perk && perkObj ? `<div class="rel-sub">✅ 待生效：${perkObj.icon} ${esc(perkObj.name)} —— 本局出生即生效</div>` : ''}
    <div class="perk-grid">${PRESTIGE_PERKS.map(p => {
      const owned = info.perk === p.id;
      const poor = info.prestige < p.cost;
      return `<button class="perk ${owned ? 'bought' : ''}" ${(owned || poor || info.perk) ? 'disabled' : ''} onclick="uiBuyPerk('${p.id}')">${p.icon} ${p.name} · ${p.cost}点<i>${esc(p.desc)}</i></button>`;
    }).join('')}</div>
    ${info.trust ? `<div class="rel-sub" style="margin-top:8px">🏦 家族信托本金 <b>${fmtMoney(info.trust.money)}</b>（${esc(info.trust.founder)} 设立于 ${info.trust.sinceYear} 年）· 这一代每年都能领给付</div>` : ''}
    ${cryoHtml}`;
}
function uiBuyPerk(id) {
  const r = buyPerk(id);
  if (!r.ok) { toast(r.msg || '换不了'); return; }
  toast('特权已就位——本局出生时生效');
  renderPrestige();
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
  let familyId = $('familyList').dataset.pick || FAMILIES[0].id;
  const priority = $('priorityList').dataset.pick || 'balance';
  // v6.1 门阀声望：出生特权在投胎前结算
  const perk = (typeof takeBirthPerk === 'function') ? takeBirthPerk() : null;
  if (perk === 'perk_rich' && typeof RICH_FAMILIES !== 'undefined') {
    familyId = RICH_FAMILIES[randInt(0, RICH_FAMILIES.length - 1)];
  }
  lsSet(LS.pref, { name, gender });
  STATE = createGame({ name, gender, familyId, priority, talents: SELECTED.slice() });
  if (perk === 'perk_stat') {
    applyEffects(STATE, { INT: 8, STR: 8, CHA: 8, WILL: 8, HP: 8 }, true);
    pushLog(STATE, '【门阀】族谱的第一页写着：这一支的血脉，天生底子就好。（六维先天 +8）', 'story');
  }
  if (perk === 'perk_cash') {
    STATE.stats.MONEY += 8000000;
    pushLog(STATE, '【门阀】满月酒那天，家里的老人塞给你一张存折：这是给孩子未来用的。', 'money');
  }
  // v6.1 冷冻人苏醒：新局直接覆盖成冷冻者本人
  if (typeof cryoReady === 'function' && cryoReady()) {
    applyCryoRevive(STATE);
  }
  // v6 传承 / 重生：新局落定后注入继承包或前世记忆
  if (typeof applyRebirthBoost === 'function') applyRebirthBoost(STATE);
  if (typeof applyHeirBoost === 'function') applyHeirBoost(STATE);
  // v6.1 世代计数：每开一局算一代（信托给付 / 冷冻解冻 / 门阀传承都用它）
  if (typeof famVault === 'function') {
    const v = famVault();
    v.gen = (v.gen || 0) + 1;
    famSave(v);
  }
  markDirty();
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
  // v6.1 真人头像：14 岁以上用精灵图，幼年走 emoji
  const hudAva = $('hudAvatar');
  if (STATE.age >= 14) {
    hudAva.textContent = '';
    hudAva.classList.add('photo');
    const st = avaStyle(STATE.name, STATE.gender).split(':');
    hudAva.style.backgroundPosition = st[1];
  } else {
    hudAva.classList.remove('photo');
    hudAva.style.backgroundPosition = '';
    hudAva.textContent = ageAvatar(STATE.age, STATE.gender);
  }
  $('hudName').textContent = `${STATE.name} · ${STATE.gender === 'M' ? '男' : '女'} · ${STATE.familyName.split(' ')[0]}`;
  $('hudAge').textContent = `${STATE.age} / ${END_AGE}岁 · ${fmtYear(STATE)} 年 · ${STATE.job || defaultJob(STATE.age)}`;
  $('hudCash').textContent = fmtMoney(s.MONEY);
  $('hudWorth').textContent = fmtMoney(netWorth(STATE));

  // 属性条：只露 6 项核心属性，次要的点「＋更多」展开
  const chip = (st) => {
    const v = Math.round(s[st.key] === undefined ? 60 : s[st.key]);
    const bad = st.warn ? !!st.warn(v) : false;
    return `<span class="m ${bad ? 'bad' : ''}" title="${escAttr(st.hint || st.name)}"><i>${st.name}</i><b>${v}</b></span>`;
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

/* 韩系影楼证件照调色板（柔光、低饱和、暖调） */
const P_SKIN = [
  { l: '#FFF1E2', b: '#FADCBD', s: '#E2B088' },
  { l: '#FCEBD6', b: '#F5D2AC', s: '#D8A67C' },
  { l: '#FBE3CA', b: '#EFC49B', s: '#C79563' },
  { l: '#F7D8BB', b: '#E4B189', s: '#B78158' },
  { l: '#FFE9D4', b: '#F1D0B0', s: '#D2A27C' }
];
const P_HAIR_F = [['#33261C', '#5C4028'], ['#4A2F1E', '#7B5330'], ['#5C3A22', '#8B5F37'],
  ['#2B2118', '#4E3A28'], ['#6E4526', '#97663D'], ['#402A1E', '#66472F']];
const P_HAIR_M = [['#241B14', '#3E2F20'], ['#33251A', '#55402A'], ['#2B2118', '#4A3826'],
  ['#1D1712', '#332818'], ['#3F2D1D', '#604730']];
const P_LIPS = [['#C4655C', '#E28E80'], ['#B85A54', '#D77F72'], ['#CB6A5F', '#E69386'], ['#B0514D', '#CD756B']];
const P_BG = [['#F7EAD9', '#E9D2B9'], ['#F9E7EC', '#EFD1D7'], ['#EDF1EA', '#D8E1D7'],
  ['#E9EDF4', '#D4DBE8'], ['#F6EBE4', '#E8D4C9'], ['#FBF0DC', '#F1DDC0']];
const P_CLOTH_F = [['#EFE6D8', '#D7CBB6'], ['#E6D9E5', '#CDBBD0'], ['#DAE5DE', '#BCCFC2'],
  ['#EADACF', '#D2BCAC'], ['#DDE3ED', '#C0CADD'], ['#F1E0D3', '#DCC2B0']];
const P_CLOTH_M = [['#3D4557', '#2E3545'], ['#504841', '#3B352F'], ['#385248', '#2B3D35'],
  ['#4B3C46', '#372C34'], ['#435160', '#323E4B']];

function _ell(cx, cy, rx, ry) {
  return `M${(cx - rx).toFixed(2)},${cy.toFixed(2)} a${rx.toFixed(2)},${ry.toFixed(2)} 0 1 0 ${(rx * 2).toFixed(2)},0 a${rx.toFixed(2)},${ry.toFixed(2)} 0 1 0 -${(rx * 2).toFixed(2)},0 Z`;
}

function portraitSVG(name, gender, age, opt) {
  opt = opt || {};
  const h = hashStr(name + '|' + (gender || 'X'));
  const age0 = typeof age === 'number' ? age : 20;
  const isF = String(gender).toUpperCase() === 'F';
  const kid = age0 < 13;
  const old = age0 >= 58;
  const elder = age0 >= 72;
  const uid = 'pg' + (h % 46657).toString(36) + ((h >>> 7) % 89);

  const cx = 50;
  const rx = kid ? 24.5 : 21.5;
  const ry = kid ? 28 : 26;
  const cy = kid ? 49.5 : 47;
  const ft = kid ? 21.5 : 21;   // 发际线最高点

  const tone = P_SKIN[(h >>> 2) % P_SKIN.length];
  const hairPal = isF ? P_HAIR_F : P_HAIR_M;
  const hp = hairPal[(h >>> 4) % hairPal.length];
  const hairC = old ? '#D9D5CE' : hp[0];
  const hairHL = old ? '#C6C1BA' : hp[1];
  const lipc = P_LIPS[(h >>> 6) % P_LIPS.length];
  const bgc = P_BG[(h >>> 8) % P_BG.length];
  const clothPal = isF ? P_CLOTH_F : P_CLOTH_M;
  const clc = clothPal[(h >>> 10) % clothPal.length];
  const iris = ['#5A3A22', '#492D1A', '#3D2917', '#693F24'][(h >>> 12) % 4];
  const st0 = opt.forceStyle != null ? opt.forceStyle : (h >>> 14) % 10;
  const st = (kid && st0 === 7) ? 8 : st0;   // 小孩不梳低马尾（侧坠不像话），换成丸子头

  const eyeY = cy + 1.5;
  const dx = 9.6;
  const browY = eyeY - 5.6;
  const noseY = cy + 9.2;
  const mouthY = cy + (old ? 17.5 : 17);

  const defs = `<defs>` +
    `<linearGradient id="${uid}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bgc[0]}"/><stop offset="1" stop-color="${bgc[1]}"/></linearGradient>` +
    `<radialGradient id="${uid}s" cx="0.42" cy="0.34" r="0.95"><stop offset="0" stop-color="${tone.l}"/><stop offset="0.55" stop-color="${tone.b}"/><stop offset="1" stop-color="${tone.s}"/></radialGradient>` +
    `<radialGradient id="${uid}i" cx="0.5" cy="0.35" r="0.8"><stop offset="0" stop-color="${iris}"/><stop offset="1" stop-color="#241708"/></radialGradient>` +
    `<radialGradient id="${uid}g" cx="0.5" cy="0.4" r="0.8"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".22"/><stop offset="0.72" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>` +
    `</defs>`;

  /* 脖子与衣服（先画，头发和脸压在上面） */
  const neckTop = cy + ry - 9;
  const neck = `<path d="M${cx - 6},${neckTop} L${cx - 6},83 Q${cx},87.5 ${cx + 6},83 L${cx + 6},${neckTop} Z" fill="${tone.b}"/>` +
    `<path d="M${cx - 6},${neckTop} q6,4.6 12,0 l0,4.4 q-6,3 -12,0 z" fill="${tone.s}" opacity=".35"/>`;
  const shW = kid ? 24 : 31;
  let cloth;
  if (kid) {
    cloth = `<path d="M${cx - shW},100 C${cx - shW},88 ${cx - 13},80 ${cx - 7},78.5 L${cx + 7},78.5 C${cx + 13},80 ${cx + shW},88 ${cx + shW},100 Z" fill="${clc[0]}"/>` +
      `<path d="M${cx - 7},78.5 Q${cx},83 ${cx + 7},78.5" stroke="${clc[1]}" stroke-width="1.4" fill="none" opacity=".9"/>`;
  } else if (isF) {
    cloth = `<path d="M${cx - shW},100 C${cx - shW + 1},84 ${cx - 18},77.5 ${cx - 7},75.5 L${cx - 6},80.5 Q${cx},88.5 ${cx + 6},80.5 L${cx + 7},75.5 C${cx + 18},77.5 ${cx + shW - 1},84 ${cx + shW},100 Z" fill="${clc[0]}"/>` +
      `<path d="M${cx - 7},75.5 Q${cx},88.5 ${cx + 7},75.5" stroke="${clc[1]}" stroke-width="1.6" fill="none" opacity=".85"/>` +
      `<path d="M${cx - 24},92 q7,-6 13,-7 M${cx + 24},92 q-7,-6 -13,-7" stroke="${clc[1]}" stroke-width="1.1" fill="none" opacity=".3"/>`;
  } else {
    cloth = `<path d="M${cx - shW},100 C${cx - shW + 1},84 ${cx - 18},77.5 ${cx - 7},75.5 L${cx + 7},75.5 C${cx + 18},77.5 ${cx + shW - 1},84 ${cx + shW},100 Z" fill="${clc[0]}"/>` +
      `<path d="M${cx - 7},75.5 L${cx},85 L${cx + 7},75.5 L${cx + 4.4},74.6 L${cx},80 L${cx - 4.4},74.6 Z" fill="${clc[1]}"/>` +
      `<path d="M${cx},85 L${cx},100" stroke="${clc[1]}" stroke-width="1.2" opacity=".8"/>`;
  }

  /* 脑后头发（长发披到肩下，短发的只是一圈轮廓） */
  const hw = rx + 5.5;
  let back = '';
  if (isF) {
    if (st <= 5) {          // 长直 / 长卷
      const wavy = st >= 4;
      back = `<path d="M${cx},${ft - 2.5} C${cx - 17},${ft - 2.5} ${cx - hw},${ft + 9} ${cx - hw},${cy + 5} ` +
        (wavy
          ? `L${cx - hw},87 Q${cx - hw + 6},95 ${cx - hw + 11},88 Q${cx - hw + 5},93 ${cx - hw + 11},91 `
          : `L${cx - hw},91 Q${cx - hw + 6},96.5 ${cx - hw + 11},90 `) +
        `L${cx - hw + 11},${cy + 17} C${cx - 18},${cy + 7} ${cx - 13},${cy - 15} ${cx},${cy - 15} ` +
        `C${cx + 13},${cy - 15} ${cx + 18},${cy + 7} ${cx + hw - 11},${cy + 17} ` +
        (wavy
          ? `L${cx + hw - 11},91 Q${cx + hw - 5},93 ${cx + hw - 11},88 Q${cx + hw - 6},95 ${cx + hw},87 `
          : `L${cx + hw - 11},90 Q${cx + hw - 6},96.5 ${cx + hw},91 `) +
        `C${cx + hw},${ft + 9} ${cx + 17},${ft - 2.5} ${cx},${ft - 2.5} Z" fill="${hairC}"/>` +
        `<path d="M${cx - hw + 6},${cy - 4} q-2.5,15 1,29 M${cx + hw - 6},${cy - 4} q2.5,15 -1,29" stroke="${hairHL}" stroke-width="1.5" opacity=".38" fill="none" stroke-linecap="round"/>`;
    } else if (st === 6) {  // 齐肩 BOB
      back = `<path d="M${cx},${ft - 2.5} C${cx - 17},${ft - 2.5} ${cx - hw},${ft + 9} ${cx - hw},${cy + 6} Q${cx - hw},${cy + 16} ${cx - 12},${cy + 14} L${cx - 12},${cy - 2} C${cx - 12},${cy - 11} ${cx + 12},${cy - 11} ${cx + 12},${cy - 2} L${cx + 12},${cy + 14} Q${cx + hw},${cy + 16} ${cx + hw},${cy + 6} C${cx + hw},${ft + 9} ${cx + 17},${ft - 2.5} ${cx},${ft - 2.5} Z" fill="${hairC}"/>`;
    } else if (st === 7) {  // 低马尾
      back = `<path d="M${cx},${ft - 2.5} C${cx - 17},${ft - 2.5} ${cx - hw},${ft + 9} ${cx - hw},${cy + 7} L${cx - hw},${cy + 20} Q${cx - hw + 7},${cy + 25} ${cx - 11},${cy + 20} L${cx - 11},${cy - 4} C${cx - 11},${cy - 12} ${cx + 11},${cy - 12} ${cx + 11},${cy - 4} L${cx + 11},${cy + 20} Q${cx + hw - 7},${cy + 25} ${cx + hw},${cy + 20} L${cx + hw},${cy + 7} C${cx + hw},${ft + 9} ${cx + 17},${ft - 2.5} ${cx},${ft - 2.5} Z" fill="${hairC}"/>` +
        `<ellipse cx="${cx + hw - 6.5}" cy="${cy + 22}" rx="4.2" ry="8" fill="${hairC}" transform="rotate(24 ${cx + hw - 6.5} ${cy + 22})"/>`;
    } else {                // 丸子头
      back = `<path d="M${cx},${ft - 2.5} C${cx - 17},${ft - 2.5} ${cx - hw},${ft + 9} ${cx - hw},${cy + 7} Q${cx - hw},${cy + 15} ${cx - 13},${cy + 13} L${cx - 13},${cy - 4} C${cx - 13},${cy - 12} ${cx + 13},${cy - 12} ${cx + 13},${cy - 4} L${cx + 13},${cy + 13} Q${cx + hw},${cy + 15} ${cx + hw},${cy + 7} C${cx + hw},${ft + 9} ${cx + 17},${ft - 2.5} ${cx},${ft - 2.5} Z" fill="${hairC}"/>` +
        `<circle cx="${cx}" cy="${ft - 6}" r="7.5" fill="${hairC}"/>`;
    }
  } else {
    back = `<path d="${_ell(cx, cy - 3, rx + 2.2, ry - .5)} ${_ell(cx, cy - 4.5, rx - 1.2, ry - 6.5)}" fill-rule="evenodd" fill="${hairC}"/>`;
  }

  /* 脸（鹅蛋形：顶部收窄，下颌圆润） */
  const face = `<path d="M${cx - rx},${cy - ry * 0.15} C${cx - rx},${cy - ry * 0.85} ${cx - rx * 0.5},${cy - ry} ${cx},${cy - ry} C${cx + rx * 0.5},${cy - ry} ${cx + rx},${cy - ry * 0.85} ${cx + rx},${cy - ry * 0.15} C${cx + rx},${cy + ry * 0.52} ${cx + rx * 0.55},${cy + ry} ${cx},${cy + ry} C${cx - rx * 0.55},${cy + ry} ${cx - rx},${cy + ry * 0.52} ${cx - rx},${cy - ry * 0.15} Z" fill="url(#${uid}s)"/>` +
    `<path d="M${cx - rx * 0.72},${cy + ry * 0.62} Q${cx},${cy + ry * 1.02} ${cx + rx * 0.72},${cy + ry * 0.62}" stroke="${tone.s}" stroke-width="1.6" opacity=".22" fill="none"/>`;

  /* 耳朵（长发遮耳的款式不画） */
  let ears = '';
  if (!isF || st >= 6) {
    ears = `<ellipse cx="${cx - rx + 0.5}" cy="${cy + 3}" rx="2.6" ry="4.2" fill="${tone.b}"/><ellipse cx="${cx + rx - 0.5}" cy="${cy + 3}" rx="2.6" ry="4.2" fill="${tone.b}"/>` +
      `<path d="M${cx - rx + 0.4},${cy + 1.6} q1.7,1.4 0.8,3.4 M${cx + rx - 0.4},${cy + 1.6} q-1.7,1.4 -0.8,3.4" stroke="${tone.s}" stroke-width=".8" opacity=".5" fill="none"/>`;
  }

  /* 眉眼鼻唇 */
  const eyeR = kid ? 2.15 : 1.9;
  const lashW = isF ? 1.35 : 1.15;
  let eyes = '';
  [-1, 1].forEach(sgn => {
    const x = cx + sgn * dx;
    const wing = (isF && !kid && !old) ? ` M${x + sgn * 3.2},${eyeY - 1.5} l${sgn * 1.7},-0.9` : '';
    eyes += (isF && !kid && !old ? `<ellipse cx="${x}" cy="${eyeY - 1}" rx="4.7" ry="2.7" fill="#D9A08A" opacity=".2"/>` : '') +
      `<ellipse cx="${x}" cy="${eyeY}" rx="3.7" ry="2.35" fill="#FDFBF8"/>` +
      `<circle cx="${x}" cy="${eyeY}" r="${eyeR}" fill="url(#${uid}i)"/>` +
      `<circle cx="${x}" cy="${eyeY}" r=".85" fill="#191009"/>` +
      `<circle cx="${x - .7}" cy="${eyeY - .9}" r=".55" fill="#FFFFFF" opacity=".95"/>` +
      `<circle cx="${x + .6}" cy="${eyeY + .8}" r=".28" fill="#FFFFFF" opacity=".7"/>` +
      `<path d="M${x - 3.9},${eyeY - .5} Q${x},${eyeY - 3.5} ${x + 3.9},${eyeY - 1.1}${wing}" stroke="#241A12" stroke-width="${lashW}" fill="none" stroke-linecap="round"/>` +
      `<path d="M${x - 2.6},${eyeY + 1.7} Q${x},${eyeY + 2.7} ${x + 2.6},${eyeY + 1.8}" stroke="#4A3527" stroke-width=".55" opacity=".32" fill="none"/>` +
      (isF && !kid && !old ? `<path d="M${x - 3.2},${eyeY - 3} Q${x},${eyeY - 4.6} ${x + 3},${eyeY - 3.2}" stroke="#8A5C42" stroke-width=".6" opacity=".4" fill="none"/>` : '') +
      (old ? `<path d="M${x - 2.4},${eyeY + 3.1} q2.4,1.3 4.8,0" stroke="${tone.s}" stroke-width=".7" opacity=".4" fill="none"/>` : '');
  });
  const browDrop = old ? 1.4 : 0;
  const brows = `<path d="M${cx - dx - 4.4},${browY + .7 + browDrop * .5} Q${cx - dx - .4},${browY - 1.7 + browDrop} ${cx - dx + 3.9},${browY + .3 + browDrop}" stroke="${hairC}" stroke-width="1.7" fill="none" stroke-linecap="round" opacity=".92"/>` +
    `<path d="M${cx + dx - 3.9},${browY + .3 + browDrop} Q${cx + dx + .4},${browY - 1.7 + browDrop} ${cx + dx + 4.4},${browY + .7 + browDrop}" stroke="${hairC}" stroke-width="1.7" fill="none" stroke-linecap="round" opacity=".92"/>`;
  const nose = `<path d="M${cx + 2.1},${cy - 1} q1.2,5.6 -.5,9.6" stroke="${tone.s}" stroke-width=".95" opacity=".42" fill="none" stroke-linecap="round"/>` +
    `<path d="M${cx - 2.7},${noseY + .6} q2.7,2.1 5.4,0" stroke="${tone.s}" stroke-width=".95" opacity=".5" fill="none" stroke-linecap="round"/>` +
    `<circle cx="${cx - 2.6}" cy="${noseY}" r=".6" fill="${tone.s}" opacity=".45"/><circle cx="${cx + 2.6}" cy="${noseY}" r=".6" fill="${tone.s}" opacity=".45"/>`;
  let mouth;
  if (old) {
    mouth = `<path d="M${cx - 6},${mouthY} q6,${isF ? 1.6 : 1.2} 12,0" stroke="${lipc[0]}" stroke-width="1.9" fill="none" stroke-linecap="round"/>`;
  } else if (isF) {
    mouth = `<path d="M${cx - 6.2},${mouthY} Q${cx - 3},${mouthY - 2.2} ${cx - .9},${mouthY - 1} Q${cx},${mouthY - 1.4} ${cx + .9},${mouthY - 1} Q${cx + 3},${mouthY - 2.2} ${cx + 6.2},${mouthY} Q${cx},${mouthY + 1.6} ${cx - 6.2},${mouthY} Z" fill="${lipc[0]}"/>` +
      `<path d="M${cx - 5.6},${mouthY + .5} Q${cx},${mouthY + 5.3} ${cx + 5.6},${mouthY + .5} Q${cx},${mouthY + 2.3} ${cx - 5.6},${mouthY + .5} Z" fill="${lipc[1]}"/>` +
      `<ellipse cx="${cx - 2}" cy="${mouthY + 2.6}" rx="1.9" ry=".85" fill="#FFFFFF" opacity=".32"/>`;
  } else {
    mouth = `<path d="M${cx - 6},${mouthY} Q${cx},${mouthY + 3.4} ${cx + 6},${mouthY}" stroke="#A65B50" stroke-width="1.7" fill="none" stroke-linecap="round"/>` +
      `<path d="M${cx - 4.6},${mouthY + 1.5} Q${cx},${mouthY + 3.4} ${cx + 4.6},${mouthY + 1.5}" fill="${lipc[1]}" opacity=".4"/>`;
  }
  const blushOn = isF || kid;
  const blush = blushOn ? `<ellipse cx="${cx - 14.5}" cy="${cy + 11}" rx="4.3" ry="2.4" fill="#F0A091" opacity="${kid ? .42 : .3}"/><ellipse cx="${cx + 14.5}" cy="${cy + 11}" rx="4.3" ry="2.4" fill="#F0A091" opacity="${kid ? .42 : .3}"/>` : '';

  /* 前发：一圈包住发际线，再叠刘海 */
  let fringe = '';
  if (kid) {
    fringe = `<path d="M${cx - rx + 3},${cy - 4} C${cx - rx + 3},${ft - 6} ${cx + rx - 3},${ft - 6} ${cx + rx - 3},${cy - 4} C${cx + 13},${cy - 9.5} ${cx + 6},${cy - 7.5} ${cx + 1},${cy - 11} C${cx - 4},${cy - 7.5} ${cx - 11},${cy - 9.5} ${cx - rx + 3},${cy - 4} Z" fill="${hairC}"/>` +
      `<circle cx="${cx + 6}" cy="${cy - 8.6}" r="2.1" fill="${hairC}"/>`;
  } else if (isF) {
    if (st === 2 || st === 3 || st === 6 || st === 7) {   // 中分八字帘
      fringe = `<path d="M${cx},${cy - 20.5} C${cx - 7},${cy - 19.5} ${cx - 13},${cy - 14} ${cx - 15.2},${cy - 5.5} C${cx - 14},${cy - 11} ${cx - 10},${cy - 13.5} ${cx - 5.5},${cy - 12.8} C${cx - 8},${cy - 8.5} ${cx - 8.5},${cy - 4} ${cx - 7.6},${cy - .5} C${cx - 4},${cy - 6} ${cx - 1.6},${cy - 10.5} ${cx},${cy - 13.5} Z" fill="${hairC}"/>` +
        `<path d="M${cx},${cy - 20.5} C${cx + 7},${cy - 19.5} ${cx + 13},${cy - 14} ${cx + 15.2},${cy - 5.5} C${cx + 14},${cy - 11} ${cx + 10},${cy - 13.5} ${cx + 5.5},${cy - 12.8} C${cx + 8},${cy - 8.5} ${cx + 8.5},${cy - 4} ${cx + 7.6},${cy - .5} C${cx + 4},${cy - 6} ${cx + 1.6},${cy - 10.5} ${cx},${cy - 13.5} Z" fill="${hairC}"/>`;
    } else {                                              // 侧分大帘
      fringe = `<path d="M${cx - 16},${cy - 5} C${cx - 16.5},${cy - 17} ${cx - 8},${cy - 21.5} ${cx},${cy - 21.5} C${cx + 9.5},${cy - 21.5} ${cx + 16},${cy - 15} ${cx + 16},${cy - 5} C${cx + 14.5},${cy - 11.5} ${cx + 9},${cy - 15.5} ${cx + 2.5},${cy - 15.5} C${cx + 6},${cy - 10.5} ${cx + 5},${cy - 6.5} ${cx + 2.6},${cy - 3.5} C${cx - 2},${cy - 10} ${cx - 9.5},${cy - 11} ${cx - 12.5},${cy - 4.5} Z" fill="${hairC}"/>`;
    }
  } else {
    if (st <= 2) {          // 碎盖 / 蘑菇头
      fringe = `<path d="M${cx - 13.5},${cy - 9} C${cx - 14},${cy - 18} ${cx + 14},${cy - 18} ${cx + 13.5},${cy - 9} C${cx + 10.5},${cy - 13.2} ${cx + 4},${cy - 15} ${cx - .5},${cy - 14} C${cx - 6.5},${cy - 13} ${cx - 11},${cy - 11.5} ${cx - 13.5},${cy - 9} Z" fill="${hairC}"/>`;
    } else if (st <= 4) {   // 侧分油头
      fringe = `<path d="M${cx - 14},${cy - 6} C${cx - 14.5},${cy - 18} ${cx - 6},${cy - 21.5} ${cx + 2},${cy - 21} C${cx + 10},${cy - 20.5} ${cx + 14.5},${cy - 14} ${cx + 14},${cy - 6} C${cx + 13},${cy - 12} ${cx + 8},${cy - 15.5} ${cx + 2},${cy - 15.5} C${cx - 4},${cy - 15.5} ${cx - 8},${cy - 13} ${cx - 9.5},${cy - 8} C${cx - 10.5},${cy - 5.5} ${cx - 12},${cy - 5} ${cx - 14},${cy - 6} Z" fill="${hairC}"/>`;
    } else if (st <= 6) {   // 寸头
      fringe = `<path d="${_ell(cx, cy - 1.2, rx + 2.2, ry + 1.2)} ${_ell(cx, cy + 5, rx - 1.4, ry - 5)}" fill-rule="evenodd" fill="${hairC}" opacity=".95"/>`;
    } else if (st <= 8) {   // 微卷
      fringe = `<path d="M${cx - 13},${cy - 7} C${cx - 13},${cy - 18.5} ${cx + 13},${cy - 18.5} ${cx + 13},${cy - 7} C${cx + 10},${cy - 12.5} ${cx + 3},${cy - 14.5} ${cx - 1},${cy - 13} C${cx - 6},${cy - 11.5} ${cx - 10.5},${cy - 10} ${cx - 13},${cy - 7} Z" fill="${hairC}"/>` +
        `<circle cx="${cx - 10.5}" cy="${cy - 14.6}" r="2.9" fill="${hairC}"/><circle cx="${cx - 3.5}" cy="${cy - 15.8}" r="3.1" fill="${hairC}"/><circle cx="${cx + 3.5}" cy="${cy - 15.4}" r="3" fill="${hairC}"/><circle cx="${cx + 10.5}" cy="${cy - 13.8}" r="2.7" fill="${hairC}"/>`;
    } else {                // 背头 + 美人尖
      fringe = `<path d="M${cx - 14.5},${cy - 6} C${cx - 15},${cy - 18} ${cx + 15},${cy - 18} ${cx + 14.5},${cy - 6} C${cx + 13},${cy - 13} ${cx + 6},${cy - 16.5} ${cx},${cy - 16.5} C${cx - 6},${cy - 16.5} ${cx - 13},${cy - 13} ${cx - 14.5},${cy - 6} Z" fill="${hairC}"/>` +
        `<path d="M${cx},${cy - 16.5} l-2.5,4.6 l5,0 Z" fill="${hairC}"/>`;
    }
  }
  const ring = `<path d="${_ell(cx, cy - 1.2, rx + 2.2, ry + 1.2)} ${_ell(cx, kid ? cy + 3.6 : (isF ? cy + 4.2 : cy + 5), kid ? rx - 4.2 : (isF ? rx - 5.2 : rx - 2.4), kid ? ry - 7.6 : (isF ? ry - 8.2 : ry - 5))}" fill-rule="evenodd" fill="${hairC}"/>`;
  const shine = `<path d="M${cx - 10},${cy - 15.5} q10,-5.5 20,-1.5" stroke="${hairHL}" stroke-width="1.5" opacity=".5" fill="none" stroke-linecap="round"/>` +
    `<path d="M${cx - 13},${cy - 12.5} q5,-3.5 11,-4" stroke="${hairHL}" stroke-width="1" opacity=".32" fill="none" stroke-linecap="round"/>`;

  /* 岁月痕迹 / 眼镜 / 耳饰 */
  const wrinkleBrow = elder ? `<g stroke="${tone.s}" stroke-width=".9" fill="none" opacity=".55"><path d="M${cx - 13},${cy - 12.5} q13,-2.5 26,0"/><path d="M${cx - 10},${cy - 9.5} q10,-2 20,0"/></g>` : '';
  const wrinkle = old ? `<g stroke="${tone.s}" stroke-width=".9" fill="none" opacity=".6">` +
    `<path d="M${cx - dx - 5.5},${eyeY - .5} q-2.4,-2.4 -4.6,-1.6 M${cx - dx - 5.2},${eyeY + 1.4} q-2.2,-1 -4,-.4"/>` +
    `<path d="M${cx + dx + 5.5},${eyeY - .5} q2.4,-2.4 4.6,-1.6 M${cx + dx + 5.2},${eyeY + 1.4} q2.2,-1 4,-.4"/>` +
    `<path d="M${cx - 9.5},${cy + 10.5} q2.6,4 1.2,8 M${cx + 9.5},${cy + 10.5} q-2.6,4 -1.2,8"/></g>` : '';
  const glass = (((h >>> 5) % 6 === 0) || old) ? `<g stroke="#39322C" stroke-width="1.4" fill="rgba(255,255,255,.15)">` +
    `<rect x="${cx - dx - 5.4}" y="${eyeY - 4.4}" width="10.8" height="8.9" rx="4.2"/>` +
    `<rect x="${cx + dx - 5.4}" y="${eyeY - 4.4}" width="10.8" height="8.9" rx="4.2"/>` +
    `<path d="M${cx - dx + 5.4},${eyeY - .8} q${dx - 5.4},-1.8 ${2 * (dx - 5.4)},0" fill="none"/>` +
    `<path d="M${cx - dx - 5.4},${eyeY - 1.5} l-3.4,-1.2 M${cx + dx + 5.4},${eyeY - 1.5} l3.4,-1.2" fill="none"/></g>` : '';
  const earring = (isF && !kid && (h >>> 15) % 3 === 0 && (!isF || st >= 6))
    ? `<circle cx="${cx - rx + .5}" cy="${cy + 8}" r="1.15" fill="#E8C36A"/><path d="M${cx - rx + .5},${cy + 9.1} l0,2.4" stroke="#E8C36A" stroke-width=".7"/><circle cx="${cx + rx - .5}" cy="${cy + 8}" r="1.15" fill="#E8C36A"/><path d="M${cx + rx - .5},${cy + 9.1} l0,2.4" stroke="#E8C36A" stroke-width=".7"/>` : '';

  return `<svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" aria-label="${escAttr(name || '')}">` +
    defs +
    `<rect width="100" height="100" fill="url(#${uid}b)"/>` +
    `<rect width="100" height="100" fill="url(#${uid}g)"/>` +
    neck + cloth + back + ears + face +
    wrinkleBrow + blush + nose + mouth + brows + eyes +
    ring + fringe + shine +
    glass + wrinkle + earring +
    `</svg>`;
}

/* 包装成可放进 rel-ava 的方块
 * v6.1 真人照片头像：14 岁以上用精灵图（见 avaIndex），幼年仍走 SVG 画像（照片里没有小孩） */
function personAvatar(name, gender, age, cls, opt) {
  if (age == null || age >= 14) {
    return `<span class="rel-ava pic photo ${cls || ''}" style="${avaStyle(name, gender)}"></span>`;
  }
  return `<span class="rel-ava pic ${cls || ''}">${portraitSVG(name, gender, age, opt)}</span>`;
}

/* ---------- v6.1 真人头像精灵图（assets/avatars.jpg · 10 列 × 4 行） ----------
 * 上两行是女（0-19），下两行是男（20-39）。
 * 同一个人一辈子同一张脸：按 hash(名字|性别) 确定性取格，不需要写进存档。 */
const AVA_COLS = 10, AVA_ROWS = 4, AVA_FACES = 20;
function avaIndex(name, gender) {
  const h = hashStr(String(name || '?') + '|' + (gender === 'F' ? 'F' : 'M'));
  return (h % AVA_FACES) + (gender === 'F' ? 0 : AVA_FACES);
}
function avaStyle(name, gender) {
  const idx = avaIndex(name, gender);
  const col = idx % AVA_COLS, row = Math.floor(idx / AVA_COLS) % AVA_ROWS;
  /* background-size 1000% 400% 时，position 百分比 = col/(cols-1)、row/(rows-1) */
  return `background-position:${(col * 100 / (AVA_COLS - 1)).toFixed(2)}% ${(row * 100 / (AVA_ROWS - 1)).toFixed(2)}%`;
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
  // 散工口径与 engine.js 的年结算共用同一个 freelanceIncome()，不再各写一份公式
  const income = STATE.career ? careerIncome(STATE) : freelanceIncome(STATE);
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
      return `<span class="ach ${on ? 'on' : ''}" title="${escAttr(a.name + '：' + a.desc)}">${a.icon}<i>${esc(a.name)}</i></span>`;
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
/* v6 走亲访友送礼：陪伴 + 三档礼物（价格显著影响关系值），一年每人一次 */
function giftMulti(who, key) {
  const touch = STATE.giftTouch || {};
  const used = touch[who] === STATE.age;
  const interact = key
    ? ((STATE.socialTouch || {})[key] === STATE.age
        ? '<span class="rel-act dis">今年已互动</span>'
        : `<button class="rel-act" onclick="uiSocial('${key}')">陪伴</button>`)
    : '';
  const gifts = used ? '<span class="rel-act dis">礼已送</span>'
    : `<button class="rel-act" onclick="uiGift('${who}','gift_small')">心意礼 ${fmtMoney(GIFT_CATALOG[0].cost)}</button>` +
      `<button class="rel-act" onclick="uiGift('${who}','gift_big')">重礼 ${fmtMoney(GIFT_CATALOG[2].cost)}</button>` +
      `<button class="rel-act" onclick="uiGift('${who}','gift_huge')">豪礼 ${fmtMoney(GIFT_CATALOG[3].cost)}</button>`;
  return interact + gifts;
}

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
          ? { avaSvg: personAvatar(ps.father.name, 'M', ps.father.age, ''), name: `父亲 · ${ps.father.name}`, sub: `${ps.father.age}岁 · ${ps.father.job || '工人'} · ${hpText(ps.father.hp)} · 亲近 ${Math.round(ps.father.affinity)}%。他不爱说话，但每次你出事，第一个到的是他。`, key: 'father', multi: giftMulti('father', 'father') }
          : { avaSvg: personAvatar(ps.father.name, 'M', ps.father.age, 'amber'), name: `父亲 · ${ps.father.name}`, sub: `已故。走得那年 ${ps.father.age}岁。`, dead: true });
      }
      if (ps.mother) {
        cards.push(ps.mother.alive
          ? { avaSvg: personAvatar(ps.mother.name, 'F', ps.mother.age, ''), name: `母亲 · ${ps.mother.name}`, sub: `${ps.mother.age}岁 · ${ps.mother.job || '工人'} · ${hpText(ps.mother.hp)} · 亲近 ${Math.round(ps.mother.affinity)}%。她记得你所有的口味。`, key: 'mother', multi: giftMulti('mother', 'mother') }
          : { avaSvg: personAvatar(ps.mother.name, 'F', ps.mother.age, 'amber'), name: `母亲 · ${ps.mother.name}`, sub: `已故。走得那年 ${ps.mother.age}岁。`, dead: true });
      }
    }
    const oppG = STATE.gender === 'M' ? 'F' : 'M';
    exList(STATE).forEach((ex, i) => {
      const canChat = ex.lastTouch !== STATE.age;
      const canRe = ex.wasSpouse && !STATE.flags.married && (ex.affinity || 0) >= LOVE_META.marryAffinity && STATE.age >= LOVE_META.marryAge;
      const canRe2 = !STATE.flags.married && !STATE.flags.dating && (ex.affinity || 0) >= 55;
      const tag = ex.wasSpouse ? (STATE.gender === 'M' ? '前妻' : '前夫') : '前任';
      cards.push({
        avaSvg: personAvatar(ex.name, ex.gender || oppG, ex.age || STATE.age, 'amber'),
        name: `${tag} · ${ex.name}`,
        sub: `${ex.at || STATE.age} 岁那年${ex.wasSpouse ? '离的' : '分开的'}${ex.reason ? `（${esc(ex.reason)}）` : ''} · 好感 ${Math.round(ex.affinity || 0)}%` +
          `${canChat ? '' : ' · 今年联系过了'}${STATE.childCount && ex.wasSpouse ? ' · 孩子的事，你们还得见面' : ''}`,
        key: null,
        multi: `${canChat ? `<button class="rel-act" onclick="uiExChat(${i})">联系</button>` : '<span class="rel-act dis">今年联系过了</span>'}` +
          `${canRe2 ? `<button class="rel-act" onclick="uiRekindle(${i})">复合</button>` : ''}` +
          `${canRe ? `<button class="rel-act" onclick="uiRemarry(${i})">复婚</button>` : ''}`
      });
    });
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
      const lv0 = loveInit(STATE);
      const dp = lv0.partner;
      cards.push({
        avaSvg: personAvatar(dp ? dp.name : '恋人', oppG, dp ? dp.age : STATE.age, 'green'),
        name: dp ? `${dp.name} · 恋人` : '恋人',
        sub: dp ? `${loverLabel(dp)} · 交往中。关系是要经营的。` : '交往中。关系是要经营的。', key: 'spouse'
      });
    }
    (STATE.children || []).forEach(c => {
      const ca = childAge(STATE, c);
      const stage = ca < 3 ? '蹒跚学步' : ca < 7 ? '上幼儿园了' : ca < 13 ? '上小学了' : ca < 16 ? '念初中' : ca < 19 ? '念高中' : ca < 23 ? '念大学' : '已经长大';
      cards.push({
        avaSvg: personAvatar(c.name, c.gender || 'M', ca, ''),
        name: `${c.name} · ${c.gender === 'F' ? '女儿' : '儿子'}`,
        sub: `${ca} 岁 · ${stage}。陪伴错过了就回不来了。`,
        key: null
      });
    });
    if (STATE.childCount) {
      cards.push({
        ava: '🧸', cls: '', name: `陪孩子们待一天`,
        sub: `${STATE.grandCount ? `你已经是 ${STATE.grandCount} 个孙辈的祖辈了。` : '一年的陪伴，是他们记一辈子的东西。'}`,
        key: 'child', multi: giftMulti('child', 'child')
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
          ${!married ? `<button class="rel-act danger" onclick="uiBreakup(${i})">分手</button>` : ''}
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
  } else if (REL_TAB === 'relax') {
    /* S-01 ③：成年期唯一系统性的减压出口。三条共享一个年度额度（spec §2.③3.3），
     * 所以这里必须把「今年还剩几次」讲清楚，否则玩家会以为是三条各一次。 */
    const st = Math.round(STATE.stats.STRESS || 0);
    const used = STATE.relaxUsedYear === STATE.age;
    extra = `<div class="rel-sub" style="padding:0 4px 8px">压力 ${st}。` +
      `<b>今年还${used ? '没有' : '有 1 次'}机会</b>——三条只能选一条，选了就没了。` +
      `${st < 10 ? '（说实话，你现在好像没那么累。）' : ''}</div>`;
    RELAX_ACTS.forEach(r => {
      const b = relaxBranch(r, STATE.age);
      const young = STATE.age < (r.minAge || 0);
      const poor = b.cost > (STATE.stats.MONEY || 0);
      // 条件门槛（NET < 20 叫不出八个人）—— 提示语本身就是叙事，直接取 condMsg
      let condFail = '';
      if (r.cond && r.cond.min) {
        for (const k in r.cond.min) { if ((STATE.stats[k] || 0) < r.cond.min[k]) condFail = r.condMsg || '条件还不满足'; }
      }
      const off = used || young || poor || !!condFail;
      const hint = used ? '今年已经用过了'
        : (young ? `${r.minAge} 岁以后`
          : (poor ? '钱不够' : (condFail ? condFail : (st < 10 ? '你现在好像不需要这个' : ''))));
      cards.push({
        avaSvg: `<span class="rel-ava ${used ? 'amber' : ''}" style="font-size:24px">${r.icon}</span>`,
        name: r.name,
        sub: `${esc(b.desc)}　→ 压力 ${b.eff.STRESS}${b.cost ? ` · 花费 ${fmtMoney(b.cost)}` : ' · 不花钱'}` +
          (hint ? ` · ${hint}` : ''),
        key: null,
        // E-1：STRESS 低时仍允许使用（还有 LOVE/HP 收益），只提示不禁止 —— 禁止会剥夺自主感
        multi: off ? `<span class="rel-act dis">${hint || '今年做不了'}</span>`
          : `<button class="rel-act" onclick="uiRelaxAct('${r.id}')">就做这个</button>`
      });
    });
  } else if (REL_TAB === 'pets') {
    /* v6 宠物生态：商店 / 喂养 / 美容 / 选美 / 繁育 / 赛马 */
    const pets = (typeof petsInit === 'function') ? petsInit(STATE) : [];
    const alive = pets.filter(p => p.alive);
    extra = `<div class="rel-sub" style="padding:0 4px 8px">宠物 ${alive.length}/${typeof PET_CAP !== 'undefined' ? PET_CAP : 4} · 每年自动喂养（没现金会掉亲密）</div>`;
    // 商店
    extra += `<div class="pet-shop">` + Object.keys(PET_TYPES).map(tp => {
      const t = PET_TYPES[tp];
      const poor = t.price > STATE.stats.MONEY;
      return `<button class="pet-buy" ${poor ? 'disabled' : ''} onclick="uiPetBuy('${tp}')">${t.icon} ${t.name}<i>${fmtMoney(t.price)}</i></button>`;
    }).join('') + `</div>`;
    // 已养宠物卡
    alive.forEach((p, i) => {
      const t = PET_TYPES[p.type];
      cards.push({
        ava: t.icon, cls: p.baby ? 'green' : '',
        name: `${p.name} · ${t.name}${p.baby ? '（幼崽）' : ''}`,
        sub: `${p.age}岁 · 亲密 ${Math.round(p.bond)}% · 美容 ${p.groom || 0}/5 · 年喂 ${fmtMoney(t.feed)}`,
        key: null,
        multi:
          `<button class="rel-act" onclick="uiPetFeed(${i})">喂养</button>` +
          `<button class="rel-act" onclick="uiPetGroom(${i})">美容</button>` +
          `<button class="rel-act" onclick="uiPetBeauty(${i})">选美 ${fmtMoney(BEAUTY_FEE)}</button>`
      });
    });
    // 繁育
    if (alive.length >= 2) {
      const pair = alive.find((a, i) => alive.slice(i + 1).some(b => b.type === a.type && a.age >= 2 && b.age >= 2));
      cards.push({
        ava: '🐣', cls: 'amber', name: '让它们试着繁育一窝',
        sub: pair ? `${pair.name} 和同伴都成年了，可以试试。` : '需要两只同类型、两岁以上的宠物。',
        key: null,
        multi: pair ? `<button class="rel-act" onclick="uiPetBreed()">配对</button>` : ''
      });
    }
    // 赛马
    if (typeof horseOwn === 'function' && horseOwn(STATE)) {
      const h = STATE.horse;
      cards.push({
        ava: '🐎', cls: 'green', name: `赛马 · ${h.name}`,
        sub: `${h.age}岁 · 训练 ${h.train}/10 · 夺冠 ${h.wins || 0} 次`,
        key: null,
        multi:
          `<button class="rel-act" onclick="uiHorseTrain()">训练 ${fmtMoney(HORSE_TRAIN_COST)}</button>` +
          `<button class="rel-act" onclick="uiHorseRace()">参赛 ${fmtMoney(HORSE_RACE_FEE)}</button>`
      });
    } else {
      cards.push({
        ava: '🐎', cls: 'amber', name: '赛马线',
        sub: `买一匹 ${fmtMoney(HORSE_PRICE)}，或者花 ${fmtMoney(5000000)} 去草原碰碰运气（45% 套得住）。`,
        key: null,
        multi:
          `<button class="rel-act" ${STATE.stats.MONEY >= HORSE_PRICE ? '' : 'disabled'} onclick="uiHorseBuy()">买马</button>` +
          `<button class="rel-act" ${STATE.stats.MONEY >= 5000000 ? '' : 'disabled'} onclick="uiHorseCatch()">草原捕捉</button>`
      });
    }
  } else if (REL_TAB === 'life') {
    /* v6 生活页：度假 / 图书馆 / 遗嘱 / 重生 / 监狱状态 */
    const vacUsed = STATE.vacYear === STATE.age;
    const inPrison = (STATE.prison || 0) > 0;
    if (inPrison) {
      cards.push({ ava: '⛓', cls: 'amber', name: `服刑中（还剩 ${STATE.prison} 年）`, sub: '高墙内外是两个世界。好好表现，读点书，等出去的那天。', key: null });
    }
    // 度假
    VACATIONS.forEach(v => {
      const poor = v.cost > STATE.stats.MONEY;
      const locked = v.minYear && fmtYear(STATE) < v.minYear;
      cards.push({
        ava: v.icon, cls: '', name: v.name,
        sub: `${esc(v.desc)} → 压力 ${v.eff.STRESS} · 花费 ${fmtMoney(v.cost)}${locked ? ` · ${v.minYear} 年后解锁` : ''}${vacUsed ? ' · 今年度过了' : ''}`,
        key: null,
        multi: (vacUsed || poor || inPrison || locked) ? `<span class="rel-act dis">${inPrison ? '服刑中' : (locked ? `${v.minYear} 年后` : (vacUsed ? '今年度过了' : '钱不够'))}</span>`
          : `<button class="rel-act" onclick="uiVacation('${v.id}')">出发</button>`
      });
    });
    // 图书馆
    const libUsed = (STATE.socialTouch || {}).library === STATE.age;
    cards.push({
      ava: '📚', cls: '', name: '泡一天图书馆',
      sub: `智力 +2~4 · 意志 +1。智力 70+ 有机会被《超级大脑》节目组看中。${libUsed ? ' · 今年来过了' : ''}`,
      key: null,
      multi: libUsed ? '<span class="rel-act dis">今年来过了</span>' : '<button class="rel-act" onclick="uiLibrary()">去学习</button>'
    });
    // 遗嘱
    if (typeof canMakeWill === 'function' && canMakeWill(STATE)) {
      const opts = willHeirOptions(STATE);
      cards.push({
        ava: '🖋', cls: STATE.will ? 'green' : 'amber',
        name: STATE.will ? `遗嘱已立 · ${STATE.will.heir.name} · ${STATE.will.share * 100}%` : '立一份遗嘱',
        sub: STATE.will ? '去公证处改遗嘱也可以。' : '把名下资产指定给最放不下的人。老年（60+）或病危时可以立。',
        key: null,
        multi: opts.map((o, i) => `<button class="rel-act" onclick="uiMakeWill('${o.kind === 'child' ? 'child:' + o.idx : 'grand'}')">留给${o.kind === 'grand' ? '孙辈' : esc(o.label.split('（')[0])}</button>`).join('')
      });
    } else if (STATE.age >= 50) {
      cards.push({ ava: '🖋', cls: '', name: '遗嘱', sub: `${WILL_MIN_AGE - STATE.age > 0 ? `还有 ${WILL_MIN_AGE - STATE.age} 年满 60。` : ''}到了年纪（或病危时）可以来立遗嘱。`, key: null });
    }
    /* ---------- v6.1 家族信托 ---------- */
    if (typeof canSetupTrust === 'function') {
      const ti = trustInfo();
      if (ti) {
        cards.push({ ava: '🏦', cls: 'green', name: `家族信托 · ${fmtMoney(ti.money)}`,
          sub: `${esc(ti.founder)} 设立于 ${ti.sinceYear} 年。本金永远锁死，每一代按 0.6% 领年度给付——败家子也饿不死。`, key: null });
      } else if (canSetupTrust(STATE)) {
        const net = Math.max(0, netWorth(STATE));
        const mkAmt = r => Math.round(net * r);
        cards.push({ ava: '🏦', cls: '', name: '设立家族信托',
          sub: `把一部分钱锁进取不出来的保险柜，换子孙后代每年一笔「饿不死的工资」（本金 0.6%）。净资产 ${fmtMoney(net)}。`, key: null,
          multi: [0.2, 0.35, 0.5].map(r => `<button class="rel-act" onclick="uiTrust(${mkAmt(r)})">存 ${fmtMoney(mkAmt(r))}</button>`).join('') });
      }
    }
    /* ---------- v6.1 圈层系统 ---------- */
    if (typeof CLUBS !== 'undefined' && STATE.age >= 18 && STATE.prison === 0) {
      CLUBS.forEach(c => {
        const joined = (STATE.clubs || []).indexOf(c.id) >= 0;
        const joinable = clubJoinable(STATE, c.id);
        cards.push({ ava: c.icon, cls: joined ? 'green' : '', name: c.name + (joined ? '<span class="club-badge">会员</span>' : ''),
          sub: `${esc(c.desc)} 年费 ${fmtMoney(c.fee)}。${joined ? '圈层的消息，比新闻快一年。' : (joinable ? '身家够了，可以递申请了。' : '门槛未到（身家 / 身份）。')}`, key: null,
          multi: joined ? '<span class="rel-act dis">今年年费已缴</span>'
            : (joinable ? `<button class="rel-act" onclick="uiClubJoin('${c.id}')">入会 ${fmtMoney(c.fee)}</button>` : '<span class="rel-act dis">门槛未到</span>') });
      });
    }
    /* ---------- v6.1 银发经济（第二春） ---------- */
    if (STATE.age >= 50) {
      const profOff = STATE.profYear === STATE.age;
      const bookOff = STATE.bookYear === STATE.age;
      const inPrison = STATE.prison > 0;
      cards.push({ ava: '🎓', cls: profOff ? 'amber' : '', name: '客座教授',
        sub: `回大学讲一门课（本科 / 智力 70）。课酬按资历与智力结算。${profOff ? ' · 今年讲过了' : ''}`, key: null,
        multi: (STATE.age >= 60 && !profOff && !inPrison && ((STATE.edu.eduLevel || 0) >= 3 || (STATE.stats.INT || 0) >= 70))
          ? '<button class="rel-act" onclick="uiSilver(\'prof\')">去讲课</button>'
          : `<span class="rel-act dis">${inPrison ? '服刑中' : (profOff ? '今年讲过了' : (STATE.age < 60 ? '60 岁起' : '资历不够'))}</span>` });
      cards.push({ ava: '📖', cls: bookOff ? 'amber' : '', name: '写自传',
        sub: `把这一生写在纸上。版税按巅峰身家与成就结算。${bookOff ? ' · 今年写过了' : ''}`, key: null,
        multi: (STATE.age >= 60 && !bookOff && !inPrison)
          ? '<button class="rel-act" onclick="uiSilver(\'book\')">动笔</button>'
          : `<span class="rel-act dis">${inPrison ? '服刑中' : (bookOff ? '今年写过了' : '60 岁起')}</span>` });
      cards.push({ ava: '❤️', cls: STATE.flags.foundation ? 'green' : '', name: STATE.flags.foundation ? '慈善基金会 · 运作中' : '创办慈善基金会',
        sub: STATE.flags.foundation ? '第一批教室已经盖起来了。声望与道德，比利息涨得快。' : `一次性出资 ${fmtMoney(FUND_COST)}。道德 +12 · 声望 +12 · 门阀声望加成。`, key: null,
        multi: STATE.flags.foundation ? '<span class="rel-act dis">基金会运作中</span>'
          : ((STATE.age >= 50 && !inPrison && STATE.stats.MONEY >= FUND_COST) ? '<button class="rel-act" onclick="uiSilver(\'fund\')">注资创办</button>'
            : `<span class="rel-act dis">${inPrison ? '服刑中' : (STATE.age < 50 ? '50 岁起' : '钱不够')}</span>`) });
    }
    /* ---------- v6.1 养老服务 ---------- */
    if (STATE.age >= 55 && typeof RETIRE_PLANS !== 'undefined') {
      RETIRE_PLANS.forEach(rp => {
        const locked = rp.minYear && fmtYear(STATE) < rp.minYear;
        const cur = STATE.retirePlan === rp.id;
        cards.push({ ava: rp.icon, cls: cur ? 'green' : '', name: rp.name,
          sub: `${esc(rp.desc)} 年费 ${fmtMoney(rp.fee)}${locked ? ` · ${rp.minYear} 年后解锁` : ''}`, key: null,
          multi: cur ? '<span class="rel-act dis">已入住</span>'
            : (locked ? `<span class="rel-act dis">${rp.minYear} 年后</span>`
              : `<button class="rel-act" onclick="uiRetire('${rp.id}')">入住</button>`) });
      });
    }
    /* ---------- v6.1 先进医疗 ---------- */
    if (STATE.age >= 40 && (STATE.ill || (STATE.stats.HP || 0) < 45)) {
      const hasGene = STATE.medGeneYear === STATE.age;
      const hasOrgan = STATE.medOrganYear === STATE.age;
      cards.push({ ava: '🧬', cls: hasGene ? 'amber' : '', name: '海外基因修复',
        sub: '顶级私人医院的细胞重编程疗程：健康 +15。三年内只做一次。', key: null,
        multi: hasGene ? '<span class="rel-act dis">今年做过了</span>'
          : `<button class="rel-act" ${STATE.stats.MONEY >= 80000000 ? '' : 'disabled'} onclick="uiMedical('gene')">疗程 ${fmtMoney(80000000)}</button>` });
      cards.push({ ava: '🫀', cls: hasOrgan ? 'amber' : '', name: STATE.ill ? `器官更换（针对：${STATE.ill.name}）` : '器官更换体检',
        sub: STATE.ill ? '换掉报废的零件，大病直接痊愈，健康 +10。' : '目前没有需要更换的器官。', key: null,
        multi: hasOrgan ? '<span class="rel-act dis">今年做过了</span>'
          : (STATE.ill ? `<button class="rel-act" ${STATE.stats.MONEY >= 150000000 ? '' : 'disabled'} onclick="uiMedical('organ')">手术 ${fmtMoney(150000000)}</button>`
            : '<span class="rel-act dis">暂无必要</span>') });
    }
    /* ---------- v6.1 冷冻休眠 ---------- */
    if (typeof canCryo === 'function') {
      const info = (typeof prestigeInfo === 'function') ? prestigeInfo() : null;
      if (info && info.cryo) {
        cards.push({ ava: '🧊', cls: 'amber', name: `冷冻舱 · ${esc(info.cryo.name)}`,
          sub: `自 ${info.cryo.frozenYear} 年沉睡（当年 ${info.cryo.frozenAge} 岁）。第 ${info.cryo.thawGen} 代之后可唤醒。`, key: null });
      }
      if (canCryo(STATE)) {
        cards.push({ ava: '🧊', cls: '', name: '冷冻休眠',
          sub: `清算全部资产的八成入舱，支付 ${fmtMoney(CRYO_COST)} 冷冻费。两代人之后医学攻克绝症，可苏醒接管家族。`, key: null,
          multi: '<button class="rel-act danger" onclick="uiCryo()">签字冷冻</button>' });
      }
    }
    // 人生重来
    cards.push({
      ava: '🥚', cls: '', name: '人生重来',
      sub: '如果这一世满是遗憾——完整重置，上一世的阅历会化为先天记忆（智力 +3 · 意志 +3）。',
      key: null,
      multi: `<button class="rel-act" onclick="uiRebirth()">重来一世</button>`
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
      <button class="rel-tab ${REL_TAB === 'relax' ? 'active' : ''}" onclick="setRelTab('relax')">🍃 减压</button>
      <button class="rel-tab ${REL_TAB === 'pets' ? 'active' : ''}" onclick="setRelTab('pets')">🐾 宠物</button>
      <button class="rel-tab ${REL_TAB === 'life' ? 'active' : ''}" onclick="setRelTab('life')">🧭 生活</button>
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
  markDirty();
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

/* 分手：结束一段恋爱关系 */
function uiBreakup(i) {
  const lv = loveInit(STATE);
  const l = lv.candidates[i];
  if (!l) return;
  uiConfirm('确定要分手吗',
    `和 <b>${esc(l.name)}</b> 分手？<br>好感会掉、心情会差，TA 会进入「前任」名单。这一步不可撤销。`,
    '分手', () => {
      const r = breakup(STATE, i);
      if (!r.ok) { toast(r.msg || '现在不行'); return; }
      afterAct('分开了');
    });
}

/* 前任：联系 / 复合 / 复婚 */
function uiExChat(i) {
  const r = exChat(STATE, i);
  if (!r.ok) { toast(r.msg || '现在不行'); return; }
  afterAct('聊了一场');
}

function uiRekindle(i) {
  const ex = exList(STATE)[i];
  if (!ex) return;
  uiConfirm('想复合吗',
    `和 <b>${esc(ex.name)}</b> 重新开始？<br>TA 现在的好感是 ${Math.round(ex.affinity || 0)}%——太低的话，会被拒绝。`,
    '重新开始', () => {
      const r = rekindle(STATE, i);
      if (!r.ok) { toast(r.msg || '没成'); return; }
      afterAct('旧情复燃');
    });
}

function uiRemarry(i) {
  const ex = exList(STATE)[i];
  if (!ex) return;
  uiConfirm('申请复婚',
    `和前配偶 <b>${esc(ex.name)}</b> 重新领证？<br>需要感情 ≥ ${LOVE_META.marryAffinity}%，还要再办一场酒席（${fmtMoney(6000000)}）。`,
    '复婚', () => {
      const r = remarryEx(STATE, i);
      if (!r.ok) { toast(r.msg || '没成'); return; }
      afterAct('复婚了');
    });
}

/* 做件好事：道德是可以主动攒的 */
function uiGoodDeed(id) {
  const r = doGoodDeed(STATE, id);
  if (!r.ok) { toast(r.msg || '现在不行'); return; }
  afterAct('道德 +');
}

/* 减压：三条共享一个年度额度，用完就没了（S-01 ③） */
function uiRelaxAct(id) {
  const r = doRelaxAct(STATE, id);
  if (!r.ok) { toast(r.msg || '现在不行'); return; }
  afterAct('松了一口气');
}

/* ============ v6.0 UI 动作 ============ */
function uiGift(who, giftId) {
  const r = familyGift(STATE, who, giftId);
  if (!r.ok) { toast(r.msg || '送不了'); return; }
  afterAct(`好感 +${r.gain}`);
}
function uiPetBuy(type) {
  const r = petBuy(STATE, type);
  if (!r.ok) { toast(r.msg || '买不了'); return; }
  afterAct('家里多了个新成员');
}
function uiPetFeed(i) {
  const r = petFeed(STATE, i);
  if (!r.ok) { toast(r.msg || '喂不了'); return; }
  afterAct('吃得津津有味');
}
function uiPetGroom(i) {
  const r = petGroom(STATE, i);
  if (!r.ok) { toast(r.msg || '做不了'); return; }
  afterAct('美了个容');
}
function uiPetBeauty(i) {
  const r = petBeautyContest(STATE, i);
  if (!r.ok) { toast(r.msg || '参加不了'); return; }
  afterAct(r.win ? '🏆 选美冠军！' : '参与奖');
}
function uiPetBreed() {
  const alive = petsInit(STATE).filter(p => p.alive);
  let pair = null;
  for (let i = 0; i < alive.length && !pair; i++) {
    for (let j = i + 1; j < alive.length; j++) {
      if (alive[i].type === alive[j].type && alive[i].age >= 2 && alive[j].age >= 2) { pair = [i, j]; break; }
    }
  }
  if (!pair) { toast('没有合适的配对'); return; }
  const r = petBreed(STATE, pair[0], pair[1]);
  if (!r.ok) { toast(r.msg || '配不了'); return; }
  afterAct('🐣 新生命');
}
function uiHorseBuy() {
  const r = horseAcquire(STATE, 'buy');
  if (!r.ok) { toast(r.msg || '买不了'); return; }
  afterAct(r.got ? '🐎 现在你有马了' : '没成');
}
function uiHorseCatch() {
  const r = horseAcquire(STATE, 'catch');
  if (!r.ok) { toast(r.msg || '去不了'); return; }
  afterAct(r.got ? '🐎 草原上套住了一匹' : '空手而归');
}
function uiHorseTrain() {
  const r = horseTrain(STATE);
  if (!r.ok) { toast(r.msg || '练不了'); return; }
  afterAct('训练度 +1');
}
function uiHorseRace() {
  const r = horseRace(STATE);
  if (!r.ok) { toast(r.msg || '比不了'); return; }
  afterAct(r.place === 1 ? '🏆 头马！' : (r.place ? `第 ${r.place} 名` : '没上奖台'));
}
function uiVacation(id) {
  const v = VACATIONS.find(x => x.id === id);
  if (!v) return;
  if (STATE.vacYear === STATE.age) { toast('今年已经度过了'); return; }
  if (STATE.stats.MONEY < v.cost) { toast('钱不够'); return; }
  STATE.stats.MONEY -= v.cost;
  STATE.vacYear = STATE.age;
  applyEffects(STATE, v.eff);
  pushLog(STATE, `【度假】${v.name}。${v.desc}`, 'muted');
  afterAct('回来的时候，人是轻的');
}
function uiLibrary() {
  const r = libraryStudy(STATE);
  if (!r.ok) { toast(r.msg || '现在不行'); return; }
  afterAct(r.superbrain ? '🧠 超级大脑冠军！' : '脑子清醒多了');
}
function uiMakeWill(heirKey) {
  const r = makeWill(STATE, heirKey);
  if (!r.ok) { toast(r.msg || '立不了'); return; }
  afterAct('遗嘱已公证');
}
function uiRebirth() {
  uiConfirm('人生重来', '这一世的一切（财产、关系、人生进度）都会清空，从出生重新开始。上一世的阅历会化为先天记忆（智力 +3 · 意志 +3）。确定重来吗？', '重来一世', () => {
    prepareRebirth();
    startCreate();
  });
}

/* ---------- v6.1 家族 / 圈层 / 银发 / 医疗 ---------- */
function uiTrust(amt) {
  const r = setupTrust(STATE, amt);
  if (!r.ok) { toast(r.msg || '设不了'); return; }
  afterAct('家族信托设立');
}
function uiClubJoin(id) {
  const r = clubJoin(STATE, id);
  if (!r.ok) { toast(r.msg || '进不去'); return; }
  afterAct('新会员');
}
function uiSilver(kind) {
  const r = kind === 'prof' ? silverProfessor(STATE)
    : kind === 'book' ? silverBook(STATE)
      : silverFund(STATE);
  if (!r.ok) { toast(r.msg || '现在不行'); return; }
  afterAct(kind === 'prof' ? '课酬到账' : kind === 'book' ? '版税到账' : '基金会成立');
}
function uiRetire(id) {
  const r = setRetirePlan(STATE, id);
  if (!r.ok) { toast(r.msg || '住不了'); return; }
  afterAct('搬家了');
}
function uiMedical(kind) {
  if (!STATE || STATE.finished) return;
  const s = STATE.stats;
  if (kind === 'gene') {
    if (STATE.medGeneYear === STATE.age) { toast('今年做过了'); return; }
    if (s.MONEY < 80000000) { toast('钱不够'); return; }
    s.MONEY -= 80000000;
    STATE.medGeneYear = STATE.age;
    applyEffects(STATE, { HP: 15, MOOD: 6 });
    pushLog(STATE, '【基因修复】苏黎世的私人诊所，仪器读数一条条变绿。医生说：您的生物学年龄，比身份证上年轻十岁。', 'money');
  } else if (kind === 'organ') {
    if (STATE.medOrganYear === STATE.age) { toast('今年做过了'); return; }
    if (!STATE.ill) { toast('目前没有需要更换的器官'); return; }
    if (s.MONEY < 150000000) { toast('钱不够'); return; }
    s.MONEY -= 150000000;
    STATE.medOrganYear = STATE.age;
    const name = STATE.ill.name;
    STATE.ill = null;
    applyEffects(STATE, { HP: 10, MOOD: 8 });
    pushLog(STATE, `【器官更换】${name} 的那部分被换成了培养舱里的新器官。主刀医生说：恭喜，这笔钱花得比任何投资都值。`, 'money');
  }
  afterAct('手术很成功');
}
function uiCryo() {
  uiConfirm('冷冻休眠',
    `清算全部资产的八成入舱，支付 ${fmtMoney(CRYO_COST)} 冷冻费，在液氮里睡到医学能治好你的那天。<br><b>这一局就此结束；两代人之后，可以在出生页以你的名字苏醒。</b><br>确定签字吗？`,
    '签字冷冻', () => {
      const r = prepareCryo(STATE);
      if (!r.ok) { toast(r.msg || '冻不了'); return; }
      autosaveNow();
      renderEnd();
    });
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
      renderStats(); renderStream(); markDirty();
      return;
    }
    html = `<div class="card-inner exam">
      <div class="card-year">${fmtYear(STATE)} 年 · ${STATE.age}岁 · ${esc(ex.title)}</div>
      ${ex.score != null ? `<div class="exam-score">${ex.score}<small> / ${ex.full}</small></div>` : ''}
      <p class="card-text">${esc(ex.text).replace(/\n/g, '<br>')}</p></div>`;
    $('actions').innerHTML = (ex.options || []).map((o, i) => {
      const meta = o.minScore != null ? `录取线 ${Math.round(o.minScore / 100 * (ex.full || 100))}` : '';
      /* E-13：把「起薪系数」露出来。档内连续化之后，同一档内不同分数拿到的系数不同，
       * 985 / 211 / 一本 之间只差 2%~10%，不显示这个数，玩家就是在盲选。
       * 只有大学有 salaryK（HIGH_SCHOOLS 没有），中考放榜不显示。 */
      let salaryTag = '';
      if (o.salaryK != null && typeof salaryKFor === 'function') {
        const k = salaryKFor(o, ex.score);
        const over = (ex.score != null && ex.score > uniNeed(o)) ? '（超线加成后）' : '';
        salaryTag = `<span class="risk r1">起薪 ×${k.toFixed(3)}${over}</span>`;
      }
      if (o.locked) {
        return `<button class="btn choice dis" disabled>${esc(o.name)}
          <span class="gamble">${esc(o.desc)}</span>
          ${salaryTag}
          <span class="risk r3">进不去 · ${esc(o.lockReason || '条件不够')}</span></button>`;
      }
      return `<button class="btn choice" onclick="chooseExam(${i})">${esc(o.name)}
        <span class="gamble">${esc(o.desc)}</span>
        ${salaryTag}
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
  markDirty();
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
  markDirty();
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
  markDirty();
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
  markDirty();
  if (STATE.queue && STATE.queue.length) renderItem(STATE.queue.shift());
  else renderIdle();
}

function finishGame() {
  if (!STATE.finished) finish(STATE);
  autosaveNow();
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
  // v6.1 门阀声望：一代落幕，折算声望点（永久保留，下一代投胎前可用）
  if (typeof settlePrestige === 'function' && STATE.prestigeGained == null) {
    STATE.prestigeGained = settlePrestige(STATE);
  }
  if (STATE.prestigeGained > 0) {
    $('endStats').innerHTML += `<div><span>家族声望</span><b>✦ +${STATE.prestigeGained}</b></div>`;
  }
  const got = STATE.achievements || [];
  let achHtml = '';
  if (typeof ACHIEVEMENTS !== 'undefined') {
    achHtml = `<h3 class="sec">🏅 成就 ${got.length} / ${ACHIEVEMENTS.length}</h3>
      <div class="ach-wall end-ach">${ACHIEVEMENTS.map(a => {
        const on = got.indexOf(a.id) >= 0;
        return `<span class="ach ${on ? 'on' : ''}" title="${escAttr(a.name + '：' + a.desc)}">${a.icon}<i>${esc(a.name)}</i></span>`;
      }).join('')}</div>`;
  }
  // v6 多款式墓碑：按评级解锁（S 传奇 > A 功德 > B 花环 > C 青石…）
  const tb = pickTombstone(rank);
  if (tb) {
    achHtml = `<h3 class="sec">🕯 长眠之地 · ${tb.name}</h3>
      <div class="tomb-wrap">${tombstoneSVG(STATE, tb)}
        <div class="tomb-desc">${esc(tb.desc)}</div></div>` + achHtml;
  }
  $('endAch').innerHTML = achHtml;
  const hl = STATE.log.filter(l => l.type === 'story' || l.type === 'money').slice(-40);
  $('endReview').innerHTML = hl.map(l => `<div class="line ${l.type}"><span class="y">${l.year} 年</span>${esc(l.text)}</div>`).join('');
  renderSuccessionBtns();
}

/* ---------- v6 墓碑结算 ---------- */
const TOMB_RANK_ORDER = ['D', 'C', 'B', 'A', 'S'];
function pickTombstone(rank) {
  if (typeof TOMBSTONES === 'undefined') return null;
  const ri = TOMB_RANK_ORDER.indexOf(rank);
  let pick = TOMBSTONES[0];
  TOMBSTONES.forEach(t => {
    if (ri >= TOMB_RANK_ORDER.indexOf(t.minRank)) pick = t;
  });
  return pick;
}
function tombstoneSVG(state, tb) {
  const year1 = state.startYear || START_YEAR;
  const year2 = year1 + state.age;
  const grads = {
    tb_plain: ['#9AA3AC', '#6E7883'], tb_flower: ['#B7C4CF', '#8496A5'],
    tb_arch: ['#C9B79C', '#9A8468'], tb_grand: ['#D8C9A8', '#A6936F'],
    tb_legend: ['#E3D9C2', '#B3A37F']
  };
  const [g1, g2] = grads[tb.id] || grads.tb_plain;
  return `<svg class="tomb" viewBox="0 0 200 170" role="img" aria-label="墓碑">
    <defs><linearGradient id="tbg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${g1}"/><stop offset="1" stop-color="${g2}"/></linearGradient></defs>
    <ellipse cx="100" cy="156" rx="86" ry="9" fill="rgba(16,15,6,.14)"/>
    <path d="M45 156 L45 60 Q45 18 100 18 Q155 18 155 60 L155 156 Z" fill="url(#tbg)" stroke="#4A4438" stroke-width="2.5"/>
    <line x1="58" y1="70" x2="142" y2="70" stroke="#4A4438" stroke-width="1.4" opacity=".55"/>
    <text x="100" y="52" text-anchor="middle" font-size="15" font-weight="700" fill="#3A342A" font-family="serif">${esc(state.name || '无名')}</text>
    <text x="100" y="88" text-anchor="middle" font-size="9.5" fill="#4A4438">${year1} — ${year2}</text>
    <text x="100" y="112" text-anchor="middle" font-size="8.5" fill="#4A4438" opacity=".85">${esc(tb.name)}</text>
    ${tb.id === 'tb_flower' || tb.id === 'tb_grand' || tb.id === 'tb_legend' ? '<circle cx="34" cy="150" r="6" fill="#E88AA0"/><circle cx="44" cy="146" r="5" fill="#F4B8C8"/><circle cx="168" cy="150" r="6" fill="#E88AA0"/><circle cx="158" cy="146" r="5" fill="#F4B8C8"/>' : ''}
    ${tb.id === 'tb_legend' ? '<path d="M20 156 L20 120 L28 120 L28 156 M172 156 L172 120 L180 120 L180 156" stroke="#4A4438" stroke-width="3" fill="none"/>' : ''}
  </svg>`;
}

/* ---------- v6 世代传承：结局页以子女/孙辈之名继续 ---------- */
function renderSuccessionBtns() {
  const box = $('endLegacy');
  if (!box) return;
  const opts = (typeof successionOptions === 'function') ? successionOptions(STATE) : [];
  if (!opts.length) { box.innerHTML = ''; return; }
  box.innerHTML = `<div class="legacy-tip">血脉还在延续——下一代的人生，从你留下的东西开始（最多继承 ${opts[0].kind === 'grand' ? '40' : '55'}% 净资产）：</div>
    <div class="of-btns">${opts.map((o, i) =>
      `<button class="btn small" onclick="uiSucceed(${i})">${esc(o.label)}</button>`).join('')}</div>`;
  box.dataset.opts = JSON.stringify(opts);
}
function uiSucceed(i) {
  const opts = JSON.parse($('endLegacy').dataset.opts || '[]');
  const o = opts[i];
  if (!o) return;
  const r = prepareSuccession(STATE, o);
  uiConfirm('世代传承', `以${o.kind === 'grand' ? '孙辈' : '子女'}之名开启新的人生：继承 ${fmtMoney(r.money)} 的家产与家风加成。新的一世无法保留这一世的记忆与关系。`, '继续', () => {
    startCreate();
  });
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
  markDirty();
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
  bind('btnSaveGame', () => { autosaveNow(); toast('已自动保存到本机缓存'); });
  bind('btnSaves2', openModal);
  bind('btnRestart', () => {
    // IMP-01 · R-03：这是全项目唯一一处不在 try 里的 localStorage 调用，
    // 隐私模式下点「重开」会抛异常，后面的 renderTitle() 就不会执行
    if (confirm('放弃当前人生，重新开始？')) {
      try { localStorage.removeItem(LS.auto); } catch (e) { }
      STATE = null; renderTitle(); showScreen('screen-title');
    }
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
