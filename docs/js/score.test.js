/**
 * score.js 자체 테스트. 실행: node app/js/score.test.js
 * 프레임워크 없음 — assert만 사용.
 *
 * 검증 방식: 기획서 5장 공식을 score.js와 별개로 여기서 다시 구현해
 * ("독립 재구현") 결과를 비교한다. score.js를 그대로 복붙해 비교하면
 * 같은 버그를 두 번 심을 수 있으므로 피한다.
 */
var assert = require('assert');
var S = require('./score.js');

function approx(actual, expected, eps, msg) {
  eps = eps == null ? 0.5 : eps;
  assert.ok(Math.abs(actual - expected) <= eps,
    (msg || '') + ' — expected ~' + expected + ', got ' + actual);
}

// ---------- 독립 재구현 (기획서 5장 그대로, score.js 코드는 보지 않고 공식만 따름) ----------
var WEEKS = 4.345;
function toMin(hhmm) { var p = hhmm.split(':'); return +p[0] * 60 + +p[1]; }
function workHoursExpected(start, end, brk, days) {
  var s = toMin(start), e = toMin(end), d = e - s;
  if (d <= 0) d += 24 * 60;
  d -= brk;
  return (d / 60) * days * WEEKS;
}
function commuteHoursExpected(oneWay, days) {
  return (oneWay * 2 / 60) * days * WEEKS;
}

// ---------- 테스트 데이터: gpt.txt 23장 예시와 동일한 3개 공고 ----------
function makeJob(id, name, payManwon, start, end, brk, days, commute, intensity) {
  return {
    id: id, name: name,
    pay: { amount: payManwon, unit: 'monthly' },
    start: start, end: end, breakMin: brk, daysPerWeek: days,
    commuteMin: commute, intensity: intensity,
    employmentType: 'regular', insurance: true
  };
}

var jobA = makeJob('A', 'A사', 300, '09:00', '18:00', 60, 5, 35, 'normal');
var jobB = makeJob('B', 'B사', 270, '08:00', '16:00', 60, 5, 15, 'easy');
var jobC = makeJob('C', 'C사', 290, '10:00', '19:00', 60, 5, 50, 'hard');

var weightsEqual = { pay: 1, commute: 1, endTime: 1, startTime: 1, days: 1, intensity: 1, stability: 1 };

// ---------- 1. 근무시간 / 통근시간 / 실질시급 공식 일치 ----------
(function testWorkAndCommuteHours() {
  approx(S.monthlyWorkHours('09:00', '18:00', 60, 5), workHoursExpected('09:00', '18:00', 60, 5), 0.01);
  approx(S.monthlyCommuteHours(35, 5), commuteHoursExpected(35, 5), 0.01);

  var wh = S.monthlyWorkHours(jobA.start, jobA.end, jobA.breakMin, jobA.daysPerWeek);
  var ch = S.monthlyCommuteHours(jobA.commuteMin, jobA.daysPerWeek);
  var payWon = 300 * 10000;
  var expectedReal = payWon / (wh + ch);
  approx(S.realWageWon(payWon, wh, ch), expectedReal, 1);
  console.log('OK 1: 근무/통근시간 및 실질시급 공식 일치');
})();

// ---------- 2. gpt.txt 23장 실질시급 역전 사례 재현 (A: 월급 높음, B: 실질시급 높음) ----------
(function testRealWageReversal() {
  var whA = S.monthlyWorkHours(jobA.start, jobA.end, jobA.breakMin, jobA.daysPerWeek);
  var chA = S.monthlyCommuteHours(jobA.commuteMin, jobA.daysPerWeek);
  var realA = S.realWageWon(S.monthlyPayWon(jobA, whA), whA, chA);

  var whB = S.monthlyWorkHours(jobB.start, jobB.end, jobB.breakMin, jobB.daysPerWeek);
  var chB = S.monthlyCommuteHours(jobB.commuteMin, jobB.daysPerWeek);
  var realB = S.realWageWon(S.monthlyPayWon(jobB, whB), whB, chB);

  assert.ok(realB > realA, '월급 낮은 B사가 실질시급은 A사보다 높아야 함 (통근시간이 짧으므로)');
  console.log('OK 2: 월급 역전(실질시급) A=' + Math.round(realA) + '원 < B=' + Math.round(realB) + '원');
})();

// ---------- 3. 급여 점수는 50~100 밴드, 공고 1개면 100 (0으로 나누기 없음) ----------
(function testPayScoreBand() {
  var band3 = S.payScoreBand([100, 150, 200]);
  band3.forEach(function (s) { assert.ok(s >= 50 && s <= 100, '급여점수는 50~100 사이여야 함: ' + s); });
  approx(Math.min.apply(null, band3), 50, 0.01);
  approx(Math.max.apply(null, band3), 100, 0.01);

  var band1 = S.payScoreBand([123]);
  assert.strictEqual(band1[0], 100, '공고 1개면 급여점수 100(0÷0 방지)');

  var bandEmpty = S.payScoreBand([]);
  assert.strictEqual(bandEmpty.length, 0);
  console.log('OK 3: 급여 점수 50~100 밴드 + 공고 1개 예외 처리');
})();

// ---------- 4. 개별 스코어 공식 ----------
(function testIndividualScores() {
  approx(S.commuteScore(30, 30), 100);
  approx(S.commuteScore(45, 30), 70);   // 15분 초과 × 2
  approx(S.commuteScore(80, 30), 0);

  approx(S.endTimeScore('18:00', '18:00'), 100);
  approx(S.endTimeScore('18:30', '18:00'), 70);
  approx(S.endTimeScore('19:40', '18:00'), 0);

  approx(S.startTimeScore('09:00', '09:00'), 100);
  approx(S.startTimeScore('08:00', '09:00'), 40);

  approx(S.daysScore(5, 5), 100);
  approx(S.daysScore(6, 5), 70);
  approx(S.daysScore(7, 5), 40);

  assert.strictEqual(S.intensityScore('very_easy'), 100);
  assert.strictEqual(S.intensityScore('very_hard'), 10);

  assert.strictEqual(S.stabilityScore('regular', true), 100);
  assert.strictEqual(S.stabilityScore('daily', false), 10);
  console.log('OK 4: 개별 항목 점수 공식 일치');
})();

// ---------- 5. 별점 전부 0 → NO_WEIGHTS 에러 ----------
(function testNoWeights() {
  var zeroWeights = { pay: 0, commute: 0, endTime: 0, startTime: 0, days: 0, intensity: 0, stability: 0 };
  var result = S.rankJobs([jobA, jobB, jobC], zeroWeights, S.DEFAULT_TARGETS, {});
  assert.strictEqual(result.error, 'NO_WEIGHTS');
  assert.strictEqual(result.ranked.length, 0);
  console.log('OK 5: 별점 전부 0 → NO_WEIGHTS');
})();

// ---------- 6. 공고 0개 → NO_JOBS ----------
(function testNoJobs() {
  var result = S.rankJobs([], weightsEqual, S.DEFAULT_TARGETS, {});
  assert.strictEqual(result.error, 'NO_JOBS');
  console.log('OK 6: 공고 0개 → NO_JOBS');
})();

// ---------- 7. 야간 교대(퇴근 < 출근) 근무시간 정상 계산 ----------
(function testOvernightShift() {
  var wh = S.monthlyWorkHours('22:00', '06:00', 0, 5);
  var expectedDaily = 8; // 22:00~06:00 = 8시간
  approx(wh, expectedDaily * 5 * WEEKS, 0.01, '야간 교대 근무시간');
  console.log('OK 7: 야간 교대(22:00~06:00) → 1일 8시간으로 계산');
})();

// ---------- 8. 필수조건 탈락 + 사유 반환 (숨기지 않음) ----------
(function testHardFilterRejection() {
  var limits = { maxEndTime: '18:00' };
  var result = S.rankJobs([jobA, jobB, jobC], weightsEqual, S.DEFAULT_TARGETS, limits);
  assert.strictEqual(result.error, null);
  assert.strictEqual(result.ranked.length, 2, 'A,B만 생존 (C는 19:00 퇴근으로 탈락)');
  assert.strictEqual(result.rejected.length, 1);
  assert.strictEqual(result.rejected[0].job.id, 'C');
  assert.strictEqual(result.rejected[0].reasons[0].code, 'MAX_END_TIME');
  console.log('OK 8: 필수조건 위반 공고가 사유와 함께 rejected에 남음');
})();

// ---------- 9. 전 공고 탈락 → ALL_REJECTED ----------
(function testAllRejected() {
  var limits = { maxEndTime: '01:00' }; // 아무도 통과 못함
  var result = S.rankJobs([jobA, jobB, jobC], weightsEqual, S.DEFAULT_TARGETS, limits);
  assert.strictEqual(result.error, 'ALL_REJECTED');
  assert.strictEqual(result.rejected.length, 3);
  console.log('OK 9: 전 공고 필수조건 탈락 → ALL_REJECTED');
})();

// ---------- 10. 전체 파이프라인 순위 + 근거 데이터 ----------
(function testFullPipelineAndExplain() {
  var result = S.rankJobs([jobA, jobB, jobC], weightsEqual, S.DEFAULT_TARGETS, {});
  assert.strictEqual(result.error, null);
  assert.strictEqual(result.ranked.length, 3);
  // 동점 타이브레이크: total 같으면 realWageWon 높은 쪽이 위
  for (var i = 0; i < result.ranked.length - 1; i++) {
    var a = result.ranked[i], b = result.ranked[i + 1];
    assert.ok(a.total > b.total || (a.total === b.total && a.raw.realWageWon >= b.raw.realWageWon),
      '정렬 순서가 총점 내림차순이어야 함');
  }

  var explain = S.explainData(result.ranked, weightsEqual);
  assert.ok(explain, 'explainData는 순위가 있으면 null이 아니어야 함');
  assert.strictEqual(explain.topJobId, result.ranked[0].job.id);
  assert.strictEqual(explain.bestKeys.length, 2);
  assert.ok(S.SCORE_KEYS.indexOf(explain.worstKey) !== -1);
  console.log('OK 10: 전체 파이프라인 정렬 + 근거 데이터(explainData) 정상');
})();

(function testMinPayReasonIsDisplayable() {
  // 시급 공고는 월급 환산에서 218.98799999999994 같은 값이 나온다 — 탈락 사유 문구에
  // 그대로 박히면 안 되고, 반올림으로 한계값과 같아 보여서도 안 된다.
  var hourly = { id: 'h', name: '시급공고', pay: { amount: 11200, unit: 'hourly' },
    start: '08:00', end: '16:00', daysPerWeek: 6, commuteMin: 10, breakMin: 30,
    intensity: 'easy', employmentType: 'contract', insurance: false };
  var out = S.rankJobs([hourly], weightsEqual, S.DEFAULT_TARGETS, { minPay: 230 });
  var reason = out.rejected[0].reasons.filter(function (r) { return r.code === 'MIN_PAY'; })[0];
  var decimals = String(reason.actual).split('.')[1];
  assert.ok(reason, 'MIN_PAY reason exists');
  assert.ok(!decimals || decimals.length <= 1, 'decimals<=1, got ' + reason.actual);
  assert.ok(reason.actual < reason.limit, 'displayed value must stay below the limit');
  console.log('OK 11: 시급 공고 MIN_PAY 탈락 사유에 부동소수 노출 없음');
})();

console.log('\n모든 테스트 통과.');
