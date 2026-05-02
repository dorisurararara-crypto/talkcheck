#!/usr/bin/env bash
# poll_goatcounter.sh — GoatCounter 방문자 수 폴링 + lift 계산
#
# 사용법:
#   ./scripts/poll_goatcounter.sh
#
# 사전 조건:
#   secrets/goatcounter.token 에 API 토큰 저장 필요
#   토큰 발급: https://talkcheck.goatcounter.com/user/api → "Create token"
#
# 출력:
#   - 오늘/7일/30일 방문자 수
#   - freemium 전환 기준 (30일 200명) 도달 여부
#   - 페이지별 인기 순위

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TOKEN_FILE="$REPO_ROOT/secrets/goatcounter.token"
API_BASE="https://talkcheck.goatcounter.com/api/v0"

# 토큰 체크
if [ ! -f "$TOKEN_FILE" ]; then
  echo "❌ 토큰 없음: $TOKEN_FILE"
  echo "   GoatCounter → https://talkcheck.goatcounter.com/user/api → Create token"
  echo "   생성 후: echo '<token>' > $TOKEN_FILE && chmod 600 $TOKEN_FILE"
  exit 1
fi

TOKEN="$(cat "$TOKEN_FILE" | tr -d '[:space:]')"
TODAY="$(date +%Y-%m-%d)"
DAY7="$(date -v-7d +%Y-%m-%d 2>/dev/null || date -d '7 days ago' +%Y-%m-%d)"
DAY30="$(date -v-30d +%Y-%m-%d 2>/dev/null || date -d '30 days ago' +%Y-%m-%d)"

echo "▶ TalkCheck GoatCounter 폴링 ($TODAY)"

# 30일 통계
STATS_30=$(curl -s -f \
  -H "Authorization: Bearer $TOKEN" \
  "$API_BASE/stats/total?start=$DAY30&end=$TODAY" 2>/dev/null || echo '{"total":0}')

VISITORS_30=$(echo "$STATS_30" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('total',0))" 2>/dev/null || echo 0)

# 7일 통계
STATS_7=$(curl -s -f \
  -H "Authorization: Bearer $TOKEN" \
  "$API_BASE/stats/total?start=$DAY7&end=$TODAY" 2>/dev/null || echo '{"total":0}')

VISITORS_7=$(echo "$STATS_7" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('total',0))" 2>/dev/null || echo 0)

echo ""
echo "📊 방문자 집계"
echo "  7일:  $VISITORS_7 명"
echo "  30일: $VISITORS_30 명"

# freemium 전환 기준 판단
THRESHOLD=200
if [ "$VISITORS_30" -ge "$THRESHOLD" ]; then
  echo ""
  echo "🎉 freemium 전환 기준 달성! (30일 $VISITORS_30 ≥ $THRESHOLD)"
  echo "   → pricing_growth 팀 freemium 설계 착수 권고"
else
  REMAINING=$((THRESHOLD - VISITORS_30))
  echo "  freemium 전환까지: ${REMAINING}명 남음 (목표 30일 200명)"
fi

# 페이지별 통계 (상위 5)
echo ""
echo "📄 페이지별 인기 (30일)"
PAGE_STATS=$(curl -s -f \
  -H "Authorization: Bearer $TOKEN" \
  "$API_BASE/stats/hits?start=$DAY30&end=$TODAY&limit=5" 2>/dev/null || echo '{"hits":[]}')

echo "$PAGE_STATS" | python3 - << 'PYEOF'
import sys, json
d = json.load(sys.stdin)
hits = d.get("hits", [])
for i, h in enumerate(hits[:5], 1):
    path = h.get("path", "-")
    count = h.get("count", 0)
    print(f"  {i}. {path}  — {count}회")
if not hits:
    print("  (데이터 없음)")
PYEOF

# 결과 로그 저장
LOG_FILE="$REPO_ROOT/logs/goatcounter_$(date +%Y%m%d).json"
mkdir -p "$REPO_ROOT/logs"
python3 - << PYEOF
import json, datetime
data = {
    "date": "$TODAY",
    "visitors_7d": $VISITORS_7,
    "visitors_30d": $VISITORS_30,
    "freemium_threshold": $THRESHOLD,
    "freemium_ready": $VISITORS_30 >= $THRESHOLD
}
with open("$LOG_FILE", "w") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print(f"  로그 저장: $LOG_FILE")
PYEOF
