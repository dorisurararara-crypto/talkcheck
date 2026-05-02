#!/usr/bin/env bash
# check_feedback_v011.sh — GitHub Issues "user-feedback" 레이블 카운트 체크
# v0.1.1 백로그 개시 임계: 10건 이상
#
# 요구사항: gh CLI (GitHub CLI) 로그인 상태
# 사용법: ./scripts/check_feedback_v011.sh

set -euo pipefail

REPO="dorisurararara-crypto/talkcheck"
THRESHOLD=10
LOG_DIR="$(dirname "$0")/../logs"
LOG_FILE="$LOG_DIR/feedback_counter.log"
STATE_FILE="$LOG_DIR/.v011_triggered"

mkdir -p "$LOG_DIR"

TS=$(date '+%Y-%m-%dT%H:%M:%S')

# GitHub Issues "user-feedback" 레이블 카운트
COUNT=$(gh issue list --repo "$REPO" --label "user-feedback" --state all --json number --jq length 2>/dev/null || echo "0")

echo "[$TS] user-feedback 이슈 수: ${COUNT}/${THRESHOLD}" >> "$LOG_FILE"

if [ "$COUNT" -ge "$THRESHOLD" ] && [ ! -f "$STATE_FILE" ]; then
  echo "[$TS] 임계 도달 → v0.1.1 개시 트리거" >> "$LOG_FILE"
  touch "$STATE_FILE"

  # openclaw에 v0.1.1 사이클 enqueue (있는 경우)
  python3 -c "
import sys; sys.path.insert(0,'$HOME/openclaw')
try:
    from orchestrator.runner import enqueue
    from orchestrator.db import connect
    with connect() as c:
        app = c.execute('SELECT id FROM apps WHERE slug=\"talkcheck\"').fetchone()
    if app:
        tid = enqueue('code_builder', app_id=app['id'],
            brief='talkcheck v0.1.1: MULTILINE-005 파서 멀티라인 보강 + TIMESTAMP-EQ-007 타이브레이커 + A11Y-008 aria 속성 추가 + TEST-MISSING-009 엣지케이스 테스트 작성. 사용자 피드백 ${COUNT}건 임계 도달.')
        print(f'enqueued code_builder: {tid}')
    else:
        print('talkcheck app not found in DB')
except Exception as e:
    print(f'enqueue fail: {e}', file=sys.stderr)
" || true

  # Telegram 알림
  python3 -c "
import sys; sys.path.insert(0,'$HOME/openclaw')
try:
    from orchestrator import notify
    notify.send('📋 talkcheck v0.1.1 개시 — 사용자 피드백 ${COUNT}건 임계 도달', level='info')
except Exception as e:
    print(f'notify fail: {e}', file=sys.stderr)
" 2>/dev/null || true

  echo "v0.1.1 개시 트리거 완료 (feedback count: ${COUNT})"
else
  echo "현재 피드백 ${COUNT}건 / 임계 ${THRESHOLD}건 ($(( THRESHOLD - COUNT ))건 더 필요)"
fi
