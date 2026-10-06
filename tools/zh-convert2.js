/* 第二轮：清掉「韩文 中文」双写里的韩文部分，以及剩下的韩语专名 */
const fs = require('fs');
const path = require('path');

const FILES = ['assets/data.js', 'assets/market.js', 'assets/engine.js', 'assets/ui.js',
               'assets/school.js', 'assets/career.js', 'assets/love.js', 'assets/loan.js', 'index.html'];

const HANGUL = '[\uac00-\ud7af\u3130-\u318f]';
const HAN = '[一-鿿]';

const EXTRA = [
  ['市中心 역습', ''],
  ['韩文输入法', '中文输入法'],
  ['학부모 직업', '家长职业'],
  ['나의 꿈 我的梦想', '我的梦想'],
  ['주식투자 입문', '股票投资入门'],
  ['근면·자조·협동', '勤劳 · 自强'],
  ['대한민국', '中国'],
  ['명예퇴직', '优化'],
  ['반지하에서 강남까지', '从城中村到江景房'],
  ['개천에서 용 난 사나이', '从泥沟里飞出的龙'],
  ['자본론', '资本论'],
  ['아리랑엔터', '星光娱乐'],
  ['미래의 집', '房产直觉'],
  ['불타는 야망', '燃烧的野心'],
  ['전생의 기억', '前世记忆'],
  ['수학천재', '数学天才'],
  ['철강체력', '钢铁体魄'],
  ['얼굴천재', '天生丽质'],
  ['불굴의 의지', '不屈意志'],
  ['아버지의 유산', '父亲的遗物'],
  ['천재 프로그래머', '编程天才'],
  ['언변의 달인', '辩才无碍'],
  ['주식 귀재', '股神直觉'],
  ['건강염려증', '养生达人'],
  ['운빨', '锦鲤附体'],
  ['성실', '勤勉'],
  ['절대음감', '绝对音感'],
  ['이중국적', '双重国籍'],
  ['평발', '扁平足'],
  ['빚더미', '负债之子'],
  ['외모 콤플렉스', '外貌自卑'],
  ['허약체질', '病弱'],
  ['시골 출신', '乡下出身'],
  ['다혈질', '暴脾气'],
  ['인맥世家', '人脉世家'],
  ['승진 晋升', '晋升'],
  ['강등 降职', '降职'],
  ['해고 失业', '失业'],
  ['才能正式工作', '岁才能正式工作']
];

FILES.forEach(f => {
  const p = path.join(__dirname, '..', f);
  if (!fs.existsSync(p)) return;
  let src = fs.readFileSync(p, 'utf8');

  EXTRA.forEach(([a, b]) => { src = src.split(a).join(b); });

  // 删除紧跟在中文前的「韩文（+空格）」
  src = src.replace(new RegExp(HANGUL + '+(?:\\s*' + HANGUL + '+)*\\s*(?=' + HAN + ')', 'g'), '');
  // 删除紧跟在中文后的「（空格+）韩文」
  src = src.replace(new RegExp('(?<=' + HAN + ')\\s+' + HANGUL + '+(?:\\s*' + HANGUL + '+)*', 'g'), '');
  // 剩下的孤立韩文串
  src = src.replace(new RegExp(HANGUL + '+(?:\\s*' + HANGUL + '+)*', 'g'), '');

  // 清理多余空格（不动缩进）
  src = src.replace(/([^\s]) {2,}([^\s])/g, '$1 $2');
  src = src.replace(/ 岁/g, '岁').replace(/ 年/g, ' 年');
  src = src.replace(/(\d) 岁/g, '$1岁');
  fs.writeFileSync(p, src, 'utf8');
  console.log(f + ' done');
});
console.log('round2 done');
