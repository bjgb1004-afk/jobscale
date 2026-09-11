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
- [x] P8 GitHub 저장소 생성(사용자 직접 실행) + push + Pages 배포 완료
      **배포 URL: https://bjgb1004-afk.github.io/jobscale/**
      (app/ → docs/로 이동: GitHub Pages classic source가 /docs만 지원, /app 불가)
      Pages 소스: main 브랜치 /docs, 빌드 확인(status: built), 실제 접속·SW 등록·
      템플릿 클릭까지 라이브 사이트에서 재검증 완료
- [x] P9-1 Bubblewrap 프로젝트 생성(twa/, 이전 세션에서 진행) + keystore 재발급
      **keystore 비밀번호 사고**: twa-manifest.json의 signingKey.path가 `jop`(오타, `job` 아님)로
      돼 있어 원본 keystore를 못 씀 → 사용자가 비밀번호를 두 번 저장 시도(1차 IME 오작동 추정,
      2차 채팅창에 실수로 평문 입력) 모두 실패/유출 위험 → **기존 keystore 폐기(android.keystore.old-bak로
      보존)하고 24자 랜덤 비밀번호를 내가 직접 생성해 twa/keystore-pass.txt에 저장(화면 미출력),
      새 keystore로 교체**. `twa/keystore-pass.txt`, `twa/android.keystore`는 .gitignore 추가함 —
      이 두 파일은 이 PC에만 있음, 분실 시 앱 업데이트 서명 불가하니 별도 백업 필요(예: 개인 클라우드
      암호화 저장, 1Password 등 — git에는 절대 넣지 말 것).
      SHA-256 지문: E8:0D:61:01:61:FB:7A:81:A9:E3:3D:A6:E8:C1:7E:4E:66:98:A0:97:17:8B:17:20:50:69:B8:BA:41:83:C3:40
- [x] P9-2 릴리스 빌드 — `npx @bubblewrap/cli build`가 Windows에서 gradlew.bat을 못 찾는 버그로
      실패(Node 최신 버전의 .bat 스폰 보안패치 관련 추정, execFile+shell:true 조합 문제) →
      gradlew.bat assembleRelease/bundleRelease를 직접 실행 + zipalign/apksigner/jarsigner로
      bubblewrap과 동일한 방식으로 수동 서명. 산출물:
      `twa/app/build/outputs/apk/release/app-release-signed.apk` (서명 검증 통과)
      `twa/app/build/outputs/bundle/release/app-release-signed.aab` (서명 검증 통과, Play Console 업로드용)
- [x] P9-3 Digital Asset Links 해결 — 새 GitHub 리포 `bjgb1004-afk/bjgb1004-afk.github.io` 생성
      (도메인 루트 전용, Pages 자동 활성화됨) + `.well-known/assetlinks.json`에 SHA-256 지문 등록.
      **함정**: GitHub Pages 기본 Jekyll 빌드가 `.well-known`처럼 점(.)으로 시작하는 폴더를 자동으로
      숨김 처리해서 무시함 → 처음엔 200이 아니라 404 남. `.nojekyll` 빈 파일을 리포 루트에 추가해서 해결.
      Google 공식 검증 API(digitalassetlinks.googleapis.com/v1/statements:list)로 최종 확인 완료 —
      정상 인식됨. 이제 TWA 앱이 주소창 없는 완전 네이티브 화면으로 뜸.
      리포: https://github.com/bjgb1004-afk/bjgb1004-afk.github.io (루트 접속 시 /jobscale/로 리다이렉트)
- [ ] P9-4 Google Play Console 업로드 — 사용자의 Google Play Developer 계정(1회 $25) 필요,
      위 .aab 파일을 업로드하고 스토어 등록정보/개인정보처리방침/콘텐츠 등급 입력은 사용자 직접 진행

## 코드 리뷰로 발견 + 수정한 버그 5건 (docs/js/, 2026-09-11)
- [x] app.js updateStarLabel — 가중치가 0~5 범위 밖(공유링크/백업으로 유입)이면
      '☆'.repeat(음수)로 RangeError 크래시 → Math.max(0, Math.min(5, v))로 clamp
- [x] app.js importBackup/loadFromShareHash — pay 필드 없는 등 깨진 job이 들어오면 저장 후
      크래시(앱이 계속 깨진 채로 남음) → sanitizeJobs()로 필수 필드 없는 job은 걸러내고,
      clampWeights()로 가중치도 0~5로 강제
- [x] app.js saveCriteria — 희망 통근시간/근무일수에 0을 입력해도 `parseInt(...)||기본값`
      패턴 때문에 기본값으로 조용히 대체됨 → isNaN 체크로 교체(0은 유효한 값으로 저장)
- [x] app.js 공유 링크가 내 데이터를 조용히 덮어씀 — persist()에 state.viewOnly 가드 추가:
      공유 링크 열람 중 첫 저장 시도 시 confirm()으로 한 번 확인받고, 취소하면 저장 안 함/
      확인하면 배너 숨기고 이후 정상 저장. 네 개 persist* 함수가 공통으로 거치는 persist()
      한 곳만 고쳐서 전부 커버함.
- [x] i18n.js t() — 플레이스홀더 치환이 순차적이라(split/join 반복) 치환값 자체가 다른
      플레이스홀더 문자열(예: 회사명이 "{best1}")이면 재치환되는 버그 → 정규식 한 번의 패스로
      치환하도록 교체
  검증: score.test.js 10개 전부 통과(회귀 없음) + node로 각 수정 로직 재현 테스트 통과 +
  agent-browser로 실제 브라우저에서 5개 시나리오 전부 재현·검증(콘솔 에러 0건):
  통근 0 저장 확인, 공유 링크 취소 시 원본 보존/확인 시 정상 덮어쓰기+배너 숨김,
  가중치 10/-3 입력해도 크래시 없이 5/0으로 clamp됨.
  **주의**: 아직 git 커밋도 GitHub Pages 배포도 안 함 — 로컬 파일만 수정된 상태.
  TWA APK는 웹 콘텐츠를 내장하지 않고 라이브 사이트를 그대로 열기 때문에, 이 수정은
  push해서 Pages에 배포만 되면 APK 재빌드 없이 바로 적용됨.

## 실사용 테스트 중 발견한 추가 버그 3건 (2026-09-11)
- [x] 안드로이드 뒤로가기 누르면 화면 전환 없이 바로 앱 이탈 — showView()가 hidden 속성만
      토글하고 브라우저 히스토리를 안 남겨서 생긴 문제. history.pushState/popstate 연동 추가:
      하위 화면(내 기준/비교/등록폼) 진입 시 히스토리 쌓고, 뒤로가기 누르면 홈으로 복귀.
      홈에서 또 뒤로가기 누르면 그때는 정상적으로 앱 이탈(의도된 동작).
- [x] 템플릿 버튼(육아 병행형/돈 우선형/몸 편한 일형/워라밸형) 눌러도 선택됐는지 표시가
      없어서 클릭했는지 헷갈림 → 클릭한 템플릿 버튼에 테두리+체크(✓) 표시. 별점을 직접
      만지거나 "저장"하면(=더 이상 어느 템플릿과도 안 맞으므로) 표시 해제됨.
- [x] 앱/페이지 제목이 파일마다 다름(index.html·strings.ko.js: "나에게 맞는 직장 계산기",
      manifest.json: "잡스케일", twa-manifest.json 안드로이드 앱 이름: "잡스코어") — 이미 빌드된
      APK/keystore/Pages 아이콘에 쓰인 "잡스코어"로 통일(사용자 선택). index.html <title>/<h1>,
      manifest.json name/short_name을 "잡스코어"로 변경. APK 재빌드 불필요(웹만 고치면 됨).
  검증: agent-browser로 실제 브라우저에서 3개 다 확인 — 제목 "잡스코어" 정상 표시,
  템플릿 클릭 시 active 클래스 붙는 것 확인, history.back() 시뮬레이션으로 하위 화면→홈
  복귀 확인(콘솔 에러 없음).

## 테스트 중 발견·수정한 버그 3건
1. `clone()`이 `Object.assign({}, [])`로 배열을 `{}`로 바꿔버려 공고 저장 시
   `state.jobs.push is not a function` 발생 → 배열 분기 추가로 수정
2. `<label data-i18n>` 안에 `<input>`이 중첩돼 있어 i18n의 `textContent` 대입이
   입력요소를 통째로 삭제 → 텍스트를 `<span>`으로 분리
3. 근거 문장의 한글 조사(과/와, 은/는, 이/가)가 하드코딩돼 있어 받침 없는
   단어에 틀린 조사가 붙음 → 받침 자동판별 함수(KO_JOSA)로 교체
app/ (rm -rf 실패 시 OneDrive/탐색기가 잡고 있을 수 있음 — 재부팅 후 수동 삭제 권장, git에서는 이미 제외됨)
