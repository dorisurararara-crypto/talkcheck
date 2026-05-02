/**
 * ab.js — A/B 변형 할당 (localStorage 영속, 50/50 split)
 * 변형: A (제어군, 기본 카피) / B (실험군, 대안 카피)
 * 텍스트 본문은 window.__ab.variant 에 노출하지 않음
 *
 * GoatCounter 이벤트 경로 규칙:
 *   /event/copy_btn_click~A  (제어군)
 *   /event/copy_btn_click~B  (실험군)
 */
(function () {
  'use strict';

  var VARIANT_KEY = 'talkcheck.variant';
  var SESSION_KEY = 'talkcheck.session';

  /** uuid v4 — crypto.randomUUID 우선, fallback Math.random */
  function genUUID() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  /** 변형 할당 — 이미 할당됐으면 재사용 */
  function getVariant() {
    try {
      var stored = localStorage.getItem(VARIANT_KEY);
      if (stored === 'A' || stored === 'B') return stored;
      var v = Math.random() < 0.5 ? 'A' : 'B';
      localStorage.setItem(VARIANT_KEY, v);
      return v;
    } catch (e) {
      // localStorage 차단(사생활 모드 일부) 시 제어군 기본값
      return 'A';
    }
  }

  /** 세션 ID — 탭/창 단위 고유 (새로고침 시 유지) */
  function getSessionId() {
    try {
      var stored = sessionStorage.getItem(SESSION_KEY);
      if (stored) return stored;
      var id = genUUID();
      sessionStorage.setItem(SESSION_KEY, id);
      return id;
    } catch (e) {
      return genUUID();
    }
  }

  var variant = getVariant();
  var sessionId = getSessionId();

  /** 전역 노출: analytics.js + index.html 인라인 스크립트가 참조 */
  window.__ab = {
    variant: variant,
    sessionId: sessionId,
  };
})();

// CommonJS 호환 (테스트 환경)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {};
}
