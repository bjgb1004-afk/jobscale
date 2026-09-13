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

t('월급 + 만원 단위 환산', function () {
  var r = ShareParse.parse({ title: '', text: '월급 250만원 지급', url: '' });
  assert.strictEqual(r.payAmount, 2500000);
  assert.strictEqual(r.payType, 'monthly');
});

t('"평일" → 주5일', function () {
  var r = ShareParse.parse({ title: '', text: '평일 근무, 시급 12000원', url: '' });
  assert.strictEqual(r.daysPerWeek, 5);
});

t('"월~금" 요일 범위 → 주5일', function () {
  var r = ShareParse.parse({ title: '', text: '근무요일: 월~금', url: '' });
  assert.strictEqual(r.daysPerWeek, 5);
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
