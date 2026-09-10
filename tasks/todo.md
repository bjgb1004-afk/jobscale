# 잡스케일 MVP 빌드 — 작업 목록

승인 완료. P0~P9 끝까지 진행. (기준: 통합개발계획서.md / 개발체크리스트.md)

## 구조 (문자열 분리 반영)
```
app/
  index.html
  css/style.css
  js/strings.ko.js   ← 한글 텍스트 전부 여기(향후 strings.en.js 추가하면 다국어)
  js/i18n.js          ← t(key), applyI18n() — 라이브러리 없음, 순수 JS
  js/score.js         ← 계산 엔진 (순수함수, 언어 무관)
  js/score.test.js    ← node로 돌리는 assert 테스트
  js/app.js           ← 상태관리 + localStorage + 렌더링
```

## 체크리스트
- [ ] P0 score.js 계산 엔진 + score.test.js (node로 통과 확인)
- [ ] i18n 뼈대: strings.ko.js + i18n.js
- [ ] P1 index.html 골격 + 공고 등록 폼 + localStorage + 순위 목록
- [ ] P2 중요도 별점 + 즉시 재정렬
- [ ] P3 필수조건(하드필터) + 탈락 표시
- [ ] P4 실질시급 + 근거문장 자동생성
- [ ] P5 나란히 비교표 + CSS 막대
- [ ] P6 템플릿 4종 버튼
- [ ] P7 PWA (manifest.json + sw.js) + JSON 백업/복원 + 링크 공유
- [ ] P8 GitHub 저장소 생성 + Pages 배포 + 실제 URL 확인
- [ ] P9 Bubblewrap TWA는 스토어 등록 단계 — 로컬 CLI 설치 필요, 이번 세션은 안내만 (실기기 서명키 발급 등은 사용자 계정 작업)

## 완료 후 기록
- 실행 결과·URL·남은 수동 작업은 이 파일 하단에 추가
