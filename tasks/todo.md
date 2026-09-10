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

- [x] P0 score.js — node score.test.js 10개 전부 통과
- [x] i18n 뼈대 — strings.ko.js / i18n.js, 조사(이가/은는/과와) 자동처리 포함
- [x] P1~P5 — index.html/app.js/style.css, agent-browser로 실사용 검증 완료
- [x] P6 템플릿 4종 — 클릭 시 즉시 가중치 반영·재정렬 확인
- [x] P7 PWA + 백업(JSON) + 공유(URL해시) — 서비스워커 캐시 9개 파일 전부 확인, 공유링크 왕복 확인
- [x] git init + 로컬 커밋 완료 (dcfe89b)
- [ ] **P8 GitHub 원격 저장소 생성 + push + Pages 배포 — auto mode 권한 분류기가 차단함.**
      `gh repo create jobscale --public --source=. --push` 를 사용자가 직접
      (터미널에서 `!` 접두사로) 실행해야 함. 이후 저장소 Settings → Pages →
      Source: `main`브랜치 `/app` 폴더로 설정하면 배포 끝.
- [ ] P9 Bubblewrap TWA — 사용자의 Google Play Console 계정 필요, 안내만 완료

## 테스트 중 발견·수정한 버그 3건
1. `clone()`이 `Object.assign({}, [])`로 배열을 `{}`로 바꿔버려 공고 저장 시
   `state.jobs.push is not a function` 발생 → 배열 분기 추가로 수정
2. `<label data-i18n>` 안에 `<input>`이 중첩돼 있어 i18n의 `textContent` 대입이
   입력요소를 통째로 삭제 → 텍스트를 `<span>`으로 분리
3. 근거 문장의 한글 조사(과/와, 은/는, 이/가)가 하드코딩돼 있어 받침 없는
   단어에 틀린 조사가 붙음 → 받침 자동판별 함수(KO_JOSA)로 교체
app/ (rm -rf 실패 시 OneDrive/탐색기가 잡고 있을 수 있음 — 재부팅 후 수동 삭제 권장, git에서는 이미 제외됨)
