#!/usr/bin/env bash
# poll_goatcounter.sh — GoatCounter 방문자 수 폴링 + lift 계산 + file_parsed 50건 임계 체크
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
#   - file_parsed 이벤트 누적 수 (7일) → 50건 도달 시 experiment_bi trigger
#   - freemium 전환 기준 (30일 200명) 도달 여부
#   - 페이지별 인기 순위
#
# experiment_bi trigger 조건:
#   7일 누적 file_parsed >= 50 → logs/experiment_bi_trigger.json 생성
#   (cost_watch가 이 파일 존재 여부를 확인해 experiment_bi 팀 enqueue)

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

# ── file_parsed 이벤트 누적 수 (7일) ──────────────────────────────────────
# GoatCounter 이벤트는 path=/event/file_parsed 로 추적됨
FILE_PARSED_THRESHOLD=50
FILE_PARSED_TRIGGER="$REPO_ROOT/logs/experiment_bi_trigger.json"

echo ""
echo "📈 file_parsed 이벤트 (7일 누적)"

# 페이지별 통계에서 /event/file_parsed 추출
HITS_RAW=$(curl -s -f \
  -H "Authorization: Bearer $TOKEN" \
  "$API_BASE/stats/hits?start=$DAY7&end=$TODAY&limit=100" 2>/dev/null || echo '{"hits":[]}')

FILE_PARSED_COUNT=$(echo "$HITS_RAW" | python3 -c "
import sys, json
d = json.load(sys.stdin)
hits = d.get('hits', [])
count = sum(h.get('count', 0) for h in hits if h.get('path','') == '/event/file_parsed')
print(count)
" 2>/dev/null || echo 0)

echo "  file_parsed 7일: $FILE_PARSED_COUNT 건 (임계: $FILE_PARSED_THRESHOLD)"

# experiment_bi trigger 판정
if [ "$FILE_PARSED_COUNT" -ge "$FILE_PARSED_THRESHOLD" ]; then
  echo ""
  echo "🎯 file_parsed 임계 달성! ($FILE_PARSED_COUNT ≥ $FILE_PARSED_THRESHOLD)"
  echo "   → experiment_bi trigger 파일 생성"
  mkdir -p "$REPO_ROOT/logs"
  python3 - << PYEOF
import json
data = {
    "trigger": "experiment_bi",
    "reason": "file_parsed_7d_ge_50",
    "file_parsed_7d": $FILE_PARSED_COUNT,
    "threshold": $FILE_PARSED_THRESHOLD,
    "triggered_at": "$TODAY",
    "action": "funnel 분석 재실행 (upload→parse→copy→donation 전환율) → experiment_bi 승자 판정"
}
with open("$FILE_PARSED_TRIGGER", "w") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print("  trigger 파일: $FILE_PARSED_TRIGGER")
PYEOF
else
  REMAINING=$((FILE_PARSED_THRESHOLD - FILE_PARSED_COUNT))
  echo "  experiment_bi 까지: ${REMAINING}건 남음"
  # 이미 trigger 된 적 있으면 유지 (재생성 X)
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
import json
data = {
    "date": "$TODAY",
    "visitors_7d": $VISITORS_7,
    "visitors_30d": $VISITORS_30,
    "file_parsed_7d": $FILE_PARSED_COUNT,
    "file_parsed_threshold": $FILE_PARSED_THRESHOLD,
    "experiment_bi_triggered": $FILE_PARSED_COUNT >= $FILE_PARSED_THRESHOLD,
    "freemium_threshold": $THRESHOLD,
    "freemium_ready": $VISITORS_30 >= $THRESHOLD
}
with open("$LOG_FILE", "w") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print(f"  로그 저장: $LOG_FILE")
PYEOF
