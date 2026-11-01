/**
 * 임금계산기 — 순수 함수만. DOM 접근 없음. score.js와 같은 틀.
 * 브라우저(<script>)와 node(require) 양쪽에서 동작.
 *
 * 소득세는 국세청 간이세액표 자체(수천 행 표)를 베끼지 않고, 그 표를 만드는 공식
 * (소득세법 §47/§55/§59)을 구현한다. 자녀세액공제·경로우대공제·급여수준별 세액공제
 * 한도축소 구간은 생략한 간소화판이라 네이버 계산기와 정확히 1원까지는 안 맞을 수 있음.
 * 자세한 설계는 tasks/specs/2026-10-31-wage-calculator-design.md 참고.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.WageCalc = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var WEEKS_PER_MONTH = 4.345; // score.js와 동일 값 (이 파일은 score.js에 의존하지 않음)

  // 매년 1~2월에 국가가 고시하는 비율로 교체. 산재보험은 전액 사업주 부담이라 제외.
  var RATES_2026 = {
    nationalPension: 0.045,
    healthInsurance: 0.03545,
    longTermCare: 0.1295, // 건강보험료 × 이 비율
    employmentInsurance: 0.009
  };

  function monthlyFromHourly(hourly, hoursPerDay, daysPerWeek) {
    return (hourly || 0) * (hoursPerDay || 0) * (daysPerWeek || 0) * WEEKS_PER_MONTH;
  }

  function monthlyFromDaily(daily, daysPerWeek) {
    return (daily || 0) * (daysPerWeek || 0) * WEEKS_PER_MONTH;
  }

  function monthlyFromAnnual(annual) {
    return (annual || 0) / 12;
  }

  // 입력: { type: 'hourly'|'daily'|'monthly'|'annual', amount, hoursPerDay, daysPerWeek }
  // 출력: 세전 금액 { hourly, daily, monthly, annual } 전부.
  function convertAll(input) {
    var hoursPerDay = input.hoursPerDay || 0;
    var daysPerWeek = input.daysPerWeek || 0;
    var monthly;
    if (input.type === 'hourly') monthly = monthlyFromHourly(input.amount, hoursPerDay, daysPerWeek);
    else if (input.type === 'daily') monthly = monthlyFromDaily(input.amount, daysPerWeek);
    else if (input.type === 'annual') monthly = monthlyFromAnnual(input.amount);
    else monthly = input.amount || 0; // monthly

    var hoursPerMonth = hoursPerDay * daysPerWeek * WEEKS_PER_MONTH;
    var daysPerMonth = daysPerWeek * WEEKS_PER_MONTH;
    return {
      hourly: hoursPerMonth > 0 ? monthly / hoursPerMonth : 0,
      daily: daysPerMonth > 0 ? monthly / daysPerMonth : 0,
      monthly: monthly,
      annual: monthly * 12
    };
  }

  function insuranceDeduction(monthlyWon, rates) {
    rates = rates || RATES_2026;
    var nationalPension = monthlyWon * rates.nationalPension;
    var healthInsurance = monthlyWon * rates.healthInsurance;
    var longTermCare = healthInsurance * rates.longTermCare;
    var employmentInsurance = monthlyWon * rates.employmentInsurance;
    return {
      nationalPension: nationalPension,
      healthInsurance: healthInsurance,
      longTermCare: longTermCare,
      employmentInsurance: employmentInsurance,
      total: nationalPension + healthInsurance + longTermCare + employmentInsurance
    };
  }

  // 구간표 공통 계산: value가 속한 구간을 찾아 base + (value - floor) * rate
  function applyBrackets(value, brackets) {
    for (var i = 0; i < brackets.length; i++) {
      var b = brackets[i];
      if (value <= b.upto) return b.base + (value - b.floor) * b.rate;
    }
    var last = brackets[brackets.length - 1];
    return last.base + (value - last.floor) * last.rate;
  }

  var EARNED_INCOME_DEDUCTION = [
    { floor: 0, upto: 5000000, base: 0, rate: 0.7 },
    { floor: 5000000, upto: 15000000, base: 3500000, rate: 0.4 },
    { floor: 15000000, upto: 45000000, base: 7500000, rate: 0.15 },
    { floor: 45000000, upto: 100000000, base: 12000000, rate: 0.05 },
    { floor: 100000000, upto: Infinity, base: 14750000, rate: 0.02 }
  ];

  var TAX_BRACKETS = [
    { floor: 0, upto: 14000000, base: 0, rate: 0.06 },
    { floor: 14000000, upto: 50000000, base: 840000, rate: 0.15 },
    { floor: 50000000, upto: 88000000, base: 6240000, rate: 0.24 },
    { floor: 88000000, upto: 150000000, base: 15360000, rate: 0.35 },
    { floor: 150000000, upto: 300000000, base: 37060000, rate: 0.38 },
    { floor: 300000000, upto: 500000000, base: 94060000, rate: 0.4 },
    { floor: 500000000, upto: 1000000000, base: 174060000, rate: 0.42 },
    { floor: 1000000000, upto: Infinity, base: 384060000, rate: 0.45 }
  ];

  function earnedIncomeTaxCredit(calculatedTax) {
    if (calculatedTax <= 1300000) return calculatedTax * 0.55;
    return 715000 + (calculatedTax - 1300000) * 0.3;
  }

  // 부양가족수: 본인 포함 인원 수(기본 1).
  function incomeTax(monthlyWon, dependents) {
    dependents = dependents || 1;
    var annualEstimate = monthlyWon * 12;
    var earnedIncomeDeduction = applyBrackets(annualEstimate, EARNED_INCOME_DEDUCTION);
    var earnedIncomeAmount = Math.max(0, annualEstimate - earnedIncomeDeduction);
    var personalDeduction = dependents * 1500000;
    var taxBase = Math.max(0, earnedIncomeAmount - personalDeduction);
    var calculatedTax = applyBrackets(taxBase, TAX_BRACKETS);
    var credit = earnedIncomeTaxCredit(calculatedTax);
    var annualTax = Math.max(0, calculatedTax - credit);
    var monthlyIncomeTax = annualTax / 12;
    return {
      incomeTax: monthlyIncomeTax,
      localIncomeTax: monthlyIncomeTax * 0.1,
      total: monthlyIncomeTax * 1.1
    };
  }

  // taxFreeAmount: 비과세액(식대 등, 월 기준). 4대보험·세금 산정 기준에서 제외된다.
  function netPay(monthlyWon, dependents, rates, taxFreeAmount) {
    var taxableMonthly = Math.max(0, monthlyWon - (taxFreeAmount || 0));
    var insurance = insuranceDeduction(taxableMonthly, rates);
    var tax = incomeTax(taxableMonthly, dependents);
    var deducted = insurance.total + tax.total;
    return {
      gross: monthlyWon,
      taxFreeAmount: taxFreeAmount || 0,
      insurance: insurance,
      tax: tax,
      deducted: deducted,
      net: monthlyWon - deducted
    };
  }

  return {
    RATES_2026: RATES_2026,
    monthlyFromHourly: monthlyFromHourly,
    monthlyFromDaily: monthlyFromDaily,
    monthlyFromAnnual: monthlyFromAnnual,
    convertAll: convertAll,
    insuranceDeduction: insuranceDeduction,
    incomeTax: incomeTax,
    netPay: netPay
  };
});
