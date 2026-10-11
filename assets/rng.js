/* =========================================================
 * cangame v2 · rng.js
 * 种子化 RNG（确定性）：所有随机走 makeRNG(seed)，
 * 同一 seed → 同一序列，便于测试复现与对局重放。
 * 加载顺序：config.js 之后（仅依赖 Math）。
 * ========================================================= */

// mulberry32：32 位种子，快速、确定、无依赖。
function makeRNG(seed) {
  var a = (seed >>> 0) || 1;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 闭区间整数抽样：min..max（含端点），确定性。
// 对应 §3.3：out = baseMin + floor(rng()*(baseMax-baseMin+1))
function randInt(rng, min, max) {
  if (max < min) { var tmp = min; min = max; max = tmp; }
  return min + Math.floor(rng() * (max - min + 1));
}

// 基于 rng 的 Fisher–Yates 原地洗牌（确定性，给定 rng 同结果）。
function shuffle(rng, arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(rng() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

if (typeof globalThis !== 'undefined') {
  globalThis.makeRNG = makeRNG;
  globalThis.randInt = randInt;
  globalThis.shuffle = shuffle;
}
