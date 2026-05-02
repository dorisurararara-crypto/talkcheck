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
