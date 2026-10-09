/* =========================================================
 * CANGAME · 市场层
 * 房产 / 汽车 / 资产 / 股市
 * 价格随年代演进，含时代冲击（IMF / 互联网泡沫 / 金融危机 / 疫情）
 * ========================================================= */

const MARKET_META = {
  stockFee: 0.0035, // 股票交易手续费
  propTax: 0.035, // 房产/车卖出交易成本
  minAge: 20, // 进入市场的最低年龄
  growthDamp: 0.75 // 股票年化阻尼（寿命延长后复利年限变多，需下调以维持平衡）
};

/* ---------- 年代价格指数（1985 = 1.0） ----------
 * ⚠ C1（v6.0 数值重铸）：2025 之后 5 段改写，2016 及以前**完全不动**。
 *   出处 `housing-decision.md` §6.2 —— 这不是抬绝对值，而是**抬 2025 之后的年化斜率**：
 *     2025→2065 年化 0.93% → **2.98%**；典型持有期（2015 买 / 2065 卖）1.70% → **3.55%**，
 *     与新增的现金 CPI（2.6%）对齐，让房子回到「抗通胀的保值资产」这一中国玩家的直觉位。
 *   2015 房价仍为 4.2–4.3（**不动**）→ 买房门可保。
 *
 * 🔴 **改这张表必须同步改 `CAREER_MULT.era.table`**（career.js）—— 两张表的 knots 必须对齐，
 *   且 `era.table` 要按 `era-wage-table.md` §6.1 重新推导（当前用的是「变体 B」）。
 *   只改房价不改薪资 → 买房门立刻失效。
 */
const HOUSE_INDEX = [
  [1985, 1.0], [1990, 1.9], [1995, 2.1], [1997, 2.2], [1999, 1.95],
  [2002, 2.6], [2006, 3.6], [2008, 3.9], [2010, 3.7], [2013, 3.6],
  [2016, 4.3], [2018, 5.2], [2020, 6.2], [2022, 7.4],
  [2025, 7.4],   // was 6.9 —— 仅补回 2022→2025 建模的回调，不额外抬高
  [2028, 8.1],   // was 7.6
  [2035, 10.0],  // was 8.6
  [2045, 13.5],  // was 9.4
  [2065, 24.0]   // was 10.0 —— 与 CPI_INDEX(2060: 6.10) 同向，房子 = 抗通胀资产
];

const CAR_INDEX = [
  [1985, 1.0], [1995, 1.15], [2005, 1.35], [2015, 1.55], [2025, 1.9], [2045, 2.3], [2065, 2.6]
];

/* ---------- 时代冲击（作用于当年涨跌幅） ---------- */
const STOCK_SHOCKS = {
  1990: { k: 0.30, t: '交易所开市', d: '老八股的时代。有人排了一整夜的队，只为买一张股票认购证。' },
  1992: { k: 0.35, t: '南巡讲话之后', d: '「发展才是硬道理」。全中国的年轻人都在往南边跑。' },
  1996: { k: 0.28, t: '大牛市', d: '营业部里人挤人，屏幕前站满了揣着存折的人。' },
  1997: { k: -0.32, t: '亚洲金融风暴', d: '周边国家的货币一个接一个崩。我们扛住了，但股市也跟着抖了半年。' },
  1999: { k: 0.42, t: '5·19 行情', d: '科技网络股起飞。只要名字里带「科技」，就能涨停。' },
  2001: { k: -0.20, t: '国有股减持', d: '政策一出，指数一路向南。也是这一年，中国加入了 WTO。' },
  2005: { k: 0.22, t: '998 点大底', d: '股权分置改革。敢在没人相信的时候买的人，三年后翻了六倍。' },
  2007: { k: 0.62, t: '6124 点', d: '全民炒股。菜市场的阿姨都在给你荐股。那年进场的人，等了十年才解套。' },
  2008: { k: -0.55, t: '全球金融危机', d: '从 6124 到 1664。你的账户少了三分之二，只剩下沉默。' },
  2009: { k: 0.48, t: '四万亿', d: 'V 型反转。敢在废墟里捡东西的人，一年就翻了身。' },
  2011: { k: -0.15, t: '紧缩与欧债', d: '通胀抬头，钱紧。市场心神不宁。' },
  2013: { k: 0.14, t: '创业板牛市', d: '手游、影视、传媒。并购重组的钱像水一样流。' },
  2015: { k: -0.38, t: '股灾 · 杠杆破裂', d: '上半年人人都是股神，六月之后千股跌停。配资的人，一夜回到解放前。' },
  2016: { k: -0.12, t: '熔断', d: '开盘十五分钟就收市，历史上最荒唐的四天。' },
  2018: { k: -0.22, t: '去杠杆与贸易摩擦', d: '质押爆仓、商誉减值。连白马都在跌。' },
  2019: { k: 0.24, t: '科技自主行情', d: '半导体被卡脖子的那年，也正是它起飞的那年。' },
  2020: { k: -0.26, t: '疫情冲击', d: '春节后第一天，三千只股票跌停。然后是史上最快的放水。' },
  2021: { k: 0.32, t: '核心资产牛市', d: '「各种茅」涨上了天。一年后，它们又跌回地面。' },
  2022: { k: -0.24, t: '估值杀', d: '成长股血流成河。躺平的基民学会了两个新词：回撤、最大回撤。' },
  2023: { k: 0.26, t: 'AI 行情', d: '算力、模型、数据。AI 吃掉一切，芯片先起飞。' },
  2026: { k: -0.14, t: '调整年', d: '涨太多，总要歇一歇。' },
  2030: { k: 0.16, t: '新周期', d: '新技术开始兑现成利润。' },
  2040: { k: -0.11, t: '又一次调整', d: '市场又一次教育了所有人。' }
};

const HOUSE_SHOCKS = {
  1991: -0.10, 1997: -0.18, 1998: -0.12, 2001: 0.14, 2002: 0.18,
  2003: 0.12, 2006: 0.16, 2008: -0.10, 2010: -0.06, 2013: -0.05,
  2016: 0.13, 2017: 0.12, 2018: 0.14, 2020: 0.18, 2021: 0.15,
  2022: -0.13, 2023: -0.06, 2026: 0.05, 2030: 0.06, 2040: -0.04
};

/* ---------- 贷款利率（按年份区间） ---------- */
const RATE_TABLE = [
  [1985, 0.105], [1993, 0.095], [1997, 0.155], [1999, 0.105],
  [2002, 0.068], [2008, 0.062], [2010, 0.048], [2015, 0.032],
  [2020, 0.028], [2022, 0.045], [2025, 0.042], [2030, 0.038], [2040, 0.035]
];

/* ---------- 房产（base = 1985 基准价） ---------- */
const HOUSES = [
  { id: 'h_jeonse_bjh', name: '城中村隔断间（押一付三）', base: 18000000,
    jeonse: true, growth: 0.035, vol: 0.03, upkeep: 0, rent: 0, cha: -2, minYear: 1985,
    desc: '一间隔断，一扇朝北的窗，楼下是永远在修的路。押一付三，是穷人的杠杆。' },
  { id: 'h_jeonse_gb', name: '老城区合租次卧（押一付三）', base: 32000000,
    jeonse: true, growth: 0.04, vol: 0.04, upkeep: 0, rent: 0, cha: 0, minYear: 1988,
    desc: '和三个陌生人共用一个卫生间。房租便宜，是因为这里没有你的名字。' },
  { id: 'h_villa_gj', name: '郊区小户型', base: 45000000,
    growth: 0.042, vol: 0.06, upkeep: 0.006, rent: 0, cha: 1, minYear: 1990,
    desc: '地铁终点站再坐两站公交。楼下车库，楼顶水箱。' },
  { id: 'h_apt_gangbuk', name: '市区老破小两居', base: 78000000,
    growth: 0.05, vol: 0.07, upkeep: 0.008, rent: 0, cha: 2, minYear: 1993,
    desc: '没有电梯，六楼。第一次有自己的阳台，晚上能看见远处的高架。' },
  { id: 'h_apt_eunma', name: '重点小学学区房', base: 140000000,
    growth: 0.072, vol: 0.08, upkeep: 0.009, rent: 0, cha: 4, minYear: 1996,
    desc: '一套四十平的老房子，贵在地段上那所小学。家长们的战争，都在这片楼群里打响。', tag: '学区' },
  { id: 'h_apt_apgujeong', name: '市中心大平层', base: 260000000,
    growth: 0.078, vol: 0.09, upkeep: 0.010, rent: 0, cha: 7, minYear: 2000,
    desc: '落地窗正对江。这里的车位比车贵，邻居的名字常出现在财经版上。', tag: '顶级' },
  { id: 'h_officetel_ydp', name: '商住公寓（可出租）', base: 160000000,
    growth: 0.055, vol: 0.07, upkeep: 0.010, rent: 0.055, cha: 3, minYear: 1998,
    desc: '写字楼林立的街区。楼下是上班的人，楼上是你的租客。', tag: '收租' },
  { id: 'h_shop_gangnam', name: '临街商铺', base: 520000000,
    growth: 0.062, vol: 0.10, upkeep: 0.012, rent: 0.075, cha: 5, net: 4, minYear: 2002,
    desc: '三十平的店面，租给一家奶茶店。每月的租金到账短信，是你最爱的闹钟。', tag: '收租' },
  { id: 'h_villa_jeju', name: '海边度假房', base: 380000000,
    growth: 0.05, vol: 0.09, upkeep: 0.014, rent: 0.02, cha: 6, minYear: 2008,
    desc: '推开窗就是海。你终于有了一个可以不去的地方。', tag: '度假' },
  { id: 'h_bldg_seongsu', name: '文创园整栋小楼', base: 1250000000,
    growth: 0.075, vol: 0.11, upkeep: 0.011, rent: 0.068, cha: 8, net: 8, minYear: 2012,
    desc: '旧厂房改造的咖啡街区。整栋楼都在替你赚钱。', tag: '收租' },
  { id: 'h_house_hannam', name: '江景大平层', base: 3200000000,
    growth: 0.068, vol: 0.10, upkeep: 0.016, rent: 0, cha: 14, net: 10, minYear: 2016,
    desc: '一整层的落地窗，江在脚下。铁门后面，是你小时候画的那栋楼。', tag: '顶级' }
];

/* ---------- 汽车 ---------- */
const CARS = [
  { id: 'car_tico', name: '二手奥拓', base: 2200000,
    dep: 0.11, upkeep: 0.16, cha: -1, minYear: 1991,
    desc: '排量 0.8，上坡要关空调。但它带你离开了那个隔断间。' },
  { id: 'car_sonata', name: '合资家轿 · 朗逸', base: 16000000,
    dep: 0.13, upkeep: 0.10, cha: 2, net: 1, minYear: 1988,
    desc: '中国家庭的身份证。小区停车场里十辆有六辆是它。' },
  { id: 'car_gran', name: '中级车 · 雅阁', base: 32000000,
    dep: 0.12, upkeep: 0.11, cha: 4, net: 3, minYear: 1998,
    desc: '部门经理的座驾。开进小区地下车库那天，保安第一次向你敬礼。' },
  { id: 'car_bmw', name: '宝马 5 系', base: 62000000,
    dep: 0.15, upkeep: 0.14, cha: 6, net: 3, minYear: 2002,
    desc: '开了它回老家，亲戚们开始打听你在外面做什么。' },
  { id: 'car_benz', name: '奔驰 S 级', base: 128000000,
    dep: 0.14, upkeep: 0.15, cha: 9, net: 6, minYear: 2008,
    desc: '后排比前排重要。你开始坐在后面。' },
  { id: 'car_porsche', name: '保时捷 911', base: 185000000,
    dep: 0.10, upkeep: 0.13, cha: 12, net: 4, minYear: 2013,
    desc: '红灯前，你和隔壁车道的谁对视了一眼。' },
  { id: 'car_lambo', name: '兰博基尼 Urus', base: 420000000,
    dep: 0.11, upkeep: 0.16, cha: 16, net: 5, minYear: 2020,
    desc: '排气声能震碎一条街的体面。你花了很多年，就为了这一声。' },
  { id: 'car_ev', name: '国产新能源', base: 55000000,
    dep: 0.09, upkeep: 0.05, cha: 5, net: 2, minYear: 2022,
    desc: '安静、省钱、有补贴。你开始在意另一件更大的事。' }
];

/* ---------- 其他资产 ---------- */
const GOODS = [
  { id: 'g_deposit', name: '定期存款', base: 10000000,
    growth: 0.045, vol: 0, upkeep: 0, rent: 0.0, safe: true, minYear: 1985,
    desc: '最无聊的东西，也是最不容易死的东西。利率跟着时代走。' },
  { id: 'g_gold', name: '金条 100g', base: 12000000,
    growth: 0.055, vol: 0.09, upkeep: 0, minYear: 1985,
    desc: '乱世的安全垫。中国大妈們抢金的那年，金价一夜之间跌穿了成本。' },
  { id: 'g_watch', name: '名表 · 百达翡丽级', base: 38000000,
    growth: 0.05, vol: 0.12, upkeep: 0.004, cha: 5, minYear: 1995,
    desc: '手腕上的谈判筹码。酒桌上，总有人先看你的表。' },
  { id: 'g_art', name: '名家字画', base: 150000000,
    growth: 0.07, vol: 0.28, upkeep: 0.006, cha: 6, net: 4, minYear: 2000,
    desc: '看懂的人说它值一个小目标，看不懂的人说这是一张涂鸦的宣纸。' },
  { id: 'g_wine', name: '白酒收藏 · 年份茅台', base: 45000000,
    growth: 0.065, vol: 0.16, upkeep: 0.005, cha: 4, net: 3, minYear: 2004,
    desc: '酒柜恒温 15 度。每一瓶都在替你安静地赚钱，只要你忍住不喝。' },
  { id: 'g_golf', name: '高尔夫会籍', base: 260000000,
    growth: 0.04, vol: 0.22, upkeep: 0.008, cha: 6, net: 12, minYear: 1998,
    desc: '有一半的生意是在球场里谈成的。这张卡就是入场券。' },
  { id: 'g_land', name: '城郊地块', base: 90000000,
    growth: 0.06, vol: 0.10, upkeep: 0.002, minYear: 1990,
    desc: '一片荒地。你赌的是十年后，这里会不会通一条地铁线。' },
  { id: 'g_gosiwon', name: '小旅馆经营权', base: 320000000,
    growth: 0.035, vol: 0.08, upkeep: 0.02, rent: 0.11, net: 2, minYear: 1996,
    desc: '四十个小房间，住着四十个来城里找工作的人。你收他们的月租。', tag: '收租' },
  { id: 'g_coin', name: '比特币', base: 8000000,
    growth: 0.34, vol: 0.65, upkeep: 0, minYear: 2013,
    desc: '一个没有国家的货币。涨跌都不需要理由。', tag: '高风险' }
];

/* ---------- 股票（base = 1985 基准股价） ---------- */
const STOCKS = [
  { id: 's_hansung', name: '华兴半导体', code: '600001', sector: '半导体',
    base: 3200, growth: 0.102, vol: 0.30, div: 0.012, minYear: 1985,
    desc: '被卡脖子的那一行，也是最争气的那一行。它的 K 线，写了半部产业史。' },
  { id: 's_hangang', name: '长江重工', code: '600002', sector: '重工',
    base: 5400, growth: 0.062, vol: 0.34, div: 0.018, minYear: 1985,
    desc: '造船、基建、工程机械。周期来了翻倍，周期走了腰斩。' },
  { id: 's_rainbow', name: '民生银行', code: '600003', sector: '金融',
    base: 7600, growth: 0.055, vol: 0.20, div: 0.038, minYear: 1985,
    desc: '分红最稳的那一只。老人和寡妇的最爱。' },
  { id: 's_seolhwa', name: '雪花食品', code: '600004', sector: '消费',
    base: 4100, growth: 0.07, vol: 0.15, div: 0.022, minYear: 1985,
    desc: '酱油和牛奶。无论什么时候，人都要吃饭。' },
  { id: 's_koryo', name: '中通通信', code: '600005', sector: '通信',
    base: 6800, growth: 0.06, vol: 0.18, div: 0.031, minYear: 1990,
    desc: '从寻呼机到 5G。它见证了每一次通信换代。' },
  { id: 's_baekdu', name: '白头制药', code: '600006', sector: '医药',
    base: 2900, growth: 0.085, vol: 0.26, div: 0.008, minYear: 1992,
    desc: '一款新药可以吃十年。集采一来，也能跌回原点。' },
  { id: 's_goldconst', name: '金鼎建设', code: '600007', sector: '地产',
    base: 4700, growth: 0.048, vol: 0.32, div: 0.015, minYear: 1988,
    desc: '它的业绩就是房价曲线。楼市的每一次调控，都写在它的报表上。' },
  { id: 's_arirang', name: '星光娱乐', code: '600008', sector: '传媒',
    base: 1500, growth: 0.125, vol: 0.48, div: 0.004, minYear: 2000,
    desc: '造星工厂。一部剧能救公司，一场塌房也能毁掉它。' },
  { id: 's_dongbang', name: '东方物流', code: '600009', sector: '物流',
    base: 3600, growth: 0.066, vol: 0.22, div: 0.016, minYear: 1996,
    desc: '港口、货车、仓库。经济的总量，写在它的卡车里程里。' },
  { id: 's_green', name: '绿能电池', code: '600010', sector: '新能源',
    base: 22000, growth: 0.115, vol: 0.52, div: 0.002, minYear: 2015,
    desc: '电池与新能源。年轻人的最爱，也是波动最大的那一只。' },
  { id: 's_ai', name: '智源 AI', code: '600011', sector: 'AI', base: 46000,
    growth: 0.14, vol: 0.58, div: 0.0, minYear: 2023,
    desc: '算力、模型、数据。它涨的时候，没有人不相信未来。' },
  { id: 's_kospi', name: '沪深 300 ETF', code: '600012', sector: '指数基金',
    base: 5000, growth: 0.068, vol: 0.16, div: 0.020, minYear: 1985,
    desc: '买下整个市场。不刺激，但你几乎不会输给时代。', tag: '稳健' }
];

/* =========================================================
 * 行情引擎
 * ========================================================= */

function gauss() {
  return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
}

function tableAt(table, year) {
  let v = table[0][1];
  for (let i = 0; i < table.length; i++) {
    if (table[i][0] > year) break;
    v = table[i][1];
  }
  // 区间内线性插值
  for (let i = 0; i < table.length - 1; i++) {
    const a = table[i], b = table[i + 1];
    if (year >= a[0] && year <= b[0]) {
      const r = (year - a[0]) / (b[0] - a[0]);
      return a[1] + (b[1] - a[1]) * r;
    }
  }
  return v;
}

function rateAt(year) {
  let r = RATE_TABLE[0][1];
  for (let i = 0; i < RATE_TABLE.length; i++) {
    if (RATE_TABLE[i][0] <= year) r = RATE_TABLE[i][1];
  }
  return r;
}

/* 房产/资产/车的当前单价 */
function housePrice(state, h) {
  const y = fmtYear(state);
  const idx = tableAt(HOUSE_INDEX, y);
  const jitter = 1 + (state.market.drift[h.id] || 0);
  return Math.round(h.base * idx * jitter);
}
function goodPrice(state, g) {
  const y = fmtYear(state);
  const years = Math.max(0, y - (g.minYear || 1985));
  const grow = Math.pow(1 + g.growth, years);
  const jitter = 1 + (state.market.drift[g.id] || 0);
  return Math.round(g.base * grow * jitter);
}
function carPrice(state, c) {
  const y = fmtYear(state);
  return Math.round(c.base * tableAt(CAR_INDEX, y));
}

function stockPrice(state, id) { return state.market.prices[id] || 0; }

/* ---------- 初始化 ---------- */
function marketInit(state) {
  state.market = {
    props: [], // 持有的房产/车/资产
    stocks: [], // 持股 {id, shares, cost}
    prices: {}, // 当前股价
    prev: {}, // 去年股价（算涨跌幅）
    hist: {}, // 价格历史（画走势）
    drift: {}, // 房产/资产的额外涨跌累积
    debt: 0, // 贷款总额
    uid: 1,
    log: []
  };
  STOCKS.forEach(s => {
    state.market.prices[s.id] = s.base;
    state.market.prev[s.id] = s.base;
    state.market.hist[s.id] = [s.base];
  });
  return state.market;
}

function marketMigrate(state) {
  if (!state.market) marketInit(state);
  const m = state.market;
  m.props = m.props || [];
  m.stocks = m.stocks || [];
  m.prices = m.prices || {};
  m.prev = m.prev || {};
  m.hist = m.hist || {};
  m.drift = m.drift || {};
  m.debt = m.debt || 0;
  m.uid = m.uid || 1;
  m.log = m.log || [];
  STOCKS.forEach(s => {
    if (!m.prices[s.id]) { m.prices[s.id] = s.base; m.prev[s.id] = s.base; }
    if (!m.hist[s.id]) m.hist[s.id] = [m.prices[s.id]];
  });
  return m;
}

/* ---------- 每年行情推进 ---------- */
function marketTick(state) {
  const m = marketMigrate(state);
  const y = fmtYear(state);
  const shock = STOCK_SHOCKS[y];
  const hs = HOUSE_SHOCKS[y] || 0;
  const lines = [];

  // 股票
  const newsBias = m.newsBias || 0;   // v6：新闻/事件情绪（去年事件 → 今年行情）
  const houseBias = m.houseBias || 0;
  const techK = m.techK || 0;         // v6.1：科技浪潮（去年事件 → 今年科技板块整体行情）
  const tip = m.tip || null;          // v6.1：圈内消息（只影响一只股票——消息有可能是假的）
  m.newsBias = 0; m.houseBias = 0; m.techK = 0; m.tip = null;
  const TECH_SECTORS = ['半导体', 'AI', '通信', '新能源'];
  STOCKS.forEach(s => {
    m.prev[s.id] = m.prices[s.id];
    let p = m.prices[s.id];
    // DAMP: 寿命延长到 100+ 后复利年限变多，年化整体下调以维持原有平衡
    let k = s.growth * MARKET_META.growthDamp + (shock ? shock.k * (s.sector.indexOf('指数') >= 0 ? 0.6 : 1) : 0) + gauss() * s.vol + newsBias;
    if (techK && TECH_SECTORS.indexOf(s.sector) >= 0) k += techK;
    if (tip && tip.id === s.id) k += tip.k;
    p = Math.round(Math.max(p * 0.22, p * (1 + k)));
    m.prices[s.id] = p;
    const h = m.hist[s.id];
    h.push(p);
    if (h.length > 14) h.shift();
  });

  // 房产与资产的额外漂移（均值回归，避免长期单边暴涨）
  HOUSES.forEach(h => {
    const d = (m.drift[h.id] || 0) * 0.86 + hs * 0.35 + houseBias * 0.5 + gauss() * h.vol * 0.35;
    m.drift[h.id] = Math.max(-0.45, Math.min(1.0, d));
  });
  GOODS.forEach(g => {
    if (g.safe) { m.drift[g.id] = 0; return; }
    const d = (m.drift[g.id] || 0) * 0.88 + gauss() * g.vol * 0.5 - (g.vol > 0.4 ? 0.02 : 0);
    m.drift[g.id] = Math.max(-0.6, Math.min(1.6, d));
  });

  // 持股分红
  let divTotal = 0;
  m.stocks.forEach(pos => {
    const s = STOCKS.find(x => x.id === pos.id);
    if (!s) return;
    const d = Math.round(pos.shares * m.prices[s.id] * s.div);
    if (d > 0) { divTotal += d; }
  });
  if (divTotal > 0) {
    state.stats.MONEY += divTotal;
    lines.push(`分红到账 ${fmtMoney(divTotal)}`);
  }

  // 资产结算：升值 / 折旧 / 维护费 / 租金 / 利息
  let upkeep = 0, rent = 0;
  m.props.forEach(p => {
    const ref = propRef(p);
    if (!ref) return;
    if (p.kind === 'house') {
      const v = housePrice(state, ref);
      p.value = Math.round(p.value * (1 + (v / Math.max(1, p.unit) - 1)));
      p.unit = v;
      upkeep += Math.round(v * (ref.upkeep || 0));
      rent += Math.round(v * (ref.rent || 0));
    } else if (p.kind === 'car') {
      p.value = Math.round(p.value * (1 - ref.dep));
      p.unit = p.value;
      upkeep += Math.round(carPrice(state, ref) * ref.upkeep);
    } else {
      const v = goodPrice(state, ref);
      p.unit = v;
      p.value = Math.round(p.unit * (p.qty || 1));
      upkeep += Math.round(p.value * (ref.upkeep || 0));
      rent += Math.round(p.value * (ref.rent || 0));
    }
  });

  const rate = rateAt(y);
  const interest = Math.round(m.debt * rate);

  if (rent > 0) { state.stats.MONEY += rent; lines.push(`租金收入 ${fmtMoney(rent)}`); }
  if (upkeep > 0) { state.stats.MONEY -= upkeep; lines.push(`持有成本 -${fmtMoney(upkeep)}`); }
  if (interest > 0) { state.stats.MONEY -= interest; lines.push(`贷款利息 -${fmtMoney(interest)}（年利率 ${(rate * 100).toFixed(1)}%）`); }

  if (shock) {
    pushLog(state, `【股市 · ${y} 年】${shock.t} — ${shock.d}`, shock.k >= 0 ? 'money' : 'warn');
  }
  if (lines.length) {
    pushLog(state, `【资产 · ${y} 年】` + lines.join(' · '), 'money');
  }
  state.market.rate = rate;
  return { shock, rent, upkeep, interest, div: divTotal };
}

function propRef(p) {
  if (p.kind === 'house') return HOUSES.find(h => h.id === p.refId);
  if (p.kind === 'car') return CARS.find(c => c.id === p.refId);
  return GOODS.find(g => g.id === p.refId);
}

/* ---------- 净资产 ---------- */
function stockValue(state) {
  const m = marketMigrate(state);
  return m.stocks.reduce((a, p) => a + p.shares * (m.prices[p.id] || 0), 0);
}
function propValue(state) {
  const m = marketMigrate(state);
  return m.props.reduce((a, p) => a + (p.value || 0), 0);
}
function netWorth(state) {
  // v6.4：配偶名下资产（扣掉 TA 的婚前债务）也是这个家的净资产
  const hh = (typeof householdNet === 'function') ? householdNet(state) : 0;
  return Math.round(state.stats.MONEY + propValue(state) + stockValue(state) + hh - (state.market ? state.market.debt : 0));
}

/* ---------- 交易 ---------- */
function buyProp(state, kind, refId, downRatio, qty) {
  const m = marketMigrate(state);
  const ref = kind === 'house' ? HOUSES.find(h => h.id === refId)
    : kind === 'car' ? CARS.find(c => c.id === refId)
      : GOODS.find(g => g.id === refId);
  if (!ref) return { ok: false, msg: '没有这件东西' };
  const y = fmtYear(state);
  if (y < (ref.minYear || 1985)) return { ok: false, msg: `${ref.minYear} 年 之后才会出现` };

  const unit = kind === 'house' ? housePrice(state, ref)
    : kind === 'car' ? carPrice(state, ref) : goodPrice(state, ref);
  const n = kind === 'good' ? Math.max(1, qty || 1) : 1;
  const total = unit * n;
  const ratio = ref.jeonse ? 1 : clamp(downRatio == null ? 1 : downRatio, 0.1, 1);
  const down = Math.round(total * ratio);
  const loan = total - down;

  if (state.stats.MONEY < down) {
    return { ok: false, msg: `现金不足，需要首付 ${fmtMoney(down)}` };
  }
  state.stats.MONEY -= down;
  m.debt += loan;
  const p = {
    uid: m.uid++, kind, refId, name: ref.name, qty: n,
    unit, value: kind === 'car' ? Math.round(total * 0.92) : total,
    buyYear: y, buyPrice: total, loan
  };
  m.props.push(p);
  applyEffects(state, { CHA: ref.cha || 0, NET: ref.net || 0 });
  pushLog(state, `【买入】${ref.name}${n > 1 ? ' ×' + n : ''} · 总价 ${fmtMoney(total)}` +
    `（首付 ${fmtMoney(down)}${loan > 0 ? '，贷款 ' + fmtMoney(loan) : ''}）`, 'money');
  if (kind === 'house' && !ref.jeonse) state.flags.own_house = true;
  if (kind === 'house' && ref.base >= 260000000) state.flags.gangnam_owner = true;
  if (kind === 'car') state.flags.own_car = true;
  return { ok: true, prop: p };
}

function sellProp(state, uid) {
  const m = marketMigrate(state);
  const i = m.props.findIndex(p => p.uid === uid);
  if (i < 0) return { ok: false, msg: '没有这项资产' };
  const p = m.props[i];
  const ref = propRef(p);
  const gross = p.value;
  const fee = Math.round(gross * MARKET_META.propTax);
  const net = Math.round(gross - fee - p.loan);
  m.debt = Math.max(0, m.debt - p.loan);
  state.stats.MONEY += net;
  m.props.splice(i, 1);
  if (ref) applyEffects(state, { CHA: -(ref.cha || 0), NET: -(ref.net || 0) });
  pushLog(state, `【卖出】${p.name} · 成交 ${fmtMoney(gross)}，扣除费用与贷款后到手 ${fmtMoney(net)}`, net >= p.buyPrice ? 'money' : 'warn');
  return { ok: true, net };
}

function buyStock(state, id, shares) {
  const m = marketMigrate(state);
  const s = STOCKS.find(x => x.id === id);
  if (!s) return { ok: false, msg: '没有这只股票' };
  const y = fmtYear(state);
  if (y < (s.minYear || 1985)) return { ok: false, msg: `${s.minYear} 年 之后才上市` };
  const price = m.prices[id];
  const n = Math.floor(shares);
  if (n <= 0) return { ok: false, msg: '数量不对' };
  const cost = Math.round(price * n * (1 + MARKET_META.stockFee));
  if (state.stats.MONEY < cost) return { ok: false, msg: `现金不足，需要 ${fmtMoney(cost)}` };
  state.stats.MONEY -= cost;
  let pos = m.stocks.find(p => p.id === id);
  if (!pos) { pos = { id, shares: 0, cost: 0 }; m.stocks.push(pos); }
  pos.shares += n; pos.cost += cost;
  pushLog(state, `【买入】${s.name} ${n}股 @ ${fmtMoney(price)}，花费 ${fmtMoney(cost)}`, 'money');
  return { ok: true, cost, n };
}

function sellStock(state, id, shares) {
  const m = marketMigrate(state);
  const pos = m.stocks.find(p => p.id === id);
  if (!pos) return { ok: false, msg: '你没有这只股票' };
  const s = STOCKS.find(x => x.id === id);
  const n = Math.min(pos.shares, Math.floor(shares));
  if (n <= 0) return { ok: false, msg: '数量不对' };
  const price = m.prices[id];
  const got = Math.round(price * n * (1 - MARKET_META.stockFee));
  state.stats.MONEY += got;
  const profit = got - Math.round(pos.cost * (n / pos.shares));
  pos.shares -= n;
  pos.cost = Math.round(pos.cost * (pos.shares / (pos.shares + n)));
  if (pos.shares <= 0) m.stocks = m.stocks.filter(p => p.id !== id || p.shares > 0);
  pushLog(state, `【卖出】${s.name} ${n}股 @ ${fmtMoney(price)}，到手 ${fmtMoney(got)}（${profit >= 0 ? '+' : ''}${fmtMoney(profit)}）`,
    profit >= 0 ? 'money' : 'warn');
  return { ok: true, got, profit };
}

function repayDebt(state, amount) {
  const m = marketMigrate(state);
  if (m.debt <= 0) return { ok: false, msg: '没有贷款' };
  const pay = Math.min(m.debt, Math.max(0, Math.round(amount)));
  if (state.stats.MONEY < pay) return { ok: false, msg: '现金不足' };
  state.stats.MONEY -= pay;
  m.debt -= pay;
  // 同步减少持有房产的贷款标记（按最早的一笔）
  let left = pay;
  m.props.forEach(p => {
    if (left <= 0) return;
    const d = Math.min(p.loan, left);
    p.loan -= d; left -= d;
  });
  pushLog(state, `【还贷】偿还 ${fmtMoney(pay)}，剩余贷款 ${fmtMoney(m.debt)}`, 'money');
  return { ok: true, pay };
}

/* ---------- 市场可用性 ---------- */
function marketOpen(state) {
  return state.age >= MARKET_META.minAge && !state.finished;
}

/* ---------- 行情摘要（侧栏） ---------- */
function marketSummary(state) {
  const m = marketMigrate(state);
  return {
    cash: state.stats.MONEY,
    props: propValue(state),
    stocks: stockValue(state),
    debt: m.debt,
    net: netWorth(state)
  };
}

/* =========================================================
 * v6.0.0 扩展包：商业地产 / 新能源与赛车 / 顶奢载具
 *  - 商业不动产走 HOUSES 通道（tag: '商业'），共用涨跌算法
 *  - 顶奢载具走 GOODS 通道（lux: true），持有期间在 luxTick 中给隐藏加成
 * ========================================================= */

/* ---------------- 商业不动产 ---------------- */
HOUSES.push(
  { id: 'h_mall_city', name: '社区底商旺铺', base: 300000000,
    growth: 0.058, vol: 0.09, upkeep: 0.012, rent: 0.068, cha: 6, net: 5, minYear: 2000,
    desc: '奶茶店、快递驿站、宠物店……六家租客的经营范围，就是你的一条小商业街。', tag: '商业' },
  { id: 'h_tower_office', name: '甲级写字楼整层', base: 1500000000,
    growth: 0.06, vol: 0.11, upkeep: 0.014, rent: 0.072, cha: 10, net: 12, minYear: 2008,
    desc: '电梯里挤满了工牌。他们中的每一个人，每月都在给你的账户打钱。', tag: '商业' },
  { id: 'h_island_priv', name: '私人海岛（度假开发）', base: 6000000000,
    growth: 0.072, vol: 0.13, upkeep: 0.018, rent: 0.045, cha: 18, net: 20, minYear: 2018,
    desc: '四十分钟的船程，一座岛。你的名字出现在海图的备注栏里。', tag: '顶级' }
);

/* ---------------- 新能源与赛车 ---------------- */
CARS.push(
  { id: 'car_ev_suv', name: '新势力纯电 SUV', base: 80000000,
    dep: 0.10, upkeep: 0.05, cha: 7, net: 3, minYear: 2023,
    desc: '冰箱、彩电、大沙发。加油站再也不用进了，服务区的充电桩排不排队看命。' },
  { id: 'car_ev_gt', name: '国产纯电超跑', base: 260000000,
    dep: 0.11, upkeep: 0.08, cha: 14, net: 4, minYear: 2025,
    desc: '零百两秒级。发布会的掌声，一半属于你车尾那个字母。', tag: '新能源' },
  { id: 'car_race_k1', name: '卡丁车（竞赛级）', base: 18000000,
    dep: 0.14, upkeep: 0.20, cha: 4, minYear: 1995, race: 1,
    desc: '所有 F1 冠军的起点，都是这种屁股贴地的小东西。', tag: '赛车' },
  { id: 'car_race_rally', name: '拉力赛车（N4 组）', base: 95000000,
    dep: 0.13, upkeep: 0.22, cha: 9, minYear: 2002, race: 2,
    desc: '砂石、雪地、夜路。副驾的路书念得越快，你心里越稳。', tag: '赛车' },
  { id: 'car_race_gt', name: 'GT3 竞速赛车', base: 380000000,
    dep: 0.12, upkeep: 0.25, cha: 13, net: 2, minYear: 2012, race: 3,
    desc: '耐力赛的后半夜，车灯是赛道上唯一的萤火。', tag: '赛车' },
  { id: 'car_race_f1', name: '方程式赛车（顶级组别）', base: 1200000000,
    dep: 0.10, upkeep: 0.30, cha: 20, net: 6, minYear: 2020, race: 4,
    desc: '五个缸体在两万转嘶吼。全世界的镜头都对准你，你只看得见下一个弯。', tag: '赛车' },
  { id: 'car_fly', name: '陆空两用飞行汽车', base: 880000000,
    dep: 0.12, upkeep: 0.20, cha: 18, net: 8, minYear: 2028, lux: true,
    desc: '堵车的时候，你按下了起飞键。交管部门为这一刻吵了十年。', tag: '顶奢' }
);

/* ---------------- 顶奢载具（GOODS 通道 · 持有有隐藏加成） ---------------- */
GOODS.push(
  { id: 'g_yacht', name: '豪华游艇', base: 700000000,
    growth: -0.01, vol: 0.06, upkeep: 0.06, cha: 16, net: 10, minYear: 2010, lux: true,
    perk: { CHA: 2, MOOD: 3, NET: 1 },
    desc: '甲板上的香槟会，谈成的不止一单生意。船真正的作用，在水面以下。', tag: '顶奢' },
  { id: 'g_sub', name: '私人潜艇', base: 550000000,
    growth: -0.02, vol: 0.05, upkeep: 0.07, cha: 12, net: 6, minYear: 2016, lux: true,
    perk: { CUR: 3, MOOD: 2 },
    desc: '下潜四十米，世界只剩声呐的滴答。有些秘密，只适合在水下说。', tag: '顶奢' },
  { id: 'g_jet', name: '私人公务机', base: 1600000000,
    growth: -0.015, vol: 0.07, upkeep: 0.08, cha: 20, net: 16, minYear: 2012, lux: true,
    perk: { CHA: 2, NET: 2, FAME: 2 },
    desc: '时间是这个星球上最贵的东西，而你是少数买得起的人。', tag: '顶奢' }
);

/* 顶奢持有清单：给 luxTick 用 */
const LUX_ITEMS = ['g_yacht', 'g_sub', 'g_jet', 'car_fly'];
