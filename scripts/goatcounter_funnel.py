#!/usr/bin/env python3
"""
goatcounter_funnel.py — D+7 퍼널 데이터 추출 + upload_rate 계산

사용법:
  python3 scripts/goatcounter_funnel.py
  python3 scripts/goatcounter_funnel.py --start 2026-05-02 --end 2026-05-09

사전 조건:
  secrets/goatcounter.token 에 API 토큰 저장 필요
  토큰 발급: https://talkcheck.goatcounter.com/user/api → "Create token"

퍼널 3단계:
  1. landing_view   — 메인 페이지 방문 (GoatCounter 기본 pageview: /)
  2. file_parsed    — 파일 업로드 + 파싱 성공 (/event/file_parsed)
  3. result_shown   — 결과 화면 도달 (/event/result_shown)

게이트 판정:
  upload_rate  = file_parsed / landing_view * 100
  result_rate  = result_shown / file_parsed * 100
  PASS: upload_rate >= 30 AND result_rate >= 50
  FAIL: 한 개라도 미달 → UX 개선 사이클 즉시 트리거

부가 지표:
  toss_cta_click_rate = toss_cta_click / result_shown * 100 (목표 >= 3%)
  result_copied_rate  = result_copied / result_shown * 100
"""

import argparse
import json
import os
import sys
import urllib.request
import urllib.error
from datetime import date, timedelta
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
TOKEN_FILE = REPO_ROOT / "secrets" / "goatcounter.token"
API_BASE = "https://talkcheck.goatcounter.com/api/v0"
LOGS_DIR = REPO_ROOT / "logs"

UPLOAD_RATE_PASS = 30   # %
RESULT_RATE_PASS = 50   # %
TOSS_CTR_WARN    = 3    # %


def load_token() -> str:
    if not TOKEN_FILE.exists():
        sys.exit(
            f"❌ 토큰 없음: {TOKEN_FILE}\n"
            "   GoatCounter → https://talkcheck.goatcounter.com/user/api → Create token\n"
            f"   생성 후: echo '<token>' > {TOKEN_FILE} && chmod 600 {TOKEN_FILE}"
        )
    return TOKEN_FILE.read_text().strip()


def gc_get(token: str, path: str) -> dict:
    url = f"{API_BASE}{path}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        sys.exit(f"❌ GoatCounter API 오류 {e.code}: {body[:200]}")
    except urllib.error.URLError as e:
        sys.exit(f"❌ 네트워크 오류: {e.reason}")


def get_pageviews(token: str, start: str, end: str) -> int:
    """메인 페이지(/) 방문 수 — stats/hits에서 path='/' 항목 합산"""
    data = gc_get(token, f"/stats/hits?start={start}&end={end}&limit=200")
    hits = data.get("hits", [])
    total = sum(h.get("count", 0) for h in hits if h.get("path") == "/")
    # path가 없으면 stats/total로 fallback
    if total == 0:
        data2 = gc_get(token, f"/stats/total?start={start}&end={end}")
        total = data2.get("total", 0)
    return total


def get_event_count(token: str, start: str, end: str, event_name: str) -> int:
    """GoatCounter 이벤트 카운트 (/event/{name})"""
    data = gc_get(token, f"/stats/hits?start={start}&end={end}&limit=200")
    hits = data.get("hits", [])
    target_path = f"/event/{event_name}"
    return sum(h.get("count", 0) for h in hits if h.get("path") == target_path)


def safe_rate(numerator: int, denominator: int) -> float:
    if denominator == 0:
        return 0.0
    return round(numerator / denominator * 100, 1)


def main():
    parser = argparse.ArgumentParser(description="TalkCheck D+7 GoatCounter 퍼널 분석")
    today = date.today().isoformat()
    d7_ago = (date.today() - timedelta(days=7)).isoformat()
    parser.add_argument("--start", default=d7_ago, help=f"시작일 YYYY-MM-DD (기본: {d7_ago})")
    parser.add_argument("--end",   default=today,  help=f"종료일 YYYY-MM-DD (기본: {today})")
    parser.add_argument("--gate",  action="store_true", help="게이트 판정 결과를 exit code로 반환 (PASS=0, FAIL=1)")
    parser.add_argument("--json",  action="store_true", help="JSON 형식으로 출력")
    args = parser.parse_args()

    token = load_token()

    print(f"▶ TalkCheck 퍼널 분석 ({args.start} ~ {args.end})")
    print()

    # ── 퍼널 3단계 수집 ─────────────────────────────────────────────────────
    landing_view   = get_pageviews(token, args.start, args.end)
    file_parsed    = get_event_count(token, args.start, args.end, "file_parsed")
    result_shown   = get_event_count(token, args.start, args.end, "result_shown")
    result_copied  = get_event_count(token, args.start, args.end, "result_copied")
    toss_cta_click = get_event_count(token, args.start, args.end, "toss_cta_click")

    # ── 비율 계산 ────────────────────────────────────────────────────────────
    upload_rate      = safe_rate(file_parsed, landing_view)
    result_rate      = safe_rate(result_shown, file_parsed)
    copy_rate        = safe_rate(result_copied, result_shown)
    toss_cta_rate    = safe_rate(toss_cta_click, result_shown)

    # ── 게이트 판정 ──────────────────────────────────────────────────────────
    pass_upload = upload_rate >= UPLOAD_RATE_PASS
    pass_result = result_rate >= RESULT_RATE_PASS
    gate_pass   = pass_upload and pass_result

    verdict = "PASS ✅" if gate_pass else "FAIL ❌"

    if args.json:
        output = {
            "window": {"start": args.start, "end": args.end},
            "funnel": {
                "landing_view":   landing_view,
                "file_parsed":    file_parsed,
                "result_shown":   result_shown,
                "result_copied":  result_copied,
                "toss_cta_click": toss_cta_click,
            },
            "rates": {
                "upload_rate_pct":   upload_rate,
                "result_rate_pct":   result_rate,
                "copy_rate_pct":     copy_rate,
                "toss_cta_rate_pct": toss_cta_rate,
            },
            "gate": {
                "pass_upload": pass_upload,
                "pass_result": pass_result,
                "verdict":     "PASS" if gate_pass else "FAIL",
            },
        }
        print(json.dumps(output, ensure_ascii=False, indent=2))
    else:
        print("📊 퍼널 (단계별 이벤트 수)")
        print(f"  1. 랜딩 방문       {landing_view:>6}  —")
        print(f"  2. 파일 업로드 성공 {file_parsed:>6}  upload_rate = {upload_rate}%  (목표 ≥{UPLOAD_RATE_PASS}%)  {'✅' if pass_upload else '❌'}")
        print(f"  3. 결과 화면 도달  {result_shown:>6}  result_rate = {result_rate}%  (목표 ≥{RESULT_RATE_PASS}%)  {'✅' if pass_result else '❌'}")
        print()
        print("📈 부가 지표")
        print(f"  복사 완료율     {copy_rate}%  (result_shown 대비)")
        print(f"  Toss CTA 클릭률 {toss_cta_rate}%  (result_shown 대비, 목표 ≥{TOSS_CTR_WARN}%)  {'✅' if toss_cta_rate >= TOSS_CTR_WARN else '⚠️ 낮음'}")
        print()
        print(f"🏁 게이트 판정: {verdict}")
        if gate_pass:
            print("   → PASS: Toss CTA 유지 + AdSense pub ID 수령 대기. 다음 게이트 D+30.")
        else:
            fails = []
            if not pass_upload:
                fails.append(f"upload_rate {upload_rate}% < {UPLOAD_RATE_PASS}% → 파일 업로드 UI/카피 재설계")
            if not pass_result:
                fails.append(f"result_rate {result_rate}% < {RESULT_RATE_PASS}% → 파서 버그 또는 결과 UI 문제")
            for f in fails:
                print(f"   ❌ {f}")
            print("   → FAIL: ux_copy + code_builder 팀 즉시 enqueue")

    # ── 로그 저장 ────────────────────────────────────────────────────────────
    LOGS_DIR.mkdir(exist_ok=True)
    log_path = LOGS_DIR / f"funnel_{date.today().strftime('%Y%m%d')}.json"
    log_data = {
        "generated_at": date.today().isoformat(),
        "window": {"start": args.start, "end": args.end},
        "funnel": {
            "landing_view":   landing_view,
            "file_parsed":    file_parsed,
            "result_shown":   result_shown,
            "result_copied":  result_copied,
            "toss_cta_click": toss_cta_click,
        },
        "rates": {
            "upload_rate_pct":   upload_rate,
            "result_rate_pct":   result_rate,
            "copy_rate_pct":     copy_rate,
            "toss_cta_rate_pct": toss_cta_rate,
        },
        "gate": {
            "verdict": "PASS" if gate_pass else "FAIL",
            "pass_upload": pass_upload,
            "pass_result": pass_result,
        },
    }
    log_path.write_text(json.dumps(log_data, ensure_ascii=False, indent=2))
    if not args.json:
        print(f"\n   로그 저장: {log_path}")

    if args.gate:
        sys.exit(0 if gate_pass else 1)


if __name__ == "__main__":
    main()
