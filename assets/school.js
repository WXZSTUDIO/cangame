/* =========================================================
 * CANGAME · 升学系统
 * 中考（15）→ 高中分档 → 高考（18）→ 大学分档
 * 学历决定求职门槛，学校质量决定起薪与晋升速度
 * ========================================================= */

/* 学历等级：0 初中以下 / 1 高中·职高 / 2 专科 / 3 二本·三本 / 4 一本·211 / 5 985·研究生 */
const EDU_LEVELS = ['初中以下', '高中 / 职高', '专科', '二本 / 三本', '一本 / 211', '985 / 研究生'];

const EXAM_META = {
  midAge: 15, // 初三结束，参加中考
  gaoAge: 18, // 高三，参加高考
  gaoRestoreYear: 1977,
  studyCap: 100
};

/* ---------------- 高中（中考录取） ---------------- */
const HIGH_SCHOOLS = [
  {
    id: 'hs_key', name: '市重点高中', tier: 3, minScore: 74, years: 3,
    desc: '全市掐尖的那两所。走廊里贴着去年的红榜，晚自习到十点半。',
    eff: { INT: 6, WILL: 4, FAME: 5, STRESS: 8, NET: 4 },
    flags: ['hs_key'], gaoBonus: 12
  },
  {
    id: 'hs_ord', name: '普通高中', tier: 2, minScore: 58, years: 3,
    desc: '县城或区里的一中二中。考上本科要靠自己，没人替你安排。',
    eff: { INT: 4, WILL: 3, STRESS: 6, NET: 3 },
    flags: ['hs_ord'], gaoBonus: 5
  },
  {
    id: 'hs_art', name: '艺术高中 / 艺校', tier: 2, minScore: 50, years: 3,
    desc: '专业课占半天：声乐、器乐、表演、美术。文化课可以差一点，但长得好看或天赋够，是硬通货。',
    eff: { CHA: 6, WILL: 3, INT: -1, STRESS: 5, NET: 4, FAME: 3 },
    flags: ['hs_art'], gaoBonus: -2,
    req: { CHA: 38 }, reqText: '要过专业面试（魅力 38）'
  },
  {
    id: 'hs_vo', name: '职业高中 / 中专', tier: 1, minScore: 40, years: 3,
    desc: '学一门手艺：汽修、烹饪、电商、幼师。三年后直接进厂或开店。',
    eff: { STR: 4, CHA: 3, WILL: 2, STRESS: 2, NET: 5 },
    flags: ['hs_vo'], gaoBonus: -4
  },
  {
    id: 'hs_none', name: '辍学 · 进社会', tier: 0, minScore: 0, years: 0,
    desc: '分数线以下。家里说：念不下去就别念了，出去挣口饭吃。',
    eff: { WILL: 6, STR: 5, INT: -3, STRESS: 8, SEC: -6 },
    flags: ['dropout'], gaoBonus: -20
  }
];

/* ---------------- 大学（高考录取） ---------------- */
const UNIVERSITIES = [
  {
    id: 'u_985', name: '985 重点大学', edu: 5, minScore: 88, years: 4, tier: 5,
    major: ['计算机', '人工智能', '金融学', '临床医学', '法学', '电子信息'],
    desc: '录取通知书是红色的。村里或小区门口，会贴一张大红榜。',
    eff: { INT: 8, NET: 10, FAME: 10, CHA: 3, WILL: 4 },
    flags: ['uni_985'], salaryK: 1.42
  },
  {
    id: 'u_211', name: '211 大学', edu: 4, minScore: 78, years: 4, tier: 4,
    major: ['软件工程', '会计学', '新闻学', '机械', '教育学', '播音与主持艺术'],
    desc: '也是好学校。校招的时候，简历能过第一道机器筛选。',
    eff: { INT: 6, NET: 8, FAME: 7, CHA: 2, WILL: 3 },
    flags: ['uni_211'], salaryK: 1.20
  },
  {
    id: 'u_yiben', name: '普通一本', edu: 4, minScore: 68, years: 4, tier: 3.5,
    major: ['工商管理', '土木工程', '英语', '市场营销', '视觉传达设计', '表演'],
    desc: '省里的好学校。能不能出头，看这四年你怎么过。',
    eff: { INT: 5, NET: 6, FAME: 4, CHA: 2, WILL: 2 },
    flags: ['uni_bk'], salaryK: 1.04
  },
  {
    id: 'u_erben', name: '二本 / 民办本科', edu: 3, minScore: 56, years: 4, tier: 3,
    major: ['电子商务', '国际经济与贸易', '环境工程', '汉语言文学', '动画', '音乐表演'],
    desc: '学费是家里咬牙凑的。毕业证上写着本科，剩下的看你自己。',
    eff: { INT: 3, NET: 5, CHA: 2, WILL: 3 },
    flags: ['uni_bk'], salaryK: 0.95
  },
  {
    id: 'u_zhuanke', name: '专科院校', edu: 2, minScore: 42, years: 3, tier: 2,
    major: ['护理学', '机电', '广告学', '物流管理', '学前教育'],
    desc: '三年制。技术性更强，也更容易在毕业那年就找到活干。',
    eff: { STR: 3, NET: 5, CHA: 2, WILL: 3 },
    flags: ['uni_zk'], salaryK: 0.85
  },
  {
    id: 'u_fail', name: '落榜 · 直接进入社会', edu: 1, minScore: 0, years: 0, tier: 1,
    major: [],
    desc: '分数不够。复读一年要钱，也可能还是不够。你决定先出去看看。',
    eff: { WILL: 7, STR: 4, STRESS: 10, SEC: -5, INT: -2 },
    flags: ['gaokao_fail'], salaryK: 0.8
  }
];

/* ---------------- 校园活动（大学期间每年可选一项） ---------------- */
const UNI_ACTIVITIES = [
  { id: 'a_study', name: '📚 泡图书馆', desc: '绩点、奖学金、保研名额，都从这里开始。',
    eff: { INT: 6, WILL: 2, GROW: 3, STRESS: 3 }, need: null },
  { id: 'a_drink', name: '🍺 聚餐喝酒', desc: '烧烤摊、KTV、散场后的马路牙子。你交到了朋友，也伤了身体。',
    eff: { NET: 6, CHA: 3, HP: -4, STRESS: -6, LOVE: 2 }, cost: 300000 },
  { id: 'a_club', name: '🎸 社团活动', desc: '吉他社、辩论队、街舞团。有人在这里找到了一辈子的事。',
    eff: { CHA: 5, NET: 4, LOVE: 3, GROW: 2 }, need: null },
  { id: 'a_intern', name: '💼 出去实习', desc: '大三那年你进了家公司，每天通勤两小时，月薪三千。',
    eff: { INT: 3, NET: 5, LOY: 6, MONEY: 1800000, STRESS: 5 }, need: null },
  { id: 'a_parttime', name: '🍜 兼职打工', desc: '家教、奶茶店、展会礼仪。你第一次自己挣钱。',
    eff: { MONEY: 2600000, WILL: 3, STR: -2, STRESS: 4 }, need: null },
  { id: 'a_game', name: '🎮 通宵打游戏', desc: '宿舍熄灯后，键盘声一直响到天亮。爽，然后挂了两科。',
    eff: { LOVE: 2, STRESS: -8, HP: -5, INT: -2 }, need: null },
  { id: 'a_kaoyan', name: '🎓 准备考研', desc: '每天早上六点的自习室。考上就是另一条路。',
    condMinAge: 20,
    eff: { INT: 7, WILL: 4, STRESS: 8, GROW: 4 }, need: null },
  { id: 'a_startup', name: '🚀 校园创业', desc: '宿舍里的四个工位，一份没人看的商业计划书。',
    eff: { WILL: 5, NET: 4, INT: 2, MONEY: -1500000, STRESS: 7 }, need: null },
  { id: 'a_love', name: '💘 谈恋爱', desc: '操场、图书馆、校外的小旅馆。你把整颗心都交出去了。',
    eff: { LOVE: 9, CHA: 3, SEC: 3, STRESS: 3 }, need: null },
  { id: 'a_sport', name: '🏀 运动与健身', desc: '操场十圈，器械区一小时。身体是本钱，这时候你还不信。',
    eff: { STR: 6, HP: 6, STRESS: -5 }, need: null }
];

/* ---------------- 同学生成 ---------------- */
const CLASSMATE_TYPES = [
  { key: 'nerd', ava: '🤓', label: '学霸', line: '年级第一，笔记被全班传抄' },
  { key: 'sport', ava: '🏀', label: '体育生', line: '操场上的风头人物' },
  { key: 'art', ava: '🎨', label: '文艺委员', line: '画板报的那个人' },
  { key: 'rich', ava: '🕶', label: '富二代', line: '校门口总有人开车来接' },
  { key: 'quiet', ava: '👤', label: '安静的人', line: '坐在最后一排，从不举手' },
  { key: 'funny', ava: '😄', label: '开心果', line: '班里最有梗的那张嘴' },
  { key: 'bad', ava: '🖤', label: '校霸', line: '走廊尽头抽烟的那几个' },
  { key: 'transfer',ava:'🧳', label: '转学生', line: '学期中途来的，谁也不熟' }
];

function makeClassmates(state, stage) {
  const pool = CLASSMATE_TYPES.slice();
  const n = stage === 'uni' ? 5 : (stage === 'grad' ? 4 : 4);
  // 研究生同学年纪更大一些
  const ageAdd = stage === 'grad' ? randInt(0, 3) : 0;
  const out = [];
  for (let i = 0; i < n && pool.length; i++) {
    const t = pool.splice(randInt(0, pool.length - 1), 1)[0];
    out.push({
      key: t.key,
      name: randomPersonName(state.gender === 'M' ? 'F' : 'M'),
      gender: state.gender === 'M' ? 'F' : 'M',
      age: clamp(state.age + randInt(-1, 1) + ageAdd, 5, 40),
      affinity: randInt(8, 26),
      charm: clamp(Math.round(rand(20, 70) + (t.key === 'rich' ? 15 : 0)), 5, 100),
      stage: stage,
      lastTouch: -1,
      dating: false
    });
  }
  // 至少有一半是同性，避免全班都是异性
  out.forEach((c, i) => { if (i % 2 === 1) { c.gender = state.gender; c.name = randomPersonName(state.gender); } });
  return out;
}

/* 同学阶段名 */
const STAGE_CN = { pri: '小学', mid: '初中', high: '高中', uni: '大学', grad: '研究生' };
const CLASSMATE_CAP = 14;

function stageCn(s) { return STAGE_CN[s] || '老同学'; }

/* 升学只「加人」，不「换人」——毕业了不等于失联 */
function refreshClassmates(state) {
  const st = schoolStageOf(state);
  if (!st) return;                      // 不在校：保留已有同学，不再刷新
  if (state.classStage === st) return;
  state.classStage = st;
  const fresh = makeClassmates(state, st);
  const old = state.classmates || [];
  state.classmates = old.concat(fresh);
  // 上限：超过时先请走「旧阶段里走动最少」的人
  let over = state.classmates.length - CLASSMATE_CAP;
  while (over > 0) {
    const cand = state.classmates
      .filter(c => c.stage !== st)
      .sort((a, b) => (a.affinity || 0) - (b.affinity || 0))[0];
    if (!cand) break;
    state.classmates = state.classmates.filter(c => c !== cand);
    over--;
  }
  pushLog(state, st === 'pri' ? '【开学】小学。你背着新书包走进教室，一群同样紧张的小孩互相打量。'
    : st === 'mid' ? '【开学】初中。新的教室，新的同学，新的排名。'
      : st === 'high' ? '【开学】高中。分班榜前挤满了家长，你在名单上找到了自己。'
        : st === 'grad' ? '【开学】研究生报到。同门一共几个人，导师的办公室在四楼，走廊尽头那间。'
          : '【开学】大学报到。宿舍四人间，上铺的同学来自一个你没听过的城市。', 'muted');
}

/* 当前在校阶段（用于 UI 区分在校 / 校友） */
function currentStage(state) { return schoolStageOf(state); }

function schoolStageOf(state) {
  if (!state.edu || state.edu.stopped) return null;
  const e = state.edu;
  if (e.uni && e.uni !== 'u_fail' && state.age >= EXAM_META.gaoAge && state.age <= (e.gradAge || 22)) {
    // 考研上岸之后换一批同学：同门、师兄师姐
    return (state.flags.kaoyan_ok && state.age >= 22) ? 'grad' : 'uni';
  }
  if (state.age >= 7 && state.age < 13) return 'pri';
  if (state.age >= 13 && state.age < EXAM_META.midAge) return 'mid';
  if (state.age >= EXAM_META.midAge && state.age < EXAM_META.gaoAge) return 'high';
  return null;
}

/* ---------------- 分数计算 ---------------- */
/* 分数以「基准线 + 相对偏差」构成：属性一般的人刚好落在中位，极端的人才会拉开差距 */
function midExamScore(state) {
  const s = state.stats;
  const e = state.edu;
  const fam = state.family || { assets: 0 };
  const tutor = fam.assets > 200000000 ? 7 : (fam.assets > 60000000 ? 4 : 0);
  const poor = (fam.debt || 0) > (fam.assets || 0) ? 5 : 0;   // 家里欠着债，补习班是奢望
  let sc = 50
    + (s.INT - 45) * 0.26
    + (s.WILL - 30) * 0.10
    + (e.study || 0) * 0.16
    + tutor
    + (state.flags.tizhinei || state.flags.prof ? 4 : 0)
    + rand(-9, 9)
    - Math.max(0, s.STRESS - 40) * 0.28
    - poor
    - (state.flags.in_love ? 5 : 0);
  return Math.round(clamp(sc, 0, 100));
}

function gaoExamScore(state) {
  const s = state.stats;
  const e = state.edu;
  const hs = HIGH_SCHOOLS.find(h => h.id === e.hs) || HIGH_SCHOOLS[1];
  const fam = state.family || { assets: 0 };
  const tutor = fam.assets > 250000000 ? 7 : (fam.assets > 80000000 ? 4 : 0);
  const poor = (fam.debt || 0) > (fam.assets || 0) ? 6 : 0;
  let sc = 52
    + (s.INT - 55) * 0.40
    + (s.WILL - 35) * 0.12
    + (e.study || 0) * 0.20
    + (hs.gaoBonus || 0)
    + tutor
    + rand(-11, 11)
    - Math.max(0, s.STRESS - 45) * 0.30
    - poor
    - (state.flags.in_love ? 8 : 0);
  return Math.round(clamp(sc, 0, 110));
}

/* ---------------- 高考恢复前：推荐制 ---------------- */
function recommendUni(state) {
  const year = fmtYear(state);
  if (year >= EXAM_META.gaoRestoreYear) return null;
  if (state.flags.tizhinei || state.flags.prof) return UNIVERSITIES[3];
  if (chance(0.25)) return UNIVERSITIES[4];
  return UNIVERSITIES[5];
}

/* ---------------- 录取门槛检查：进不去要说清楚为什么 ---------------- */
const STAT_CN_LOCK = {
  INT: '智力', STR: '体魄', CHA: '魅力', WILL: '意志', HP: '健康',
  STRESS: '压力', NET: '人脉', FAME: '声望', LOY: '口碑', ETH: '道德', MOOD: '心情'
};
function schoolLockReason(state, u, total, full) {
  const need = Math.round((u.minScore || 0) / 100 * (full || 100));
  if (total < need) return `分数不够：差 ${need - total} 分（录取线 ${need}）`;
  if (u.req) {
    for (const k in u.req) {
      if ((state.stats[k] || 0) < u.req[k]) {
        return (u.reqText || `${STAT_CN_LOCK[k] || k} 不够`) + `（需 ${u.req[k]}，你 ${Math.round(state.stats[k] || 0)}）`;
      }
    }
  }
  if (u.needFlag && !u.needFlag.some(f => state.flags[f])) return '你没有拿到这里的门路';
  return null;
}

/* ---------------- 生成考试事件（先答 5 道常识题，再放榜） ---------------- */
/* 满分：中考 400 / 高考 700。平时分（学术）占 85%，常识题 5 道占 15%——
   权重配平过：真实玩家答对 4 题左右时，录取分布与旧制基本一致。 */
function quizPick() {
  const pool = EXAM_QUIZ.slice();
  const out = [];
  for (let i = 0; i < 5 && pool.length; i++) {
    out.push(pool.splice(randInt(0, pool.length - 1), 1)[0]);
  }
  return out;
}

/* 卷面构成：满分 中考 400 / 高考 700
   常识题 5 道（占 25%）+ 平时分折算（占 75%）。
   平时分以「优秀线」为满分基准归一：原始分达到 ceil 就拿满该部分，
   因此天才 + 五题全对 = 真正的满分（不会出现全答对也差一口气的情况）。 */
function examParts(kind) {
  const full = kind === 'mid' ? 400 : 700;
  const perQ = kind === 'mid' ? 16 : 28;      // 每题：中考 16 分 / 高考 28 分
  const quizFull = perQ * 5;                  // 80 / 140 —— 正好 20%
  const academicPart = full - quizFull;       // 320 / 560 —— 正好 80%
  const ceil = kind === 'mid' ? 92 : 100;     // 平时分「顶格线」
  return { full, perQ, quizFull, academicPart, ceil };
}

/* 平时分折算：开方曲线是标定过的结果——
   线性映射会让普通资质的人被压到职高/专科（平时分中位只有 46 与 32），
   开方后「平庸」仍在普高/二本区间，「真学霸」又能稳稳拿满这部分，
   于是「天资 + 五题全对 = 满分」成立，而不是全靠常识题定生死。 */
function academicBase(rawScore, P) {
  return Math.round(Math.sqrt(clamp(rawScore / P.ceil, 0, 1)) * P.academicPart);
}

function makeExamEvent(state, kind) {
  const e = state.edu;
  const year = fmtYear(state);
  const P = examParts(kind);
  if (kind === 'mid') {
    const raw = midExamScore(state);
    return {
      type: 'exam',
      exam: {
        kind: 'mid',
        title: '中考 · 常识统考',
        score: null,
        full: P.full,
        base: academicBase(raw, P),
        perQ: P.perQ,
        quizFull: P.quizFull,
        academicFull: P.academicPart,
        text: `${year} 夏天，中考来了。第一场是常识统考——五道题，每道 ${P.perQ} 分，共 ${P.quizFull} 分；` +
          `剩下的 ${P.academicPart} 分是你三年的平时成绩（智力 ${Math.round(state.stats.INT)} · 意志 ${Math.round(state.stats.WILL)} · 学习投入 ${Math.round(e.study || 0)}）。\n` +
          `满分 ${P.full}。认真作答。`,
        options: null,
        quiz: { qs: quizPick(), i: 0, correct: 0, done: false }
      }
    };
  }
  // 高考
  const rec = recommendUni(state);
  if (rec) {
    e.gao = null;
    return {
      type: 'exam',
      exam: {
        kind: 'gao', title: '推荐制 · 那一年没有高考', score: null, full: null,
        text: `${year}。高考还没有恢复，大学名额是「推荐」来的。\n` +
          `家里能说上话的人，决定了你能不能走进那扇校门。`,
        options: [rec]
      }
    };
  }
  const raw = gaoExamScore(state);
  const hs = HIGH_SCHOOLS.find(h => h.id === e.hs);
  return {
    type: 'exam',
    exam: {
      kind: 'gao',
      title: '高考 · 常识统考',
      score: null,
      full: P.full,
      base: academicBase(raw, P),
      perQ: P.perQ,
      quizFull: P.quizFull,
      academicFull: P.academicPart,
      text: `${year} 六月，高考。${hs ? hs.name : '高中'} 出身，智力 ${Math.round(state.stats.INT)}，学习投入 ${Math.round(e.study || 0)}。\n` +
        `五道常识题，每道 ${P.perQ} 分（共 ${P.quizFull} 分），加上 ${P.academicPart} 分的平时成绩，满分 ${P.full}。`,
      options: null,
      quiz: { qs: quizPick(), i: 0, correct: 0, done: false }
    }
  };
}

/* 答题：每答一题记一次分，答完 5 题自动放榜 */
function answerExamQ(state, optIdx) {
  const item = state.pending;
  if (!item || item.type !== 'exam' || !item.exam || !item.exam.quiz || item.exam.quiz.done) return { ok: false };
  const ex = item.exam;
  const qz = ex.quiz;
  const q = qz.qs[qz.i];
  if (!q) return { ok: false };
  const correct = optIdx === q.a;
  if (correct) qz.correct += 1;
  pushLog(state, `【${ex.kind === 'mid' ? '中考' : '高考'}】第 ${qz.i + 1} 题「${q.q}」你的答案：${q.opts[optIdx]} — ${correct ? '答对了' : '答错了，正确答案是 ' + q.opts[q.a]}`, correct ? 'stat' : 'muted');
  qz.i += 1;
  if (qz.i >= qz.qs.length) {
    // 放榜
    const quizScore = qz.correct * ex.perQ;
    const total = clamp(ex.base + quizScore, 0, ex.full);
    ex.score = total;
    ex.quizScore = quizScore;
    qz.done = true;
    if (ex.kind === 'mid') state.edu.mid = total; else state.edu.gao = total;
    const pool = ex.kind === 'mid' ? HIGH_SCHOOLS : UNIVERSITIES;
    // 所有学校都摆出来，进不去的写清楚为什么——不然玩家永远不知道自己差在哪
    ex.options = pool.map(u => {
      const why = schoolLockReason(state, u, total, ex.full);
      return why ? Object.assign({}, u, { locked: true, lockReason: why }) : Object.assign({}, u);
    });
    const open = ex.options.filter(o => !o.locked);
    ex.text =
      `放榜了。平时分 ${ex.base} / ${ex.academicFull}，常识题答对 ${qz.correct} / 5 道得 ${quizScore} / ${ex.quizFull} 分，` +
      `总分 ${total} / ${ex.full}${total >= ex.full ? '——满分。' : '。'}\n` +
      (open.length > 1 ? `${pool.length} 条路摆在这里，你能走的有 ${open.length} 条。想去哪儿？`
        : open.length === 1 ? `只有一条路能走。` : `今年，一条路都没走通。`);
    pushLog(state, `【放榜】${ex.kind === 'mid' ? '中考' : '高考'} ${total} 分（满分 ${ex.full}${total >= ex.full ? '，满分' : ''}）。`, 'money');
  }
  return { ok: true, correct: correct, done: qz.done };
}

/* ---------------- 录取落定 ---------------- */
function applySchool(state, id) {
  const e = state.edu;
  if (e.hs && !e.uni) {
    // 高考录取
    const u = UNIVERSITIES.find(x => x.id === id);
    if (!u) return;
    e.uni = u.id;
    e.eduLevel = u.edu;
    e.gradAge = state.age + u.years;
    e.major = null; // 专业由录取后的填志愿事件决定
    e.salaryK = u.salaryK;
    applyEffects(state, u.eff || {});
    (u.flags || []).forEach(f => state.flags[f] = true);
    if (u.id === 'u_fail') {
      state.job = '待业';
      pushLog(state, `【落榜】${u.name}。你把课本装进纸箱，第二天去了劳务市场。`, 'warn');
    } else {
      state.job = '大学生';
      pushLog(state, `【录取】${u.name}。${u.desc}`, 'money');
      // 填志愿：从该校专业里三选一
      if (u.major && u.major.length) {
        state.queue = state.queue || [];
        state.queue.unshift({ type: 'event', ev: makeMajorEvent(state, u) });
      }
    }
    return;
  }
  // 中考录取
  const h = HIGH_SCHOOLS.find(x => x.id === id);
  if (!h) return;
  e.hs = h.id;
  applyEffects(state, h.eff || {});
  (h.flags || []).forEach(f => state.flags[f] = true);
  state.job = h.id === 'hs_none' ? '待业' : '高中生';
  pushLog(state, `【中考】${h.name}。${h.desc}`, h.tier >= 2 ? 'money' : 'warn');
}

/* ---------------- 校园活动 ---------------- */
function doUniActivity(state, actId) {
  if (!state.edu || !state.edu.uni || state.edu.uni === 'u_fail') return { ok: false, msg: '你现在不在大学里' };
  const a = UNI_ACTIVITIES.find(x => x.id === actId);
  if (!a) return { ok: false, msg: '没有这个活动' };
  if (a.condMinAge && state.age < a.condMinAge) return { ok: false, msg: `${a.condMinAge}之后才行` };
  const touch = state.uniTouch = state.uniTouch || {};
  if (touch[actId] === state.age) return { ok: false, msg: '今年已经做过了' };
  if (a.cost && state.stats.MONEY < a.cost) return { ok: false, msg: '钱不够' };
  touch[actId] = state.age;
  applyEffects(state, a.eff || {});
  if (a.id === 'a_study') state.edu.study = clamp((state.edu.study || 0) + 12, 0, EXAM_META.studyCap);
  if (a.id === 'a_kaoyan' && chance(0.45) && state.edu.eduLevel < 5) {
    state.edu.eduLevel = 5;
    state.edu.salaryK = Math.max(state.edu.salaryK || 1, 1.4);
    state.edu.gradAge = (state.edu.gradAge || 22) + 2;
    state.flags.kaoyan_ok = true;
    pushLog(state, '【上岸】考研成绩出来了。你考上了。研究生三年，又是一段没有人问结果的路。', 'money');
  }
  if (a.id === 'a_love') {
    state.flags.in_love = true;
    if (!state.flags.dating) { state.flags.dating = true; ensureLover(state, '同学'); }
  }
  pushLog(state, `【校园】${a.name} — ${a.desc}`, 'muted');
  return { ok: true };
}

/* ---------------- 刷题 / 补习（初中·高中每年一次） ---------------- */
function cramSchool(state) {
  if (state.age >= EXAM_META.gaoAge || state.age < 7) return { ok: false, msg: '现在不用刷题' };
  const touch = state.uniTouch = state.uniTouch || {};
  if (touch.cram === state.age) return { ok: false, msg: '今年已经刷过了' };
  touch.cram = state.age;
  state.edu.study = clamp((state.edu.study || 0) + randInt(6, 11), 0, EXAM_META.studyCap);
  applyEffects(state, { INT: randInt(2, 4), HP: -3, STRESS: 5, GROW: 2 });
  pushLog(state, `【刷题】这一年的晚自习，你把错题本翻烂了。学习投入 ${Math.round(state.edu.study)}。`, 'stat');
  return { ok: true };
}

/* ---------------- 同学互动 ---------------- */
function classmateAct(state, idx) {
  const c = (state.classmates || [])[idx];
  if (!c) return { ok: false, msg: '没有这位同学' };
  if (c.lastTouch === state.age) return { ok: false, msg: '今年已经见过了' };
  c.lastTouch = state.age;
  const alum = c.stage !== schoolStageOf(state);
  const gain = Math.max(1, Math.round((randInt(4, 8) + Math.round(state.stats.CHA / 22)) * (alum ? 0.6 : 1)));
  c.affinity = clamp(c.affinity + gain, 0, 100);
  applyEffects(state, { NET: alum ? 1 : 2, LOVE: alum ? 1 : 2, CHA: 1, STRESS: -2 });
  const t = CLASSMATE_TYPES.find(x => x.key === c.key) || { label: '同学' };
  pushLog(state, `【${alum ? '旧友' : '同学'}】你${alum ? '约了' : '课间和'} ${c.name}（${stageCn(c.stage)}同学 · ${t.label}）${alum ? '吃了顿饭，翻来覆去还是那几年的事' : '聊了很久'}。好感 ${Math.round(c.affinity)}%。`, 'muted');
  return { ok: true, gain };
}
