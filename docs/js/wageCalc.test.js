/**
 * wageCalc.js 자체 테스트. 실행: node docs/js/wageCalc.test.js
 * 프레임워크 없음 — assert만 사용. score.test.js와 동일 패턴.
 * 검증 방식: 손으로 계산한 예시값과 비교(독립 재구현).
 */
var assert = require('assert');
var W = require('./wageCalc.js');

function approx(actual, expected, eps, msg) {
  eps = eps == null ? 1 : eps;
  assert.ok(Math.abs(actual - expected) <= eps,
    (msg || '') + ' — expected ~' + expected + ', got ' + actual);
}

// ---------- 1. 단위 환산 (세전) ----------
(function testConvertAll() {
  // 시급 10,000원, 하루8시간, 주5일 → 월급 10000*8*5*4.345 = 1,738,000
  var r1 = W.convertAll({ type: 'hourly', amount: 10000, hoursPerDay: 8, daysPerWeek: 5 });
  approx(r1.monthly, 1738000, 1, '시급→월급');
  approx(r1.annual, 1738000 * 12, 1, '시급→연봉');

  // 일급 100,000원, 주5일 → 월급 100000*5*4.345 = 2,172,500
  var r2 = W.convertAll({ type: 'daily', amount: 100000, hoursPerDay: 8, daysPerWeek: 5 });
  approx(r2.monthly, 2172500, 1, '일급→월급');

  // 월급 3,000,000원, 하루8시간 주5일 → 평균 시급 = 월급/(8*5*4.345)
  var r3 = W.convertAll({ type: 'monthly', amount: 3000000, hoursPerDay: 8, daysPerWeek: 5 });
  approx(r3.hourly, 3000000 / (8 * 5 * 4.345), 1, '월급→시급 역산');

  // 연봉 3,600만원 → 월급 300만원
  var r4 = W.convertAll({ type: 'annual', amount: 36000000, hoursPerDay: 8, daysPerWeek: 5 });
  approx(r4.monthly, 3000000, 1, '연봉→월급');

  console.log('OK 1: 단위 환산(세전) 공식 일치');
})();

// ---------- 2. 4대보험 — 월급 300만원 기준 ----------
(function testInsurance() {
  var ins = W.insuranceDeduction(3000000);
  approx(ins.nationalPension, 135000, 1, '국민연금');
  approx(ins.healthInsurance, 106350, 1, '건강보험');
  approx(ins.longTermCare, 106350 * 0.1295, 1, '장기요양보험');
  approx(ins.employmentInsurance, 27000, 1, '고용보험');
  console.log('OK 2: 4대보험 공식 일치');
})();

// ---------- 3. 소득세 — 월급 300만원, 부양가족 1명(본인만) 기준, 손계산 비교 ----------
(function testIncomeTax() {
  var tax = W.incomeTax(3000000, 1);
  // 연간급여 3600만 → 근로소득공제 750만+(3600-1500)*15%만=1065만
  // 근로소득금액 2535만 - 인적공제150만 = 과세표준 2385만
  // 산출세액 84만+(2385-1400)*15%=231.75만
  // 근로소득세액공제 71.5만+(231.75-130)*30%=102.025만
  // 연간결정세액 129.725만 → 월 10.8104만
  approx(tax.incomeTax, 108104, 100, '소득세(월)');
  approx(tax.localIncomeTax, tax.incomeTax / 10, 1, '지방소득세=소득세의 10%');
  console.log('OK 3: 소득세 공식 손계산 일치');
})();

// ---------- 4. 실수령액 = 월급 - 4대보험 - 세금 ----------
(function testNetPay() {
  var net = W.netPay(3000000, 1);
  var expectedNet = 3000000
    - (135000 + 106350 + 106350 * 0.1295 + 27000)
    - (108104 + 10810);
  approx(net.net, expectedNet, 150, '실수령액');
  console.log('OK 4: 실수령액 = 월급 - 4대보험 - 세금');
})();

// ---------- 5. 비과세액(식대 등) — 월급 300만원 중 20만원 비과세 ----------
(function testNetPayTaxFree() {
  var netWithTaxFree = W.netPay(3000000, 1, null, 200000);
  var netWithoutTaxFree = W.netPay(2800000, 1); // 비과세 뗀 280만원 자체를 과세대상으로 계산한 것과 같아야 함
  approx(netWithTaxFree.insurance.total, netWithoutTaxFree.insurance.total, 1, '비과세 반영 4대보험');
  approx(netWithTaxFree.tax.total, netWithoutTaxFree.tax.total, 1, '비과세 반영 세금');
  // 실수령액은 원래 월급(300만) 기준이라 더 높아야 함
  approx(netWithTaxFree.net, 3000000 - netWithoutTaxFree.deducted, 1, '비과세 반영 실수령액');
  console.log('OK 5: 비과세액만큼 4대보험·세금 산정 기준에서 빠짐');
})();

// ---------- 6. 가산수당(잔업·특근) ----------
(function testExtraPay() {
  // 통상시급 10,000원
  // 평일 잔업 월 20시간 → 10000*20*1.5 = 300,000
  var a = W.extraPay(10000, { overtimeHours: 20 });
  approx(a.overtime, 300000, 1, '평일 잔업 1.5배');
  approx(a.holiday, 0, 1, '특근 없으면 0');

  // 특근 하루 6시간 × 월 2회 → 8시간 이내라 전부 1.5배: 10000*2*(6*1.5) = 180,000
  var b = W.extraPay(10000, { holidayHoursPerDay: 6, holidayDays: 2 });
  approx(b.holiday, 180000, 1, '특근 8시간 이내 1.5배');
  approx(b.holidayHours, 12, 0.01, '특근 총 시간');

  // 특근 하루 10시간 × 월 1회 → 8시간 1.5배 + 2시간 2배: 10000*(8*1.5+2*2) = 160,000
  var c = W.extraPay(10000, { holidayHoursPerDay: 10, holidayDays: 1 });
  approx(c.holiday, 160000, 1, '특근 8시간 초과분 2배');

  // 둘 다 있으면 합산
  var d = W.extraPay(10000, { overtimeHours: 20, holidayHoursPerDay: 10, holidayDays: 1 });
  approx(d.total, 300000 + 160000, 1, '잔업+특근 합산');

  // 잔업수당도 과세대상 → 실수령액 계산 기준에 더해진다
  var net = W.netPay(3000000 + d.total, 1, null, 0);
  assert.ok(net.net > W.netPay(3000000, 1, null, 0).net, '가산수당 포함 시 실수령액 증가');
  assert.ok(net.deducted > W.netPay(3000000, 1, null, 0).deducted, '가산수당도 공제 대상');

  console.log('OK 6: 가산수당(잔업 1.5배 / 특근 8h 이내 1.5배·초과 2배) 공식 일치');
})();
