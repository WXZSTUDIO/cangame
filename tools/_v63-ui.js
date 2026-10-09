/* =========================================================
 * v6.3.0 UI（A3 家族树 / 手足卡 · D1 时间轴 · D2 分享海报）
 * ========================================================= */

/* ---------- A3 家族树 ---------- */
function treeChip(ava, label, sub, dead) {
  return `<div class="ft-chip ${dead ? 'dead' : ''}">
    ${ava}
    <div class="ft-chip-info"><b>${label}</b><i>${sub}</i></div>
  </div>`;
}

function familyTreeHtml() {
  const s = STATE;
  const ps = s.parents || {};
  const gen1 = [];
  if (ps.father) gen1.push(treeChip(personAvatar(ps.father.name, 'M', ps.father.age, ''), ps.father.name, '父亲', !ps.father.alive));
  if (ps.mother) gen1.push(treeChip(personAvatar(ps.mother.name, 'F', ps.mother.age, ''), ps.mother.name, '母亲', !ps.mother.alive));
  if (!gen1.length) gen1.push(treeChip('🏛', '福利院', '养你长大的地方', true));

  const gen2 = [];
  (s.siblings || []).forEach(sib => {
    if (!sib.alive && sibAge(s, sib) < 0) return;
    const rel = sib.born < s.startYear ? (sib.gender === 'M' ? '哥哥' : '姐姐') : (sib.gender === 'M' ? '弟弟' : '妹妹');
    gen2.push(treeChip(personAvatar(sib.name, sib.gender, sibAge(s, sib), ''), sib.name, rel + (sib.alive ? '' : ' · 已故'), !sib.alive));
  });
  const meSub = (s.flags.married ? '已婚' : (s.flags.dating ? '恋爱中' : '未婚')) + ' · ' + (s.job || '');
  gen2.push(treeChip(personAvatar(s.name, s.gender, s.age, 'green'), s.name + '（你）', meSub, false));
  if (s.flags.married && s.spouse) {
    gen2.push(treeChip(personAvatar(s.spouse.name, s.gender === 'M' ? 'F' : 'M', s.spouse.age, ''), s.spouse.name, '配偶', s.spouse.alive === false));
  }

  const gen3 = [];
  (s.children || []).forEach(c => {
    const ca = childAge(s, c);
    const tag = c.illegit ? (c.ack ? ' · 非婚生已认领' : ' · 私生子') : '';
    gen3.push(treeChip(personAvatar(c.name, c.gender || 'M', ca, c.illegit && !c.ack ? 'amber' : ''), c.name, (c.gender === 'F' ? '女儿' : '儿子') + ' ' + ca + '岁' + tag, c.alive === false));
  });
  if (!gen3.length) gen3.push(`<div class="ft-empty">还没有下一代</div>`);

  return `<div class="ftree">
    <div class="ft-title">🌳 家族图谱 <i>三代人的位置，一眼看完</i></div>
    <div class="ft-row"><div class="ft-gen">长辈</div><div class="ft-chips">${gen1.join('')}</div></div>
    <div class="ft-row"><div class="ft-gen">你这辈</div><div class="ft-chips">${gen2.join('')}</div></div>
    <div class="ft-row"><div class="ft-gen">下一辈</div><div class="ft-chips">${gen3.join('')}</div></div>
  </div>`;
}

/* ---------- A1 手足卡（家人页） ---------- */
function sibCards() {
  const out = [];
  (STATE.siblings || []).forEach((sib, i) => {
    const a = sibAge(STATE, sib);
    const rel = sib.born < STATE.startYear ? (sib.gender === 'M' ? '哥哥' : '姐姐') : (sib.gender === 'M' ? '弟弟' : '妹妹');
    out.push(sib.alive
      ? {
        avaSvg: personAvatar(sib.name, sib.gender, a, ''),
        name: `${rel} · ${sib.name}`,
        sub: `${a}岁 · ${sib.married ? '已成家' : '未婚'} · 亲近 ${Math.round(sib.affinity)}%。${(sib.affinity || 0) >= 70 ? '你们是无话不说的手足。' : (sib.affinity || 0) >= 45 ? '平时各忙各的，有事必到。' : '小时候总吵架，现在客气得像亲戚。'}`,
        key: null,
        multi: sib.touchYear === STATE.age
          ? '<span class="rel-act dis">今年见过了</span>'
          : `<button class="rel-act" onclick="uiSibChat(${i})">联系</button>`
      }
      : { avaSvg: personAvatar(sib.name, sib.gender, a, 'amber'), name: `${rel} · ${sib.name}`, sub: '已经不在了。你手机里还存着 TA 的号码。', dead: true });
  });
  return out;
}

function uiSibChat(i) {
  const r = sibChat(STATE, i);
  toast(r.msg);
  saveGame && saveGame();
  renderRel();
}

/* ---------- D1 结算页 · 人生轨迹时间轴 ---------- */
function endTimelineHtml() {
  const lines = STATE.log.filter(l =>
    l.type === 'story' || l.type === 'money' || l.type === 'warn' || l.type === 'end'
  ).slice(-46);
  if (!lines.length) return '';
  return `<h3 class="sec">🧭 人生轨迹</h3>
  <div class="tl-wrap">
    ${lines.map(l => `<div class="tl-row ${l.type}">
      <div class="tl-dot"></div>
      <div class="tl-year">${l.year} 年</div>
      <div class="tl-text">${esc(l.text)}</div>
    </div>`).join('')}
  </div>`;
}

/* ---------- D2 结局分享海报（canvas → PNG 下载） ---------- */
function uiSharePoster() {
  try {
    const W = 720, H = 960;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    /* 背景 */
    g.fillStyle = '#1B1630'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#241D3E'; g.fillRect(0, 0, W, 240);
    g.fillStyle = '#E88AA0';
    [[60, 60, 5], [640, 100, 4], [110, 150, 3], [600, 190, 5], [360, 40, 3]].forEach(([x, y, r]) => {
      g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    });
    /* 标题区 */
    g.fillStyle = '#F5EFFF'; g.textAlign = 'center';
    g.font = '700 44px "Songti SC","SimSun",serif';
    g.fillText(STATE.name || '无名', W / 2, 96);
    g.font = '24px sans-serif'; g.fillStyle = '#B7A9D8';
    const y1 = STATE.startYear || 2000, y2 = y1 + (STATE.age || 0);
    g.fillText(`${y1} — ${y2} · 享年 ${STATE.age} 岁`, W / 2, 138);
    g.font = '28px sans-serif'; g.fillStyle = '#F4B8C8';
    g.fillText(`人生评分 ${STATE.score != null ? STATE.score : scoreOf(STATE)} / 100 · 评级 ${STATE.rank || grade(scoreOf(STATE))}`, W / 2, 186);
    g.font = '20px sans-serif'; g.fillStyle = '#8F7FB8';
    g.fillText((STATE.job ? '终章身份 · ' + STATE.job : ''), W / 2, 218);
    /* 墓碑（简笔画） */
    g.fillStyle = '#C9B79C';
    g.beginPath();
    g.moveTo(W / 2 - 110, 560);
    g.lineTo(W / 2 - 110, 400);
    g.quadraticCurveTo(W / 2 - 110, 300, W / 2, 300);
    g.quadraticCurveTo(W / 2 + 110, 300, W / 2 + 110, 400);
    g.lineTo(W / 2 + 110, 560);
    g.closePath(); g.fill();
    g.strokeStyle = '#4A4438'; g.lineWidth = 4; g.stroke();
    g.fillStyle = '#3A342A'; g.font = '700 34px "Songti SC",serif';
    g.fillText(STATE.name || '无名', W / 2, 388);
    g.font = '20px "Songti SC",serif'; g.fillStyle = '#4A4438';
    g.fillText(`${y1} — ${y2}`, W / 2, 428);
    g.font = '18px "Songti SC",serif';
    g.fillText('人生模拟 · 一生纪念', W / 2, 470);
    /* 碑文摘句 */
    const ep = (STATE.epitaph || '').split('。').filter(Boolean);
    g.fillStyle = '#E8DFF6'; g.font = '21px "Songti SC",serif';
    const picks = [ep[1] || ep[0], ep[2] || ep[1], ep[ep.length - 1]].filter(Boolean).slice(0, 3);
    let yy = 640;
    picks.forEach(t => {
      const line = (t.length > 22 ? t.slice(0, 22) + '…' : t) + '。';
      g.fillText(line, W / 2, yy);
      yy += 40;
    });
    g.font = '22px sans-serif'; g.fillStyle = '#6E5E96';
    g.fillText('—— WXZSTUDIO · 人生模拟 ——', W / 2, H - 56);
    /* 下载 */
    const url = cv.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url; a.download = `人生模拟_${STATE.name || '无名'}_${y1}-${y2}.png`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    toast('海报已生成，快去分享你的一生的故事吧');
  } catch (err) {
    toast('海报生成失败：' + err.message);
  }
}
