/* =========================================================
 * cangame v2 · resource.js
 * 资源统一流转：所有加减走 transferResource()，杜绝「幽灵资源」。
 * 依赖：state.js（pushLog 可选）。
 * 加载顺序：factions.js → resource.js。
 * ========================================================= */

var RESOURCE_KEYS = ['life', 'goods', 'won', 'militaryFund'];

// 对单个阵营增减资源。delta = { life, goods, won, militaryFund }（可缺省）。
// 防幽灵资源：任一资源不会低于 0；返回实际生效的 delta（用于日志/事件）。
function transferResource(faction, delta) {
  delta = delta || {};
  var applied = {};
  RESOURCE_KEYS.forEach(function (k) {
    var d = Number(delta[k]) || 0;
    var before = Number(faction[k]) || 0;
    var after = before + d;
    var actual = d;
    if (after < 0) { after = 0; actual = -before; } // 不允许负资源：实际只扣到 0
    faction[k] = after;
    applied[k] = actual;
  });
  return applied;
}

// 别名（任务约定的函数名）。
function transfer(faction, delta) { return transferResource(faction, delta); }

// 是否买得起某笔成本（不修改状态，仅校验）。
function canAfford(faction, cost) {
  cost = cost || {};
  return RESOURCE_KEYS.every(function (k) {
    var c = Number(cost[k]) || 0;
    if (c <= 0) return true;
    return (Number(faction[k]) || 0) >= c;
  });
}

if (typeof globalThis !== 'undefined') {
  globalThis.transferResource = transferResource;
  globalThis.transfer = transfer;
  globalThis.canAfford = canAfford;
  globalThis.RESOURCE_KEYS = RESOURCE_KEYS;
}
