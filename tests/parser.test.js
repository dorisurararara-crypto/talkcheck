/**
 * parser.test.js — node --test 내장 테스트 (외부 의존성 0)
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// parser.js 로드
const { parseKakaoTxt } = require('../js/parser.js');

const FIXTURES = path.join(__dirname, 'fixtures');

// ── AT1: iOS 형식 파싱 ──────────────────────────────────────────
test('AT1: ios_sample.txt → format=ios, messages>0, members>=3', () => {
  const raw = fs.readFileSync(path.join(FIXTURES, 'ios_sample.txt'), 'utf-8');
  const result = parseKakaoTxt(raw);

  assert.equal(result.format, 'ios', `format은 'ios'여야 하는데 '${result.format}'`);
  assert.ok(result.messages.length > 0, `messages.length=${result.messages.length} > 0 이어야 함`);
  assert.ok(result.members.size >= 3, `members.size=${result.members.size} >= 3 이어야 함`);
});

// ── AT2: Android 형식 파싱 ──────────────────────────────────────
test('AT2: android_sample.txt → format=android, messages>0, members>=3', () => {
  const raw = fs.readFileSync(path.join(FIXTURES, 'android_sample.txt'), 'utf-8');
  const result = parseKakaoTxt(raw);

  assert.equal(result.format, 'android', `format은 'android'여야 하는데 '${result.format}'`);
  assert.ok(result.messages.length > 0, `messages.length=${result.messages.length} > 0 이어야 함`);
  assert.ok(result.members.size >= 3, `members.size=${result.members.size} >= 3 이어야 함`);
});

// ── AT8: 알 수 없는 포맷 ──────────────────────────────────────
test('AT8: 알 수 없는 포맷 → format=unknown', () => {
  const raw = 'This is not a kakao chat export file.\nRandom text here.\n12345';
  const result = parseKakaoTxt(raw);

  assert.equal(result.format, 'unknown', `format은 'unknown'이어야 하는데 '${result.format}'`);
  assert.equal(result.messages.length, 0, 'unknown 포맷은 messages 없어야 함');
});

// ── AT9: MULTILINE-005 — iOS 다중 라인 메시지 이어붙임 ────────
test('AT9: iOS 멀티라인 메시지 → 두 번째 줄 이전 메시지 text에 append', () => {
  const raw = [
    '--------------- 2024년 3월 15일 금요일 ---------------',
    '[홍길동] [오전 9:00] 공지 있습니다',
    '오늘 오후 2시 회의실 A',
    '참석 필수입니다',
    '[김철수] [오전 9:05] 확인',
  ].join('\n');

  const result = parseKakaoTxt(raw);

  assert.equal(result.format, 'ios');
  assert.equal(result.messages.length, 2, `messages.length=2 이어야 하는데 ${result.messages.length}`);
  assert.ok(
    result.messages[0].text.includes('오늘 오후 2시 회의실 A'),
    '두 번째 줄이 첫 메시지 text에 포함되어야 함'
  );
  assert.ok(
    result.messages[0].text.includes('참석 필수입니다'),
    '세 번째 줄도 첫 메시지 text에 포함되어야 함'
  );
  assert.equal(result.messages[1].author, '김철수', '두 번째 메시지 작성자는 김철수');
});

// ── AT10: MULTILINE-005 — Android 다중 라인 메시지 이어붙임 ───
test('AT10: Android 멀티라인 메시지 → 두 번째 줄 이전 메시지 text에 append', () => {
  const raw = [
    '2024년 3월 15일 오전 9:00, 홍길동 : 공지입니다',
    '오늘 미팅 있습니다',
    '2024년 3월 15일 오전 9:05, 김철수 : 확인했습니다',
  ].join('\n');

  const result = parseKakaoTxt(raw);

  assert.equal(result.format, 'android');
  assert.equal(result.messages.length, 2, `messages.length=2 이어야 하는데 ${result.messages.length}`);
  assert.ok(
    result.messages[0].text.includes('오늘 미팅 있습니다'),
    '두 번째 줄이 첫 메시지 text에 포함되어야 함'
  );
  assert.equal(result.messages[1].author, '김철수');
});

// ── AT15: ReDoS 취약성 없음 (10MB 악성 입력) ─────────────────
test('AT15: ReDoS — 10MB 악성 입력 2초 이내 처리', (t, done) => {
  // ReDoS 유발 패턴: 정규식 backtracking 극대화
  // 예: 많은 공백 + 잘못된 형식 반복
  const chunk = 'a'.repeat(100) + '\n';
  const malicious = chunk.repeat(100_000); // ~10MB

  const start = Date.now();
  const result = parseKakaoTxt(malicious);
  const elapsed = Date.now() - start;

  assert.ok(elapsed < 2000, `처리 시간 ${elapsed}ms — 2000ms 이내여야 함 (ReDoS 방어)`);
  assert.equal(result.format, 'unknown', '악성 입력은 unknown 이어야 함');
  done();
});
