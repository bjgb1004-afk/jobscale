/**
 * feedImport.js 자체 테스트. 실행: node docs/js/feedImport.test.js
 * 프레임워크 없음 — assert만 사용. shareParse.test.js와 동일 패턴.
 */
var assert = require('assert');
var FeedImport = require('./feedImport.js');
var JobScore = require('./score.js');

function t(desc, fn) {
  try { fn(); console.log('OK  ' + desc); }
  catch (e) { console.log('FAIL ' + desc + ' — ' + e.message); process.exitCode = 1; }
}

var ITEM = {
  id: '81013', sido: '007015', org: '창원시설공단', title: '수영 소그룹 도급강사 공개모집 공고',
  field: '스포츠', jobType: '기간제', emp: 'contract',
  income: '2600만원 이상', incomeWon: 26000000, incomeBound: 'min',
  end: '2026-11-20', addr: '경상남도 창원시', url: 'https://job.cleaneye.go.kr/user/ypCareersData.do?idx=81013'
};

t('연봉 2600만원 → 월급 217만원(만원 단위)', function () {
  assert.strictEqual(FeedImport.monthlyManWon(26000000), 217);
  assert.strictEqual(FeedImport.monthlyManWon(100000000), 833);
});

t('급여 미기재/무급은 0 (NaN이 job에 들어가면 점수 계산 전체가 깨진다)', function () {
  [null, undefined, 0, NaN, 'x'].forEach(function (v) {
    assert.strictEqual(FeedImport.monthlyManWon(v), 0, String(v));
  });
});

t('이름은 기관명 · 제목이고 폼과 같은 40자 제한', function () {
  assert.strictEqual(FeedImport.buildName(ITEM), '창원시설공단 · 수영 소그룹 도급강사 공개모집 공고');
  var long = FeedImport.buildName({ org: '가'.repeat(30), title: '나'.repeat(30) });
  assert.strictEqual(long.length, 40);
});

t('제목이 이미 기관명으로 시작하면 기관명을 또 붙이지 않는다', function () {
  assert.strictEqual(
    FeedImport.buildName({ org: '서울연구원', title: '서울연구원 2026년 제11회 정원외직원 채용 공고' }),
    '서울연구원 2026년 제11회 정원외직원 채용 공고'
  );
  assert.strictEqual(FeedImport.buildName({ org: '', title: '제목만' }), '제목만');
  assert.strictEqual(FeedImport.buildName({ org: '기관만', title: '' }), '기관만');
});

t('담은 job은 점수 계산에 필요한 필드가 전부 유효하다', function () {
  var job = FeedImport.buildJob(ITEM, 'jtest');
  assert.strictEqual(job.pay.unit, 'monthly');
  assert.strictEqual(job.pay.amount, 217);
  assert.strictEqual(job.employmentType, 'contract');
  assert.strictEqual(job.sourceUrl, ITEM.url);
  ['start', 'end'].forEach(function (k) {
    assert.ok(/^\d\d:\d\d$/.test(job[k]), k + '가 시간 형식이어야 한다: ' + job[k]);
  });
  assert.strictEqual(typeof job.commuteMin, 'number');
  assert.strictEqual(typeof job.breakMin, 'number');
});

t('근무시간이 하루 24시간으로 계산되지 않는다 (빈 시간 넣으면 터지는 바로 그 지점)', function () {
  var job = FeedImport.buildJob(ITEM, 'jtest');
  var hours = JobScore.monthlyWorkHours(job.start, job.end, job.breakMin, job.daysPerWeek);
  assert.ok(hours > 0 && hours < 24 * 30, '월 근무시간: ' + hours);
  // 09-18시, 휴게 60분, 주5일 → 하루 8시간 × 월 21.7일 ≈ 174시간
  assert.ok(Math.abs(hours - 174) < 6, '월 174시간 근처여야 한다: ' + hours);
  var broken = JobScore.monthlyWorkHours('', '', 0, 5);
  assert.ok(broken > hours * 2, '시간을 비우면 터진다는 전제 확인: ' + broken);
});

t('rankJobs가 담은 job에 점수를 매긴다', function () {
  var job = FeedImport.buildJob(ITEM, 'jtest');
  var res = JobScore.rankJobs([job], { pay: 3, commute: 3, endTime: 3, startTime: 3, days: 3, intensity: 3, stability: 3 }, {}, {});
  assert.ok(!res.error, '에러 없어야 한다: ' + res.error);
  assert.strictEqual(res.ranked.length, 1);
  assert.ok(res.ranked[0].raw.realWageWon > 0, '실질시급이 나와야 한다');
});

t('needsCheck — 급여가 있으면 시간만, 없으면 급여까지', function () {
  assert.deepStrictEqual(FeedImport.buildJob(ITEM, 'a').needsCheck, ['hours']);
  var noPay = Object.assign({}, ITEM, { incomeWon: null });
  assert.deepStrictEqual(FeedImport.buildJob(noPay, 'b').needsCheck, ['pay', 'hours']);
});

t('정규직 매핑', function () {
  assert.strictEqual(FeedImport.buildJob(Object.assign({}, ITEM, { emp: 'regular' }), 'a').employmentType, 'regular');
  assert.strictEqual(FeedImport.buildJob(Object.assign({}, ITEM, { emp: 'duh' }), 'a').employmentType, 'contract');
});

t('남은 날 계산', function () {
  assert.strictEqual(FeedImport.daysLeft('2026-11-20', '2026-11-18'), 2);
  assert.strictEqual(FeedImport.daysLeft('2026-11-18', '2026-11-18'), 0);
  assert.strictEqual(FeedImport.daysLeft('2026-11-17', '2026-11-18'), -1);
  assert.strictEqual(FeedImport.daysLeft('', '2026-11-18'), null);
});

t('UTC 늦은 시각에도 한국 날짜 기준', function () {
  assert.strictEqual(FeedImport.todayKST(new Date('2026-11-17T20:00:00Z')), '2026-11-18');
});

t('목록은 지역 필터 + 마감 지난 건 제거 + 마감 임박순', function () {
  var items = [
    { sido: '007001', end: '2026-11-25' },
    { sido: '007001', end: '2026-11-19' },
    { sido: '007001', end: '2026-11-01' },
    { sido: '007008', end: '2026-11-20' }
  ];
  var out = FeedImport.visibleItems(items, '007001', '2026-11-18');
  assert.deepStrictEqual(out.map(function (i) { return i.end; }), ['2026-11-19', '2026-11-25']);
  assert.strictEqual(FeedImport.visibleItems(items, null, '2026-11-18').length, 3);
  assert.strictEqual(FeedImport.visibleItems(null, '007001', '2026-11-18').length, 0);
});
