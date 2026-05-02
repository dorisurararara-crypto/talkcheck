/**
 * analytics.js — GoatCounter + AdSense 초기화
 * 메시지 본문은 절대 네트워크 요청에 포함하지 않음
 */

/**
 * GoatCounter 페이지뷰 기록
 * @param {string} path - 페이지 경로 (기본값: location.pathname)
 * @param {string} [title]
 */
function trackPageView(path, title) {
  if (typeof window === 'undefined') return;
  if (!window.goatcounter) return;
  window.goatcounter.count({
    path: path || (typeof location !== 'undefined' ? location.pathname : '/'),
    title: title || (typeof document !== 'undefined' ? document.title : ''),
  });
}

/**
 * 이벤트 추적 (분석 데이터 — 텍스트 내용 제외)
 * @param {string} eventName - 이벤트 이름 (예: 'file_parsed', 'result_copied')
 */
function trackEvent(eventName) {
  if (typeof window === 'undefined') return;
  if (!window.goatcounter) return;
  window.goatcounter.count({
    path: `/event/${eventName}`,
    title: eventName,
    event: true,
  });
}

/**
 * AdSense 초기화 — placeholder
 * console error 없이 graceful degradation
 */
function initAdSense() {
  // placeholder: ca-pub-0000000000000000
  // 실제 AdSense 승인 후 pub ID 교체
  if (typeof window === 'undefined') return;
  try {
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  } catch (e) {
    // AdSense 스크립트 미로드 시 무시 — console.error 미발생
  }
}

// CommonJS / browser 호환
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { trackPageView, trackEvent, initAdSense };
}
