#!/usr/bin/env bash
# setup_goatcounter_token.sh — GoatCounter API 토큰을 GitHub Actions secret 에 등록
#
# 사용법:
#   ./scripts/setup_goatcounter_token.sh <token>
#   예시: ./scripts/setup_goatcounter_token.sh gc_xxxxxxxxxxxxxxxx
#
# GoatCounter 토큰 발급 (사람 본인만 가능):
#   1. https://talkcheck.goatcounter.com/user/api 로그인
#   2. "Create token" → 이름: experiment_bi → 권한: read-only
#   3. 발급된 토큰을 이 스크립트 인자로 전달
#
# 효과:
#   - GitHub repo secret GOATCOUNTER_TOKEN 등록 (gh CLI 사용)
#   - experiment_bi.yml cron 워크플로우 즉시 활성화
#   - 로컬 secrets/goatcounter.token 도 저장 (poll_goatcounter.sh 용)
#
# 주의: 토큰은 git push 금지. secrets/ 는 .gitignore 처리됨.

set -euo pipefail

REPO="dorisurararara-crypto/talkcheck"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TOKEN_FILE="$REPO_ROOT/secrets/goatcounter.token"

if [ $# -lt 1 ]; then
  echo "사용법: $0 <goatcounter-token>"
  echo "예시:   $0 gc_xxxxxxxxxxxxxxxx"
  exit 1
fi

TOKEN="$1"

# 기본 검증
if [[ ! "$TOKEN" =~ ^[A-Za-z0-9_-]{10,} ]]; then
  echo "❌ 토큰 형식 이상. GoatCounter 토큰은 보통 gc_ 로 시작합니다."
  exit 1
fi

# GoatCounter API 연결 확인
echo "▶ GoatCounter API 연결 확인..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  "https://talkcheck.goatcounter.com/api/v0/me" 2>/dev/null || echo "000")

if [ "$STATUS" != "200" ]; then
  echo "❌ GoatCounter API 인증 실패 (HTTP $STATUS). 토큰 확인 바랍니다."
  exit 1
fi
echo "   ✓ GoatCounter API 인증 성공"

# GitHub Actions secret 등록
echo "▶ GitHub Actions secret 등록 ($REPO)..."
if command -v gh &>/dev/null; then
  echo "$TOKEN" | gh secret set GOATCOUNTER_TOKEN --repo "$REPO" --body -
  echo "   ✓ GOATCOUNTER_TOKEN secret 등록 완료"
else
  echo "   ⚠ gh CLI 없음. 수동으로 등록 필요:"
  echo "   https://github.com/$REPO/settings/secrets/actions → New secret"
  echo "   Name: GOATCOUNTER_TOKEN / Value: $TOKEN"
fi

# 로컬 token 파일 저장 (poll_goatcounter.sh 용)
mkdir -p "$REPO_ROOT/secrets"
printf '%s' "$TOKEN" > "$TOKEN_FILE"
chmod 600 "$TOKEN_FILE"
echo "   ✓ 로컬 저장: $TOKEN_FILE (chmod 600)"

# experiment_bi 워크플로우 수동 실행 (즉시 확인)
echo ""
echo "▶ experiment_bi 워크플로우 즉시 실행 (데이터 확인)..."
if command -v gh &>/dev/null; then
  gh workflow run experiment_bi.yml --repo "$REPO" && \
    echo "   ✓ 실행 요청 완료 — https://github.com/$REPO/actions 에서 확인" || \
    echo "   ⚠ 워크플로우 실행 실패 (권한/브랜치 확인)"
else
  echo "   gh CLI 없음 — 수동 실행: https://github.com/$REPO/actions → experiment_bi → Run workflow"
fi

echo ""
echo "✅ 완료."
echo "   cron: 매일 09:00 KST 자동 실행"
echo "   수동: gh workflow run experiment_bi.yml --repo $REPO"
