
/* =========================================================
 * v6.4.0 外界评价（别人眼里的你）
 * ---------------------------------------------------------
 * 玩家一辈子只看得见自己的面板，看不见自己在别人嘴里是什么样。
 * 这一层把散落各处的状态（口碑、名望、道德、资产、婚姻、案底、
 * 圈层、慈善）翻译成六组「谁在看你 + 他们怎么看你」。
 * 同一个人在家人眼里和在舆论眼里，可以是完全相反的两个人 ——
 * 这正是这套评价想让人看见的东西。
 * ========================================================= */
const IMAGE_GROUPS = [
  { key: 'family', who: '家人', icon: '🏠' },
  { key: 'colleague', who: '同事 / 同行', icon: '💼' },
  { key: 'neighbor', who: '邻居 / 老乡', icon: '🚪' },
  { key: 'friend', who: '朋友', icon: '🍻' },
  { key: 'circle', who: '圈内 / 业界', icon: '🎭' },
  { key: 'public', who: '舆论 / 陌生人', icon: '📰' }
];

/* 分档：0–100 打成六个说法 */
const IMAGE_BANDS = [
  [0, '很差'], [20, '不太好'], [35, '一般'], [50, '还行'], [66, '不错'], [82, '很好']
];
function imageBand(v) {
  let lab = IMAGE_BANDS[0][1];
  for (const b of IMAGE_BANDS) if (v >= b[0]) lab = b[1];
  return lab;
}

/* 净资产档位（外界最先看见的永远是这个） */
function worthTier(state) {
  const w = (typeof netWorth === 'function') ? netWorth(state) : (state.stats.MONEY || 0);
  if (w >= 30000000000) return 5;   // 300 亿+
  if (w >= 5000000000) return 4;    // 50 亿+
  if (w >= 800000000) return 3;     // 8 亿+
  if (w >= 100000000) return 2;     // 1 亿+
  if (w >= 10000000) return 1;      // 千万级
  return 0;
}

/* 各组评价文案（按分档取一句） */
const IMAGE_TEXT = {
  family: [
    ['家里人已经很久不主动提起你了。', '亲戚聚会时，你的名字会被轻轻带过。', '家里人觉得你过得一般，也不太指望你。',
      '家里人提起你时语气是平的——不丢人，也不出挑。', '家里遇到事第一个想到你。', '在这个家里，你是那个说话有人听的人。']],
  colleague: [
    ['业内提起你就摇头，没人愿意把你写进项目名单。', '同事背后说你靠不住。', '同事觉得你只是一个普通的名字。',
      '同事愿意把活交给你，也相信你能交回来。', '同行对你评价很高，你的名字能背书。', '这一行里，你的名字本身就是招牌。']],
  neighbor: [
    ['邻居绕着你走，看见你会换条路。', '街坊对你有看法，见面只是点头。', '邻居知道有你这么个人，仅此而已。',
      '邻里之间提起你是客气的一句「挺好的」。', '街坊都愿意跟你打招呼，有事也愿意找你。', '这条街上的人都说：那是个好人。']],
  friend: [
    ['你的通讯录里，已经没人主动找你了。', '朋友越来越少，剩下的也淡了。', '朋友不多，但还联系。',
      '你有一圈能坐下来吃饭的人。', '朋友遇事会先给你打电话。', '你这辈子交下的朋友，够坐满好几桌。']],
  circle: [
    ['圈子里没人知道你，也没人想知道。', '圈内提起你没什么印象。', '圈子里有人认识你，仅此而已。',
      '圈内知道你的名字，也认你的位置。', '圈子里你是被邀请的那一类人。', '你的名字在圈内是能开门的。']],
  public: [
    ['报纸上出现你的名字时，通常不是好事。', '网上关于你的评价不太好。', '公众对你知道得不多，评价也平平。',
      '外界对你的印象是正面的，但不算有名。', '公众记得你，而且记得的是好事。', '你的名字出现在标题里时，人们会停下来看。']
  ]
};

function bandIdx(v) {
  if (v < 20) return 0;
  if (v < 35) return 1;
  if (v < 50) return 2;
  if (v < 66) return 3;
  if (v < 82) return 4;
  return 5;
}

/* 主入口：返回 { score, headline, groups[] } */
function publicImage(state) {
  const s = state.stats || {};
  const f = state.flags || {};
  const sp = state.spouse;
  const tier = worthTier(state);
  const kids = state.children ? state.children.length : (state.childCount || 0);
  const friends = (state.friends || []).length;
  const clubs = (state.clubs || []).length;
  const c = state.career ? (typeof careerById === 'function' ? careerById(state.career.id) : null) : null;
  const lv = state.career ? (state.career.level || 0) : 0;

  /* ① 家人 */
  let family = 42 + (s.LOVE || 0) * 0.22 + (s.SEC || 0) * 0.10 + kids * 2.5;
  if (sp && sp.alive !== false) family += ((sp.affinity || 50) - 50) * 0.22;
  if (f.divorced) family -= 12;
  if (f.widowed) family -= 4;
  if (f.exposed) family -= 22;
  if (f.ex_prisoner) family -= 18;
  if (state.grief) family -= 5;
  if ((s.MONEY || 0) < 0) family -= 8;

  /* ② 同事 / 同行 */
  let colleague = 34 + (s.LOY || 0) * 0.42 + lv * 4.5 + (s.INT || 0) * 0.12;
  if (c) colleague += 6;
  if (state.job === '待业' || state.job === '无业' || !state.job) colleague -= 16;
  if (state.prison > 0) colleague -= 30;
  if (f.ex_prisoner) colleague -= 20;
  if (f.fired) colleague -= 10;

  /* ③ 邻居 / 老乡 */
  let neighbor = 40 + tier * 6 + (s.ETH || 0) * 0.20 + (f.own_house ? 6 : 0);
  if (f.ex_prisoner) neighbor -= 22;
  if (f.scandal) neighbor -= 14;
  if (f.charity) neighbor += 8;

  /* ④ 朋友 */
  let friend = 34 + (s.NET || 0) * 0.38 + friends * 2.2 + (s.CHA || 0) * 0.10;
  if (f.betrayed_friend) friend -= 12;
  if (state.grief) friend += 3;

  /* ⑤ 圈内 / 业界 */
  let circle = 22 + (s.FAME || 0) * 0.52 + (s.NET || 0) * 0.18 + clubs * 5;
  if (f.fam_biz) circle += 10;
  if (f.club_race || f.club_yacht || f.club_chamber) circle += 6;

  /* ⑥ 舆论 / 陌生人 */
  let pub = 30 + (s.FAME || 0) * 0.46 + (s.ETH || 0) * 0.14 + tier * 3;
  if (f.charity) pub += 12;
  if (f.ex_prisoner) pub -= 26;
  if (f.exposed) pub -= 18;
  if (f.scandal) pub -= 16;
  if (f.hero) pub += 14;

  const raw = { family: family, colleague: colleague, neighbor: neighbor, friend: friend, circle: circle, public: pub };
  const groups = IMAGE_GROUPS.map(g => {
    const v = clamp(Math.round(raw[g.key]), 0, 100);
    return {
      key: g.key, who: g.who, icon: g.icon, score: v,
      label: imageBand(v), text: (IMAGE_TEXT[g.key] || [''])[0][bandIdx(v)]
    };
  });

  // 总评：家人与同事的权重大一些——人这一辈子，主要是被身边的人记住
  const score = Math.round(clamp(
    raw.family * 0.22 + raw.colleague * 0.20 + raw.friend * 0.18
    + raw.neighbor * 0.15 + raw.circle * 0.13 + raw.public * 0.12, 0, 100));

  return { score: score, label: imageBand(score), groups: groups, headline: imageHeadline(state, score, groups) };
}

/* 一句话总评：不重复面板上的数字，说的是「你是个什么样的人」 */
function imageHeadline(state, score, groups) {
  const s = state.stats || {};
  const f = state.flags || {};
  const byKey = {};
  (groups || []).forEach(g => byKey[g.key] = g.score);
  const gap = Math.max(byKey.family || 0, byKey.circle || 0, byKey.public || 0)
    - Math.min(byKey.family || 0, byKey.colleague || 0, byKey.neighbor || 0);

  if ((byKey.public || 0) >= 70 && (byKey.family || 0) <= 45)
    return '外面的人把你当回事，家里的人却觉得你很久没回家了。';
  if ((byKey.family || 0) >= 70 && (byKey.public || 0) <= 40)
    return '知道你的人不多，但知道你的那几个人，都把你放在心上。';
  if (f.ex_prisoner && score >= 45)
    return '你走过一段没人愿意提的路，后来把自己捞了回来——只是提起你的人，还是先想起那段。';
  if (score >= 82) return '不管从哪个方向看过来，你这辈子都站得住。';
  if (score >= 66) return '在认识你的人里，你的名声是好的，而且是你自己挣来的。';
  if (score >= 50) return '大部分人提起你，会说一句「还不错」——这已经很不容易。';
  if (score >= 35) return '你没做什么大恶，也没让人记住什么。这是一种平淡的清白。';
  if (score >= 20) return '有些人对你的印象不太好。你自己知道是怎么走到这一步的。';
  return '你在别人嘴里的样子，和你以为的自己，差得有点远。';
}

/* UI 用的渲染片段 */
function publicImageHtml(state) {
  const img = publicImage(state);
  const rows = img.groups.map(g => {
    const pct = Math.max(2, g.score);
    const col = g.score >= 66 ? '#2E9E6B' : (g.score >= 40 ? '#C79A3C' : '#B4553F');
    return `<div class="img-row">
      <span class="img-who">${g.icon} ${esc(g.who)}</span>
      <span class="img-bar"><i style="width:${pct}%;background:${col}"></i></span>
      <span class="img-lv" style="color:${col}">${esc(g.label)}</span>
    </div>
    <div class="img-say">${esc(g.text)}</div>`;
  }).join('');
  return `<div class="img-card">
    <div class="img-head">
      <b>外界怎么看你</b>
      <span class="img-score">${img.score} · ${esc(img.label)}</span>
    </div>
    <div class="img-lead">${esc(img.headline)}</div>
    ${rows}
  </div>`;
}
