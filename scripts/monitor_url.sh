#!/usr/bin/env bash
# monitor_url.sh — GitHub Pages URL 접근성 체크
# cron: */30 * * * * 또는 launchd로 30분마다

set -euo pipefail

URL="https://dorisurararara-crypto.github.io/talkcheck/"
LOG_DIR="$(dirname "$0")/../logs"
LOG_FILE="$LOG_DIR/url_monitor.log"
MAX_LINES=500

mkdir -p "$LOG_DIR"

TS=$(date '+%Y-%m-%dT%H:%M:%S')
HTTP_CODE=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 15 "$URL" 2>&1 || echo "ERR")

if [ "$HTTP_CODE" = "200" ]; then
  echo "[$TS] OK 200 $URL" >> "$LOG_FILE"
else
  echo "[$TS] FAIL $HTTP_CODE $URL" >> "$LOG_FILE"
  # Telegram 알림 (openclaw notify 있을 경우)
  if command -v python3 &>/dev/null; then
    python3 -c "
import sys; sys.path.insert(0,'$HOME/openclaw')
try:
    from orchestrator import notify
    notify.send('🔴 talkcheck URL 다운 — HTTP $HTTP_CODE', level='warn')
except Exception as e:
    print(f'notify fail: {e}', file=sys.stderr)
" 2>/dev/null || true
  fi
fi

# 로그 길이 제한 (최근 MAX_LINES 줄만 보존)
if [ -f "$LOG_FILE" ]; then
  LINES=$(wc -l < "$LOG_FILE")
  if [ "$LINES" -gt "$MAX_LINES" ]; then
    tail -n "$MAX_LINES" "$LOG_FILE" > "${LOG_FILE}.tmp" && mv "${LOG_FILE}.tmp" "$LOG_FILE"
  fi
fi

exit 0
