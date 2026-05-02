/**
 * parser.js — KakaoTalk 단체 채팅 내보내기 파싱
 * iOS / Android 자동 감지
 */

// iOS 메시지 정규식
// 예: [홍길동] [오전 9:00] 안녕하세요
const IOS_MSG_RE = /^\[(?<author>[^\]]+?)\] \[(?<ampm>오전|오후) (?<h>\d{1,2}):(?<m>\d{2})\] (?<text>.*)$/;

// iOS 날짜 헤더 정규식
// 예: --------------- 2024년 3월 15일 금요일 ---------------
const IOS_DATE_RE = /^-{15}\s+\d{4}년 \d{1,2}월 \d{1,2}일 .+요일\s+-{15}$/;

// Android 메시지 정규식
// 예: 2024년 3월 15일 오전 9:00, 홍길동 : 안녕하세요
const ANDROID_MSG_RE = /^(?<y>\d{4})년 (?<mo>\d{1,2})월 (?<d>\d{1,2})일 (?<ampm>오전|오후) (?<h>\d{1,2}):(?<m>\d{2}), (?<author>.+?) : (?<text>.*)$/;

/**
 * 오전/오후 + 시:분 → 24h 기준 Date 생성 (날짜 정보 없이 시간만)
 * @param {string} ampm '오전'|'오후'
 * @param {number} h 시 (1-12)
 * @param {number} m 분
 * @param {Date} dateCtx 날짜 컨텍스트
 * @returns {Date}
 */
function toDate(ampm, h, m, dateCtx) {
  let hour = Number(h);
  if (ampm === '오전') {
    if (hour === 12) hour = 0;
  } else {
    if (hour !== 12) hour += 12;
  }
  const d = new Date(dateCtx);
  d.setHours(hour, Number(m), 0, 0);
  return d;
}

/**
 * KakaoTalk 채팅 텍스트 파싱
 * @param {string} rawText
 * @returns {{ format: 'ios'|'android'|'unknown', messages: Array<{author: string, timestamp: Date, text: string}>, members: Set<string> }}
 */
function parseKakaoTxt(rawText) {
  const lines = rawText.split('\n');

  // 자동 감지: 첫 50라인 매칭률 비교
  const sample = lines.slice(0, 50);
  let iosCount = 0;
  let androidCount = 0;
  for (const line of sample) {
    if (IOS_MSG_RE.test(line)) iosCount++;
    if (ANDROID_MSG_RE.test(line)) androidCount++;
  }

  let detectedFormat;
  if (iosCount === 0 && androidCount === 0) {
    detectedFormat = 'unknown';
  } else {
    detectedFormat = iosCount >= androidCount ? 'ios' : 'android';
  }

  if (detectedFormat === 'unknown') {
    return { format: 'unknown', messages: [], members: new Set() };
  }

  const messages = [];
  const members = new Set();

  if (detectedFormat === 'ios') {
    let currentDate = new Date(2000, 0, 1); // fallback date
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // 날짜 헤더 파싱
      const dateMatch = trimmed.match(/(\d{4})년 (\d{1,2})월 (\d{1,2})일/);
      if (IOS_DATE_RE.test(trimmed) && dateMatch) {
        currentDate = new Date(
          Number(dateMatch[1]),
          Number(dateMatch[2]) - 1,
          Number(dateMatch[3])
        );
        continue;
      }

      // 메시지 파싱
      const m = trimmed.match(IOS_MSG_RE);
      if (m && m.groups) {
        const { author, ampm, h, m: min, text } = m.groups;
        const timestamp = toDate(ampm, h, min, currentDate);
        members.add(author);
        messages.push({ author, timestamp, text });
      }
    }
  } else {
    // Android
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const m = trimmed.match(ANDROID_MSG_RE);
      if (m && m.groups) {
        const { y, mo, d, ampm, h, m: min, author, text } = m.groups;
        const dateCtx = new Date(Number(y), Number(mo) - 1, Number(d));
        const timestamp = toDate(ampm, h, min, dateCtx);
        members.add(author);
        messages.push({ author, timestamp, text });
      }
    }
  }

  return { format: detectedFormat, messages, members };
}

// CommonJS / browser 호환
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parseKakaoTxt };
}
