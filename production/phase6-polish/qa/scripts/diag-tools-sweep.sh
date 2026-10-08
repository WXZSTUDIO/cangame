#!/usr/bin/env bash
# tools/ 全套 flaky 普查（quality-lead）
# 沙箱下 Node 里 spawnSync 会 EBUSY（engineering-lead 也踩过），所以改由 bash 串行跑。
# 用法：ROUNDS=20 bash diag-tools-sweep.sh   →  out/tools-flake-sweep.txt
cd "/c/Users/ro3ea/WorkBuddy/作品集/cangame" || exit 1
NODE="C:/Users/ro3ea/.workbuddy/binaries/node/versions/22.22.2-3/node.exe"
ROUNDS="${ROUNDS:-20}"
CASES="_verify-v52.js _verify-v53.js _verify-v54.js _verify-v55.js v5-test.js"
TMP="production/phase6-polish/qa/scripts/out/.sweep.tmp"
OUT="production/phase6-polish/qa/scripts/out/tools-flake-sweep.txt"
: > "$TMP"

echo "================ tools/ flaky 普查 · ${ROUNDS} 轮 ================" | tee "$OUT"
echo "" | tee -a "$OUT"

for f in $CASES; do
  bad=0
  for i in $(seq 1 "$ROUNDS"); do
    o=$("$NODE" "tools/$f" 2>&1)
    [ $? -ne 0 ] && bad=$((bad+1))
    printf '%s\n' "$o" | grep '✗' | sed "s|^|${f} :: |" >> "$TMP"
  done
  echo "退出码非 0：${f}  ${bad}/${ROUNDS}" | tee -a "$OUT"
done

echo "" | tee -a "$OUT"
echo "出现失败的断言（次数 / ${ROUNDS} 轮，按次数降序）：" | tee -a "$OUT"
if [ -s "$TMP" ]; then
  sed 's/[[:space:]]\{2,\}/ | /' "$TMP" \
    | sort | uniq -c | sort -rn \
    | awk -v r="$ROUNDS" '{n=$1; $1=""; printf "  %3d%%  %s/%s%s\n", (n*100)/r, n, r, $0}' \
    | tee -a "$OUT"
else
  echo "  （无 —— ${ROUNDS} 轮全绿）" | tee -a "$OUT"
fi

echo "" | tee -a "$OUT"
echo "原始 ✗ 明细（去重前共 $(wc -l < "$TMP") 行）已合并统计如上" | tee -a "$OUT"
rm -f "$TMP"
