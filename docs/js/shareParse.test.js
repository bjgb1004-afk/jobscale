/**
 * shareParse.js 자체 테스트. 실행: node docs/js/shareParse.test.js
 * 프레임워크 없음 — assert만 사용. score.test.js와 동일 패턴.
 */
var assert = require('assert');
var ShareParse = require('./shareParse.js');

function t(desc, fn) {
  try { fn(); console.log('OK  ' + desc); }
  catch (e) { console.log('FAIL ' + desc + ' — ' + e.message); process.exitCode = 1; }
}

t('시급 + 시간 + 주N일 패턴 파싱', function () {
  var r = ShareParse.parse({ title: '', text: '시급 10,030원 / 근무 09:00~18:00 / 주5일 근무', url: '' });
  assert.strictEqual(r.payAmount, 10030);
  assert.strictEqual(r.payType, 'hourly');
  assert.strictEqual(r.start, '09:00');
  assert.strictEqual(r.end, '18:00');
  assert.strictEqual(r.daysPerWeek, 5);
});

t('월급 250만원 → 만원 단위 그대로(250) 저장 — score.js가 월급을 만원 단위로 계산함', function () {
  var r = ShareParse.parse({ title: '', text: '월급 250만원 지급', url: '' });
  assert.strictEqual(r.payAmount, 250);
  assert.strictEqual(r.payType, 'monthly');
});

t('월급이 원 단위로 적혀있으면(2,500,000원) 만원 단위로 환산', function () {
  var r = ShareParse.parse({ title: '', text: '월급 2,500,000원', url: '' });
  assert.strictEqual(r.payAmount, 250);
  assert.strictEqual(r.payType, 'monthly');
});

t('시급이 만원 단위로 적혀있으면(드묾) 원 단위로 환산', function () {
  var r = ShareParse.parse({ title: '', text: '시급 1만원', url: '' });
  assert.strictEqual(r.payAmount, 10000);
  assert.strictEqual(r.payType, 'hourly');
});

t('연봉 → 월급(만원)으로 환산 — score.js에 연봉 단위가 없음', function () {
  var r = ShareParse.parse({ title: '', text: '급여 연봉 3,700 만원 (주 40시간)', url: '' });
  assert.strictEqual(r.payAmount, 308); // 3700 / 12
  assert.strictEqual(r.payType, 'monthly');
});

t('연봉이 원 단위로 적혀있어도 월급(만원)으로 환산', function () {
  var r = ShareParse.parse({ title: '', text: '연봉 37,000,000원', url: '' });
  assert.strictEqual(r.payAmount, 308);
  assert.strictEqual(r.payType, 'monthly');
});

t('주급 → 월급(만원)으로 환산', function () {
  var r = ShareParse.parse({ title: '', text: '주급 50만원 지급', url: '' });
  assert.strictEqual(r.payAmount, 217); // 50 * 4.345
  assert.strictEqual(r.payType, 'monthly');
});

t('일급 + 주N일 → 월급(만원)으로 환산', function () {
  var r = ShareParse.parse({ title: '', text: '일급 100,620원 / 주5일', url: '' });
  assert.strictEqual(r.payAmount, 219); // 10.062만원 * 5일 * 4.345주
  assert.strictEqual(r.payType, 'monthly');
});

t('일급인데 근무일수를 모르면 급여를 비워둔다 — 추측하면 순위가 통째로 틀어짐', function () {
  var r = ShareParse.parse({ title: '', text: '일급 100,620원 / 요일협의', url: '' });
  assert.strictEqual(r.payAmount, null);
  assert.strictEqual(r.payType, null);
});

t('"일 최대 20만원" 같은 홍보문구를 급여로 오인하지 않음', function () {
  var r = ShareParse.parse({ title: '', text: '[추석 단기알바] 일 최대 20만원! #쿠팡', url: '' });
  assert.strictEqual(r.payAmount, null);
});

t('"평일" → 주5일', function () {
  var r = ShareParse.parse({ title: '', text: '평일 근무, 시급 12000원', url: '' });
  assert.strictEqual(r.daysPerWeek, 5);
});

t('"월~금" 요일 범위 → 주5일', function () {
  var r = ShareParse.parse({ title: '', text: '근무요일: 월~금', url: '' });
  assert.strictEqual(r.daysPerWeek, 5);
});

t('법인 표기가 있는 줄을 업체명으로 우선 사용 — 공고는 제목이 먼저 오고 회사명이 뒤에 있음', function () {
  var r = ShareParse.parse({
    title: '',
    text: '[추석 맞이 단기알바] 일 최대 20만원! #단순소분#쿠팡\n쿠팡로지스틱스서비스(유)\n일급 100,620원',
    url: ''
  });
  assert.strictEqual(r.name, '쿠팡로지스틱스서비스(유)');
});

t('법인 표기가 없으면 기존대로 title/첫 줄을 사용', function () {
  var r = ShareParse.parse({ title: '', text: '스타벅스 역삼점 바리스타 모집\n시급 12000원', url: '' });
  assert.strictEqual(r.name, '스타벅스 역삼점 바리스타 모집');
});

t('title의 " - " 앞부분을 업체명으로 사용', function () {
  var r = ShareParse.parse({ title: '이디야커피 강남점 알바 - 알바몬', text: '', url: '' });
  assert.strictEqual(r.name, '이디야커피 강남점 알바');
});

t('title 없으면 text 첫 줄을 업체명으로 사용', function () {
  var r = ShareParse.parse({ title: '', text: '스타벅스 역삼점 바리스타 모집\n시급 12000원', url: '' });
  assert.strictEqual(r.name, '스타벅스 역삼점 바리스타 모집');
});

t('url 파라미터가 있으면 그대로 sourceUrl로', function () {
  var r = ShareParse.parse({ title: '', text: '아무 텍스트', url: 'https://albamon.com/12345' });
  assert.strictEqual(r.sourceUrl, 'https://albamon.com/12345');
});

t('url 파라미터 없으면 text 안의 링크를 추출', function () {
  var r = ShareParse.parse({ title: '', text: '공고 보기 https://albamon.com/12345 확인해줘', url: '' });
  assert.strictEqual(r.sourceUrl, 'https://albamon.com/12345');
});

t('아무 것도 안 맞으면 조용히 빈 값 — 예외 던지지 않음', function () {
  var r = ShareParse.parse({ title: '', text: '', url: '' });
  assert.strictEqual(r.payAmount, null);
  assert.strictEqual(r.start, null);
  assert.strictEqual(r.daysPerWeek, null);
  assert.strictEqual(r.name, '');
});
