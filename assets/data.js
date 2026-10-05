/* =========================================================
 *  CANGAME · 江南逆袭 (강남 역습)
 *  数据层：天赋 / 出身 / 事件库 / 投资 / 结局
 * ========================================================= */

const GAME_META = {
  title: '江南逆袭',
  subtitle: '강남 역습 · 从半地下室到财阀之巅',
  version: '1.0.0',
  startYear: 1985,
  endAge: 80
};

/* ---------------- 数值定义 ---------------- */
const STATS = [
  { key: 'INT',  name: '지력 智力',  hint: '学习、考试、谋略' },
  { key: 'STR',  name: '체력 体魄',  hint: '兵役、打架、耐力' },
  { key: 'CHA',  name: '매력 魅力',  hint: '人脉、恋爱、影响力' },
  { key: 'WILL', name: '의지 意志',  hint: '抗压、低谷反弹' },
  { key: 'HP',   name: '건강 健康',  hint: '归零即人生结束' },
  { key: 'STRESS', name: '스트레스 压力', hint: '过高会损伤健康' }
];

const RESOURCES = [
  { key: 'MONEY', name: '자산 资产', hint: '韩元 ₩' },
  { key: 'NET',   name: '인맥 人脉', hint: '关键时刻能调动的人' },
  { key: 'FAME',  name: '명성 声望', hint: '社会知名度' },
  { key: 'LOY',   name: '太星好感', hint: '与太星家族的关系' }
];

/* ---------------- 天赋 ---------------- */
/* cost > 0 消耗点数，cost < 0 返还点数（负面天赋） */
const TALENTS = [
  { id: 'memory',   name: '전생의 기억 前世记忆', cost: 4, desc: '你死过一次。前世作为太星集团底层职员被灭口，却带回了未来三十年的大事件。',
    eff: { WILL: 6, INT: 3 }, flags: ['past_life'], tag: '核心' },
  { id: 'math',     name: '수학천재 数学天才', cost: 3, desc: '数字在你脑中自己排队。', eff: { INT: 9 } },
  { id: 'iron',     name: '철강체력 钢铁体魄', cost: 2, desc: '从小没打过点滴。', eff: { STR: 9, HP: 10 } },
  { id: 'face',     name: '얼굴천재 天生丽质', cost: 3, desc: '江南的整形医院以你的脸为模板。', eff: { CHA: 9 } },
  { id: 'will',     name: '불굴의 의지 不屈意志', cost: 2, desc: '被打倒多少次，就站起来多少次。', eff: { WILL: 9 } },
  { id: 'gangnam',  name: '강남 토박이 江南土著', cost: 3, desc: '户口本上写着江南区，哪怕只是半地下室。', eff: { CHA: 4, MONEY: 8000000 }, flags: ['gangnam'] },
  { id: 'legacy',   name: '아버지의 유산 父亲的遗物', cost: 2, desc: '一只旧铁盒，里面是父亲攒了一辈子的钱。', eff: { MONEY: 6000000, WILL: 2 } },
  { id: 'code',     name: '천재 프로그래머 编程天才', cost: 2, desc: '你在 DOS 里写出了第一个韩文输入法。', eff: { INT: 5, STR: -2 }, flags: ['coder'] },
  { id: 'speech',   name: '언변의 달인 辩才无碍', cost: 2, desc: '一张嘴能把黑的说成白的。', eff: { CHA: 5, NET: 5 } },
  { id: 'stock',    name: '주식 귀재 股神直觉', cost: 2, desc: '你天生懂得恐惧与贪婪的周期。', eff: { INT: 3 }, flags: ['stock_buff'] },
  { id: 'estate',   name: '미래의 집 房产直觉', cost: 2, desc: '你总能闻到哪块地要涨价。', eff: { INT: 2 }, flags: ['estate_buff'] },
  { id: 'network',  name: '인맥世家 人脉世家', cost: 2, desc: '叔叔的表哥的岳父，总在某个要害部门。', eff: { NET: 10 } },
  { id: 'health',   name: '건강염려증 养生达人', cost: 1, desc: '你熟读每一本健康杂志。', eff: { HP: 15, STRESS: -10 } },
  { id: 'revenge',  name: '복수심 复仇之心', cost: 2, desc: '那个雨夜，是谁把你推下了汉江大桥。你记得。', eff: { WILL: 6, STRESS: 12 }, flags: ['revenge'] },
  { id: 'lucky',    name: '운빨 锦鲤附体', cost: 2, desc: '好事总在你身上多绕一圈。', eff: {}, flags: ['lucky'] },
  { id: 'diligent', name: '성실 勤勉', cost: 1, desc: '你相信一天十四小时的力量。', eff: { INT: 2, STR: 2, CHA: 2, WILL: 2 } },
  { id: 'absolutepitch', name: '절대음감 绝对音感', cost: 1, desc: '随便一首歌你都能弹出调子。', eff: { CHA: 4 }, flags: ['music'] },
  { id: 'dual',     name: '이중국적 双重国籍', cost: 2, desc: '一本美国护照，让兵役成为别人的故事。', eff: { CHA: 2 }, flags: ['no_military'] },
  { id: 'flatfoot', name: '평발 扁平足', cost: -2, desc: '免除兵役的唯一好处，是你能早两年进入社会。', eff: { STR: -3 }, flags: ['no_military'] },
  { id: 'debt',     name: '빚더미 负债之子', cost: -3, desc: '父亲的债，写在你的户口本上。', eff: { MONEY: -4000000, WILL: 5 } },
  { id: 'ugly',     name: '외모 콤플렉스 外貌自卑', cost: -2, desc: '你习惯了被忽略，也因此更懂得观察。', eff: { CHA: -4, INT: 4 } },
  { id: 'sick',     name: '허약체질 病弱', cost: -2, desc: '医院的走廊你比教室还熟。', eff: { HP: -9, INT: 3 } },
  { id: 'country',  name: '시골 출신 乡下出身', cost: -2, desc: '庆尚北道的稻田，和首尔的霓虹隔着一整个时代。', eff: { CHA: -2, STR: 4, WILL: 2 } },
  { id: 'temper',   name: '다혈질 暴脾气', cost: -2, desc: '拳头总比脑子先动。', eff: { STR: 5, CHA: -3, WILL: 2 } }
];

/* ---------------- 出身 ---------------- */
const FAMILIES = [
  { id: 'banjiha', name: '반지하 江南半地下室', desc: '窗子与地面齐平，能看见路人的鞋。首尔江南区，一间 12 平的半地下室。',
    eff: { MONEY: 1200000, INT: 3, CHA: 2, WILL: 4 }, flags: ['poor', 'seoul'] },
  { id: 'factory', name: '공장노동자 京畿道工厂家庭', desc: '父亲在安山的工厂做冲压工，母亲在食堂洗碗。',
    eff: { MONEY: 800000, STR: 5, WILL: 5, INT: 1 }, flags: ['poor'] },
  { id: 'province', name: '지방 大邱小商人家庭', desc: '家里开着一间文具店，账本永远差几百块。',
    eff: { MONEY: 1500000, INT: 2, CHA: 4, NET: 3 }, flags: ['province'] },
  { id: 'single',   name: '한부모 单亲家庭', desc: '母亲一个人打三份工，把你拉扯大。',
    eff: { MONEY: 500000, WILL: 8, INT: 3, CHA: 1 }, flags: ['poor', 'single'] },
  { id: 'orphan',   name: '고아 教会孤儿院', desc: '你没有户口本上的父母，只有一排编号。',
    eff: { MONEY: 200000, WILL: 9, INT: 5, CHA: -2 }, flags: ['poor', 'orphan'] },
  { id: 'rentier',  name: '임대업 月收家庭', desc: '家里有几间考试院在收租，不算富，但饿不死。',
    eff: { MONEY: 5000000, INT: 2, CHA: 3, NET: 4 }, flags: ['rentier'] },
  { id: 'prof',     name: '교수 教授家庭', desc: '父亲是地方大学的讲师，家里的墙都是书架。',
    eff: { MONEY: 3000000, INT: 9, CHA: 2, NET: 5 }, flags: ['prof'] },
  { id: 'chaebol_edge', name: '먼 친척 太星远亲', desc: '母亲那边的远房亲戚，据说在太星集团门口当过保安。',
    eff: { MONEY: 2500000, CHA: 3, NET: 6, LOY: 5 }, flags: ['chaebol_tie'] }
];

/* ---------------- 事件库 ----------------
 * cond: {ageMin,ageMax,gender:'M'/'F',need:[flags],ban:[flags],min:{stat},max:{stat},job:[...]}
 * eff : {STAT:delta, flags:[...], job:'...', edu:'...'}
 * choice: {text, eff:{...}, flags:[...]}
 */
const EVENTS = [
  /* ===== 幼儿 0-6 ===== */
  { id: 'c01', age: [0, 3], w: 10, text: '你出生在首尔的冬天。母亲抱着你，窗外是汉江对岸尚未点亮的江南。',
    eff: { HP: 2 }, flags: [] },
  { id: 'c02', age: [0, 4], w: 8, text: '半地下室的雨季。墙纸鼓起又脱落，你第一次知道「首尔」有两种：地上的和地下的。',
    cond: { need: ['poor'] }, eff: { WILL: 2, INT: 1 } },
  { id: 'c03', age: [1, 5], w: 7, text: '隔壁姐姐教你念韩文字母。你学得很快，母亲在灯下笑出了眼泪。', eff: { INT: 3, CHA: 1 } },
  { id: 'c04', age: [2, 6], w: 7, text: '你在旧书摊捡到一本破旧的《世界地图册》，翻到「首尔」那一页，用蜡笔画了一个圈。', eff: { INT: 2, WILL: 1 } },
  { id: 'c05', age: [2, 6], w: 6, text: '父亲喝醉回家，把桌子掀翻。你躲在衣柜里，学会了屏住呼吸。',
    cond: { ban: ['single', 'orphan'] }, eff: { WILL: 3, STRESS: 6 } },
  { id: 'c06', age: [3, 6], w: 6, text: '教会发来一箱旧衣服。你穿着不合身的外套去幼儿园，被笑了整整一年。',
    cond: { need: ['poor'] }, eff: { CHA: -2, WILL: 2 } },
  { id: 'c07', age: [1, 6], w: 5, text: '你发高烧到 40 度，母亲背着你跑了三家医院。活下来之后，你的身体似乎更强了。', eff: { HP: 5, WILL: 2 } },
  { id: 'c08', age: [3, 6], w: 5, text: '母亲在你耳边反复说一句话：「우리는 못 살아도, 너는 살아야 한다.」再穷，你也得活出个人样。', eff: { WILL: 4 } },
  { id: 'c09', age: [0, 2], w: 4, text: '前世的记忆在午夜涌来：冰冷的江水，和一双擦得发亮的皮鞋。你哭醒了。',
    cond: { need: ['past_life'] }, eff: { INT: 3, WILL: 2, STRESS: 4 } },
  { id: 'c10', age: [4, 6], w: 5, text: '你在纸上画了一栋很高的楼，指着它说：这以后是我的。大人笑作一团。', eff: { WILL: 2, FAME: 1 } },

  /* ===== 小学 7-12 ===== */
  { id: 'p01', age: [7, 12], w: 9, text: '小学入学。老师的名牌上写着「학부모 직업」一栏，你在上面填了「会社员」。', eff: { INT: 2 } },
  { id: 'p02', age: [7, 12], w: 8, text: '班里的富家子带了一台 Game Boy。你只远远看过一眼，但记住了它的电路板结构。', eff: { INT: 2, STRESS: 2 } },
  { id: 'p03', age: [8, 12], w: 8, text: '你考了年级第一。母亲把成绩单贴在墙上，那一刻比过年还亮。', eff: { INT: 4, FAME: 2 } },
  { id: 'p04', age: [8, 12], w: 7, text: '학원 补习班。母亲把最后的钱交给了大峙洞的数学学院。', cond: { min: { MONEY: 500000 } },
    eff: { INT: 5, MONEY: -600000 } },
  { id: 'p05', age: [8, 12], w: 7, text: '大峙洞的学院太贵了。你在图书馆自学到闭馆，路灯下背单词。', cond: { max: { MONEY: 500000 } },
    eff: { INT: 4, WILL: 3, HP: -2 } },
  { id: 'p06', age: [9, 12], w: 6, text: '你在操场上被富家子推倒，爬起来把他的鼻子打出了血。第一次明白：道理是讲给有地位的人听的。',
    cond: { min: { STR: 15 } }, eff: { STR: 3, CHA: -2, WILL: 3, STRESS: 4 } },
  { id: 'p07', age: [9, 12], w: 6, text: '你成了班里最会讲故事的人。孩子们围着你，连那个富家子也凑过来。',
    cond: { min: { CHA: 15 } }, eff: { CHA: 3, NET: 3 } },
  { id: 'p08', age: [10, 12], w: 6, text: '父亲失业了。家里的晚饭从三菜一汤变成了泡菜和饭。你开始去便利店打工。', eff: { WILL: 5, MONEY: 300000, STRESS: 5 } },
  { id: 'p09', age: [10, 12], w: 5, text: '第一次坐地铁穿过汉江。对岸的公寓灯火通明，你说不出话。', eff: { WILL: 3, INT: 1 } },
  { id: 'p10', age: [11, 12], w: 5, text: '你在作文里写《나의 꿈 我的梦想》：我要在江南最高的楼上，看首尔的夜景。老师给了满分。', eff: { INT: 2, FAME: 2, WILL: 2 } },

  /* ===== 中学 13-15 ===== */
  { id: 'm01', age: [13, 15], w: 9, text: '中学。青春期，贫穷第一次变成一种刺在皮肤上的东西。', eff: { STRESS: 4 } },
  { id: 'm02', age: [13, 15], w: 8, text: '你爱上了隔壁班的女孩。你在她课桌里塞了一封没署名的信，然后转学去了别的补习班。', eff: { CHA: 2, INT: -1, WILL: 1 } },
  { id: 'm03', age: [13, 15], w: 8, text: '你在网吧第一次接触到互联网。那一刻你听见了时代转动的声音。', eff: { INT: 4 }, flags: ['net_gen'] },
  { id: 'm04', age: [13, 15], w: 7, text: '你加入了学校的棒球队。汗水是最便宜的解药。', cond: { min: { STR: 20 } }, eff: { STR: 5, HP: 4 } },
  { id: 'm05', age: [14, 15], w: 7, text: '你偷了一本《주식투자 입문 股票投资入门》。看不懂，但你记住了两个字：复利。', eff: { INT: 3 }, flags: ['stock_interest'] },
  { id: 'm06', age: [13, 15], w: 6, text: '校园霸凌。你被拉进厕所，交出了一周的饭钱。你记住了他们的名字。', cond: { ban: ['lucky'] }, eff: { WILL: 4, STRESS: 8, HP: -3 } },
  { id: 'm07', age: [14, 15], w: 6, text: '你考进了「特目高」的预备班。母亲去学校门口给老师鞠躬。', cond: { min: { INT: 35 } }, eff: { INT: 4, FAME: 3 } },
  { id: 'm08', age: [14, 15], w: 5, text: '你在旧货市场淘到一台 486 电脑，整夜研究 DOS。', cond: { need: ['coder'] }, eff: { INT: 5, STR: -2 }, flags: ['coder'] },

  /* ===== 高中 16-19 ===== */
  { id: 'h01', age: [16, 17], w: 9, text: '高中。韩国最残酷的三年开始了——有人把它叫做「지옥 地狱」。', eff: { STRESS: 6 } },
  { id: 'h02', age: [16, 18], w: 8, text: '你在自习室待到凌晨两点。走廊的灯灭了，你借着应急灯背书。', eff: { INT: 5, HP: -4, STRESS: 5 } },
  { id: 'h03', age: [16, 18], w: 7, text: '你和几个同学组了乐队，在弘大的地下 Live House 演出。台下只有七个人，但他们在鼓掌。',
    cond: { need: ['music'] }, eff: { CHA: 4, FAME: 3 } },
  { id: 'h04', age: [17, 19], w: 9, text: '수능 高考日。全韩国的飞机为你们停飞十五分钟。你走出考场时，手在抖。',
    cond: { min: { INT: 45 } }, eff: {}, flags: ['suneung_good'] },
  { id: 'h05', age: [17, 19], w: 8, text: '수능 失利。你在汉江边坐了一整夜，江水很冷，但你没有跳下去。',
    cond: { max: { INT: 45 } }, eff: { WILL: 5, STRESS: 10 } },
  { id: 'h06', age: [17, 19], w: 6, text: '你拿到了 SKY（首尔大/高丽/延世）的录取通知书。整个巷子都知道了。',
    cond: { need: ['suneung_good'], min: { INT: 55 } }, eff: { INT: 4, FAME: 8, NET: 5 }, flags: ['sky'], job: '大学生' },
  { id: 'h07', age: [17, 19], w: 6, text: '你进了地方大学。学费是母亲借来的，但你发誓不会浪费。',
    cond: { ban: ['sky'] }, eff: { INT: 2, NET: 2 }, job: '大学生' },
  { id: 'h08', age: [17, 19], w: 5, text: '你放弃了大学，去工厂上班。流水线上的噪音盖过了所有关于未来的想象。',
    cond: { max: { MONEY: 1000000 } }, eff: { STR: 5, MONEY: 1200000, WILL: 3, INT: -3 }, job: '工厂工人' },
  { id: 'h09', age: [18, 19], w: 5, text: '你在便利店打夜班，遇到一个醉醺醺的大叔。他是太星集团的科长，说了一句你记了一辈子的话。',
    eff: { NET: 4, LOY: 3 }, flags: ['met_taeseong'] },

  /* ===== 大学 / 兵役 19-24 ===== */
  { id: 'u01', age: [19, 23], w: 9, text: '大学。你第一次和江南出身的同学坐在同一间教室里，听懂了什么叫「격차 差距」。', cond: { job: ['大学生'] }, eff: { INT: 3, NET: 3 } },
  { id: 'u02', age: [19, 23], w: 7, text: '你加入了投资社团，第一次买入股票——然后亏掉了一半。', cond: { need: ['stock_interest'] }, eff: { INT: 3, MONEY: -500000 } },
  { id: 'u03', age: [19, 23], w: 7, text: '你在自习室认识了一个家住 압구정 狎鸥亭的同学。他随手借你的两万块，够你吃一个月。', cond: { min: { CHA: 30 } }, eff: { NET: 8, CHA: 2 } },
  { id: 'u04', age: [19, 23], w: 6, text: '你拿到了美国大学的交换名额。机场里，母亲塞给你一袋辣白菜。', cond: { min: { INT: 60 } }, eff: { INT: 5, CHA: 3, FAME: 4 }, flags: ['exchange'] },
  { id: 'u05', age: [20, 24], w: 9, text: '병역 兵役通知书来了。两年，是你欠这个国家的。', cond: { gender: 'M', ban: ['no_military'] }, eff: { STR: 4, WILL: 3, HP: 3 }, flags: ['military'], job: '军人' },
  { id: 'u06', age: [20, 24], w: 7, text: '部队里你学会了两件事：服从，以及观察谁在真正发号施令。', cond: { need: ['military'] }, eff: { STR: 3, WILL: 3, NET: 3 } },
  { id: 'u07', age: [20, 24], w: 6, text: '你在部队考上了「카투사 KATUSA」，美军基地里的英语让你的世界大了一圈。', cond: { need: ['military'], min: { INT: 55 } }, eff: { INT: 4, CHA: 3, NET: 5 } },
  { id: 'u08', age: [20, 24], w: 5, text: '免役。你比同龄人多了两年，但少了军营里的人脉。', cond: { need: ['no_military'] }, eff: { INT: 3, WILL: 2 } },
  { id: 'u09', age: [21, 24], w: 6, text: '你在大学创业社团做的小程序，被一家小公司用 3000 万韩元买走。',
    cond: { need: ['coder'] }, eff: { MONEY: 30000000, FAME: 5, INT: 3 }, flags: ['first_exit'] },

  /* ===== 社会初期 23-32 ===== */
  { id: 's01', age: [23, 32], w: 9, text: '취업 求职季。你穿上人生第一套西装，在汝矣岛的招聘会上排了四个小时。', eff: { STRESS: 6 } },
  { id: 's02', age: [23, 32], w: 8, text: '你通过了太星集团的公开招聘。入职那天，你在大厅的集团标志前站了很久。',
    cond: { min: { INT: 50 } }, eff: { MONEY: 35000000, NET: 6, LOY: 10 }, job: '太星集团社员', flags: ['taeseong_staff'] },
  { id: 's03', age: [23, 32], w: 7, text: '你进了一家中小企业。加班到十一点是常态，회식 聚餐是必修课。', eff: { MONEY: 26000000, STR: -3, STRESS: 7 }, job: '会社员' },
  { id: 's04', age: [23, 32], w: 6, text: '你考上了公务员。母亲在电话那头哭了。', cond: { min: { INT: 60 } }, eff: { MONEY: 24000000, NET: 6, FAME: 4 }, job: '公务员' },
  { id: 's05', age: [24, 32], w: 7, text: '江南的房价每天都在涨。中介说：再不买就永远买不起了。', eff: { STRESS: 5 }, flags: ['house_pressure'] },
  { id: 's06', age: [24, 32], w: 6, text: '你在狎鸥亭的酒桌上替上司挡了一杯酒。从此他记得你的名字。', cond: { min: { CHA: 40 } }, eff: { NET: 8, LOY: 5, HP: -3 } },
  { id: 's07', age: [25, 32], w: 6, text: '你和相恋三年的女友分手了。她说：你什么都好，就是没有「집 房子」。', eff: { STRESS: 10, WILL: 4 } },
  { id: 's08', age: [25, 32], w: 5, text: '你结婚了。婚礼在江南的小型礼堂，礼金刚好够付半年的房租。', cond: { min: { CHA: 35 } }, eff: { WILL: 4, NET: 5, MONEY: 5000000 }, flags: ['married'] },
  { id: 's09', age: [24, 30], w: 6, text: '你被派到中国的分公司。两年的海外经历，换来了别人没有的视野。', cond: { need: ['taeseong_staff'] }, eff: { INT: 5, NET: 8, LOY: 6 } },
  { id: 's10', age: [26, 33], w: 6, text: '部门结构调整，你被列入「명예퇴직 名誉退职」名单。三十岁，你第一次失业。',
    cond: { ban: ['lucky'] }, eff: { MONEY: 20000000, STRESS: 12, WILL: 4 }, job: '无业' },
  { id: 's11', age: [26, 34], w: 6, text: '你在清潭洞开了第一家店：一间只有八平米的咖啡馆。', cond: { min: { MONEY: 30000000 } }, eff: { MONEY: -30000000, NET: 6, CHA: 4 }, job: '个体户', flags: ['own_shop'] },
  { id: 's12', age: [27, 35], w: 6, text: '你辞职创业。办公室在九老区的数字园，六个工位，四个人。',
    cond: { min: { WILL: 40, INT: 50 } }, eff: { MONEY: -20000000, WILL: 5, STRESS: 10 }, job: '创业者', flags: ['startup'] },

  /* ===== 经济事件（时代） ===== */
  { id: 'e1997', age: [12, 13], w: 12, once: true, text: '1997년 IMF。电视里总理说国家破产了。父亲把金戒指交给母亲，让她去排队换米。街头到处是「IMF 빚」的标语。',
    eff: { WILL: 6, STRESS: 10, MONEY: -2000000 }, flags: ['imf'], log: 'IMF 外汇危机：全国进入紧缩。' },
  { id: 'e1998gold', age: [13, 14], w: 8, once: true, text: '全民献金运动。母亲把结婚戒指放进了募捐箱，她说：国家也是家。',
    cond: { need: ['imf'] }, eff: { WILL: 4, FAME: 2 } },
  { id: 'e2002', age: [17, 18], w: 8, once: true, text: '2002 世界杯。整个首尔变成了红色的海。你在光化门前和几十万人一起喊「대한민국」。',
    eff: { WILL: 3, CHA: 2, STRESS: -8 } },
  { id: 'e2008', age: [23, 24], w: 11, once: true, text: '2008 金融海啸。KOSPI 单日暴跌，办公室里没有人说话。有人在楼下抽烟，抽完就上楼辞职了。',
    eff: { STRESS: 8, WILL: 3 }, flags: ['crisis2008'], log: '2008 金融危机：资产大幅缩水，但也是抄底之年。' },
  { id: 'e2012gangnam', age: [27, 28], w: 8, once: true, text: '《江南 Style》火遍全球。全世界的综艺都在跳骑马舞，而江南的房价又涨了一倍。',
    eff: { FAME: 2 }, flags: ['kpop_boom'] },
  { id: 'e2020', age: [35, 36], w: 10, once: true, text: '2020 疫情。股市熔断，但流动性洪水随后而来。有人破产，有人在一年里赚到了一辈子的钱。',
    eff: { STRESS: 6 }, flags: ['covid'], log: '2020 疫情冲击：资产剧烈波动，机会与风险同在。' },

  /* ===== 事业期 30-45 ===== */
  { id: 'b01', age: [30, 45], w: 9, text: '你的公司拿到了第一轮投资。投资人在合同上签字那一刻，你的手是凉的。',
    cond: { need: ['startup'] }, eff: { MONEY: 500000000, FAME: 10, NET: 8 } },
  { id: 'b02', age: [30, 45], w: 7, text: '你被太星集团挖角，成为战略室的次长。你终于走进了那栋楼的顶层。',
    cond: { min: { INT: 70 } }, eff: { MONEY: 120000000, LOY: 20, NET: 10, FAME: 8 }, job: '太星战略室次长', flags: ['taeseong_core'] },
  { id: 'b03', age: [30, 45], w: 7, text: '你在江南买下了第一套属于自己的公寓。签约那天，你在空房子里坐到天黑。',
    cond: { min: { MONEY: 800000000 } }, eff: { MONEY: -800000000, WILL: 6, CHA: 4, FAME: 5 }, flags: ['gangnam_owner'] },
  { id: 'b04', age: [32, 45], w: 6, text: '你的公司被大企业以极低的价格强行收购。你明白了：在这里，做大就会被吃掉。',
    cond: { need: ['startup'], ban: ['lucky'] }, eff: { MONEY: 300000000, STRESS: 14, WILL: 5 } },
  { id: 'b05', age: [32, 46], w: 6, text: '你出版了自传《반지하에서 강남까지》。签售会排了三百人。',
    cond: { min: { FAME: 40 } }, eff: { FAME: 15, MONEY: 150000000 } },
  { id: 'b06', age: [33, 45], w: 6, text: '体检报告上写着「과로 过劳」和三个红色箭头。医生说：你再这样会死。', eff: { HP: -8, STRESS: 10 } },
  { id: 'b07', age: [34, 48], w: 6, text: '你在济州岛休假两周。海风吹过来的时候，你第一次觉得活着是件好事。', eff: { HP: 8, STRESS: -15 } },
  { id: 'b08', age: [35, 46], w: 6, text: '你成立了基金，开始做真正的资本运作。钱第一次开始为你工作。',
    cond: { min: { MONEY: 3000000000, INT: 70 } }, eff: { MONEY: 500000000, NET: 12, FAME: 10 }, flags: ['fund'] },
  { id: 'b09', age: [33, 45], w: 5, text: '检察机关上门调查。你坐在审讯室里，第一次看清了这个国家真正的权力结构。',
    cond: { min: { FAME: 30 } }, eff: { STRESS: 12, WILL: 4, NET: 5 }, flags: ['probed'] },

  /* ===== 财阀线 36-60 ===== */
  { id: 't01', age: [36, 60], w: 10, text: '太星集团会长召见。老人的手指敲着桌面：「我听说过你。你很像年轻时的我。」',
    cond: { min: { LOY: 30, FAME: 30 } }, eff: { LOY: 15, NET: 10 }, flags: ['taeseong_inner'] },
  { id: 't02', age: [36, 60], w: 9, text: '继承之争开始。长子、二女儿、以及一个不被承认的私生子，三方都在拉拢你。',
    cond: { need: ['taeseong_inner'] }, eff: {}, flags: ['war_start'],
    choices: [
      { text: '站在长子一边（稳，但被架空）', eff: { LOY: 12, NET: 8, WILL: -3 }, flags: ['side_elder'] },
      { text: '站在二女儿一边（她的眼光最准）', eff: { LOY: 14, INT: 4, NET: 10 }, flags: ['side_second'] },
      { text: '谁也不站，做自己的局', eff: { WILL: 8, STRESS: 10, INT: 5 }, flags: ['side_self'] }
    ] },
  { id: 't03', age: [36, 60], w: 8, text: '你拿到了那份前世让你送命的文件：太星的秘密资金账本。这一次，你知道该怎么用。',
    cond: { need: ['past_life'], need2: ['taeseong_inner'] }, eff: { INT: 5, WILL: 6, STRESS: 8 }, flags: ['ledger'] },
  { id: 't04', age: [38, 60], w: 8, text: '你开始在市场上悄悄收购太星集团的流通股。3%，5%，7.4%……每一次都踩在披露线以下。',
    cond: { min: { MONEY: 5000000000 } }, eff: { MONEY: -2000000000, INT: 5, STRESS: 8 }, flags: ['buying_stake'] },
  { id: 't05', age: [38, 62], w: 7, text: '股东大会那天，你走进会场。闪光灯亮起的瞬间，你想起前世自己站在门外撑伞的那场雨。',
    cond: { need: ['buying_stake'] }, eff: { FAME: 25, LOY: -20, WILL: 8 }, flags: ['showdown'] },
  { id: 't06', age: [40, 62], w: 7, text: '一场突如其来的税务调查。你的对手比你想象的更不体面。',
    cond: { min: { FAME: 60 } }, eff: { STRESS: 14, MONEY: -300000000, WILL: 5 }, flags: ['tax_raid'] },
  { id: 't07', age: [40, 62], w: 6, text: '你成了太星集团的副会长。汉江对岸的灯，终于有一盏是你点亮的。',
    cond: { need: ['side_second'], min: { LOY: 70 } }, eff: { MONEY: 2000000000, FAME: 20, LOY: 10 }, job: '太星集团副会长' },
  { id: 't08', age: [42, 65], w: 6, text: '你把当年的那份账本交给了记者。三天后，太星集团的股价开盘跌停。',
    cond: { need: ['ledger'], need2: ['revenge'] }, eff: { FAME: 20, LOY: -40, WILL: 6, STRESS: 10 }, flags: ['exposed'] },
  { id: 't09', age: [45, 65], w: 6, text: '你在汝矣岛的办公室里签下收购协议。太星，从此改姓。',
    cond: { need: ['showdown'], min: { MONEY: 20000000000 } }, eff: { MONEY: -5000000000, FAME: 40, NET: 20 }, job: '太星集团会长', flags: ['took_over'] },

  /* ===== 通用 / 随机小事件 ===== */
  { id: 'r01', age: [20, 60], w: 6, text: '你在地铁里给一位老人让座。他递给你一张名片——那是你此后十年最重要的一通电话。',
    cond: { need: ['lucky'] }, eff: { NET: 12, CHA: 3 } },
  { id: 'r02', age: [22, 55], w: 5, text: '朋友拉你入伙一个「稳赚」的项目。你嗅到了骗局的味道。', eff: {},
    choices: [
      { text: '投进去（万一呢）', eff: { MONEY: -8000000, STRESS: 6, INT: 2 } },
      { text: '拒绝，并拉黑他', eff: { INT: 3, WILL: 2, NET: -3 } }
    ] },
  { id: 'r03', age: [25, 55], w: 5, text: '你连续三个月每天只睡四小时。身体开始抗议。', eff: { HP: -6, STRESS: 8 } },
  { id: 'r04', age: [25, 55], w: 5, text: '你开始跑步。清晨六点的汉江公园，跑着跑着就想通了很多事。', eff: { HP: 8, STR: 3, STRESS: -8 } },
  { id: 'r05', age: [26, 50], w: 5, text: '你参加了一场婚礼，认识了某个人。命运有时候就藏在一句客套话里。', cond: { min: { CHA: 40 } }, eff: { NET: 7 } },
  { id: 'r06', age: [28, 55], w: 4, text: '你的名字第一次出现在报纸上。不是讣告，是新闻。', cond: { min: { FAME: 25 } }, eff: { FAME: 6, CHA: 2 } },
  { id: 'r07', age: [30, 60], w: 5, text: '母亲病了。你在病房外走廊里签了一大堆单据，忽然发现自己是家里唯一能做决定的人。', eff: { WILL: 5, STRESS: 8, MONEY: -6000000 } },
  { id: 'r08', age: [30, 60], w: 4, text: '你资助了一个老家的孩子读书。没人知道，也不需要知道。', cond: { min: { MONEY: 100000000 } }, eff: { WILL: 4, FAME: 3, MONEY: -5000000 } },
  { id: 'r09', age: [35, 70], w: 5, text: '你在江南的一家清吧遇到了一个说真话的老记者。他告诉你的东西，比任何财报都有用。', eff: { INT: 5, NET: 6 } },
  { id: 'r10', age: [40, 75], w: 6, text: '你有了孩子。你把那个从小就画在纸上的高塔故事，讲给了他听。', cond: { need: ['married'] }, eff: { WILL: 5, STRESS: -6, HP: 3 } },
  { id: 'r11', age: [45, 75], w: 5, text: '你去医院做了全面体检。医生说：你比你看起来老十岁。', eff: { HP: -5, STRESS: 5 } },
  { id: 'r12', age: [55, 80], w: 6, text: '你开始写回忆录。第一句话是：我出生在一个看不见天空的房间里。', eff: { INT: 3, FAME: 5 } },
  { id: 'r13', age: [60, 80], w: 6, text: '你回到老家的巷子。半地下室还在，只是换了人家。', eff: { WILL: 3, STRESS: -5 } },
  { id: 'r14', age: [50, 80], w: 5, text: '有人在电视节目里提到你的名字，说你是「개천에서 용 난 사나이 从泥沟里飞出的龙」。', cond: { min: { FAME: 50 } }, eff: { FAME: 8, WILL: 4 } },
  { id: 'r15', age: [20, 50], w: 4, text: '你在书店站着看完了《자본론》。合上书时，你对自己的人生有了另一种解释。', cond: { min: { INT: 55 } }, eff: { INT: 4, WILL: 3 } },

  /* ===== 晚年 60+ ===== */
  { id: 'o01', age: [60, 80], w: 8, text: '你退休了，或者说被退休了。名誉会长，一个没有实权的头衔。', eff: { STRESS: 6, WILL: -2 } },
  { id: 'o02', age: [62, 80], w: 7, text: '你在汉江边的长椅上坐了一下午。江水还是那个江水。', eff: { STRESS: -12, WILL: 3 } },
  { id: 'o03', age: [65, 80], w: 6, text: '你把大部分财产捐了出去，成立了一个帮助半地下室孩子的基金。', cond: { min: { MONEY: 10000000000 } }, eff: { MONEY: -5000000000, FAME: 15, WILL: 6 } },
  { id: 'o04', age: [70, 80], w: 6, text: '医生把你叫到一边，说了那个词。你反而很平静。', eff: { HP: -12, STRESS: 8 } }
];

/* ---------------- 投资机会（前世记忆核心玩法） ---------------- */
/* year: 触发年份；hold: 持有到哪年结算；base: 基准倍率；vol: 波动 */
const INVESTMENTS = [
  { id: 'inv_imf_usd', year: 1997, name: '1997 IMF · 美元与黄金', hold: 2, cost: 2000000,
    hint: '원화는 무너진다 韩元会崩。你记得那一年，一美元从 900 韩元涨到了近 2000。',
    base: 2.6, vol: 0.5, kind: 'macro' },
  { id: 'inv_imf_junk', year: 1998, name: '1998 · 收购破产企业债券', hold: 3, cost: 5000000,
    hint: '大宇、起亚的债券被打到面值的两成。国家会兜底。', base: 4.2, vol: 1.2, kind: 'macro' },
  { id: 'inv_dotcom', year: 1999, name: '1999 · 互联网概念股', hold: 2, cost: 5000000,
    hint: '닷컴 버블。它会在 2000 年 3 月破裂，但在那之前会涨到荒唐的高度。', base: 2.4, vol: 1.0, kind: 'stock' },
  { id: 'inv_gangnam_apt', year: 2001, name: '2001 · 江南区公寓', hold: 6, cost: 20000000,
    hint: '江南区大峙洞的「은마아파트」。你记得它后来涨了十倍。', base: 3.2, vol: 0.4, kind: 'estate' },
  { id: 'inv_china', year: 2004, name: '2004 · 中国制造概念', hold: 3, cost: 10000000,
    hint: '중국 특수。韩国的中间材会跟着中国的工厂一起起飞。', base: 2.0, vol: 0.6, kind: 'stock' },
  { id: 'inv_2008', year: 2008, name: '2008 危机 · 抄底 KOSPI', hold: 3, cost: 30000000,
    hint: '所有人都恐慌的十月，是你一生中最好的买点。', base: 3.4, vol: 0.8, kind: 'stock' },
  { id: 'inv_kpop', year: 2011, name: '2011 · 娱乐公司股票', hold: 4, cost: 20000000,
    hint: '한류。你知道明年会有一个骑马的胖子让全世界认识江南。', base: 4.0, vol: 1.1, kind: 'stock' },
  { id: 'inv_btc', year: 2013, name: '2013 · 比特币', hold: 4, cost: 10000000,
    hint: '一个叫 비트코인 的东西，现在几百美元，你记得它后来能买一辆车。', base: 8.0, vol: 2.5, kind: 'crypto' },
  { id: 'inv_rebuild', year: 2015, name: '2015 · 江南再建筑', hold: 5, cost: 50000000,
    hint: '재건축。三十年老公寓拆掉重建的那几年，是韩国最稳的暴利。', base: 2.8, vol: 0.5, kind: 'estate' },
  { id: 'inv_covid', year: 2020, name: '2020 · 疫情熔断抄底', hold: 2, cost: 100000000,
    hint: '三月的熔断，所有人都在抛。然后流动性来了。', base: 2.5, vol: 0.7, kind: 'stock' },
  { id: 'inv_semicon', year: 2022, name: '2022 · 半导体超级周期', hold: 3, cost: 200000000,
    hint: 'AI 会吃掉全世界的高带宽内存。你记得那家公司叫什么。', base: 2.2, vol: 0.6, kind: 'stock' }
];

/* ---------------- 结局 ---------------- */
/* cond: 判定函数 (s) => bool；rank: S/A/B/C/D */
const ENDINGS = [
  { id: 'end_king', rank: 'S', title: '재벌의 주인 财阀之主',
    text: '你从半地下室走到了太星集团会长办公室的落地窗前。汉江在你脚下。前世的雨夜，终于被你亲手改写。',
    cond: s => s.flags.took_over },
  { id: 'end_avenger', rank: 'S', title: '복수의 설계자 复仇的设计者',
    text: '你没有拿走他们的钱，你拿走了他们的名字。太星集团的招牌被摘下那天，你在汉江大桥上站了很久。',
    cond: s => s.flags.exposed && s.stats.FAME >= 60 },
  { id: 'end_stock', rank: 'A', title: '주식의 신 股神',
    text: '你在汝矣岛有一间没有招牌的办公室。屏幕上的曲线你看了四十年，最后它们都变成了你的名字。',
    cond: s => (s.market && s.market.stocks.length >= 1 ? stockValue(s) : 0) >= 100000000000 },
  { id: 'end_landlord', rank: 'A', title: '건물주 收租的房东',
    text: '你名下的收租物业排到了第十九号。每个月的第一天，手机会准时响起——那是租金到账的声音。',
    cond: s => (s.market ? s.market.props.filter(p => {
      const r = propRef(p); return r && (r.rent || 0) > 0;
    }).length : 0) >= 2 && (typeof worthOf === 'function' ? worthOf(s) : s.stats.MONEY) >= 30000000000 },
  { id: 'end_tycoon', rank: 'A', title: '자수성가亿万富豪',
    text: '你不属于任何家族，你只属于你自己。报纸称你为「흙수저의 반란 土勺子的叛乱」。',
    cond: s => (typeof worthOf === 'function' ? worthOf(s) : s.stats.MONEY) >= 150000000000 },
  { id: 'end_vice', rank: 'A', title: '회장의 오른팔 会长之右臂',
    text: '你一生都在别人的影子里，但那个影子覆盖了整个韩国的天际线。',
    cond: s => s.flags.side_second && s.stats.LOY >= 60 },
  { id: 'end_politician', rank: 'A', title: '여의도의 별 汝矣岛之星',
    text: '你走进了国会议事堂。韩国最锋利的权力不在江南的办公室，而在这里的一张票上。',
    cond: s => s.stats.FAME >= 95 && s.stats.NET >= 150 },
  { id: 'end_legend', rank: 'A', title: '전설 传说',
    text: '你的名字被写进了教科书。孩子们不知道你出生在哪儿，只知道你做过什么。',
    cond: s => s.stats.FAME >= 160 },
  { id: 'end_escape', rank: 'B', title: '해외 도피 远走他乡',
    text: '你在仁川机场的贵宾室里等着最后一班航班。钱还在，名字臭了。这也是一种活法。',
    cond: s => s.flags.tax_raid && (typeof worthOf === 'function' ? worthOf(s) : s.stats.MONEY) >= 1000000000 && s.stats.LOY < 0 },
  { id: 'end_fund', rank: 'B', title: '은퇴한 투자자 退休投资人',
    text: '你在济州岛有一栋房子和一片橘子园。钱够用，故事也够讲。',
    cond: s => (typeof worthOf === 'function' ? worthOf(s) : s.stats.MONEY) >= 3000000000 },
  { id: 'end_shop', rank: 'B', title: '따뜻한 가게 温暖的店',
    text: '你的咖啡馆还在清潭洞的巷子里。老顾客来了一茬又一茬，你记得每个人的口味。',
    cond: s => s.flags.own_shop && (typeof worthOf === 'function' ? worthOf(s) : s.stats.MONEY) > 0
      && (typeof worthOf === 'function' ? worthOf(s) : s.stats.MONEY) < 3000000000 && s.stats.FAME < 40 },
  { id: 'end_salary', rank: 'C', title: '평범한 회사원 平凡的会社员',
    text: '你按时上下班，按时退休。回首尔的夜景时，你还是会想起小时候画的那个圈。',
    cond: s => ['会社员', '公务员', '太星集团社员', '工厂工人', '个体户'].indexOf(s.job) >= 0
      && s.stats.FAME < 40 && (typeof worthOf === 'function' ? worthOf(s) : s.stats.MONEY) < 3000000000 },
  { id: 'end_broken', rank: 'D', title: '빚 负债者',
    text: '你奋斗了一辈子，最后只剩下一张催缴单和半地下室的钥匙。',
    cond: s => (typeof worthOf === 'function' ? worthOf(s) : s.stats.MONEY) < 0 },
  { id: 'end_lonely', rank: 'C', title: '혼자 独行者',
    text: '你爬得不算高，但每一步都是自己的。天黑了，你给自己倒了一杯烧酒。',
    cond: s => s.stats.WILL >= 60 },
  { id: 'end_normal', rank: 'C', title: '보통의 인생 普通的人生',
    text: '你的一生没有奇迹，也没有崩塌。像汉江的水，平稳地流过。',
    cond: () => true }
];

/* =========================================================
 *  扩展事件库 · 每个事件 3 个选项，风险与回报各不相同
 *  risk: 1 低 / 2 中 / 3 高   gamble: {p, win, lose} 概率赌注
 * ========================================================= */
const EVENTS_EXTRA = [

  /* ===== 주거 居住 / 房产 ===== */
  { id: 'x_h01', age: [23, 45], w: 8, text: '월세 到期，房东说要涨三成。你在半地下室的墙前站了很久——这里是你的起点，也是你最想逃离的地方。',
    choices: [
      { text: '续租，忍一年', eff: { MONEY: -3000000, STRESS: 5 }, risk: 1 },
      { text: '搬到京畿道，通勤两小时', eff: { MONEY: -1200000, STR: -3, STRESS: 8, WILL: 3 }, risk: 2 },
      { text: '咬牙凑 전세 押金，一次性解决', eff: { MONEY: -18000000, WILL: 4, STRESS: 10 }, risk: 3,
        gamble: { p: 0.45, win: { MONEY: 6000000, WILL: 3 }, lose: { MONEY: -8000000, STRESS: 8 } } }
    ] },
  { id: 'x_h02', age: [25, 50], w: 8, text: '中介打来电话：大峙洞有一套 24 坪，业主急售，比市价低一成。首付要在三天内到位。',
    cond: { min: { MONEY: 60000000 } },
    choices: [
      { text: '再等等，也许还有更便宜的', eff: { STRESS: 4 }, risk: 1 },
      { text: '付三成首付，剩下的贷款', eff: { MONEY: -42000000, STRESS: 10, WILL: 4 }, flags: ['mortgage'], risk: 2 },
      { text: '借遍所有能借的人，全款拿下', eff: { MONEY: -140000000, WILL: 8, STRESS: 16 }, flags: ['own_house', 'allin_house'], risk: 3,
        gamble: { p: 0.55, win: { MONEY: 80000000, CHA: 5, FAME: 3 }, lose: { MONEY: -30000000, HP: -5 } } }
    ] },
  { id: 'x_h03', age: [27, 55], w: 7, text: '房价连续三年上涨。办公室里所有人不谈工作，只谈房子。你手里有一笔钱，也有一个判断。',
    cond: { min: { MONEY: 50000000 } },
    choices: [
      { text: '不追高，把钱留在手里', eff: { INT: 2, WILL: 2 }, risk: 1 },
      { text: '买一套江北的小户型收租', eff: { MONEY: -50000000, NET: 3 }, risk: 2 },
      { text: '加杠杆，同时吃下两套', eff: { MONEY: -80000000, STRESS: 14 }, flags: ['leveraged'], risk: 3,
        gamble: { p: 0.42, win: { MONEY: 260000000, CHA: 4 }, lose: { MONEY: -60000000, HP: -6, STRESS: 10 } } }
    ] },
  { id: 'x_h04', age: [30, 60], w: 6, text: '政府出台了新的房产税。你持有的房产，每年的持有成本会明显上升。',
    cond: { need: ['own_house'] },
    choices: [
      { text: '卖掉一套，降低负担', eff: { MONEY: 40000000, STRESS: -6 }, risk: 1 },
      { text: '硬扛，赌长期还是涨的', eff: { MONEY: -12000000, WILL: 4 }, risk: 2 },
      { text: '全部换成商铺，转收租模式', eff: { MONEY: -20000000, NET: 6, INT: 3 }, risk: 3,
        gamble: { p: 0.5, win: { MONEY: 70000000 }, lose: { MONEY: -25000000 } } }
    ] },
  { id: 'x_h05', age: [33, 58], w: 6, text: '你所住的那片老公寓贴出了「재건축 重建」公告。业主大会要投票，你的一票很关键。',
    cond: { need: ['own_house'] },
    choices: [
      { text: '反对，重建期间没地方住', eff: { STRESS: 4, WILL: -2 }, risk: 1 },
      { text: '赞成，等五年', eff: { MONEY: -15000000, WILL: 5, STRESS: 8 }, risk: 2 },
      { text: '赞成，并低价收购邻居的份额', eff: { MONEY: -90000000, INT: 5, STRESS: 12 }, flags: ['rebuild_player'], risk: 3,
        gamble: { p: 0.48, win: { MONEY: 420000000, FAME: 5 }, lose: { MONEY: -40000000, STRESS: 10 } } }
    ] },
  { id: 'x_h06', age: [40, 70], w: 6, text: '你在中介那里看到一套汉南洞的房子。价格是你十年前想都不敢想的数字，而你居然买得起了。',
    cond: { min: { MONEY: 2000000000 } },
    choices: [
      { text: '买，这是给自己一个交代', eff: { MONEY: -1800000000, CHA: 10, FAME: 8, WILL: 6 }, flags: ['own_house'], risk: 2 },
      { text: '不买，钱应该继续生钱', eff: { INT: 4, WILL: 3 }, risk: 1 },
      { text: '买两套，一套住一套租', eff: { MONEY: -2600000000, CHA: 12, NET: 8 }, flags: ['own_house'], risk: 3,
        gamble: { p: 0.5, win: { MONEY: 900000000 }, lose: { MONEY: -400000000, STRESS: 10 } } }
    ] },
  { id: 'x_h07', age: [24, 40], w: 6, text: '母亲从老家来首尔看你。她在半地下室里坐了一晚，第二天说：这地方，怎么住人。',
    cond: { need: ['poor'] },
    choices: [
      { text: '笑着说，快了', eff: { WILL: 4, STRESS: 5 }, risk: 1 },
      { text: '带她去看江南的样板房', eff: { MONEY: -500000, WILL: 6, INT: 2 }, risk: 2 },
      { text: '当场签下一套首付合同', eff: { MONEY: -60000000, WILL: 8, STRESS: 14 }, flags: ['own_house', 'mortgage'], risk: 3,
        gamble: { p: 0.45, win: { MONEY: 50000000, CHA: 4 }, lose: { MONEY: -20000000, HP: -5 } } }
    ] },
  { id: 'x_h08', age: [28, 50], w: 5, text: '老家传来消息：那条规划了十年的地铁线，终于要动工了。你手里有一块京畿道的地。',
    cond: { min: { MONEY: 30000000 } },
    choices: [
      { text: '不折腾，继续持有', eff: { INT: 2 }, risk: 1 },
      { text: '追加买入周边的地', eff: { MONEY: -60000000, STRESS: 8 }, risk: 2 },
      { text: '抵押房子，把整条线吃下来', eff: { MONEY: -150000000, WILL: 6, STRESS: 16 }, flags: ['leveraged'], risk: 3,
        gamble: { p: 0.4, win: { MONEY: 620000000, NET: 8 }, lose: { MONEY: -90000000, HP: -7 } } }
    ] },

  /* ===== 자동차 汽车 ===== */
  { id: 'x_c01', age: [23, 40], w: 7, text: '你攒够了第一辆车的钱。销售员说：在首尔，车不是交通工具，是名片。',
    cond: { min: { MONEY: 15000000 } },
    choices: [
      { text: '买一辆二手小排量，能开就行', eff: { MONEY: -8000000, STR: 1 }, flags: ['own_car'], risk: 1 },
      { text: '买国产中型车，体面且够用', eff: { MONEY: -22000000, CHA: 3, NET: 2 }, flags: ['own_car'], risk: 2 },
      { text: '贷款上进口车，先像那个人', eff: { MONEY: -30000000, CHA: 7, NET: 3, STRESS: 10 }, flags: ['own_car', 'car_loan'], risk: 3,
        gamble: { p: 0.4, win: { NET: 10, CHA: 4 }, lose: { MONEY: -12000000, STRESS: 8 } } }
    ] },
  { id: 'x_c02', age: [28, 50], w: 6, text: '客户在电话里问：「你开什么车来？」你看着窗外的旧车，停顿了三秒。',
    cond: { min: { NET: 30 } },
    choices: [
      { text: '如实说，靠方案说话', eff: { WILL: 3, INT: 2 }, risk: 1 },
      { text: '租一辆好车去见他', eff: { MONEY: -1500000, CHA: 4, NET: 5 }, risk: 2 },
      { text: '直接换车，一次到位', eff: { MONEY: -95000000, CHA: 9, NET: 8 }, flags: ['own_car'], risk: 3,
        gamble: { p: 0.5, win: { NET: 14, MONEY: 60000000 }, lose: { MONEY: -20000000, STRESS: 6 } } }
    ] },
  { id: 'x_c03', age: [30, 55], w: 5, text: '你在清潭洞的红灯前停着，隔壁车道是一辆和你同款的车。对方摇下车窗，是太星集团的人。',
    cond: { min: { MONEY: 120000000 } },
    choices: [
      { text: '点头示意，各自开走', eff: { WILL: 2 }, risk: 1 },
      { text: '递上名片，说一句久仰', eff: { NET: 8, LOY: 4, CHA: 2 }, risk: 2 },
      { text: '摇下车窗，问他要不要喝一杯', eff: { NET: 12, LOY: 8, HP: -4, STRESS: 6 }, risk: 3,
        gamble: { p: 0.45, win: { LOY: 15, NET: 10 }, lose: { LOY: -8, CHA: -3 } } }
    ] },
  { id: 'x_c04', age: [35, 65], w: 5, text: '你终于买下了那辆小时候贴在墙上的车。钥匙放在手里，比想象中轻。',
    cond: { min: { MONEY: 180000000 } },
    choices: [
      { text: '买下，但不开去公司', eff: { MONEY: -190000000, WILL: 5, CHA: 5 }, flags: ['own_car'], risk: 1 },
      { text: '买下，并开去所有该去的地方', eff: { MONEY: -190000000, CHA: 10, NET: 6, FAME: 4 }, flags: ['own_car'], risk: 2 },
      { text: '一次买两辆，一辆给母亲', eff: { MONEY: -340000000, CHA: 12, WILL: 8, FAME: 5 }, flags: ['own_car'], risk: 3,
        gamble: { p: 0.5, win: { WILL: 10, NET: 8 }, lose: { MONEY: -40000000, STRESS: 8 } } }
    ] },
  { id: 'x_c05', age: [26, 45], w: 5, text: '同事聚会，大家都在谈股票和车。有人说：没贷款买车的人，是没野心的人。',
    choices: [
      { text: '笑而不语', eff: { INT: 3, WILL: 2 }, risk: 1 },
      { text: '附和几句，混个脸熟', eff: { NET: 4, CHA: 2 }, risk: 2 },
      { text: '当场宣布：我今年要买两辆', eff: { CHA: 5, NET: 6, STRESS: 10 }, risk: 3,
        gamble: { p: 0.35, win: { NET: 12, FAME: 6 }, lose: { CHA: -6, NET: -5, STRESS: 8 } } }
    ] },

  /* ===== 주식 股市 ===== */
  { id: 'x_s01', age: [20, 40], w: 9, text: '你在证券公司开了户。营业厅的屏幕上全是红绿数字，客户经理递给你一杯速溶咖啡。',
    choices: [
      { text: '只买大盘 ETF，慢慢来', eff: { INT: 3, MONEY: -5000000 }, flags: ['investor'], risk: 1 },
      { text: '买一只你研究过的行业龙头', eff: { INT: 4, MONEY: -15000000, STRESS: 5 }, flags: ['investor'], risk: 2 },
      { text: '全部押在当下最火的那只', eff: { INT: 3, MONEY: -30000000, STRESS: 12 }, flags: ['investor', 'degen'], risk: 3,
        gamble: { p: 0.38, win: { MONEY: 60000000, INT: 5 }, lose: { MONEY: -18000000, STRESS: 10 } } }
    ] },
  { id: 'x_s02', age: [21, 45], w: 7, text: '你买的第一只股票连跌三天。论坛里全是「존버 死扛」和「손절 止损」的声音。',
    cond: { need: ['investor'] },
    choices: [
      { text: '死扛，等它回来', eff: { WILL: 4, STRESS: 8 }, risk: 2 },
      { text: '止损，认赔离场', eff: { INT: 4, STRESS: -5, WILL: 2 }, risk: 1 },
      { text: '越跌越买，摊平成本', eff: { MONEY: -20000000, WILL: 6, STRESS: 14 }, risk: 3,
        gamble: { p: 0.42, win: { MONEY: 90000000, INT: 6 }, lose: { MONEY: -40000000, HP: -5 } } }
    ] },
  { id: 'x_s03', age: [22, 50], w: 7, text: '一个在券商工作的学长偷偷告诉你：有家公司下周会有大消息。他说完就后悔了，让你当没听过。',
    choices: [
      { text: '当没听过，合规性第一', eff: { WILL: 3, INT: 2 }, risk: 1 },
      { text: '买一点点，试一试', eff: { MONEY: -10000000, NET: 5, STRESS: 6 }, flags: ['insider'], risk: 2 },
      { text: '重仓，这是改变命运的消息', eff: { MONEY: -80000000, WILL: 6, STRESS: 16 }, flags: ['insider', 'degen'], risk: 3,
        gamble: { p: 0.4, win: { MONEY: 400000000, INT: 8 }, lose: { MONEY: -60000000, FAME: -10, STRESS: 14 }, loseFlag: 'insider_risk' } }
    ] },
  { id: 'x_s04', age: [23, 55], w: 7, text: '你的账户在一年内翻了一倍。你开始觉得自己懂市场了——这是最危险的时候。',
    cond: { need: ['investor'], min: { MONEY: 100000000 } },
    choices: [
      { text: '取出本金，只留利润在场上', eff: { INT: 6, WILL: 4 }, risk: 1 },
      { text: '继续按照原来的节奏', eff: { INT: 3, STRESS: 4 }, risk: 2 },
      { text: '加大仓位，用信用融资再上杠杆', eff: { WILL: 6, STRESS: 18 }, flags: ['leveraged'], risk: 3,
        gamble: { p: 0.35, win: { MONEY: 500000000, FAME: 6 }, lose: { MONEY: -280000000, HP: -8, STRESS: 16 } } }
    ] },
  { id: 'x_s05', age: [24, 60], w: 6, text: '市场暴跌，你的账户一天少了三成。手机屏幕上的绿色，比任何颜色都刺眼。',
    cond: { min: { MONEY: 30000000 } },
    choices: [
      { text: '关掉软件，去跑步', eff: { HP: 6, STRESS: -10, WILL: 3 }, risk: 1 },
      { text: '减仓一半，保留子弹', eff: { INT: 4, STRESS: -4 }, risk: 2 },
      { text: '别人恐惧我贪婪，全仓抄底', eff: { WILL: 8, STRESS: 18 }, flags: ['bottom_fisher'], risk: 3,
        gamble: { p: 0.45, win: { MONEY: 320000000, INT: 8 }, lose: { MONEY: -150000000, HP: -7 } } }
    ] },
  { id: 'x_s06', age: [25, 60], w: 6, text: '你手里那只股票一年涨了四倍。办公室的人开始问你买了什么。',
    cond: { min: { MONEY: 200000000 } },
    choices: [
      { text: '卖掉一半，落袋为安', eff: { INT: 5, WILL: 3, STRESS: -6 }, risk: 1 },
      { text: '一股不卖，让它继续跑', eff: { WILL: 5, STRESS: 8 }, risk: 2 },
      { text: '追加买入，把胜利推到极致', eff: { WILL: 8, STRESS: 16 }, flags: ['degen'], risk: 3,
        gamble: { p: 0.38, win: { MONEY: 700000000, FAME: 8 }, lose: { MONEY: -220000000, STRESS: 14 } } }
    ] },
  { id: 'x_s07', age: [26, 58], w: 6, text: '有人在论坛贴出一张截图：他做空了整个市场，赚了十倍。评论区一半在膜拜，一半在骂。',
    choices: [
      { text: '关掉，继续上班', eff: { INT: 3 }, risk: 1 },
      { text: '小仓位试一次做空', eff: { MONEY: -20000000, INT: 4, STRESS: 8 }, risk: 2 },
      { text: '跟着他，全仓做空', eff: { MONEY: -100000000, WILL: 6, STRESS: 20 }, flags: ['short_player'], risk: 3,
        gamble: { p: 0.3, win: { MONEY: 580000000, FAME: 10 }, lose: { MONEY: -260000000, HP: -8 } } }
    ] },
  { id: 'x_s08', age: [22, 45], w: 6, text: '一个「股票直播间」的主播说：跟着我操作，一个月翻倍，不赚包赔。',
    choices: [
      { text: '举报，然后关掉', eff: { INT: 4, WILL: 2 }, risk: 1 },
      { text: '进群看看，一分钱不投', eff: { INT: 5, NET: 3 }, risk: 2 },
      { text: '交了两百万的会员费', eff: { MONEY: -2000000, STRESS: 10 }, risk: 3,
        gamble: { p: 0.15, win: { MONEY: 30000000 }, lose: { MONEY: -12000000, INT: -4 } } }
    ] },
  { id: 'x_s09', age: [28, 60], w: 6, text: '你被拉进一个「江南投资俱乐部」。入场条件是：账户里至少要有十亿。',
    cond: { min: { MONEY: 1000000000 } },
    choices: [
      { text: '婉拒，圈子是有代价的', eff: { INT: 4, WILL: 3 }, risk: 1 },
      { text: '加入，只听不出手', eff: { NET: 10, INT: 6, MONEY: -20000000 }, risk: 2 },
      { text: '加入，并参与他们的联合建仓', eff: { MONEY: -500000000, NET: 18, LOY: 8, STRESS: 12 }, flags: ['club_member'], risk: 3,
        gamble: { p: 0.45, win: { MONEY: 1400000000, NET: 12 }, lose: { MONEY: -350000000, NET: -8 } } }
    ] },
  { id: 'x_s10', age: [30, 62], w: 6, text: '你重仓的那家公司爆出会计造假，股价开盘跌停。新闻里，你的名字出现在「受害个人股东」名单中。',
    cond: { min: { MONEY: 200000000 } },
    choices: [
      { text: '认赔，永远记住这一课', eff: { INT: 8, WILL: 5, STRESS: 10 }, risk: 1 },
      { text: '联合其他散户发起集体诉讼', eff: { FAME: 8, NET: 10, WILL: 6, STRESS: 12 }, flags: ['lawsuit'], risk: 2 },
      { text: '反向加仓，赌它不会退市', eff: { MONEY: -150000000, WILL: 8, STRESS: 20 }, risk: 3,
        gamble: { p: 0.28, win: { MONEY: 900000000, FAME: 12 }, lose: { MONEY: -300000000, HP: -8 } } }
    ] },
  { id: 'x_s11', age: [32, 65], w: 6, text: '你开始写投资专栏。第一篇的题目是《我如何在五年内把一千万变成十亿》。',
    cond: { min: { MONEY: 1000000000, INT: 60 } },
    choices: [
      { text: '只写方法，不写标的', eff: { FAME: 8, INT: 4 }, risk: 1 },
      { text: '公开你的持仓', eff: { FAME: 15, NET: 8, STRESS: 8 }, risk: 2 },
      { text: '顺势发行自己的基金', eff: { FAME: 20, NET: 14, MONEY: 300000000, STRESS: 14 }, flags: ['fund'], risk: 3,
        gamble: { p: 0.48, win: { MONEY: 2200000000, FAME: 15 }, lose: { FAME: -12, MONEY: -400000000, STRESS: 12 } } }
    ] },
  { id: 'x_s12', age: [20, 35], w: 6, text: '朋友在用一款新的海外券商 App，可以做空、可以加二十倍杠杆、可以买美股。他给你看了他的收益率。',
    choices: [
      { text: '不碰，看不懂的东西不碰', eff: { INT: 5, WILL: 3 }, risk: 1 },
      { text: '开个户，只放一点点钱', eff: { MONEY: -10000000, INT: 4 }, risk: 2 },
      { text: '二十倍杠杆，一把定生死', eff: { MONEY: -30000000, STRESS: 22, WILL: 6 }, flags: ['degen', 'leveraged'], risk: 3,
        gamble: { p: 0.25, win: { MONEY: 900000000, FAME: 10 }, lose: { MONEY: -30000000, HP: -9, STRESS: 18 } } }
    ] },
  { id: 'x_s13', age: [30, 60], w: 5, text: '你在股东大会上第一次举手发言。会场很小，麦克风很凉，你的声音在抖。',
    cond: { min: { MONEY: 500000000, INT: 60 } },
    choices: [
      { text: '问一个温和的问题', eff: { NET: 6, FAME: 4 }, risk: 1 },
      { text: '当众质疑管理层', eff: { FAME: 12, NET: 8, LOY: -6, WILL: 5 }, risk: 2 },
      { text: '提案罢免一名董事', eff: { FAME: 22, WILL: 8, LOY: -18, STRESS: 14 }, flags: ['activist'], risk: 3,
        gamble: { p: 0.35, win: { MONEY: 600000000, FAME: 15 }, lose: { LOY: -15, MONEY: -200000000 } } }
    ] },
  { id: 'x_s14', age: [26, 50], w: 5, text: '你在汝矣岛的券商大厅遇见一个老人。他看了你一眼，说：小伙子，你是来赚钱的，还是来证明什么的？',
    choices: [
      { text: '赚钱', eff: { INT: 4 }, risk: 1 },
      { text: '都有', eff: { INT: 3, WILL: 4, NET: 4 }, risk: 2 },
      { text: '证明一些事', eff: { WILL: 8, INT: 2, STRESS: 8 }, flags: ['prove_self'], risk: 3,
        gamble: { p: 0.4, win: { WILL: 10, INT: 6, MONEY: 80000000 }, lose: { WILL: -4, STRESS: 12 } } }
    ] },
  { id: 'x_s15', age: [24, 55], w: 5, text: '同事都在买同一只「국민주 国民股」。有人说不买就落伍了。',
    choices: [
      { text: '不买，落伍就落伍', eff: { INT: 4, WILL: 2 }, risk: 1 },
      { text: '买一点，随大流', eff: { MONEY: -10000000, NET: 3 }, risk: 2 },
      { text: '反向思考，做空它', eff: { MONEY: -30000000, INT: 6, STRESS: 12 }, risk: 3,
        gamble: { p: 0.32, win: { MONEY: 260000000, INT: 8 }, lose: { MONEY: -120000000, NET: -5 } } }
    ] },

  /* ===== 직장 职场 ===== */
  { id: 'x_w01', age: [23, 45], w: 8, text: '上司把一份不属于你的错误，压到了你头上。会议室里所有人都在看你。',
    choices: [
      { text: '认下来，记在心里', eff: { WILL: 5, STRESS: 8, NET: 4 }, risk: 1 },
      { text: '当场解释清楚', eff: { INT: 4, WILL: 3, NET: -4, STRESS: 6 }, risk: 2 },
      { text: '把证据发给会长的秘书', eff: { WILL: 8, INT: 6, LOY: 6, STRESS: 16 }, risk: 3,
        gamble: { p: 0.35, win: { NET: 15, LOY: 15, MONEY: 60000000 }, lose: { NET: -12, STRESS: 14, job: '无业' } } }
    ] },
  { id: 'x_w02', age: [25, 50], w: 7, text: '一家竞争对手开出两倍的薪水挖你。合同就在邮箱里，回信期限是今晚十二点。',
    cond: { min: { INT: 45 } },
    choices: [
      { text: '拒绝，忠诚也是有价的', eff: { LOY: 8, WILL: 3, NET: 4 }, risk: 1 },
      { text: '谈一个更好的价，留下来', eff: { MONEY: 30000000, NET: 6, INT: 3 }, risk: 2 },
      { text: '跳过去，并把团队一起带走', eff: { MONEY: 80000000, NET: 10, LOY: -12, WILL: 6 }, risk: 3,
        gamble: { p: 0.45, win: { MONEY: 200000000, FAME: 8 }, lose: { LOY: -20, NET: -10, STRESS: 12 } } }
    ] },
  { id: 'x_w03', age: [26, 48], w: 7, text: '部门要选一个人去海外分公司。那里有机会，也有两年回不来的代价。',
    choices: [
      { text: '不去，守住眼前的位置', eff: { WILL: 2, STRESS: 3 }, risk: 1 },
      { text: '去，见识比安稳重要', eff: { INT: 6, NET: 8, CHA: 4, STRESS: 6 }, risk: 2 },
      { text: '主动请缨去最苦的那个市场', eff: { INT: 10, WILL: 8, NET: 12, HP: -6, STRESS: 12 }, risk: 3,
        gamble: { p: 0.5, win: { MONEY: 180000000, FAME: 10, LOY: 10 }, lose: { HP: -8, STRESS: 14 } } }
    ] },
  { id: 'x_w04', age: [28, 52], w: 7, text: '회식 聚餐。上司把一杯烧酒推到你面前，说：喝了这杯，这个单子就是你的。',
    choices: [
      { text: '以身体为由，换成水', eff: { WILL: 3, CHA: -3, STRESS: 5 }, risk: 1 },
      { text: '喝了，然后去洗手间吐掉', eff: { NET: 6, HP: -4, CHA: 2 }, risk: 2 },
      { text: '连干三杯，把气氛推到最高', eff: { NET: 12, LOY: 6, CHA: 4, HP: -7, STRESS: 6 }, risk: 3,
        gamble: { p: 0.42, win: { NET: 14, MONEY: 70000000 }, lose: { HP: -9, STRESS: 10 } } }
    ] },
  { id: 'x_w05', age: [30, 50], w: 6, text: '一个供应商塞给你一个信封。他说：这是行业规矩，大家都这样。',
    choices: [
      { text: '当场退回去', eff: { WILL: 5, INT: 3, NET: -3 }, risk: 1 },
      { text: '收下，但原样上缴公司', eff: { INT: 4, LOY: 6, FAME: 3 }, risk: 2 },
      { text: '收下，装进自己的口袋', eff: { MONEY: 40000000, WILL: -3, STRESS: 10 }, flags: ['took_bribe'], risk: 3,
        gamble: { p: 0.25, win: { MONEY: 150000000 }, lose: { MONEY: -200000000, FAME: -20, STRESS: 18 }, loseFlag: 'bribe_risk' } }
    ] },
  { id: 'x_w06', age: [30, 55], w: 6, text: '公司要裁掉十分之一的人。名单由你所在的部门出，而你的名字也在候选里。',
    choices: [
      { text: '保住下属，自己走', eff: { WILL: 8, NET: 10, MONEY: -20000000, FAME: 6 }, job: '无业', risk: 2 },
      { text: '按绩效如实上报', eff: { INT: 4, WILL: 3, NET: -4 }, risk: 1 },
      { text: '把对手的名字写上去', eff: { WILL: 5, INT: 5, NET: -8, LOY: 4 }, risk: 3,
        gamble: { p: 0.4, win: { MONEY: 90000000, LOY: 10 }, lose: { NET: -14, FAME: -8 } } }
    ] },
  { id: 'x_w07', age: [27, 45], w: 6, text: '你连续三个月睡在办公室。体检报告出来了，医生用红笔圈了四项。',
    choices: [
      { text: '休假两周，好好睡觉', eff: { HP: 12, STRESS: -12, MONEY: -3000000 }, risk: 1 },
      { text: '继续，但开始吃药', eff: { HP: -4, STRESS: 4, MONEY: 20000000 }, risk: 2 },
      { text: '什么都不管，项目必须上线', eff: { MONEY: 120000000, FAME: 8, HP: -11, STRESS: 16 }, risk: 3,
        gamble: { p: 0.42, win: { MONEY: 400000000, FAME: 15, LOY: 10 }, lose: { HP: -14, STRESS: 20 } } }
    ] },
  { id: 'x_w08', age: [29, 48], w: 6, text: '你有一个创业的想法，写在笔记本的第 47 页。问题是：要不要真的辞掉工作。',
    cond: { min: { WILL: 35 } },
    choices: [
      { text: '先做副业，验证一下', eff: { INT: 4, MONEY: 8000000, STRESS: 6 }, risk: 1 },
      { text: '辞职，给自己一年', eff: { MONEY: -30000000, WILL: 6, STRESS: 12 }, job: '创业者', flags: ['startup'], risk: 2 },
      { text: '抵押房子创业，不留退路', eff: { MONEY: -120000000, WILL: 10, STRESS: 20 }, job: '创业者', flags: ['startup', 'allin_startup'], risk: 3,
        gamble: { p: 0.32, win: { MONEY: 1800000000, FAME: 20, NET: 15 }, lose: { MONEY: -200000000, HP: -8, STRESS: 18 } } }
    ] },
  { id: 'x_w09', age: [33, 55], w: 6, text: '你带的一个后辈犯了致命错误。他跪在你办公室门口，说家里还有生病的母亲。',
    choices: [
      { text: '让他自己承担后果', eff: { INT: 3, WILL: -2, NET: -3 }, risk: 1 },
      { text: '替他扛下来', eff: { WILL: 5, NET: 10, STRESS: 8, MONEY: -10000000 }, risk: 2 },
      { text: '让他承担，但私下把他的母亲安排好', eff: { INT: 6, WILL: 6, NET: 12, MONEY: -30000000 }, risk: 3,
        gamble: { p: 0.5, win: { NET: 16, WILL: 8 }, lose: { NET: -6, MONEY: -20000000 } } }
    ] },
  { id: 'x_w10', age: [35, 58], w: 6, text: '你的名字出现在理事的候选名单上。要上去，还得再跨过一个人。',
    cond: { min: { LOY: 20 } },
    choices: [
      { text: '等，等到该轮到你', eff: { WILL: 4, INT: 3 }, risk: 1 },
      { text: '主动向会长汇报一次', eff: { LOY: 10, FAME: 6, NET: 6 }, risk: 2 },
      { text: '把对手的问题整理成一份材料', eff: { LOY: 14, INT: 6, WILL: 5, STRESS: 14 }, flags: ['backstab'], risk: 3,
        gamble: { p: 0.45, win: { MONEY: 300000000, LOY: 15 }, lose: { LOY: -20, FAME: -10, NET: -12 } } }
    ] },

  /* ===== 관계 / 가족 关系与家庭 ===== */
  { id: 'x_f01', age: [24, 45], w: 7, text: '相恋三年的女友坐下来认真地说：我们要不要先买房，再结婚？房价每天都在变。',
    cond: { min: { CHA: 30 } },
    choices: [
      { text: '说再等等，我不想负债', eff: { WILL: 3, STRESS: 8, CHA: -2 }, risk: 1 },
      { text: '答应，一起去银行', eff: { MONEY: -60000000, WILL: 5, STRESS: 12 }, flags: ['married', 'mortgage'], risk: 2 },
      { text: '当场签下一套江南的合约', eff: { MONEY: -200000000, CHA: 10, WILL: 8, STRESS: 18 }, flags: ['married', 'own_house'], risk: 3,
        gamble: { p: 0.45, win: { MONEY: 300000000, WILL: 8 }, lose: { MONEY: -80000000, STRESS: 14 } } }
    ] },
  { id: 'x_f02', age: [26, 50], w: 6, text: '母亲住院了。缴费单上的数字，比你第一次买房的首付还让人心慌。',
    choices: [
      { text: '用最好的药，钱可以再赚', eff: { MONEY: -40000000, WILL: 5, HP: -4, STRESS: 8 }, risk: 2 },
      { text: '选普通方案，能治就行', eff: { MONEY: -15000000, WILL: 3, STRESS: 12 }, risk: 1 },
      { text: '把房子抵押出去，请国外专家', eff: { MONEY: -120000000, WILL: 8, STRESS: 18 }, flags: ['leveraged'], risk: 3,
        gamble: { p: 0.42, win: { WILL: 12, HP: 8, NET: 6 }, lose: { MONEY: -60000000, HP: -7 } } }
    ] },
  { id: 'x_f03', age: [28, 48], w: 6, text: '孩子的학원 补习班。妻子说：别人都在上，我们不能不上。账单是每月两百万。',
    cond: { need: ['married'] },
    choices: [
      { text: '只上一个，其他的自己教', eff: { INT: 4, WILL: 3, MONEY: -12000000 }, risk: 1 },
      { text: '上全套，砸进去', eff: { MONEY: -48000000, WILL: 5, STRESS: 10 }, risk: 2 },
      { text: '直接送进国际学校', eff: { MONEY: -200000000, CHA: 6, NET: 8, FAME: 5 }, risk: 3,
        gamble: { p: 0.45, win: { NET: 16, FAME: 10 }, lose: { MONEY: -100000000, STRESS: 12 } } }
    ] },
  { id: 'x_f04', age: [30, 55], w: 6, text: '老家的弟弟打电话来借钱创业。他说：哥，你是我唯一的希望。',
    choices: [
      { text: '拒绝，钱救不了所有人', eff: { WILL: -2, INT: 4, NET: -4 }, risk: 1 },
      { text: '给一小笔，量力而行', eff: { MONEY: -10000000, WILL: 4, NET: 4 }, risk: 2 },
      { text: '给他一大笔，并帮他写商业计划', eff: { MONEY: -80000000, NET: 8, WILL: 6, STRESS: 10 }, risk: 3,
        gamble: { p: 0.4, win: { MONEY: 260000000, NET: 12 }, lose: { MONEY: -50000000, NET: -6 } } }
    ] },
  { id: 'x_f05', age: [32, 58], w: 5, text: '你在孩子的家长会上迟到。其他家长在用一种你熟悉的眼神看你——那是当年看你母亲的眼神。',
    cond: { need: ['married'] },
    choices: [
      { text: '坦然坐下', eff: { WILL: 4, CHA: 2 }, risk: 1 },
      { text: '主动赞助一场活动', eff: { MONEY: -20000000, NET: 8, FAME: 4 }, risk: 2 },
      { text: '站起来做自我介绍，把生意谈成', eff: { NET: 14, CHA: 6, FAME: 6, MONEY: 60000000 }, risk: 3,
        gamble: { p: 0.42, win: { NET: 18, MONEY: 300000000 }, lose: { CHA: -6, NET: -5 } } }
    ] },
  { id: 'x_f06', age: [34, 60], w: 5, text: '妻子说，你已经三年没有在家吃过晚饭了。她没有哭，只是很平静。',
    cond: { need: ['married'] },
    choices: [
      { text: '答应这个周末一定回来', eff: { WILL: 2, STRESS: -4 }, risk: 1 },
      { text: '把周末全空出来，带她去济州', eff: { MONEY: -8000000, WILL: 5, HP: 5, STRESS: -10 }, risk: 2 },
      { text: '什么也不说，关掉手机陪她一整天', eff: { WILL: 8, HP: 8, STRESS: -16, MONEY: -50000000 }, risk: 3,
        gamble: { p: 0.5, win: { WILL: 10, HP: 10 }, lose: { MONEY: -120000000, STRESS: 8 } } }
    ] },
  { id: 'x_f07', age: [35, 62], w: 5, text: '你在父亲坟前站了很久。他一辈子没离开过那条巷子，而你走得太远了。',
    choices: [
      { text: '说一句：我过得不错', eff: { WILL: 4, STRESS: -6 }, risk: 1 },
      { text: '说：我会让他们都知道你的名字', eff: { WILL: 8, FAME: 4 }, risk: 2 },
      { text: '什么也不说，把那栋楼的照片烧给他', eff: { WILL: 10, HP: -4, STRESS: -12 }, risk: 3,
        gamble: { p: 0.45, win: { WILL: 12, FAME: 8 }, lose: { HP: -7, STRESS: 10 } } }
    ] },

  /* ===== 도박 / 사기 风险金钱 ===== */
  { id: 'x_g01', age: [24, 55], w: 6, text: '朋友带你去了一间地下赌场。他说：就玩一把，输赢都不超过十万。',
    choices: [
      { text: '转身就走', eff: { WILL: 4, INT: 3 }, risk: 1 },
      { text: '玩一把就走', eff: { MONEY: -2000000, STRESS: 6 }, risk: 2 },
      { text: '越玩越大，直到天亮', eff: { STRESS: 16, WILL: -3 }, flags: ['gambler'], risk: 3,
        gamble: { p: 0.28, win: { MONEY: 280000000 }, lose: { MONEY: -180000000, HP: -8, STRESS: 18 } } }
    ] },
  { id: 'x_g02', age: [26, 55], w: 6, text: '一个「稳赚不赔」的海外项目找上门，年化 30%，合同很厚，印章很红。',
    choices: [
      { text: '不看，直接拉黑', eff: { INT: 5, WILL: 3 }, risk: 1 },
      { text: '投一小笔试试', eff: { MONEY: -20000000, INT: 4 }, risk: 2 },
      { text: '全押，并拉朋友一起', eff: { MONEY: -200000000, NET: 6, STRESS: 16 }, risk: 3,
        gamble: { p: 0.18, win: { MONEY: 900000000 }, lose: { MONEY: -260000000, NET: -20, FAME: -10 } } }
    ] },
  { id: 'x_g03', age: [25, 50], w: 5, text: '大学同学找你做担保人。他说只是走个流程，不会真的要你还。',
    choices: [
      { text: '拒绝，担保就是负债', eff: { INT: 5, NET: -3 }, risk: 1 },
      { text: '只担保一个很小的额度', eff: { MONEY: -10000000, NET: 4 }, risk: 2 },
      { text: '签了，朋友就该这样', eff: { NET: 8, WILL: 4, STRESS: 12 }, flags: ['guarantor'], risk: 3,
        gamble: { p: 0.3, win: { NET: 14, MONEY: 50000000 }, lose: { MONEY: -300000000, NET: -10 } } }
    ] },
  { id: 'x_g04', age: [27, 52], w: 5, text: '急用钱。银行的门关着，街边的「대출 小额贷款」招牌亮着，月息三分。',
    cond: { max: { MONEY: 20000000 } },
    choices: [
      { text: '去找朋友借', eff: { MONEY: 15000000, NET: -4, WILL: 3 }, risk: 1 },
      { text: '找正规银行的小额贷', eff: { MONEY: 20000000, STRESS: 8 }, risk: 2 },
      { text: '借高利贷，先过这关', eff: { MONEY: 40000000, STRESS: 20, WILL: -4 }, flags: ['loan_shark'], risk: 3,
        gamble: { p: 0.3, win: { MONEY: 120000000 }, lose: { MONEY: -90000000, HP: -7, STRESS: 20 } } }
    ] },
  { id: 'x_g05', age: [24, 45], w: 5, text: '共同基金的申购日。销售说这是「国民理财产品」，闭着眼买都不会错。',
    choices: [
      { text: '不买，先看说明书', eff: { INT: 5, WILL: 2 }, risk: 1 },
      { text: '买一点点', eff: { MONEY: -10000000, INT: 2 }, risk: 2 },
      { text: '重仓，反正是「国民」级别', eff: { MONEY: -60000000, STRESS: 10 }, risk: 3,
        gamble: { p: 0.35, win: { MONEY: 180000000 }, lose: { MONEY: -40000000 } } }
    ] },
  { id: 'x_g06', age: [28, 50], w: 5, text: '你发现公司账上有笔说不清的支出。查下去，可能会查到自己人。',
    cond: { min: { INT: 50 } },
    choices: [
      { text: '装作没看见', eff: { WILL: -2, LOY: 6 }, risk: 1 },
      { text: '匿名举报', eff: { FAME: 6, WILL: 4, LOY: -8, STRESS: 8 }, risk: 2 },
      { text: '把材料握在手里，等到需要那天', eff: { INT: 8, WILL: 6, STRESS: 12 }, flags: ['blackmail'], risk: 3,
        gamble: { p: 0.42, win: { MONEY: 400000000, LOY: 12 }, lose: { MONEY: -100000000, FAME: -14, HP: -6 } } }
    ] },

  /* ===== 재벌선 财阀线 ===== */
  { id: 'x_t10', age: [34, 58], w: 7, text: '太星集团的股价异动。你在屏幕上看到那条熟悉的曲线——前世它没有出现在这一天。',
    cond: { need: ['past_life'], min: { MONEY: 300000000 } },
    choices: [
      { text: '不动，看着', eff: { INT: 4, WILL: 2 }, risk: 1 },
      { text: '买入一部分，跟着感觉走', eff: { MONEY: -150000000, INT: 5 }, risk: 2 },
      { text: '满仓买入，这是你等了半辈子的机会', eff: { MONEY: -600000000, WILL: 8, STRESS: 18 }, flags: ['taeseong_stake'], risk: 3,
        gamble: { p: 0.55, win: { MONEY: 3200000000, LOY: 8, INT: 8 }, lose: { MONEY: -300000000, STRESS: 16 } } }
    ] },
  { id: 'x_t11', age: [36, 60], w: 7, text: '会长的长子约你喝酒。他推过来一份文件，说：签了，你就是自己人。',
    cond: { min: { LOY: 25 } },
    choices: [
      { text: '不签，我谁的账都不买', eff: { WILL: 6, LOY: -8, INT: 4 }, risk: 2 },
      { text: '签，先站进去再说', eff: { LOY: 14, NET: 10, MONEY: 80000000, WILL: -3 }, flags: ['side_elder'], risk: 1 },
      { text: '签，但把文件多复印一份', eff: { LOY: 12, INT: 8, NET: 12, STRESS: 12 }, flags: ['side_elder', 'has_copy'], risk: 3,
        gamble: { p: 0.48, win: { LOY: 18, MONEY: 600000000 }, lose: { LOY: -25, FAME: -10, HP: -6 } } }
    ] },
  { id: 'x_t12', age: [38, 62], w: 7, text: '二女儿在美术馆闭馆后见你。她只说了一句：我父亲的位置，不会传给废物。',
    cond: { min: { LOY: 30 } },
    choices: [
      { text: '保持距离', eff: { INT: 4, WILL: 3 }, risk: 1 },
      { text: '表示支持', eff: { LOY: 14, NET: 12, INT: 4 }, flags: ['side_second'], risk: 2 },
      { text: '当场承诺：我会让你坐上那个位置', eff: { LOY: 22, WILL: 10, NET: 14, STRESS: 14 }, flags: ['side_second', 'oath'], risk: 3,
        gamble: { p: 0.5, win: { LOY: 25, MONEY: 900000000, NET: 12 }, lose: { LOY: -20, STRESS: 16 } } }
    ] },
  { id: 'x_t13', age: [40, 64], w: 7, text: '股东大会前夜。你手里有 7.4% 的股份，还差最后一点点，就能改掉这个国家的财阀史。',
    cond: { min: { MONEY: 3000000000 } },
    choices: [
      { text: '收手，把股份卖掉落袋', eff: { MONEY: 800000000, WILL: -4 }, risk: 1 },
      { text: '再买 2%，站到台前', eff: { MONEY: -2000000000, FAME: 20, WILL: 8, LOY: -15 }, flags: ['buying_stake'], risk: 2 },
      { text: '全押，明天之后不再有退路', eff: { MONEY: -6000000000, FAME: 30, WILL: 12, LOY: -25, STRESS: 20 }, flags: ['buying_stake', 'showdown'], risk: 3,
        gamble: { p: 0.42, win: { FAME: 40, MONEY: 3000000000, flags: ['took_over'], job: '太星集团会长' }, lose: { MONEY: -3000000000, LOY: -30, HP: -8 } } }
    ] },
  { id: 'x_t14', age: [40, 65], w: 6, text: '检察官请你喝了一杯茶。他说：我们知道一些事，也想知道一些事。',
    cond: { min: { FAME: 40 } },
    choices: [
      { text: '什么也不说', eff: { WILL: 5, STRESS: 10, LOY: 6 }, risk: 1 },
      { text: '只说别人的', eff: { LOY: -6, NET: -6, WILL: -3, STRESS: 6 }, flags: ['snitch'], risk: 2 },
      { text: '把手里的账本交出去', eff: { FAME: 25, LOY: -40, WILL: 8, STRESS: 16 }, flags: ['whistleblower'], risk: 3,
        gamble: { p: 0.5, win: { FAME: 30, WILL: 10, NET: 10 }, lose: { MONEY: -800000000, HP: -8 } } }
    ] },

  /* ===== 시대 时代 ===== */
  { id: 'x_e01', age: [12, 14], w: 10, once: true, text: '1997년。街头的电视都在放同一条新闻：国家向 IMF 求助。父亲的工厂关门了，母亲把金戒指放进募捐箱。',
    choices: [
      { text: '把零花钱全部交给母亲', eff: { WILL: 6, MONEY: -100000, STRESS: 6 }, risk: 1 },
      { text: '跟着父亲去街头摆摊', eff: { WILL: 8, CHA: 3, MONEY: 800000, STRESS: 10 }, risk: 2 },
      { text: '把家里最后一点钱拿去买美元', eff: { MONEY: -500000, INT: 8, WILL: 6, STRESS: 14 }, flags: ['imf_buyer'], risk: 3,
        gamble: { p: 0.6, win: { MONEY: 12000000, INT: 6 }, lose: { MONEY: -400000, STRESS: 8 } } }
    ] },
  { id: 'x_e02', age: [23, 25], w: 9, once: true, text: '2008년。雷曼兄弟倒下的那个秋天，办公室里没人说话。你的账户每天少掉一个月的工资。',
    choices: [
      { text: '清仓，保住剩下的', eff: { INT: 5, WILL: 3, STRESS: -6 }, risk: 1 },
      { text: '不动，等它过去', eff: { WILL: 6, STRESS: 12 }, risk: 2 },
      { text: '借钱抄底，赌国运', eff: { WILL: 10, STRESS: 20 }, flags: ['bottom_fisher', 'leveraged'], risk: 3,
        gamble: { p: 0.55, win: { MONEY: 700000000, INT: 10 }, lose: { MONEY: -220000000, HP: -8 } } }
    ] },
  { id: 'x_e03', age: [35, 37], w: 9, once: true, text: '2020년。三月，股市熔断两次。四月，所有人都在家里打开证券 App。你的手机也在推送开户广告。',
    choices: [
      { text: '关掉推送，去阳台上透气', eff: { HP: 6, STRESS: -8 }, risk: 1 },
      { text: '小仓位进场', eff: { MONEY: -30000000, INT: 4 }, risk: 2 },
      { text: '满仓，这是十年一次的价钱', eff: { MONEY: -200000000, WILL: 8, STRESS: 18 }, flags: ['bottom_fisher'], risk: 3,
        gamble: { p: 0.55, win: { MONEY: 1200000000, INT: 8 }, lose: { MONEY: -120000000, HP: -7 } } }
    ] },
  { id: 'x_e04', age: [17, 19], w: 8, once: true, text: '2002년 世界杯。整个首尔变成了红色的海，你在光化门前和几十万人一起喊「대한민국」。',
    choices: [
      { text: '喊到嗓子哑，然后回家背书', eff: { WILL: 4, INT: 3, STRESS: -10 }, risk: 1 },
      { text: '跟着人群跑遍整座城市', eff: { CHA: 5, NET: 6, WILL: 4, HP: -3 }, risk: 2 },
      { text: '在街头摆摊卖国旗，赚第一桶金', eff: { MONEY: 1200000, CHA: 4, INT: 4, NET: 3 }, risk: 3,
        gamble: { p: 0.5, win: { MONEY: 5000000, CHA: 5 }, lose: { MONEY: -300000, STRESS: 5 } } }
    ] },
  { id: 'x_e05', age: [27, 29], w: 7, once: true, text: '《江南 Style》火遍全球。全世界的综艺都在跳骑马舞，江南的房价在半年里又涨了一成。',
    choices: [
      { text: '笑一笑，继续上班', eff: { STRESS: -5 }, risk: 1 },
      { text: '买一点娱乐股', eff: { MONEY: -20000000, INT: 4 }, risk: 2 },
      { text: '重仓韩流概念，赌它还能再翻倍', eff: { MONEY: -80000000, WILL: 6, STRESS: 12 }, risk: 3,
        gamble: { p: 0.45, win: { MONEY: 400000000 }, lose: { MONEY: -50000000 } } }
    ] },
  { id: 'x_e06', age: [38, 40], w: 7, once: true, text: 'AI 的时代来了。所有公司都在谈算力，而你手里的钱，第一次变成了「入场券」。',
    cond: { min: { MONEY: 500000000 } },
    choices: [
      { text: '观望，等技术落地', eff: { INT: 5, WILL: 2 }, risk: 1 },
      { text: '买行业龙头', eff: { MONEY: -200000000, INT: 6 }, risk: 2 },
      { text: 'all in，这是最后一场大周期', eff: { MONEY: -800000000, WILL: 10, STRESS: 18 }, flags: ['ai_bet'], risk: 3,
        gamble: { p: 0.45, win: { MONEY: 4000000000, FAME: 15 }, lose: { MONEY: -500000000, HP: -7 } } }
    ] },

  /* ===== 말년 晚年 ===== */
  { id: 'x_o05', age: [58, 72], w: 7, text: '你开始考虑交接。把公司交给职业经理人，还是留给自己的孩子？',
    cond: { min: { MONEY: 3000000000 } },
    choices: [
      { text: '交给职业经理人', eff: { INT: 5, NET: 8, WILL: -2 }, risk: 1 },
      { text: '交给孩子，血脉优先', eff: { WILL: 6, NET: 4, FAME: 4 }, risk: 2 },
      { text: '成立财团，谁也拿不走', eff: { FAME: 15, NET: 10, WILL: 8, MONEY: -500000000 }, flags: ['foundation'], risk: 3,
        gamble: { p: 0.5, win: { FAME: 20, WILL: 10 }, lose: { FAME: -8, MONEY: -1200000000 } } }
    ] },
  { id: 'x_o06', age: [60, 76], w: 6, text: '一个年轻人写信给你，说他在半地下室里读完了你的自传。他问：我还有机会吗？',
    cond: { min: { FAME: 30 } },
    choices: [
      { text: '回一句：有', eff: { WILL: 4, FAME: 3 }, risk: 1 },
      { text: '资助他读完大学', eff: { MONEY: -30000000, WILL: 6, FAME: 6 }, risk: 2 },
      { text: '成立一个资助半地下室孩子的基金', eff: { MONEY: -2000000000, FAME: 20, WILL: 10 }, flags: ['foundation'], risk: 3,
        gamble: { p: 0.5, win: { FAME: 25, WILL: 12 }, lose: { MONEY: -1000000000, STRESS: 8 } } }
    ] },
  { id: 'x_o07', age: [62, 80], w: 6, text: '医生给了你两个选择：手术，或者剩下的时间。',
    choices: [
      { text: '不做手术，回家', eff: { HP: -11, WILL: 6, STRESS: -10 }, risk: 2 },
      { text: '做手术，赌一把', eff: { MONEY: -80000000, HP: 10, STRESS: 10 }, risk: 2 },
      { text: '去国外找最好的医生', eff: { MONEY: -500000000, HP: 20, STRESS: 6 }, risk: 3,
        gamble: { p: 0.45, win: { HP: 28, WILL: 8 }, lose: { MONEY: -300000000, HP: -7 } } }
    ] },
  { id: 'x_o08', age: [65, 80], w: 6, text: '你回到那条巷子。半地下室还在，只是换了人家。门口晒着别人的鞋。',
    choices: [
      { text: '站一会儿就走', eff: { WILL: 3, STRESS: -5 }, risk: 1 },
      { text: '敲开门，和里面的人聊几句', eff: { WILL: 5, CHA: 3, NET: 3, STRESS: -8 }, risk: 2 },
      { text: '买下整条巷子，改成青年公寓', eff: { MONEY: -3000000000, FAME: 20, WILL: 12, NET: 10 }, flags: ['foundation'], risk: 3,
        gamble: { p: 0.5, win: { FAME: 25, WILL: 14 }, lose: { MONEY: -800000000, STRESS: 10 } } }
    ] }
];
EVENTS.push.apply(EVENTS, EVENTS_EXTRA);

/* ---------------- 称号（按人生阶段显示身份） ---------------- */
const TITLES = [
  { min: 0,   max: 6,   name: '갓난아이 婴儿' },
  { min: 7,   max: 12,  name: '초등학생 小学生' },
  { min: 13,  max: 15,  name: '중학생 初中生' },
  { min: 16,  max: 18,  name: '고등학생 高中生' },
  { min: 19,  max: 200, name: '' }
];
