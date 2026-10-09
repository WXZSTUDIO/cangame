/* =========================================================
 * v6.3.0 新兴职业 10 种（按年代解锁，minYear = 行业诞生的年份）
 * 挂在 CAREERS 末尾 push，jobOffers 支持 minYear 门控。
 * ========================================================= */
CAREERS.push(
  {
    id: 'upzhu', name: '视频UP主', cat: '新媒体', edu: 2, risk: 3, need: { CHA: 25, INT: 30 }, minYear: 2010,
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
    id: 'livestreamer', name: '直播带货主播', cat: '新媒体', edu: 1, risk: 3, need: { CHA: 35 }, minYear: 2017,
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
    id: 'dronepilot', name: '无人机飞手', cat: '技术', edu: 2, risk: 2, need: { INT: 35 }, needFlag: ['drone_license'], minYear: 2015,
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
    id: 'escorts', name: '陪诊师', cat: '服务业', edu: 1, risk: 1, need: { CHA: 20, LOVE: 45 }, minYear: 2020,
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
    id: 'organizer', name: '整理收纳师', cat: '服务业', edu: 1, risk: 1, need: { WILL: 40 }, minYear: 2019,
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
    id: 'scriptdm', name: '剧本杀DM', cat: '文娱', edu: 1, risk: 2, need: { CHA: 28, INT: 25 }, minYear: 2018,
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
    id: 'petfuneral', name: '宠物殡葬师', cat: '服务业', edu: 1, risk: 1, need: { LOVE: 50, WILL: 35 }, minYear: 2015,
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
    id: 'crosstra', name: '跨境电商运营', cat: '商业', edu: 3, risk: 2, need: { INT: 40 }, major: ['商科', '外语', '传媒'], minYear: 2014,
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
    id: 'aitrainer', name: 'AI训练师', cat: '技术', edu: 4, risk: 2, need: { INT: 60 }, major: ['计算机', '数学'], minYear: 2020,
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
