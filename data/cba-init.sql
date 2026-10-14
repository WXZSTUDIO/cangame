-- cangame v3.5 · CBA 初始化脚本（由 tools/gen-cba-data.js 从 assets/cba-data.js 派生，勿手改）
-- 赛季口径：2009-10。1 级 = 当季 CBA 真实参赛队（含冠名）；2 级 = 真实次级队名（TODO 未对齐 09-10）。
-- 队名真实可核实；球员为占位数据(todo_verify=1)，须人工核对后启用。

CREATE TABLE IF NOT EXISTS cba_team (
  id         VARCHAR(32) PRIMARY KEY,
  league_id  VARCHAR(8)  NOT NULL COMMENT 'L1 / L2a / L2b',
  tier       TINYINT     NOT NULL COMMENT '1=一级 2=二级',
  city       VARCHAR(32) NOT NULL,
  nick       VARCHAR(32) NOT NULL,
  name       VARCHAR(64) NOT NULL,
  todo_verify TINYINT(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cba_player (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(64)                 COMMENT '球员名：占位生成，TODO 人工核对',
  team_id      VARCHAR(32)                 COMMENT '球队：外键 → cba_team.id',
  season       INT                         COMMENT '赛季：起始 2000',
  pos          ENUM('PG','SG','SF','PF','C')COMMENT '位置',
  height       SMALLINT                    COMMENT '身高(cm)：genPlayer 按位置区间',
  weight       SMALLINT                    COMMENT '体重(kg)：height*(0.44~0.52)',
  birthday     DATE                        COMMENT '生日：按年龄反推',
  age          TINYINT                     COMMENT '年龄',
  overall      TINYINT                     COMMENT '综合',
  potential    TINYINT                     COMMENT '潜力：overall + 0~16（≤22岁 +6）',
  salary       INT                         COMMENT '工资',
  iq           TINYINT                     COMMENT '意识：a.IQ',
  is_rookie    TINYINT(1)                  COMMENT '新秀：ROOKIE_AGE 判定',
  is_fa        TINYINT(1)                  COMMENT '自由球员',
  todo_verify  TINYINT(1)                  COMMENT '待人工核对：占位数据恒为 1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 球队种子数据（42 队）
INSERT INTO cba_team (id, league_id, tier, city, nick, name, todo_verify) VALUES
  ('L101','L1',1,'广东','东莞银行','广东东莞银行',0),
  ('L102','L1',1,'新疆','广汇汽车','新疆广汇汽车',0),
  ('L103','L1',1,'上海','玛吉斯','上海玛吉斯',0),
  ('L104','L1',1,'江苏','德玛斯特','江苏德玛斯特',0),
  ('L105','L1',1,'八一','双鹿电池','八一双鹿电池',0),
  ('L106','L1',1,'北京','金隅','北京金隅',0),
  ('L107','L1',1,'辽宁','盼盼','辽宁盼盼',0),
  ('L108','L1',1,'山东','黄金','山东黄金',0),
  ('L109','L1',1,'浙江','广厦建设','浙江广厦建设',0),
  ('L110','L1',1,'福建','浔兴','福建浔兴',0),
  ('L111','L1',1,'东莞','马可波罗','东莞马可波罗',0),
  ('L112','L1',1,'山西','汾酒','山西汾酒',0),
  ('L113','L1',1,'吉林','东北虎','吉林东北虎',0),
  ('L114','L1',1,'浙江','稠州银行','浙江稠州银行',0),
  ('L2a01','L2a',2,'石家庄','翔蓝','石家庄翔蓝',0),
  ('L2a02','L2a',2,'合肥','狂风','合肥狂风',0),
  ('L2a03','L2a',2,'长沙','勇胜','长沙勇胜',0),
  ('L2a04','L2a',2,'武汉','锟鹏','武汉锟鹏',0),
  ('L2a05','L2a',2,'广西','威壮','广西威壮',0),
  ('L2a06','L2a',2,'陕西','信达','陕西信达',0),
  ('L2a07','L2a',2,'安徽','文一','安徽文一',0),
  ('L2a08','L2a',2,'河南','赊店老酒','河南赊店老酒',0),
  ('L2a09','L2a',2,'贵州','森航','贵州森航',0),
  ('L2a10','L2a',2,'重庆','华熙','重庆华熙',0),
  ('L2a11','L2a',2,'佛山','功夫小子','佛山功夫小子',0),
  ('L2a12','L2a',2,'东莞','麻涌','东莞麻涌',0),
  ('L2a13','L2a',2,'拉萨','净土','拉萨净土',0),
  ('L2a14','L2a',2,'江苏','国立','江苏国立',0),
  ('L2b01','L2b',2,'江西','鑫业','江西鑫业',0),
  ('L2b02','L2b',2,'河北','翔蓝','河北翔蓝',0),
  ('L2b03','L2b',2,'山西','国投','山西国投',0),
  ('L2b04','L2b',2,'宁夏','哈纳斯','宁夏哈纳斯',0),
  ('L2b05','L2b',2,'天津','雄狮','天津雄狮',0),
  ('L2b06','L2b',2,'北京','东方雄鹿','北京东方雄鹿',0),
  ('L2b07','L2b',2,'香港','飞龙','香港飞龙',0),
  ('L2b08','L2b',2,'云南','红河','云南红河',0),
  ('L2b09','L2b',2,'四川','金强','四川金强',0),
  ('L2b10','L2b',2,'广州','龙狮','广州龙狮',0),
  ('L2b11','L2b',2,'青岛','双星','青岛双星',0),
  ('L2b12','L2b',2,'浙江','广厦','浙江广厦',0),
  ('L2b13','L2b',2,'江苏','同曦','江苏同曦',0),
  ('L2b14','L2b',2,'深圳','马可波罗','深圳马可波罗',0);

-- 备用：09-10 赛季真实参赛队中因 1 级槽位仅 14 而未启用的 3 支
-- （扩容到 17 队时取消注释即可；注意「青岛双星」与 2 级现有队名冲突，需先改名或移除）
--   天津荣钢  09-10 赛季真实参赛队，1级槽位不足暂未启用
--   青岛双星  09-10 赛季真实参赛队，1级槽位不足暂未启用
--   陕西锂源动力  09-10 赛季真实参赛队，1级槽位不足暂未启用

-- 球员：本版不灌入真实名单（AI 无法准确编造 2000-2025 逐季名单）。
-- 真实名单补录后按 cba_player 字段插入，并把 todo_verify 置 0；
-- 未补录前由前端 genPlayer 程序化生成，落库时保持 todo_verify=1。
-- 导入后自检：SELECT league_id, COUNT(*) FROM cba_team GROUP BY league_id;  -- 期望 L1=14 / L2a=14 / L2b=14
