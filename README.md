# TalkCheck — 카톡 단톡방 무응답자 찾기

카카오톡 단체 채팅방 내보내기 파일로 공지 무응답자를 찾아 @멘션 텍스트를 자동 생성합니다.

**[바로 사용하기 →](https://dorisurararara-crypto.github.io/talkcheck/)**

## 특징

- iOS / Android 내보내기 파일 자동 감지
- 공지 키워드 지정 → 무응답자 자동 추출
- @멘션 텍스트 원클릭 복사
- 파일은 브라우저에서만 처리 (서버 전송 없음)
- PWA 지원 (오프라인 사용 가능)
- 외부 라이브러리 없음 (Vanilla JS)

## 사용법

1. 카카오톡 채팅방 → 대화 내보내기 → `.txt` 파일 저장
2. TalkCheck에 파일 업로드
3. 공지 키워드 입력 (예: 공지, 중요, 필독)
4. "무응답자 찾기" 클릭
5. @멘션 텍스트 복사 후 채팅방에 붙여넣기

## 개발

```bash
# 테스트 실행 (Node.js 내장, 의존성 없음)
node --test tests/parser.test.js tests/analyzer.test.js
```

## 라이선스

MIT License — Copyright (c) 2024
