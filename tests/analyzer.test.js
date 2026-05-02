/**
 * analyzer.test.js — node --test 내장 테스트 (외부 의존성 0)
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { detectAnnouncement, computeNonResponders, buildMentionText } = require('../js/analyzer.js');

// 테스트용 공통 날짜 헬퍼
function makeDate(h, m) {
  const d = new Date(2024, 2, 15, h, m, 0);
  return d;
}

// 테스트용 메시지 목록
function makeSampleMessages() {
  return [
    { author: '홍길동', timestamp: makeDate(9, 0), text: '안녕하세요' },
    { author: '김철수', timestamp: makeDate(9, 5), text: '반갑습니다' },
    { author: '이영희', timestamp: makeDate(9, 10), text: '공지 있습니다 오늘 오후 2시 회의' },
    { author: '박민준', timestamp: makeDate(9, 15), text: '네 알겠습니다' },
    { author: '최지연', timestamp: makeDate(9, 20), text: '확인했어요' },
    { author: '홍길동', timestamp: makeDate(9, 25), text: '감사합니다' },
  ];
}

const ALL_MEMBERS = new Set(['홍길동', '김철수', '이영희', '박민준', '최지연']);

// ── AT3: '공지' 키워드 → 첫 공지 메시지 timestamp 반환 ──────
test('AT3: 키워드 공지 → detectAnnouncement가 첫 공지 메시지 timestamp 반환', () => {
  const messages = makeSampleMessages();
  const { announcedAt, announcerAuthor, matched } = detectAnnouncement(messages, '공지');

  assert.ok(matched, 'matched=true 이어야 함');
  assert.ok(announcedAt instanceof Date, 'announcedAt은 Date 이어야 함');
  assert.equal(announcerAuthor, '이영희', `announcerAuthor='이영희' 이어야 하는데 '${announcerAuthor}'`);
  // 시간 검증: 9:10
  assert.equal(announcedAt.getHours(), 9, 'hour=9');
  assert.equal(announcedAt.getMinutes(), 10, 'minute=10');
});

// ── AT4: 공지 이후 발화 0명 → nonResponders = members - {announcer} ──
test('AT4: 공지 이후 발화 0명 → nonResponders = members - announcer', () => {
  // 공지 이후 메시지 없는 상황
  const messages = [
    { author: '홍길동', timestamp: makeDate(9, 0), text: '공지입니다' },
    // 이후 아무도 말 안 함
  ];
  const members = new Set(['홍길동', '김철수', '이영희']);
  const { announcedAt, announcerAuthor } = detectAnnouncement(messages, '공지');
  const { nonResponders } = computeNonResponders(messages, members, announcedAt, announcerAuthor);

  // 발화자 제외: 홍길동 제외 → 김철수, 이영희가 무응답자
  assert.equal(nonResponders.length, 2, `nonResponders.length=2 이어야 하는데 ${nonResponders.length}`);
  assert.ok(nonResponders.includes('김철수'), '김철수는 무응답자');
  assert.ok(nonResponders.includes('이영희'), '이영희는 무응답자');
  assert.ok(!nonResponders.includes('홍길동'), '공지자(홍길동)는 무응답자 X');
});

// ── AT5: 모든 멤버 공지 후 발화 → nonResponders = [] ──────────
test('AT5: 모든 멤버 공지 후 발화 → nonResponders=[]', () => {
  const messages = [
    { author: '홍길동', timestamp: makeDate(9, 0), text: '공지 있어요' },
    { author: '김철수', timestamp: makeDate(9, 5), text: '확인' },
    { author: '이영희', timestamp: makeDate(9, 10), text: '확인' },
    { author: '박민준', timestamp: makeDate(9, 15), text: '확인' },
    { author: '최지연', timestamp: makeDate(9, 20), text: '확인' },
  ];
  const members = new Set(['홍길동', '김철수', '이영희', '박민준', '최지연']);
  const { announcedAt, announcerAuthor } = detectAnnouncement(messages, '공지');
  const { nonResponders } = computeNonResponders(messages, members, announcedAt, announcerAuthor);

  assert.equal(nonResponders.length, 0, `nonResponders=[] 이어야 하는데 [${nonResponders}]`);
});

// ── AT6: buildMentionText(['홍길동','김철수']) ──────────────────
test('AT6: buildMentionText 출력 형식 검증', () => {
  const result = buildMentionText(['홍길동', '김철수']);
  const expected = '@홍길동 @김철수 공지 확인 부탁드려요 🙏';
  assert.equal(result, expected, `'${result}' !== '${expected}'`);
});

// ── 추가: buildMentionText 빈 배열 ──────────────────────────────
test('buildMentionText([]) → 빈 문자열', () => {
  assert.equal(buildMentionText([]), '');
  assert.equal(buildMentionText(null), '');
});

// ── AT7: TIMESTAMP-EQ-007 — 공지와 동일 분 응답자 포함 ─────────
test('AT7: 공지와 동일 분(timestamp===announcedAt)에 응답한 사람 → responders에 포함', () => {
  const announceTime = makeDate(9, 10);
  const messages = [
    { author: '이영희', timestamp: makeDate(9, 10), text: '공지 있습니다' },
    // 동일 분(9:10)에 응답 — TIMESTAMP-EQ-007 버그 시 누락됨
    { author: '홍길동', timestamp: makeDate(9, 10), text: '확인' },
    { author: '김철수', timestamp: makeDate(9, 15), text: '알겠습니다' },
  ];
  const members = new Set(['이영희', '홍길동', '김철수', '박민준']);
  const { announcedAt, announcerAuthor } = detectAnnouncement(messages, '공지');
  const { responders, nonResponders } = computeNonResponders(messages, members, announcedAt, announcerAuthor);

  assert.ok(responders.includes('홍길동'), '동일 분 응답자(홍길동)는 responders에 포함되어야 함');
  assert.ok(responders.includes('김철수'), '이후 응답자(김철수)도 responders에 포함');
  assert.ok(!nonResponders.includes('홍길동'), '홍길동은 nonResponders에 없어야 함');
  assert.ok(nonResponders.includes('박민준'), '미응답자(박민준)는 nonResponders에 포함');
});

// ── 추가: detectAnnouncement 키워드 없음 ──────────────────────
test('detectAnnouncement — 키워드 없음 → matched=false', () => {
  const messages = makeSampleMessages();
  const r = detectAnnouncement(messages, '');
  assert.equal(r.matched, false);
  assert.equal(r.announcedAt, null);
});
