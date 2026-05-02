/**
 * analyzer.js — 공지 감지 + 무응답자 계산
 */

/**
 * 메시지 목록에서 keyword가 포함된 첫 메시지를 공지로 감지
 * @param {Array<{author: string, timestamp: Date, text: string}>} messages
 * @param {string} keyword
 * @returns {{ announcedAt: Date|null, announcerAuthor: string|null, matched: boolean }}
 */
function detectAnnouncement(messages, keyword) {
  if (!keyword || !keyword.trim()) {
    return { announcedAt: null, announcerAuthor: null, matched: false };
  }
  for (const msg of messages) {
    if (msg.text.includes(keyword.trim())) {
      return {
        announcedAt: msg.timestamp,
        announcerAuthor: msg.author,
        matched: true
      };
    }
  }
  return { announcedAt: null, announcerAuthor: null, matched: false };
}

/**
 * 공지 이후 발화한 멤버 계산 → 무응답자 = 전체 - 발화자 - 공지자
 * @param {Array<{author: string, timestamp: Date, text: string}>} messages
 * @param {Set<string>} members
 * @param {Date|null} announcedAt
 * @param {string|null} announcerAuthor
 * @returns {{ responders: string[], nonResponders: string[] }}
 */
function computeNonResponders(messages, members, announcedAt, announcerAuthor) {
  if (!announcedAt) {
    return { responders: [], nonResponders: Array.from(members) };
  }

  const responders = new Set();
  for (const msg of messages) {
    // 공지 timestamp 이후 메시지만 (공지 자체는 제외)
    if (msg.timestamp > announcedAt && msg.author !== announcerAuthor) {
      responders.add(msg.author);
    }
  }

  const nonResponders = [];
  for (const member of members) {
    if (member !== announcerAuthor && !responders.has(member)) {
      nonResponders.push(member);
    }
  }

  return {
    responders: Array.from(responders),
    nonResponders
  };
}

/**
 * 무응답자 목록으로 @멘션 텍스트 생성
 * @param {string[]} nonResponders
 * @returns {string}
 */
function buildMentionText(nonResponders) {
  if (!nonResponders || nonResponders.length === 0) return '';
  const mentions = nonResponders.map(name => `@${name}`).join(' ');
  return `${mentions} 공지 확인 부탁드려요 🙏`;
}

// CommonJS / browser 호환
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { detectAnnouncement, computeNonResponders, buildMentionText };
}
