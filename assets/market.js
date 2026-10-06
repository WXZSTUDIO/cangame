/* =========================================================
 *  CANGAME · 市场层
 *  부동산 房产 / 자동차 汽车 / 자산 资产 / 주식 股市
 *  价格随年代演进，含时代冲击（IMF / 互联网泡沫 / 金融危机 / 疫情）
 * ========================================================= */

const MARKET_META = {
  stockFee: 0.0035,   // 股票交易手续费
  propTax: 0.035,     // 房产/车卖出交易成本
  minAge: 20,         // 进入市场的最低年龄
  growthDamp: 0.75    // 股票年化阻尼（寿命延长后复利年限变多，需下调以维持平衡）
};

/* ---------- 年代价格指数（1985 = 1.0） ---------- */
const HOUSE_INDEX = [
  [1985, 1.0], [1990, 1.9], [1995, 2.1], [1997, 2.2], [1999, 1.95],
  [2002, 2.6], [2006, 3.6], [2008, 3.9], [2010, 3.7], [2013, 3.6],
  [2016, 4.3], [2018, 5.2], [2020, 6.2], [2022, 7.4], [2025, 6.9],
  [2028, 7.6], [2035, 8.6], [2045, 9.4], [2065, 10.0]
];

const CAR_INDEX = [
  [1985, 1.0], [1995, 1.15], [2005, 1.35], [2015, 1.55], [2025, 1.9], [2045, 2.3], [2065, 2.6]
];

/* ---------- 时代冲击（作用于当年涨跌幅） ---------- */
const STOCK_SHOCKS = {
  1987: { k: 0.18, t: '87년 대세 상승장', d: '全世界都在涨，连出租车司机都在谈股票。' },
  1989: { k: -0.22, t: '89년 폭락', d: '东京的泡沫开始漏气，首尔跟着打了个喷嚏。' },
  1997: { k: -0.46, t: 'IMF 외환위기', d: 'KOSPI 腰斩。你眼睁睁看着数字往下掉，像看着汉江的水位。' },
  1998: { k: 0.38, t: 'IMF 이후 반등', d: '废墟里长出的反弹，比谁想的都猛。' },
  1999: { k: 0.55, t: '닷컴 버블', d: '只要名字里带「넷」，就能涨停。' },
  2000: { k: -0.42, t: '닷컴 붕괴', d: '泡沫破了。你昨天还是天才，今天是笑柄。' },
  2001: { k: 0.16, t: '9·11 이후 회복', d: '恐慌过去，市场重新开始呼吸。' },
  2003: { k: 0.29, t: '신용카드 사태 이후', d: '信用卡危机出清，反弹开始。' },
  2007: { k: 0.32, t: '사상 최고치', d: 'KOSPI 站上 2000 点，办公室里人人都是股神。' },
  2008: { k: -0.48, t: '글로벌 금융위기', d: '雷曼倒下的那一周，你的账户少了半条命。' },
  2009: { k: 0.45, t: 'V자 반등', d: '敢在废墟里捡东西的人，一年翻了身。' },
  2011: { k: -0.13, t: '유럽 재정위기', d: '欧债危机，市场心神不宁。' },
  2012: { k: 0.12, t: '한류 특수', d: '一个骑马的胖子，把韩国文化卖到了全世界。' },
  2015: { k: 0.14, t: '중국 특수', d: '中国游客来了，免税店的队伍排到了街角。' },
  2016: { k: -0.09, t: '최순실 게이트', d: '政治风暴，市场最怕不确定性。' },
  2018: { k: -0.17, t: '미중 무역전쟁', d: '关税一加，全世界一起感冒。' },
  2020: { k: -0.28, t: '코로나 폭락', d: '三月，熔断。然后是史上最快的放水。' },
  2021: { k: 0.40, t: '유동성 장세', d: '동학개미운동。全民炒股，连你妈都开了账户。' },
  2022: { k: -0.24, t: '인플레이션 쇼크', d: '加息，杀估值。成长股血流成河。' },
  2023: { k: 0.26, t: 'AI 랠리', d: 'AI 吃掉一切，半导体先起飞。' },
  2026: { k: -0.14, t: '조정장', d: '涨太多，总要歇一歇。' },
  2030: { k: 0.16, t: '新周期', d: '新技术开始兑现成利润。' },
  2040: { k: -0.11, t: '조정', d: '市场又一次教育了所有人。' }
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
  { id: 'h_jeonse_bjh', name: '반지하 전세 半地下室传贳', cn: '江南半地下室', base: 18000000,
    jeonse: true, growth: 0.035, vol: 0.03, upkeep: 0, rent: 0, cha: -2, minYear: 1985,
    desc: '押金一万八，没有月租，也没有窗户。전세 是穷人的杠杆。' },
  { id: 'h_jeonse_gb', name: '강북 전세 江北传贳', cn: '江北老公寓', base: 32000000,
    jeonse: true, growth: 0.04, vol: 0.04, upkeep: 0, rent: 0, cha: 0, minYear: 1988,
    desc: '过江就是江北。押金三千万，屋子朝北，冬天会结霜。' },
  { id: 'h_villa_gj', name: '경기도 빌라 京畿道联立住宅', cn: '京畿道小楼', base: 45000000,
    growth: 0.042, vol: 0.06, upkeep: 0.006, rent: 0, cha: 1, minYear: 1990,
    desc: '安山站步行十五分钟。楼下车库，楼顶水箱。' },
  { id: 'h_apt_gangbuk', name: '강북 24평 아파트 江北公寓', cn: '江北 24 坪', base: 78000000,
    growth: 0.05, vol: 0.07, upkeep: 0.008, rent: 0, cha: 2, minYear: 1993,
    desc: '第一次有自己的阳台。晚上能看见南山塔。' },
  { id: 'h_apt_eunma', name: '대치동 은마아파트 大峙洞银马', cn: '大峙洞银马公寓', base: 140000000,
    growth: 0.072, vol: 0.08, upkeep: 0.009, rent: 0, cha: 4, minYear: 1996,
    desc: '江南学区的心脏。母亲们的战争，都在这片楼群里打响。', tag: '学区' },
  { id: 'h_apt_apgujeong', name: '압구정 현대아파트 狎鸥亭现代', cn: '狎鸥亭现代公寓', base: 260000000,
    growth: 0.078, vol: 0.09, upkeep: 0.010, rent: 0, cha: 7, minYear: 2000,
    desc: '江南中的江南。这里的车位比车贵，邻居的名字写在财经版上。', tag: '顶级' },
  { id: 'h_officetel_ydp', name: '여의도 오피스텔 汝矣岛商住楼', cn: '汝矣岛商住楼', base: 160000000,
    growth: 0.055, vol: 0.07, upkeep: 0.010, rent: 0.055, cha: 3, minYear: 1998,
    desc: '证券公司林立的街区。楼下是券商，楼上是你的床。', tag: '收租' },
  { id: 'h_shop_gangnam', name: '강남 상가 江南商铺', cn: '江南商铺', base: 520000000,
    growth: 0.062, vol: 0.10, upkeep: 0.012, rent: 0.075, cha: 5, net: 4, minYear: 2002,
    desc: '八坪的店面，租给一家美妆店。每月的租金短信，是你最爱的闹钟。', tag: '收租' },
  { id: 'h_villa_jeju', name: '제주 별장 济州别墅', cn: '济州别墅', base: 380000000,
    growth: 0.05, vol: 0.09, upkeep: 0.014, rent: 0.02, cha: 6, minYear: 2008,
    desc: '橘子园和海。你终于有了一个可以不去的地方。', tag: '度假' },
  { id: 'h_bldg_seongsu', name: '성수동 꼬마빌딩 圣水洞小楼', cn: '圣水洞整栋小楼', base: 1250000000,
    growth: 0.075, vol: 0.11, upkeep: 0.011, rent: 0.068, cha: 8, net: 8, minYear: 2012,
    desc: '旧工厂改造的咖啡街区。整栋楼都在替你赚钱。', tag: '收租' },
  { id: 'h_house_hannam', name: '한남동 대저택 汉南洞大宅', cn: '汉南洞大宅', base: 3200000000,
    growth: 0.068, vol: 0.10, upkeep: 0.016, rent: 0, cha: 14, net: 10, minYear: 2016,
    desc: '大使馆区的一整栋。铁门后面，是你小时候画的那栋楼。', tag: '顶级' }
];

/* ---------- 汽车 ---------- */
const CARS = [
  { id: 'car_tico', name: '중고 티코 二手 Tico', cn: '二手大宇 Tico', base: 2200000,
    dep: 0.11, upkeep: 0.16, cha: -1, minYear: 1991,
    desc: '排量 800cc，上坡要关空调。但它带你离开了 반지하。' },
  { id: 'car_sonata', name: '쏘나타 索纳塔', cn: '现代索纳塔', base: 16000000,
    dep: 0.13, upkeep: 0.10, cha: 2, net: 1, minYear: 1988,
    desc: '韩国中产的身份证。停车场里十辆有六辆是它。' },
  { id: 'car_gran', name: '그랜저 君爵', cn: '现代君爵', base: 32000000,
    dep: 0.12, upkeep: 0.11, cha: 4, net: 3, minYear: 1998,
    desc: '科长以上的座驾。开进公司地下车库的那天，保安第一次向你敬礼。' },
  { id: 'car_bmw', name: 'BMW 520i', cn: '宝马 5 系', base: 62000000,
    dep: 0.15, upkeep: 0.14, cha: 6, net: 3, minYear: 2002,
    desc: '进口车。邻居开始打听你是做什么的。' },
  { id: 'car_benz', name: '벤츠 S350 奔驰 S 级', cn: '奔驰 S 级', base: 128000000,
    dep: 0.14, upkeep: 0.15, cha: 9, net: 6, minYear: 2008,
    desc: '后排比前排重要。你开始坐在后面。' },
  { id: 'car_porsche', name: '포르쉐 911 保时捷', cn: '保时捷 911', base: 185000000,
    dep: 0.10, upkeep: 0.13, cha: 12, net: 4, minYear: 2013,
    desc: '清潭洞的红灯前，你和隔壁车道的谁对视了一眼。' },
  { id: 'car_lambo', name: '람보르기니 우루스 兰博基尼', cn: '兰博基尼 Urus', base: 420000000,
    dep: 0.11, upkeep: 0.16, cha: 16, net: 5, minYear: 2020,
    desc: '排气声能震碎一条街的体面。你花了很多年，就为了这一声。' },
  { id: 'car_ev', name: '아이오닉 EV 电动车', cn: '现代 IONIQ', base: 55000000,
    dep: 0.09, upkeep: 0.05, cha: 5, net: 2, minYear: 2022,
    desc: '安静、省钱、有补贴。你开始在意另一件更大的事。' }
];

/* ---------- 其他资产 ---------- */
const GOODS = [
  { id: 'g_deposit', name: '정기예금 定期存款', cn: '定期存款', base: 10000000,
    growth: 0.045, vol: 0, upkeep: 0, rent: 0.0, safe: true, minYear: 1985,
    desc: '最无聊的东西，也是最不容易死的东西。利率跟着时代走。' },
  { id: 'g_gold', name: '금괴 金条', cn: '金条 100g', base: 12000000,
    growth: 0.055, vol: 0.09, upkeep: 0, minYear: 1985,
    desc: '乱世的安全垫。1997 年，全国人把金戒指捐给了国家。' },
  { id: 'g_watch', name: '명품 시계 名表', cn: '百达翡丽级名表', base: 38000000,
    growth: 0.05, vol: 0.12, upkeep: 0.004, cha: 5, minYear: 1995,
    desc: '手腕上的谈判筹码。酒桌上，总有人先看你的表。' },
  { id: 'g_art', name: '미술품 艺术品', cn: '单色画派作品', base: 150000000,
    growth: 0.07, vol: 0.28, upkeep: 0.006, cha: 6, net: 4, minYear: 2000,
    desc: '看懂的人说它值一个亿，看不懂的人说这是一块白布。' },
  { id: 'g_wine', name: '와인 컬렉션 葡萄酒收藏', cn: '波尔多收藏', base: 45000000,
    growth: 0.065, vol: 0.16, upkeep: 0.005, cha: 4, net: 3, minYear: 2004,
    desc: '酒柜恒温 13 度。每一瓶都在替你安静地赚钱。' },
  { id: 'g_golf', name: '골프 회원권 高尔夫会员券', cn: '高尔夫会员券', base: 260000000,
    growth: 0.04, vol: 0.22, upkeep: 0.008, cha: 6, net: 12, minYear: 1998,
    desc: '韩国的生意，一半在球场里谈成。这张卡就是入场券。' },
  { id: 'g_land', name: '경기도 토지 京畿道土地', cn: '京畿道农地', base: 90000000,
    growth: 0.06, vol: 0.10, upkeep: 0.002, minYear: 1990,
    desc: '荒地。你赌的是十年后，这里会不会有一条地铁线。' },
  { id: 'g_gosiwon', name: '고시원 考试院', cn: '考试院经营权', base: 320000000,
    growth: 0.035, vol: 0.08, upkeep: 0.02, rent: 0.11, net: 2, minYear: 1996,
    desc: '四十个一坪半的房间，住着四十个想考公务员的人。你收他们的月租。', tag: '收租' },
  { id: 'g_coin', name: '비트코인 比特币', cn: '比特币', base: 8000000,
    growth: 0.34, vol: 0.65, upkeep: 0, minYear: 2013,
    desc: '一个没有国家的货币。涨停和跌停都不需要理由。', tag: '高风险' }
];

/* ---------- 股票（base = 1985 基准股价） ---------- */
const STOCKS = [
  { id: 's_hansung', name: '한성전자 韩星电子', code: '005930', sector: '반도체 半导体',
    base: 3200, growth: 0.102, vol: 0.30, div: 0.012, minYear: 1985,
    desc: '韩国的国民股。它的K线，就是这个国家四十年的经济史。' },
  { id: 's_hangang', name: '한강중공업 汉江重工', code: '010620', sector: '조선 造船',
    base: 5400, growth: 0.062, vol: 0.34, div: 0.018, minYear: 1985,
    desc: '造船与基建。周期来了翻倍，周期走了腰斩。' },
  { id: 's_rainbow', name: '무지개은행 彩虹银行', code: '024110', sector: '금융 金融',
    base: 7600, growth: 0.055, vol: 0.20, div: 0.038, minYear: 1985,
    desc: '分红最稳的那一只。老人和寡妇的最爱。' },
  { id: 's_seolhwa', name: '설화식품 雪花食品', code: '003240', sector: '소비재 消费',
    base: 4100, growth: 0.07, vol: 0.15, div: 0.022, minYear: 1985,
    desc: '泡面和牛奶。无论谁当总统，人都要吃饭。' },
  { id: 's_koryo', name: '고려통신 高丽通信', code: '030200', sector: '통신 通信',
    base: 6800, growth: 0.06, vol: 0.18, div: 0.031, minYear: 1990,
    desc: '从寻呼机到 5G。它见证了韩国每一次通信换代。' },
  { id: 's_baekdu', name: '백두제약 白头制药', code: '019680', sector: '제약 医药',
    base: 2900, growth: 0.085, vol: 0.26, div: 0.008, minYear: 1992,
    desc: '一款新药可以吃十年。一款失败，也能跌回原点。' },
  { id: 's_goldconst', name: '황금건설 黄金建设', code: '001880', sector: '건설 建筑',
    base: 4700, growth: 0.048, vol: 0.32, div: 0.015, minYear: 1988,
    desc: '它的业绩就是韩国的房价曲线。江南一动，它就动。' },
  { id: 's_arirang', name: '아리랑엔터 阿里郎娱乐', code: '053210', sector: '엔터 娱乐',
    base: 1500, growth: 0.125, vol: 0.48, div: 0.004, minYear: 2000,
    desc: '造星工厂。一个团能救公司，一场丑闻也能毁掉它。' },
  { id: 's_dongbang', name: '동방물류 东方物流', code: '009970', sector: '물류 物流',
    base: 3600, growth: 0.066, vol: 0.22, div: 0.016, minYear: 1996,
    desc: '港口、货车、仓库。经济的总量，写在它的卡车里程里。' },
  { id: 's_green', name: '그린에너지 绿色能源', code: '071050', sector: '2차전지 电池',
    base: 22000, growth: 0.115, vol: 0.52, div: 0.002, minYear: 2015,
    desc: '电池与新能源。年轻人的最爱，也是波动最大的那一只。' },
  { id: 's_ai', name: '네오마인드 AI', code: '108800', sector: 'AI', base: 46000,
    growth: 0.14, vol: 0.58, div: 0.0, minYear: 2023,
    desc: '算力、模型、数据。它涨的时候，没有人不相信未来。' },
  { id: 's_kospi', name: '코스피 ETF 大盘指数', code: '069500', sector: '지수 指数',
    base: 5000, growth: 0.068, vol: 0.16, div: 0.020, minYear: 1985,
    desc: '买下整个市场。不刺激，但你几乎不会输给时代。', tag: '稳健' }
];

/* =========================================================
 *  行情引擎
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
    props: [],          // 持有的房产/车/资产
    stocks: [],         // 持股 {id, shares, cost}
    prices: {},         // 当前股价
    prev: {},           // 去年股价（算涨跌幅）
    hist: {},           // 价格历史（画走势）
    drift: {},          // 房产/资产的额外涨跌累积
    debt: 0,            // 贷款总额
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
  STOCKS.forEach(s => {
    m.prev[s.id] = m.prices[s.id];
    let p = m.prices[s.id];
    // DAMP: 寿命延长到 100+ 后复利年限变多，年化整体下调以维持原有平衡
    let k = s.growth * MARKET_META.growthDamp + (shock ? shock.k * (s.sector.indexOf('지수') >= 0 ? 0.6 : 1) : 0) + gauss() * s.vol;
    p = Math.round(Math.max(p * 0.22, p * (1 + k)));
    m.prices[s.id] = p;
    const h = m.hist[s.id];
    h.push(p);
    if (h.length > 14) h.shift();
  });

  // 房产与资产的额外漂移（均值回归，避免长期单边暴涨）
  HOUSES.forEach(h => {
    const d = (m.drift[h.id] || 0) * 0.86 + hs * 0.35 + gauss() * h.vol * 0.35;
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
    lines.push(`배당금 分红到账 ${fmtMoney(divTotal)}`);
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

  if (rent > 0) { state.stats.MONEY += rent; lines.push(`임대수익 租金收入 ${fmtMoney(rent)}`); }
  if (upkeep > 0) { state.stats.MONEY -= upkeep; lines.push(`유지비 持有成本 -${fmtMoney(upkeep)}`); }
  if (interest > 0) { state.stats.MONEY -= interest; lines.push(`대출이자 贷款利息 -${fmtMoney(interest)}（年利率 ${(rate * 100).toFixed(1)}%）`); }

  if (shock) {
    pushLog(state, `【증시 股市 · ${y}년】${shock.t} — ${shock.d}`, shock.k >= 0 ? 'money' : 'warn');
  }
  if (lines.length) {
    pushLog(state, `【자산 资产 · ${y}년】` + lines.join(' · '), 'money');
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
  return Math.round(state.stats.MONEY + propValue(state) + stockValue(state) - (state.market ? state.market.debt : 0));
}

/* ---------- 交易 ---------- */
function buyProp(state, kind, refId, downRatio, qty) {
  const m = marketMigrate(state);
  const ref = kind === 'house' ? HOUSES.find(h => h.id === refId)
    : kind === 'car' ? CARS.find(c => c.id === refId)
      : GOODS.find(g => g.id === refId);
  if (!ref) return { ok: false, msg: '没有这件东西' };
  const y = fmtYear(state);
  if (y < (ref.minYear || 1985)) return { ok: false, msg: `${ref.minYear}년 之后才会出现` };

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
  pushLog(state, `【구매 买入】${ref.name}${n > 1 ? ' ×' + n : ''} · 总价 ${fmtMoney(total)}` +
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
  pushLog(state, `【매각 卖出】${p.name} · 成交 ${fmtMoney(gross)}，扣除费用与贷款后到手 ${fmtMoney(net)}`, net >= p.buyPrice ? 'money' : 'warn');
  return { ok: true, net };
}

function buyStock(state, id, shares) {
  const m = marketMigrate(state);
  const s = STOCKS.find(x => x.id === id);
  if (!s) return { ok: false, msg: '没有这只股票' };
  const y = fmtYear(state);
  if (y < (s.minYear || 1985)) return { ok: false, msg: `${s.minYear}년 之后才上市` };
  const price = m.prices[id];
  const n = Math.floor(shares);
  if (n <= 0) return { ok: false, msg: '数量不对' };
  const cost = Math.round(price * n * (1 + MARKET_META.stockFee));
  if (state.stats.MONEY < cost) return { ok: false, msg: `现金不足，需要 ${fmtMoney(cost)}` };
  state.stats.MONEY -= cost;
  let pos = m.stocks.find(p => p.id === id);
  if (!pos) { pos = { id, shares: 0, cost: 0 }; m.stocks.push(pos); }
  pos.shares += n; pos.cost += cost;
  pushLog(state, `【매수 买入】${s.name} ${n}주 @ ${fmtMoney(price)}，花费 ${fmtMoney(cost)}`, 'money');
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
  pushLog(state, `【매도 卖出】${s.name} ${n}주 @ ${fmtMoney(price)}，到手 ${fmtMoney(got)}（${profit >= 0 ? '+' : ''}${fmtMoney(profit)}）`,
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
  pushLog(state, `【상환 还贷】偿还 ${fmtMoney(pay)}，剩余贷款 ${fmtMoney(m.debt)}`, 'money');
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
