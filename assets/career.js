/* =========================================================
 * CANGAME · 职业与晋升系统
 * 学历决定门槛，学校决定起步职级，绩效决定升迁
 * salary / cost 为年度名义值（与全局货币同单位）
 * ========================================================= */

const CAREER_META = {
  minWorkAge: 16,
  retireAge: 60,
  promoMinYears: 3
};

/* cat: 行业；edu: 最低学历等级；need: 属性门槛；risk: 职业风险（0-3） */
const CAREERS = [
  /* ===== 无门槛 / 体力 ===== */
  {
    id: 'rider', name: '外卖骑手', cat: '服务业', edu: 0, risk: 2, need: {},
    desc: '电动车、保温箱、超时罚款。时间就是钱，这句话在这里是字面意思。',
    ladder: [
      { title: '外卖骑手', sal: 8000000, cost: 7600000 },
      { title: '金牌骑手', sal: 11500000, cost: 8000000 },
      { title: '站点组长', sal: 15500000, cost: 9000000 },
      { title: '区域承包商', sal: 23000000, cost: 12000000 }
    ],
    tick: { STR: -1, HP: -1, STRESS: 2, NET: 1 }
  },
  {
    id: 'extra', name: '群众演员', cat: '演艺', edu: 0, risk: 2, need: {},
    desc: '一天八十块，盒饭管饱。躺在地上演死尸，一躺就是六个小时。',
    ladder: [
      { title: '群演', sal: 5000000, cost: 7000000 },
      { title: '特约演员', sal: 10000000, cost: 9000000 },
      { title: '配角演员', sal: 19000000, cost: 13000000 },
      { title: '有名气的演员', sal: 50000000, cost: 22000000 },
      { title: '主演 / 艺人', sal: 130000000, cost: 40000000 }
    ],
    tick: { CHA: 1, FAME: 2, SEC: -1, STRESS: 2 }
  },
  {
    id: 'waiter', name: '餐饮服务员', cat: '服务业', edu: 0, risk: 1, need: {},
    desc: '端盘子、擦桌子、被骂。第一份工作大多是这样开始的。',
    ladder: [
      { title: '服务员', sal: 6200000, cost: 6800000 },
      { title: '领班', sal: 9800000, cost: 7800000 },
      { title: '店长', sal: 17500000, cost: 9600000 },
      { title: '区域店长', sal: 30000000, cost: 13500000 }
    ],
    tick: { CHA: 1, NET: 1, STR: -1 }
  },
  {
    id: 'anchor', name: '主播 / 网红', cat: '新媒体', edu: 0, risk: 3, need: { CHA: 15 },
    desc: '直播间里只有你和一个补光灯。能不能火，谁也说不准。',
    ladder: [
      { title: '小主播', sal: 14000000, cost: 8000000 },
      { title: '签约主播', sal: 40000000, cost: 13000000 },
      { title: '头部主播', sal: 120000000, cost: 28000000 },
      { title: '机构老板', sal: 300000000, cost: 60000000 }
    ],
    tick: { CHA: 2, FAME: 2, NET: 2, STRESS: 3, HP: -1 }
  },
  {
    id: 'streamer', name: '自媒体博主', cat: '新媒体', edu: 2, risk: 2, need: { INT: 15 }, major: ['传媒', '艺术'],
    desc: '一个人、一台电脑。流量是可以被设计出来的，也可以一夜归零。',
    ladder: [
      { title: '兼职博主', sal: 10000000, cost: 7000000 },
      { title: '全职博主', sal: 26000000, cost: 10000000 },
      { title: '百万粉账号', sal: 70000000, cost: 20000000 },
      { title: '内容公司老板', sal: 180000000, cost: 42000000 }
    ],
    tick: { INT: 1, FAME: 2, NET: 1, STRESS: 2 }
  },

  /* ===== 高中 / 职高 ===== */
  {
    id: 'factory', name: '工厂工人', cat: '制造业', edu: 1, risk: 1, need: {},
    desc: '流水线、两班倒、白班夜班。厂里包吃住，也包住你十年。',
    ladder: [
      { title: '流水线工人', sal: 18000000, cost: 13000000 },
      { title: '熟练工', sal: 24000000, cost: 14000000 },
      { title: '班组长', sal: 33000000, cost: 16000000 },
      { title: '车间主任', sal: 50000000, cost: 21000000 }
    ],
    tick: { STR: -1, HP: -1, WILL: 1 }
  },
  {
    id: 'courier', name: '快递员', cat: '物流', edu: 1, risk: 1, need: {},
    desc: '片区、三轮车、双十一。爬楼的时候你会想起当年没做的那道题。',
    ladder: [
      { title: '快递员', sal: 12500000, cost: 9500000 },
      { title: '片区骨干', sal: 18500000, cost: 10500000 },
      { title: '网点承包人', sal: 31000000, cost: 14500000 },
      { title: '区域加盟商', sal: 62000000, cost: 25000000 }
    ],
    tick: { STR: -1, NET: 2, CHA: 1 }
  },
  {
    id: 'driver', name: '网约车司机', cat: '服务业', edu: 1, risk: 1, need: {},
    desc: '方向盘后面是十二个小时。你听了一整座城市的故事。',
    ladder: [
      { title: '网约车司机', sal: 14000000, cost: 10500000 },
      { title: '五星司机', sal: 20000000, cost: 11500000 },
      { title: '车队长', sal: 30000000, cost: 14500000 },
      { title: '小车队老板', sal: 54000000, cost: 23500000 }
    ],
    tick: { NET: 1, HP: -1, STRESS: 1 }
  },
  {
    id: 'guard', name: '保安 / 物业', cat: '服务业', edu: 1, risk: 0, need: {},
    desc: '门岗、监控室、一杯茶。稳定，也容易把人坐懒。',
    ladder: [
      { title: '保安', sal: 9500000, cost: 7500000 },
      { title: '保安队长', sal: 14000000, cost: 8500000 },
      { title: '物业主管', sal: 22000000, cost: 10500000 },
      { title: '物业经理', sal: 34000000, cost: 14500000 }
    ],
    tick: { STR: -1, SEC: 2, WILL: -1 }
  },
  {
    id: 'sales', name: '销售 / 中介', cat: '商业', edu: 1, risk: 2, need: { CHA: 13 }, major: ['金融'],
    desc: '底薪三千，提成上不封顶。脸皮厚一点，收入高一点。',
    ladder: [
      { title: '销售专员', sal: 17000000, cost: 12000000 },
      { title: '高级销售', sal: 42000000, cost: 16000000 },
      { title: '销售主管', sal: 70000000, cost: 22000000 },
      { title: '销售总监', sal: 130000000, cost: 35000000 }
    ],
    tick: { CHA: 2, NET: 2, STRESS: 3, ETH: -1 }
  },
  {
    id: 'cook', name: '厨师', cat: '服务业', edu: 1, risk: 1, need: {},
    desc: '后厨四十度。颠勺三年，手腕比同龄人粗一圈。',
    ladder: [
      { title: '学徒', sal: 8500000, cost: 7200000 },
      { title: '炒锅师傅', sal: 17000000, cost: 9200000 },
      { title: '厨师长', sal: 34000000, cost: 13500000 },
      { title: '餐饮合伙人', sal: 70000000, cost: 25000000 }
    ],
    tick: { STR: -1, CHA: 1, NET: 1 }
  },
  {
    id: 'idol', name: '偶像练习生', cat: '演艺', edu: 1, risk: 3, need: { CHA: 25 }, major: ['艺术', '体育'],
    desc: '练习室的镜子和体脂秤。出道位是几百个人抢的九个位置。',
    ladder: [
      { title: '练习生', sal: 7000000, cost: 8500000 },
      { title: '出道艺人', sal: 40000000, cost: 16000000 },
      { title: '人气成员', sal: 110000000, cost: 30000000 },
      { title: '顶流偶像', sal: 320000000, cost: 60000000 },
      { title: '国际艺人', sal: 800000000, cost: 90000000 }
    ],
    tick: { CHA: 2, FAME: 3, HP: -2, STRESS: 4, WILL: 1 },
    needFlag: ['music']
  },
  {
    id: 'gamer', name: '电竞选手', cat: '电竞', edu: 1, risk: 3, need: { INT: 18 },
    desc: '每天训练十四小时。黄金年龄只有四年，之后呢？',
    ladder: [
      { title: '电竞青训生', sal: 7500000, cost: 8000000 },
      { title: '职业选手', sal: 40000000, cost: 13000000 },
      { title: '明星选手', sal: 120000000, cost: 26000000 },
      { title: '俱乐部股东 / 教练', sal: 200000000, cost: 40000000 }
    ],
    tick: { INT: 1, FAME: 2, HP: -2, STRESS: 3 }
  },

  /* ===== 专科 ===== */
  {
    id: 'clerk', name: '公司文员', cat: '职场', edu: 2, risk: 0, need: {}, major: ['金融', '师范'],
    desc: '打印、报销、订会议室。写字楼里最不起眼，也最不能缺的岗位。',
    ladder: [
      { title: '前台 / 文员', sal: 16000000, cost: 10000000 },
      { title: '行政主管', sal: 25000000, cost: 12000000 },
      { title: '行政经理', sal: 38000000, cost: 16000000 },
      { title: '办公室主任', sal: 56000000, cost: 22000000 }
    ],
    tick: { LOY: 1, NET: 1, STRESS: 1 }
  },
  {
    id: 'accountant', name: '会计', cat: '财务', edu: 2, risk: 1, need: { INT: 15 }, major: ['金融'],
    desc: '凭证、报表、汇算清缴。账面干净，睡觉才踏实。',
    ladder: [
      { title: '出纳 / 会计助理', sal: 24000000, cost: 10000000 },
      { title: '会计', sal: 38000000, cost: 12000000 },
      { title: '财务主管', sal: 60000000, cost: 17000000 },
      { title: '财务总监', sal: 110000000, cost: 28000000 }
    ],
    tick: { INT: 1, LOY: 2, STRESS: 2 }
  },
  {
    id: 'nurse', name: '护士', cat: '医疗', edu: 2, risk: 1, need: {}, major: ['医学'],
    desc: '夜班、扎针、被家属骂。你见过太多生离死别。',
    ladder: [
      { title: '实习护士', sal: 18000000, cost: 9000000 },
      { title: '护士', sal: 30000000, cost: 11000000 },
      { title: '护师', sal: 44000000, cost: 14000000 },
      { title: '护士长', sal: 68000000, cost: 20000000 }
    ],
    tick: { HP: -1, LOVE: 1, WILL: 1, STRESS: 2 }
  },
  {
    id: 'ecom', name: '电商运营', cat: '互联网', edu: 2, risk: 2, need: { INT: 14 }, major: ['金融', '理工'],
    desc: '详情页、投流、大促。GMV 就是你这一年的墓志铭。',
    ladder: [
      { title: '运营助理', sal: 22000000, cost: 10000000 },
      { title: '店铺运营', sal: 40000000, cost: 13000000 },
      { title: '运营主管', sal: 70000000, cost: 19000000 },
      { title: '品牌操盘手', sal: 140000000, cost: 32000000 }
    ],
    tick: { INT: 1, NET: 1, STRESS: 3 }
  },

  /* ===== 本科 ===== */
  {
    id: 'programmer', name: '程序员', cat: '互联网', edu: 3, risk: 1, need: { INT: 20 }, major: ['理工'],
    desc: '需求、排期、线上事故。三十五岁是哪道坎，你早晚会知道。',
    ladder: [
      { title: '实习程序员', sal: 30000000, cost: 11000000 },
      { title: '初级开发', sal: 48000000, cost: 14000000 },
      { title: '中级工程师', sal: 78000000, cost: 18000000 },
      { title: '高级工程师', sal: 120000000, cost: 24000000 },
      { title: '技术专家 / 架构师', sal: 190000000, cost: 34000000 },
      { title: '技术总监', sal: 320000000, cost: 48000000 }
    ],
    tick: { INT: 2, STR: -1, HP: -1, STRESS: 2 }
  },
  {
    id: 'pm', name: '产品经理', cat: '互联网', edu: 3, risk: 2, need: { INT: 18, CHA: 15 }, major: ['理工', '金融', '传媒'],
    desc: '需求文档写不完，锅也背不完。产品是妥协的艺术。',
    ladder: [
      { title: '产品助理', sal: 28000000, cost: 11000000 },
      { title: '产品经理', sal: 52000000, cost: 15000000 },
      { title: '高级产品经理', sal: 88000000, cost: 21000000 },
      { title: '产品总监', sal: 160000000, cost: 32000000 },
      { title: '事业部负责人', sal: 300000000, cost: 46000000 }
    ],
    tick: { INT: 1, CHA: 1, NET: 2, STRESS: 3 }
  },
  {
    id: 'designer', name: 'UI / 视觉设计师', cat: '互联网', edu: 3, risk: 1, need: { INT: 15 }, major: ['艺术'],
    desc: '改稿第十七版。甲方说，还是第一版好。',
    ladder: [
      { title: '设计助理', sal: 24000000, cost: 10000000 },
      { title: '设计师', sal: 42000000, cost: 13000000 },
      { title: '资深设计师', sal: 70000000, cost: 18000000 },
      { title: '设计负责人', sal: 120000000, cost: 26000000 }
    ],
    tick: { INT: 1, CHA: 1, HP: -1, STRESS: 2 }
  },
  {
    id: 'hacker', name: '黑客 / 安全研究员', cat: '灰色', edu: 3, risk: 3, need: { INT: 28 }, major: ['理工'],
    desc: '灰色地带的技术活。一念是白帽子，一念是铁窗。',
    ladder: [
      { title: '脚本小子', sal: 36000000, cost: 12000000 },
      { title: '安全工程师', sal: 70000000, cost: 17000000 },
      { title: '顶级白帽子', sal: 140000000, cost: 26000000 },
      { title: '灰色操盘手', sal: 300000000, cost: 42000000 }
    ],
    tick: { INT: 2, ETH: -2, STRESS: 3, SEC: -2, WILL: 1 }
  },
  {
    id: 'teacher', name: '中小学教师', cat: '教育', edu: 3, risk: 0, need: { INT: 20 }, major: ['师范'],
    desc: '编制、寒暑假、一群永远记不住你生日的孩子。',
    ladder: [
      { title: '代课老师', sal: 22000000, cost: 9000000 },
      { title: '正式教师', sal: 36000000, cost: 12000000 },
      { title: '骨干教师', sal: 52000000, cost: 15000000 },
      { title: '年级组长', sal: 70000000, cost: 19000000 },
      { title: '副校长 / 校长', sal: 110000000, cost: 26000000 }
    ],
    tick: { INT: 1, LOVE: 1, SEC: 2, STRESS: 2 }
  },
  {
    id: 'lawyer', name: '律师', cat: '法律', edu: 3, risk: 2, need: { INT: 25 }, major: ['法律'],
    desc: '法考、实习、案源。前三年穷，后面看命。',
    ladder: [
      { title: '实习律师', sal: 18000000, cost: 10000000 },
      { title: '执业律师', sal: 48000000, cost: 15000000 },
      { title: '资深律师', sal: 100000000, cost: 24000000 },
      { title: '合伙人', sal: 220000000, cost: 40000000 },
      { title: '律所主任', sal: 420000000, cost: 60000000 }
    ],
    tick: { INT: 2, NET: 2, FAME: 1, STRESS: 3 }
  },
  {
    id: 'civil', name: '公务员 / 事业编', cat: '体制内', edu: 3, risk: 0, need: { INT: 23 },
    desc: '千军万马过独木桥。考上那天，母亲在电话那头哭了。',
    ladder: [
      { title: '科员', sal: 30000000, cost: 11000000 },
      { title: '副科级', sal: 42000000, cost: 13000000 },
      { title: '正科级', sal: 58000000, cost: 16000000 },
      { title: '副处级', sal: 82000000, cost: 21000000 },
      { title: '处级', sal: 120000000, cost: 28000000 },
      { title: '厅局级', sal: 200000000, cost: 40000000 }
    ],
    tick: { LOY: 2, SEC: 3, NET: 2, ETH: -1 }
  },

  /* ===== 名校 ===== */
  {
    id: 'doctor', name: '医生', cat: '医疗', edu: 4, risk: 1, need: { INT: 28 }, major: ['医学'],
    desc: '五年本科、三年规培、无数个夜班。白大褂穿上是责任。',
    ladder: [
      { title: '规培医生', sal: 22000000, cost: 11000000 },
      { title: '住院医师', sal: 45000000, cost: 14000000 },
      { title: '主治医师', sal: 80000000, cost: 20000000 },
      { title: '副主任医师', sal: 140000000, cost: 29000000 },
      { title: '主任医师 / 科室主任', sal: 240000000, cost: 42000000 }
    ],
    tick: { INT: 1, FAME: 1, HP: -2, STRESS: 3, ETH: 1 }
  },
  {
    id: 'finance', name: '投行 / 券商', cat: '金融', edu: 4, risk: 2, need: { INT: 28, CHA: 18 }, major: ['金融'],
    desc: '路演、尽调、凌晨三点的 Excel。钱在这里流动得比任何地方都快。',
    ladder: [
      { title: '分析师', sal: 50000000, cost: 18000000 },
      { title: '高级经理', sal: 100000000, cost: 28000000 },
      { title: '业务董事', sal: 200000000, cost: 42000000 },
      { title: '部门负责人', sal: 400000000, cost: 65000000 },
      { title: '合伙人 / 高管', sal: 800000000, cost: 90000000 }
    ],
    tick: { INT: 2, NET: 3, FAME: 1, HP: -2, STRESS: 4 }
  },
  {
    id: 'ai', name: 'AI 算法工程师', cat: '互联网', edu: 5, risk: 2, need: { INT: 33 }, major: ['理工'],
    desc: '算力、模型、论文。这个时代最贵的一批大脑，就坐在这些工位上。',
    ladder: [
      { title: '算法工程师', sal: 70000000, cost: 20000000 },
      { title: '高级算法专家', sal: 140000000, cost: 30000000 },
      { title: '首席科学家', sal: 280000000, cost: 48000000 },
      { title: 'AI 业务负责人', sal: 500000000, cost: 70000000 }
    ],
    tick: { INT: 3, FAME: 1, HP: -1, STRESS: 3 }
  },
  {
    id: 'startup', name: '创业者', cat: '创业', edu: 1, risk: 3, need: { WILL: 20 },
    desc: '六个工位、四个人的团队。融资 BP 改了三十版。',
    ladder: [
      { title: '初创者', sal: 12000000, cost: 14000000 },
      { title: '拿到天使轮', sal: 40000000, cost: 20000000 },
      { title: 'A 轮创始人', sal: 100000000, cost: 32000000 },
      { title: '独角兽创始人', sal: 300000000, cost: 60000000 },
      { title: '上市公司创始人', sal: 900000000, cost: 100000000 }
    ],
    tick: { WILL: 2, NET: 2, INT: 1, HP: -2, STRESS: 4 }
  },
  {
    id: 'athlete', name: '职业运动员', cat: '体育', edu: 0, risk: 3, need: { STR: 13, HP: 46 }, major: ['体育'],
    desc: '训练房、队医、成绩单。吃的是青春饭，拼的是骨头和心气。',
    ladder: [
      { title: '青训队员', sal: 9000000, cost: 7200000 },
      { title: '职业球员', sal: 16000000, cost: 9000000 },
      { title: '主力球员', sal: 34000000, cost: 12000000 },
      { title: '国字号球员', sal: 72000000, cost: 16000000 },
      { title: '传奇球星', sal: 150000000, cost: 22000000 },
      { title: '总教练 / 解说', sal: 60000000, cost: 14000000 }
    ],
    tick: { STR: 1, HP: -2, FAME: 1, STRESS: 2, WILL: 1 }
  }
];

/* ---------- 把职业阶梯展开进 JOBS，保持旧逻辑（JOBS[job]）可用 ---------- */
function buildJobTable() {
  CAREERS.forEach(c => {
    c.ladder.forEach(l => {
      JOBS[l.title] = { salary: l.sal, cost: l.cost, career: c.id };
    });
  });
  return JOBS;
}

function careerById(id) { return CAREERS.find(c => c.id === id); }
function careerOfJob(jobName) {
  const j = JOBS[jobName];
  if (!j || !j.career) return null;
  return careerById(j.career);
}

/* =========================================================
 * 孤儿职称 → CAREERS 阶梯（IMP-01 · A-06）
 * ---------------------------------------------------------
 * 事件与系统会直接往 state.job 里写一批「有名字但没有阶梯」的职称
 * （公司职员 / 公务员 / 工厂工人 / 个体户 / 创业者 / 大企业职员 /
 *   军人 / 大公司战略次长 / 大公司副董事长 / 企业董事长）。
 * 它们只存在于 engine.js 预置的 JOBS 平工资表里（JOBS[x].career 为 undefined），
 * 于是 state.career 一直是 null —— 拿固定工资、永不晋升、不吃学历与工龄加成。
 * 随机基线里「公司职员」恰好是 30 岁最主流的落点，等于把最典型的玩家路径
 * 一脚踢出了晋升体系。
 *
 * level 的取法：先按「名义年薪同档」对齐（避免一次性把主流路径的到手收入
 * 砍掉一半），再尽量留至少一级晋升空间。个中取舍见 imp-batch1.md。
 * ⚠ 这是 v6.0 数值重铸（第二批）的输入，不是终值。
 * ========================================================= */
const JOB_ALIAS = {
  '公司职员': { career: 'clerk', level: 1 },      // 公司文员 · 行政主管
  '大企业职员': { career: 'clerk', level: 2 },     // 公司文员 · 行政经理
  '公务员': { career: 'civil', level: 1 },        // 公务员/事业编 · 副科级
  '工厂工人': { career: 'factory', level: 1 },    // 工厂工人 · 熟练工
  '个体户': { career: 'startup', level: 1 },      // 创业者 · 拿到天使轮
  '创业者': { career: 'startup', level: 1 },      // 创业者 · 拿到天使轮
  '军人': { career: 'guard', level: 1 },          // 保安/物业 · 保安队长（退伍安置口径）
  '大公司战略次长': { career: 'pm', level: 2 },     // 产品经理 · 高级产品经理
  '大公司副董事长': { career: 'finance', level: 2 },// 投行/券商 · 业务董事
  '企业董事长': { career: 'finance', level: 4 }    // 投行/券商 · 合伙人 / 高管
};

/* 不在 JOB_ALIAS 里、也不该被当成职业的状态名（学生 / 未就业 / 未成年） */
const NON_JOBS = ['婴儿', '小学生', '初中生', '高中生', '大学生', '待业', '无业', '退休', ''];

/* 唯一的职称写入口：所有 `state.job = x` 都应改走这里 */
function setJob(state, title) {
  if (!title) return { job: state.job, aliased: false };

  // ① 已经是阶梯里的正经职称：同步 job 与 career.level
  const j = JOBS[title];
  if (j && j.career) {
    const c = careerById(j.career);
    const li = c ? c.ladder.findIndex(l => l.title === title) : -1;
    state.job = title;
    if (c && li >= 0) {
      if (!state.career || state.career.id !== c.id) {
        state.career = { id: c.id, level: li, years: 0, joinedAge: state.age };
      } else {
        state.career.level = li;
      }
    }
    return { job: state.job, aliased: false };
  }

  // ② 孤儿职称：换上阶梯里同档的职称，并把 career 补上
  const a = JOB_ALIAS[title];
  if (a) {
    const c = careerById(a.career);
    if (c) {
      const lv = clamp(a.level, 0, c.ladder.length - 1);
      const from = title;
      state.job = c.ladder[lv].title;
      state.career = { id: c.id, level: lv, years: 0, joinedAge: state.age };
      return { job: state.job, aliased: true, from: from };
    }
  }

  // ③ 学生 / 待业 / 退休这类状态：原样写入，不动 career
  state.job = title;
  return { job: state.job, aliased: false };
}

/* 名字是否属于「不该有 career」的状态 */
function isNonJob(title) { return NON_JOBS.indexOf(title) >= 0; }

/* ---------- 可应聘列表：学历与属性门槛 ---------- */
function jobOffers(state) {
  const lv = (state.edu && state.edu.eduLevel) || 0;
  const myMajor = majorCatOf(state);
  return CAREERS.map(c => {
    const okEdu = lv >= c.edu;
    let okStat = true, miss = '';
    for (const k in (c.need || {})) {
      if ((state.stats[k] || 0) < c.need[k]) {
        okStat = false;
        miss = `${k} 需 ${c.need[k]}`;
      }
    }
    let okFlag = true;
    if (c.needFlag && !c.needFlag.some(f => state.flags[f])) okFlag = false;
    // v6.3：时代职业——行业还没诞生的年代，投简历也投不进去
    if (c.minYear && (state.startYear + state.age) < c.minYear) okFlag = false;
    // v6.2：有案底的人进不了要政审的行当（坐过牢就当不了老师 / 公务员 / 飞行员）
    const rec = (typeof recordBlocked === 'function') ? recordBlocked(state, c) : null;
    if (rec) okFlag = false;
    // 专业对口：只约束本科及以上的对口职业（没上过大学的人不受限）
    let majorOk = true;
    if (c.major && lv >= 3 && myMajor && c.major.indexOf(myMajor) === -1) {
      majorOk = false;
      okFlag = false;
    }
    const entry = entryLevelFor(state, c);
    return { career: c, okEdu, okStat, okFlag, majorOk, miss, entry, record: rec, title: c.ladder[entry].title };
  });
}

/* 起步职级：学校越好，起点越高；社会经验（工龄）也能顶一点 */
function entryLevelFor(state, c) {
  let lv = 0;
  const lv5 = state.flags.uni_985 || state.flags.kaoyan_ok;
  const lv4 = state.flags.uni_211;
  if (lv5) lv = 1;
  else if (lv4) lv = 1;
  else if ((state.edu && state.edu.eduLevel) >= 4) lv = 1;
  if ((state.career && state.career.years >= 4) || state.age >= 30) lv += 1;
  return clamp(lv, 0, c.ladder.length - 1);
}

/* ---------- 入职 ---------- */
function applyJob(state, careerId) {
  const c = careerById(careerId);
  if (!c) return { ok: false, msg: '没有这个岗位' };
  const offer = jobOffers(state).find(o => o.career.id === careerId);
  if (!offer) return { ok: false, msg: '没有这个岗位' };
  if (!offer.okEdu) return { ok: false, msg: `学历不够（需 ${EDU_LEVELS[c.edu]}）` };
  if (!offer.okStat) return { ok: false, msg: `能力不够：${offer.miss}` };
  if (offer.record) return { ok: false, msg: offer.record + '（出狱后，有些门就关上了）' };
  if (!offer.okFlag) return { ok: false, msg: offer.majorOk ? '你缺少进入这行的机缘' : '专业不对口（HR 筛简历就刷掉了）' };
  if (state.age < CAREER_META.minWorkAge) return { ok: false, msg: `${CAREER_META.minWorkAge}岁才能正式工作` };
  const lv = offer.entry;
  state.career = { id: c.id, level: lv, years: 0, joinedAge: state.age };
  state.job = c.ladder[lv].title;
  pushLog(state, `【入职】${c.name} · ${c.ladder[lv].title}。${c.desc}`, 'money');
  return { ok: true, title: state.job };
}

/* ---------- 年度职业结算：绩效 → 升职 / 降职 / 裁员 ---------- */
function careerTick(state) {
  if (!state.career) return null;
  const c = careerById(state.career.id);
  if (!c) return null;
  const s = state.stats;
  if (c.tick) applyEffects(state, c.tick);
  state.career.years += 1;

  const lv = state.career.level;
  const salaryK = (state.edu && state.edu.salaryK) || 1;
  let score = 30
    + s.LOY * 0.525
    + s.INT * 0.44
    + s.NET * 0.32
    + s.WILL * 0.28
    + state.career.years * 2.2
    + (salaryK - 1) * 22
    + rand(-11, 13)
    - s.STRESS * 0.18
    - (state.stats.ETH < 35 ? 6 : 0)
    - (c.risk * 2);
  const need = 50 + lv * 16;

  let result = null;
  if (score >= need && lv < c.ladder.length - 1 && state.career.years >= CAREER_META.promoMinYears) {
    state.career.level += 1;
    state.job = c.ladder[state.career.level].title;
    applyEffects(state, { LOY: 6, MONEY: Math.round(c.ladder[state.career.level].sal * 0.08), NET: 3, STRESS: 4 });
    pushLog(state, `【晋升】${c.name} → ${state.job}。这一年你没有白熬。`, 'money');
    result = 'promote';
  } else if (score < need * 0.42 && lv > 0 && state.age < CAREER_META.retireAge) {
    state.career.level -= 1;
    state.job = c.ladder[state.career.level].title;
    applyEffects(state, { LOY: -8, STRESS: 8, WILL: -2, SEC: -4 });
    pushLog(state, `【降职】你被调到了 ${state.job}。工位换到了靠门的位置。`, 'warn');
    result = 'demote';
  } else if (score < need * 0.28 && c.risk >= 1 && chance(0.35) && state.age < CAREER_META.retireAge) {
    state.career = null;
    state.job = '待业';
    applyEffects(state, { LOY: -15, STRESS: 12, SEC: -8, WILL: 3 });
    pushLog(state, `【失业】公司让你走人了。你抱着纸箱站在写字楼门口，不知道该给谁打电话。`, 'warn');
    result = 'fire';
  }
  return result;
}

/* ---------- 初始化：把职业阶梯展开进 JOBS —— 调用已挪到文件末尾（v6.4） ---------- */

/* =========================================================
 * 年薪乘子配置表（IMP-01 · A-07）
 * ---------------------------------------------------------
 * 原先 careerIncome() 里有五个「直接写在函数体里的魔法数」，配置表上看不见：
 *
 *     j.salary × (1 + (age-22)*0.028) × salaryK
 *              × (1 + INT/520) × (1 + NET/1000) × (1 + LOY/1100)
 *
 * 结果是「阶梯表上的年薪」和「玩家实际拿到的年薪」系统性差 2.3×–3.7×，
 * 所有照着 CAREERS 阶梯表做的数值讨论都是错的。现在把它们全部提到这张表里，
 * 让「配置 = 运行时行为」。
 *
 * ⚠ 改这张表 = 改全局经济。v6.0 数值重铸请从这里入口，不要再去改函数体。
 * ========================================================= */
const CAREER_MULT = {
  /* 资历：从 fromAge 起每长一岁 +perYear，无上限（所以 100 岁是 3.2×） */
  seniority: { fromAge: 22, perYear: 0.028 },
  /* 学历：取自 state.edu.salaryK。
   * 来源是 school.js：高考录取走 salaryKFor(u, gao) = 档位基准 × 档内连续加成（SCORE_K），
   * 考研上岸走 Math.max(salaryK, KAOYAN_FLOOR)（常量定义在 data.js，三处考研路径共用）。
   * ⚠ 历史坑：考研下限曾有两套值（school.js 用 1.4、engine.js 用 1.45），
   *   985 生走不同路径结果差 2.1%。现统一为 KAOYAN_FLOOR，只剩这一个常量。 */
  edu: { field: 'salaryK', default: 1 },
  /* 属性加成：每 1 点属性 = 1 / div，div 越小这条属性越值钱 */
  stats: { INT: 260, NET: 500, LOY: 733 },
  /* 散工口径：没有正式职业（孤儿职称 / 长期待业）时只吃 INT 与 NET，
   * 不吃学历、不吃工龄、不吃忠诚 —— 这条原先在 engine.js 与 ui.js 各抄了一份 */
  freelance: { INT: 200, NET: 400 },

  /* ===== A-07 · 年代薪资曲线（v6.0 P2.1）=====
   * 这张表**不是**「工资应该涨多少」的独立设计，而是**守住房价收入比**的约束解：
   * 让薪资曲线与房价曲线同形，把 R(y) = HOUSE_INDEX(y) / kEra(y) 锁在一条窄带里。
   *
   * 📌 当前用的是 **「变体 B」**（`era-wage-table.md` §6）—— 因为 C1 抬了 2025 之后的房价斜率，
   *   原 v1.3 表会让晚期房价收入比失控。变体 B 是按同一套 R 形状对**新** HOUSE_INDEX 重新推的。
   *   ⚠ 若再改 `HOUSE_INDEX`，必须按 `era-wage-table.md` §6.1 重新推导这张表。
   *
   * 🔴 knots 必须与 `HOUSE_INDEX`（market.js）完全对齐（1985 之后逐点对齐）。
   *   对齐时，区间内 HOUSE 与 kEra 都是 y 的线性函数 → R(y) = 线性/线性 在区间内单调
   *   → **全局极值只可能出现在 knot 上**，可被穷举验证而不是靠采样碰运气。
   *   1955/1965/1975 三个前置 knot 是给早期世代用的（HOUSE 在 1985 前 clamp 到 1.0）。
   *
   * `norm` 是绝对水平归一化：kEra_eff(y) = table(y) / norm。
   *
   * 🔴🔴 可执行规则（不是历史数字，别照抄成常量）：
   *     **norm 必须恒等于 table[2025]。**
   *     后果：kEra_eff(2025) ≡ 1.000，即「2025 世代的薪资 = 表内基准值，不被年代项改写」。
   *     这是全表唯一的绝对锚点；1985 = 1.00 只是**书写锚点**，不承担绝对水平。
   *
   * 🔴 联动义务：以后任何人改 `HOUSE_INDEX`（market.js）或改本 era table，
   *     改完必须让 `norm` 同步跟着 **新的 table[2025]** 走，然后再复测 EW-2 / EW-4 / EW-5。
   *     否则 2025 锚点会漂 —— EW-5（clerk lv0 一本压线 vs 2000万）是这条规则的哨兵，
   *     锚点漂 3% 它就会红（2025-08 实测：norm 停在 5.31 而 table[2025] 抬到 5.48，
   *     kEra_eff(2025) = 1.032，clerk lv0 一本打出 20.57M，超门槛 2.8%）。
   *
   * ⚠ `clerk` lv0 触顶时应调 `SCORE_K.max`，不要动 norm —— norm 动一次锚点就漂一次。
   */
  era: {
    table: [
      [1955, 0.35], [1965, 0.46], [1975, 0.66],
      [1985, 1.00], [1990, 1.58], [1995, 1.83], [1997, 1.95], [1999, 1.95],
      [2002, 2.26], [2006, 2.86], [2008, 3.05], [2010, 3.59], [2013, 3.60],
      [2016, 3.65], [2018, 3.94], [2020, 4.43], [2022, 4.93], [2025, 5.48],
      [2028, 5.79], [2035, 6.90], [2045, 9.12], [2065, 15.79]
    ],
    norm: 5.48   // 🔴 必须等于 table[2025]（见上方可执行规则）
  }
};

/* 年代系数：kEra_eff(y) = table(y) / norm。正式职业与散工共用，
 * 否则 1955 世代的散工收入会与现代持平（E-6）。
 * tableAt 对越界年份 clamp 到端点（1955→0.35、2065→15.79），老存档无需迁移（E-3）。
 *
 * ⚠ 这是个**函数声明**（不是 const）：engine.js 在 career.js **之前**加载，
 *   但函数声明会挂到全局对象上，engine.js 的函数在**运行时**调用它时已经可用。
 *   若写成 `const eraK = ...`，engine.js 加载期就会踩 TDZ。
 */
function eraK(state) {
  if (typeof tableAt !== 'function' || !CAREER_MULT.era) return 1;
  return tableAt(CAREER_MULT.era.table, fmtYear(state)) / CAREER_MULT.era.norm;
}

/* 有效年薪构成：既用于结算，也用于对账 / 排查。返回每一项乘子，方便直接看钱是怎么来的 */
function careerIncomeParts(state) {
  const j = jobEntry(state, state.job);
  const s = state.stats || {};
  const S = CAREER_MULT.seniority, St = CAREER_MULT.stats;
  const salaryK = (state.edu && state.edu.salaryK) || CAREER_MULT.edu.default;
  const base = j.salary;
  const kAge = 1 + Math.max(0, (state.age || 0) - S.fromAge) * S.perYear;
  const kEdu = salaryK;
  const kInt = 1 + (s.INT || 0) / St.INT;
  const kNet = 1 + (s.NET || 0) / St.NET;
  const kLoy = 1 + (s.LOY || 0) / St.LOY;
  const kEra = eraK(state);                       // A-07：年代项
  return {
    base: base, kEra: kEra, kAge: kAge, kEdu: kEdu, kInt: kInt, kNet: kNet, kLoy: kLoy,
    total: base * kEra * kAge * kEdu * kInt * kNet * kLoy
  };
}

/* ---------- 职业收入（含学历加成与工龄） ---------- */
function careerIncome(state) {
  const p = careerIncomeParts(state);
  // 保留原来的取整顺序（先乘资历×学历取整一次，再乘三项属性），避免任何数值漂移
  // ⚠ E-5（最高危）：careerIncome 委托 parts 但**不读 p.total**，只取零件自己重算。
  //    只把 kEra 加进 parts.total 的话，会变成「UI 用新值、结算用旧值」。两处都必须有。
  const mid = Math.round(p.base * p.kEra * p.kAge * p.kEdu);
  return Math.max(0, Math.round(mid * p.kInt * p.kNet * p.kLoy));
}

/* 没有正式职业时的散工收入（原为 engine.js / ui.js 各自内联的一份公式） */
function freelanceIncome(state) {
  const j = jobEntry(state, state.job);
  const s = state.stats || {};
  const F = CAREER_MULT.freelance;
  // E-6：散工不吃学历与工龄，但**要吃年代**，否则 1955 世代的散工收入会与现代持平
  return Math.max(0, Math.round(j.salary * eraK(state)
    * (1 + (s.INT || 0) / F.INT) * (1 + (s.NET || 0) / F.NET)));
}

/* =========================================================
 * v6.0.0 职业扩充
 *  - 常规：飞行员/空乘/机务/主持人/导演/酿酒师/品酒师/情感检测师/精神科医生
 *  - 高门槛隐藏线：入殓师 / 特种部队 / 宇航员（needFlag 门槛）
 *  - 垂直线：马术骑手（jockey_license）与三级赛车线（race_license）
 *  needFlag 的旗子来自 data.js v6 事件包（参军 / 考执照 / 殡仪馆的来信）
 * ========================================================= */
CAREERS.push(
  { id: 'pilot', name: '民航飞行员', cat: '航空', edu: 4, risk: 2, need: { INT: 30, HP: 54, CHA: 18 }, major: ['理工'],
    desc: '三百吨的铝在万米高空以九百公里的时速飞行。你的手一寸一寸把它按在航线上。',
    ladder: [
      { title: '第二副驾', sal: 42000000, cost: 22000000 },
      { title: '副驾驶', sal: 68000000, cost: 30000000 },
      { title: '正驾驶', sal: 110000000, cost: 42000000 },
      { title: '机长教员', sal: 190000000, cost: 60000000 },
      { title: '总飞行师', sal: 320000000, cost: 90000000 }
    ],
    tick: { HP: -1, FAME: 1, WILL: 1, STRESS: 2 } },
  { id: 'cabincrew', name: '空乘', cat: '航空', edu: 2, risk: 1, need: { CHA: 23, HP: 42 },
    desc: '微笑、广播、应急撤离口令。三千次起飞降落，你把服务做成了肌肉记忆。',
    ladder: [
      { title: '见习乘务员', sal: 14000000, cost: 10000000 },
      { title: '乘务员', sal: 22000000, cost: 14000000 },
      { title: '头等舱乘务员', sal: 36000000, cost: 19000000 },
      { title: '乘务长', sal: 55000000, cost: 26000000 },
      { title: '客舱经理', sal: 80000000, cost: 34000000 }
    ],
    tick: { CHA: 1, HP: -1, STRESS: 2, NET: 1 } },
  { id: 'avmech', name: '飞机维修师', cat: '航空', edu: 3, risk: 2, need: { INT: 23, WILL: 20 }, major: ['理工'],
    desc: '航后检查要打几百项签。你的签名之后，是几百条人命。',
    ladder: [
      { title: '机务学徒', sal: 13000000, cost: 11000000 },
      { title: '放行机械员', sal: 24000000, cost: 16000000 },
      { title: '资深机务', sal: 40000000, cost: 22000000 },
      { title: '维修主管', sal: 65000000, cost: 30000000 }
    ],
    tick: { INT: 1, WILL: 1, HP: -2, STRESS: 2 } },
  { id: 'tvhost', name: '主持人', cat: '传媒', edu: 3, risk: 2, need: { CHA: 28, INT: 21 }, major: ['艺术', '传媒'],
    desc: '直播镜头红灯亮起的那一秒，你的声音就是全场的定心丸。',
    ladder: [
      { title: '实习主播', sal: 12000000, cost: 10000000 },
      { title: '台里主持人', sal: 26000000, cost: 16000000 },
      { title: '王牌节目主持', sal: 60000000, cost: 26000000 },
      { title: '台柱 · 金牌主持', sal: 130000000, cost: 45000000 }
    ],
    tick: { CHA: 2, FAME: 2, NET: 1, STRESS: 2 } },
  { id: 'director', name: '导演', cat: '演艺', edu: 3, risk: 3, need: { INT: 25, FAME: 8 }, major: ['艺术', '传媒'],
    desc: '监视器后面的人决定一切，也背负一切。票房和口碑，总有一个会让你失眠。',
    ladder: [
      { title: '场记 / 副导演', sal: 11000000, cost: 10000000 },
      { title: '新锐导演', sal: 30000000, cost: 20000000 },
      { title: '院线导演', sal: 80000000, cost: 40000000 },
      { title: '名导 · 工作室老板', sal: 220000000, cost: 80000000 }
    ],
    tick: { CHA: 1, FAME: 3, NET: 2, STRESS: 3, HP: -1 } },
  { id: 'brewer', name: '酿酒师', cat: '手艺', edu: 2, risk: 1, need: { INT: 20, WILL: 19 }, major: ['农林', '理工'],
    desc: '温度、湿度、时间。微生物不认识 KPI，但你把它们调教得服服帖帖。',
    ladder: [
      { title: '酿酒学徒', sal: 11000000, cost: 9000000 },
      { title: '酿造技术员', sal: 20000000, cost: 13000000 },
      { title: '首席酿酒师', sal: 42000000, cost: 20000000 },
      { title: '酒庄技术总监', sal: 70000000, cost: 30000000 }
    ],
    tick: { INT: 1, HP: -1, MOOD: 1 } },
  { id: 'sommelier', name: '品酒师', cat: '手艺', edu: 2, risk: 1, need: { CHA: 20, INT: 23 },
    desc: '一杯酒里能喝出产区、年份和酿酒师的心情。你的舌头值一套房。',
    ladder: [
      { title: '侍酒助理', sal: 12000000, cost: 11000000 },
      { title: '侍酒师', sal: 24000000, cost: 15000000 },
      { title: '高级侍酒师', sal: 48000000, cost: 22000000 },
      { title: '首席品鉴顾问', sal: 85000000, cost: 32000000 }
    ],
    tick: { CHA: 1, INT: 1, HP: -1, NET: 1 } },
  { id: 'empath', name: '情感咨询师 / 情感检测师', cat: '医疗', edu: 3, risk: 1, need: { INT: 25, CHA: 20 }, major: ['师范', '医学'],
    desc: '一对对濒临散伙的情侣坐在你面前。你负责画出他们心里的等高线。',
    ladder: [
      { title: '咨询助理', sal: 13000000, cost: 11000000 },
      { title: '情感咨询师', sal: 26000000, cost: 16000000 },
      { title: '资深咨询师', sal: 50000000, cost: 23000000 },
      { title: '情感工作室主理人', sal: 90000000, cost: 34000000 }
    ],
    tick: { INT: 1, CHA: 1, STRESS: 2, MOOD: 1 } },
  { id: 'psychiatrist', name: '精神科医生', cat: '医疗', edu: 4, risk: 1, need: { INT: 30 }, major: ['医学'],
    desc: '处方笔很轻，落下去的每个诊断都很重。这个时代的心事，一半在你的诊室里。',
    ladder: [
      { title: '精神科住院医师', sal: 22000000, cost: 18000000 },
      { title: '精神科主治医师', sal: 42000000, cost: 26000000 },
      { title: '精神科副主任医师', sal: 70000000, cost: 34000000 },
      { title: '主任医师 · 督导师', sal: 120000000, cost: 46000000 }
    ],
    tick: { INT: 1, STRESS: 2, MOOD: 1, FAME: 1 } },
  { id: 'mortician', name: '入殓师', cat: '特殊', edu: 2, risk: 1, need: { WILL: 28, ETH: 45 }, needFlag: ['mortician_call'],
    desc: '你替逝者整理最后的体面。这行不缺钱，缺的是敢直视它的人。',
    ladder: [
      { title: '殡仪馆学员', sal: 16000000, cost: 10000000 },
      { title: '入殓师', sal: 30000000, cost: 14000000 },
      { title: '资深入殓师', sal: 52000000, cost: 20000000 },
      { title: '遗体整容专家', sal: 85000000, cost: 28000000 }
    ],
    tick: { WILL: 2, ETH: 1, STRESS: 3, MOOD: -1 } },
  { id: 'sforce', name: '特种部队', cat: '军伍', edu: 1, risk: 3, need: { STR: 30, HP: 63, WILL: 35 }, needFlag: ['veteran'],
    desc: '番号保密，行踪保密。你把最好的年华交给了一面旗帜。',
    ladder: [
      { title: '突击队员', sal: 18000000, cost: 14000000 },
      { title: '班长 / 军士长', sal: 30000000, cost: 20000000 },
      { title: '特战分队指挥', sal: 52000000, cost: 28000000 },
      { title: '传奇老兵 · 教官', sal: 80000000, cost: 36000000 }
    ],
    tick: { STR: 2, WILL: 2, HP: -2, FAME: 1 } },
  { id: 'astronaut', name: '宇航员', cat: '特殊', edu: 5, risk: 3, need: { INT: 36, HP: 67, STR: 25 }, needFlag: ['veteran', 'astro_pool'],
    desc: '三千人里选出三个。点火的那八分钟，你替所有人抬头。',
    ladder: [
      { title: '预备航天员', sal: 35000000, cost: 24000000 },
      { title: '航天员', sal: 65000000, cost: 34000000 },
      { title: '指令长', sal: 120000000, cost: 50000000 },
      { title: '航天英雄 · 少将', sal: 200000000, cost: 70000000 }
    ],
    tick: { INT: 1, FAME: 3, HP: -2, WILL: 2 } },
  { id: 'jockey', name: '马术骑手', cat: '体育', edu: 1, risk: 2, need: { STR: 20, WILL: 20 }, needFlag: ['jockey_license'],
    desc: '人马合一不是玄学，是几百个清晨五点的马房。比赛的奖金很肥，摔下来也很疼。',
    ladder: [
      { title: '马房学徒', sal: 12000000, cost: 11000000 },
      { title: '见习骑手', sal: 22000000, cost: 15000000 },
      { title: '职业骑手', sal: 45000000, cost: 22000000 },
      { title: '冠军骑手', sal: 90000000, cost: 32000000 },
      { title: '马术俱乐部主理人', sal: 150000000, cost: 50000000 }
    ],
    tick: { STR: 1, WILL: 1, HP: -1, MOOD: 2 } },
  { id: 'racer_k', name: '卡丁车 / 初级方程式车手', cat: '体育', edu: 1, risk: 3, need: { STR: 18, CHA: 13 }, needFlag: ['race_license'],
    desc: '每一个世界冠军的第一圈，都是在卡丁车场被套圈的。',
    ladder: [
      { title: '卡丁车手', sal: 10000000, cost: 14000000 },
      { title: '初级方程式车手', sal: 24000000, cost: 20000000 },
      { title: '青年组冠军', sal: 55000000, cost: 30000000 }
    ],
    tick: { STR: 1, CHA: 1, HP: -2, FAME: 1 } },
  { id: 'racer_pro', name: '职业赛车手（GT / 拉力）', cat: '体育', edu: 1, risk: 3, need: { STR: 23, CHA: 18, WILL: 20 }, needFlag: ['race_license', 'race_win'],
    desc: '砂石拉力和耐力赛是两种苦。领奖台上的香槟，是拿命换的汽水。',
    ladder: [
      { title: '车队签约车手', sal: 40000000, cost: 26000000 },
      { title: '分站冠军', sal: 85000000, cost: 38000000 },
      { title: '年度总冠军', sal: 180000000, cost: 60000000 },
      { title: '厂商队席 · 传奇车手', sal: 320000000, cost: 90000000 }
    ],
    tick: { STR: 1, CHA: 2, FAME: 3, HP: -2, STRESS: 2 } }
);

/* 参军与执照事件（needFlag 的旗子从这里来） */
EVENTS.push(
  { id: 'v6_army', once: true, age: [18, 22], w: 8, text: '征兵公告贴到了社区门口。绿色的军装在橱窗里，像另一条人生的入口。',
    choices: [
      { text: '报名参军', eff: { STR: 8, WILL: 6, CHA: -2 }, flags: ['veteran'] },
      { text: '继续念书 / 工作', eff: { INT: 2 } }
    ] },
  { id: 'v6_race_lic', once: true, age: [16, 45], w: 5, cond: { min: { MONEY: 5000000 } },
    text: '赛道开放日。教练看着你的单圈成绩说：「去考个执照吧，你是这块料。」',
    choices: [
      { text: '考赛车执照（-80 万）', eff: { MONEY: -800000, CHA: 3, STR: 2 }, flags: ['race_license'] },
      { text: '看看就好', eff: { MOOD: 2 } }
    ] },
  { id: 'v6_jockey_lic', once: true, age: [14, 35], w: 5, text: '马术俱乐部的角落里永远缺人手。老骑手问你想不想系统地学。',
    choices: [
      { text: '拜师，考骑手执照', eff: { STR: 4, WILL: 3, MONEY: -1200000 }, flags: ['jockey_license'] },
      { text: '只是路过', eff: { MOOD: 1 } }
    ] },
  { id: 'v6_mortician', once: true, age: [18, 50], w: 4, text: '殡仪馆的招聘启事写在很旧的纸上：「诚聘入殓学徒，胆大心细，待遇从优。」你在门口站了很久。',
    choices: [
      { text: '走进去问详情', eff: { WILL: 4, ETH: 3 }, flags: ['mortician_call'] },
      { text: '转身离开', eff: {} }
    ] },
  { id: 'v6_astro_pool', once: true, age: [24, 38], w: 4, cond: { need: ['veteran'], min: { INT: 70, HP: 75 } },
    text: '第三批航天员选拔开始报名。你把体检表填完的那一刻，手是抖的。',
    eff: { WILL: 5, FAME: 2 }, flags: ['astro_pool'] }
);

/* =========================================================
 * v6.3.0 新兴职业 10 种（按年代解锁，minYear = 行业诞生的年份）
 * 挂在 CAREERS 末尾 push，jobOffers 支持 minYear 门控。
 * ========================================================= */
CAREERS.push(
  {
    id: 'upzhu', name: '视频UP主', cat: '新媒体', edu: 2, risk: 3, need: { CHA: 13, INT: 15 }, minYear: 2010,
    desc: '一部手机、一腔热血。更新是玄学，三连是信仰，恰饭是艺术。',
    ladder: [
      { title: '百粉小UP', sal: 3000000, cost: 4000000 },
      { title: '万粉UP主', sal: 12000000, cost: 7000000 },
      { title: '十万粉头部UP', sal: 45000000, cost: 15000000 },
      { title: '签约百万粉创作者', sal: 150000000, cost: 38000000 }
    ],
    tick: { CHA: 1, INT: 1, FAME: 2, STRESS: 2, HP: -1 }
  },
  {
    id: 'livestreamer', name: '直播带货主播', cat: '新媒体', edu: 1, risk: 3, need: { CHA: 18 }, minYear: 2017,
    desc: '三二一上链接。喉咙是消耗品，信任是易碎品，GMV是硬通货。',
    ladder: [
      { title: '夜班小主播', sal: 7000000, cost: 6000000 },
      { title: '场观过万主播', sal: 22000000, cost: 10000000 },
      { title: '头部直播间主理人', sal: 80000000, cost: 22000000 },
      { title: 'MCN机构合伙人', sal: 260000000, cost: 60000000 }
    ],
    tick: { CHA: 1, FAME: 2, HP: -2, STRESS: 3 }
  },
  {
    id: 'rideshare', name: '网约车司机', cat: '服务业', edu: 1, risk: 1, need: {}, minYear: 2014,
    desc: '方向盘一握十二小时。你是城市毛细血管里的一辆车，乘客的故事你听了一车。',
    ladder: [
      { title: '兼职司机', sal: 6000000, cost: 6500000 },
      { title: '全职司机', sal: 10000000, cost: 8000000 },
      { title: '双证优司机', sal: 14000000, cost: 9500000 },
      { title: '车队承包人', sal: 20000000, cost: 14000000 }
    ],
    tick: { STR: -1, HP: -2, STRESS: 2, NET: 1 }
  },
  {
    id: 'dronepilot', name: '无人机飞手', cat: '技术', edu: 2, risk: 2, need: { INT: 18 }, needFlag: ['drone_license'], minYear: 2015,
    desc: '航拍、测绘、植保、巡检。你的办公室在天上，摔一架一个月白干。',
    ladder: [
      { title: '持证飞手', sal: 9000000, cost: 7000000 },
      { title: '项目飞手', sal: 16000000, cost: 9500000 },
      { title: '机长 / 教员', sal: 26000000, cost: 13000000 },
      { title: '通航公司技术总监', sal: 55000000, cost: 24000000 }
    ],
    tick: { INT: 1, CUR: 1, STRESS: 2 }
  },
  {
    id: 'escorts', name: '陪诊师', cat: '服务业', edu: 1, risk: 1, need: { CHA: 10, LOVE: 45 }, minYear: 2020,
    desc: '替子女尽孝，陪陌生人看病。你熟悉每家医院的流程，也熟悉人情的重量。',
    ladder: [
      { title: '兼职陪诊', sal: 5000000, cost: 4000000 },
      { title: '全职陪诊师', sal: 9000000, cost: 5500000 },
      { title: '金牌陪诊师', sal: 14000000, cost: 7000000 },
      { title: '陪诊工作室主理人', sal: 26000000, cost: 11000000 }
    ],
    tick: { LOVE: 2, NET: 1, HP: -1 }
  },
  {
    id: 'organizer', name: '整理收纳师', cat: '服务业', edu: 1, risk: 1, need: { WILL: 20 }, minYear: 2019,
    desc: '你整理的不是衣服，是别人的人生。每一个塞满的衣柜背后，都是一段舍不得。',
    ladder: [
      { title: '上门整理师', sal: 6000000, cost: 4500000 },
      { title: '认证收纳顾问', sal: 11000000, cost: 6500000 },
      { title: '培训导师', sal: 20000000, cost: 9500000 },
      { title: '收纳品牌创始人', sal: 45000000, cost: 18000000 }
    ],
    tick: { WILL: 1, CHA: 1, LOVE: 1 }
  },
  {
    id: 'scriptdm', name: '剧本杀DM', cat: '文娱', edu: 1, risk: 2, need: { CHA: 14, INT: 13 }, minYear: 2018,
    desc: '白天主持别人的悲欢离合，晚上复盘本子的逻辑漏洞。行业起落比剧本还刺激。',
    ladder: [
      { title: '实习DM', sal: 5000000, cost: 4500000 },
      { title: '金牌DM', sal: 10000000, cost: 6500000 },
      { title: '店长 / 主持人培训师', sal: 18000000, cost: 9000000 },
      { title: '发行工作室主理人', sal: 40000000, cost: 16000000 }
    ],
    tick: { CHA: 1, INT: 1, MOOD: 1, STRESS: 2 }
  },
  {
    id: 'petfuneral', name: '宠物殡葬师', cat: '服务业', edu: 1, risk: 1, need: { LOVE: 50, WILL: 18 }, minYear: 2015,
    desc: '送别一只毛孩子，安慰一个家庭。你做的是告别，也是纪念。',
    ladder: [
      { title: '助理', sal: 5500000, cost: 4500000 },
      { title: '殡葬师', sal: 10000000, cost: 6000000 },
      { title: '高级礼仪师', sal: 16000000, cost: 8500000 },
      { title: '纪念服务工作室主理人', sal: 32000000, cost: 13000000 }
    ],
    tick: { LOVE: 2, ETH: 1, STRESS: 2 }
  },
  {
    id: 'crosstra', name: '跨境电商运营', cat: '商业', edu: 3, risk: 2, need: { INT: 20 }, major: ['商科', '外语', '传媒'], minYear: 2014,
    desc: '把货卖到全世界。时差是你的作息表，汇率是你的心电图。',
    ladder: [
      { title: '运营专员', sal: 11000000, cost: 8000000 },
      { title: '店铺负责人', sal: 20000000, cost: 11000000 },
      { title: '品类总监', sal: 42000000, cost: 18000000 },
      { title: '跨境品牌创始人', sal: 100000000, cost: 36000000 }
    ],
    tick: { INT: 1, NET: 2, LOY: 1, STRESS: 3 }
  },
  {
    id: 'aitrainer', name: 'AI训练师', cat: '技术', edu: 4, risk: 2, need: { INT: 30 }, major: ['计算机', '数学'], minYear: 2020,
    desc: '教机器说人话。你标注的每一条数据，都在塑造未来几十亿人看到的答案。',
    ladder: [
      { title: '数据标注专员', sal: 12000000, cost: 8000000 },
      { title: 'AI训练师', sal: 26000000, cost: 12000000 },
      { title: '算法产品经理', sal: 55000000, cost: 22000000 },
      { title: '大模型团队负责人', sal: 140000000, cost: 45000000 }
    ],
    tick: { INT: 2, CUR: 1, LOY: 1, STRESS: 3, HP: -1 }
  }
);

/* =========================================================
 * v6.4.0 职业工资表修复
 * ---------------------------------------------------------
 * 旧 bug：buildJobTable() 原先在文件中间（CAREERS 数组定义之后、
 * v6.0/v6.3 的 CAREERS.push 之前）就调用了，于是导演、飞行员等
 * 全部后加职业的职称从未注册进 JOBS → careerIncome 走
 * `JOBS[job] || {salary:0}` 兜底 → 这些职业年薪恒为 0。
 * 修法：调用挪到文件末尾，并给收入函数加一层职业阶梯回落。
 * ========================================================= */
function jobEntry(state, jobName) {
  const j = JOBS[jobName];
  if (j) return j;
  const c = state && state.career ? careerById(state.career.id) : null;
  if (c) {
    const lv = Math.max(0, Math.min(c.ladder.length - 1, state.career.level || 0));
    return { salary: c.ladder[lv].sal, cost: c.ladder[lv].cost, career: c.id };
  }
  return { salary: 0, cost: 12000000 };
}
buildJobTable();
