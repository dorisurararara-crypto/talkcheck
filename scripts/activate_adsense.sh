#!/usr/bin/env bash
# activate_adsense.sh — AdSense 승인 후 pub ID 실 ID로 교체 + 커밋 + 푸시
#
# 사용법:
#   ./scripts/activate_adsense.sh <pub-ID> <ad-slot>
#   예시: ./scripts/activate_adsense.sh pub-1234567890123456 9876543210
#
# AdSense 가입 절차 (사람 본인만 가능):
#   1. https://adsense.google.com/start/ → dorisurararara@gmail.com 로그인
#   2. 사이트 URL: https://dorisurararara-crypto.github.io/talkcheck/
#   3. 승인 이메일 수신 (보통 1-14일) → pub-ID / ad-slot 확인
#   4. 이 스크립트 실행

set -euo pipefail

if [ $# -lt 2 ]; then
  echo "사용법: $0 <pub-ID> <ad-slot>"
  echo "예시:   $0 pub-1234567890123456 9876543210"
  exit 1
fi

PUB_ID="$1"
AD_SLOT="$2"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "▶ ads.txt 업데이트 ($PUB_ID)"
cat > "$REPO_ROOT/ads.txt" << EOF
google.com, ${PUB_ID}, DIRECT, f08c47fec0942fa0
EOF

echo "▶ index.html AdSense 스크립트 활성화"
# 1) head 안 AdSense script 주석 해제 + ca-pub-PLACEHOLDER → 실 pub ID 교체
sed -i '' \
  "s|<!-- <script async src=\"https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-PLACEHOLDER\".*-->|<script async src=\"https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${PUB_ID}\" crossorigin=\"anonymous\"></script>|g" \
  "$REPO_ROOT/index.html"

# 2) footer 광고 블록 주석 해제 + pub ID / slot 교체 (ca-pub-PLACEHOLDER, SLOT-PLACEHOLDER → 실 값)
python3 - << PYEOF
import re, pathlib

path = pathlib.Path("${REPO_ROOT}/index.html")
html = path.read_text()

# footer-ads 블록 내 주석 해제 및 ID 교체
old_block = r'<!-- AdSense 승인 후 activate_adsense\.sh 실행 시 자동 활성화\s*\n\s*(<ins[\s\S]*?</ins>)\s*\n\s*-->'
match = re.search(old_block, html)
if match:
    ins_tag = match.group(1)
    ins_tag = ins_tag.replace('ca-pub-PLACEHOLDER', '${PUB_ID}')
    ins_tag = ins_tag.replace('SLOT-PLACEHOLDER', '${AD_SLOT}')
    invoke_js = '(adsbygoogle = window.adsbygoogle || []).push({});'
    html = html.replace(match.group(0), ins_tag + '\n      <script>' + invoke_js + '</script>')

# '광고 준비 중' 텍스트 제거
html = html.replace('      광고 준비 중\n', '')

path.write_text(html)
print('index.html 업데이트 완료')
PYEOF

echo "▶ git 커밋 + 푸시"
cd "$REPO_ROOT"
git add ads.txt index.html
git commit -m "feat(adsense): AdSense 활성화 — ${PUB_ID} pub ID 교체"
git push origin main

echo ""
echo "✅ 완료. GitHub Actions 배포 대기 (~2분)."
echo "   확인: https://dorisurararara-crypto.github.io/talkcheck/ads.txt"
