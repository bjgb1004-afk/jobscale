/**
 * 잡스케일 계산 엔진 — 순수 함수만. DOM 접근 없음. 한글 문자열 없음(언어 무관).
 * 브라우저(<script>)와 node(require) 양쪽에서 동작.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.JobScore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var WEEKS_PER_MONTH = 4.345;

  var DEFAULT_TARGETS = {
    commuteTarget: 30,       // 분
    endTimeTarget: '18:00',
    startTimeTarget: '09:00',
    daysTarget: 5
  };

  var INTENSITY_LEVELS = ['very_easy', 'easy', 'normal', 'hard', 'very_hard'];
  var INTENSITY_SCORE = { very_easy: 100, easy: 80, normal: 60, hard: 35, very_hard: 10 };
  var EMPLOYMENT_TYPES = ['regular', 'contract', 'daily'];
  var EMPLOYMENT_SCORE = { regular: 50, contract: 30, daily: 10 };
  var SCORE_KEYS = ['pay', 'commute', 'endTime', 'startTime', 'days', 'intensity', 'stability'];

  function timeToMinutes(hhmm) {
    if (!hhmm || hhmm.indexOf(':') === -1) return 0;
    var parts = hhmm.split(':');
    return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
  }

  // 퇴근 <= 출근이면 야간 교대(자정 넘김)로 간주해 24시간을 더한다.
  function monthlyWorkHours(start, end, breakMin, daysPerWeek) {
    var s = timeToMinutes(start);
    var e = timeToMinutes(end);
    var diff = e - s;
    if (diff <= 0) diff += 24 * 60;
    diff -= (breakMin || 0);
    if (diff < 0) diff = 0;
    return (diff / 60) * (daysPerWeek || 0) * WEEKS_PER_MONTH;
  }

  function monthlyCommuteHours(oneWayMin, daysPerWeek) {
    return ((oneWayMin || 0) * 2 / 60) * (daysPerWeek || 0) * WEEKS_PER_MONTH;
  }

  // 월급은 '만원' 단위 입력, 시급은 '원' 단위 입력 — 둘 다 '원'으로 환산해 반환.
  function monthlyPayWon(job, workHours) {
    if (job.pay.unit === 'hourly') return (job.pay.amount || 0) * workHours;
    return (job.pay.amount || 0) * 10000;
  }

  function nominalWageWon(payWon, workHours) {
    return workHours > 0 ? payWon / workHours : 0;
  }

  function realWageWon(payWon, workHours, commuteHours) {
    var total = workHours + commuteHours;
    return total > 0 ? payWon / total : 0;
  }

  // 실질시급 기준 상대 정규화, 50~100 밴드 (0점은 "탈락"처럼 보여 신뢰를 깎으므로 쓰지 않음).
  function payScoreBand(realWages) {
    if (realWages.length === 0) return [];
    var min = Math.min.apply(null, realWages);
    var max = Math.max.apply(null, realWages);
    if (max === min) return realWages.map(function () { return 100; });
    return realWages.map(function (x) {
      return 50 + 50 * (x - min) / (max - min);
    });
  }

  function commuteScore(min, target) {
    var t = target == null ? DEFAULT_TARGETS.commuteTarget : target;
    if (min <= t) return 100;
    return Math.max(0, 100 - (min - t) * 2);
  }

  function endTimeScore(hhmm, target) {
    var t = timeToMinutes(target || DEFAULT_TARGETS.endTimeTarget);
    var x = timeToMinutes(hhmm);
    if (x <= t) return 100;
    return Math.max(0, 100 - (x - t));
  }

  function startTimeScore(hhmm, target) {
    var t = timeToMinutes(target || DEFAULT_TARGETS.startTimeTarget);
    var x = timeToMinutes(hhmm);
    if (x >= t) return 100;
    return Math.max(0, 100 - (t - x));
  }

  function daysScore(days, target) {
    var t = target == null ? DEFAULT_TARGETS.daysTarget : target;
    if (days <= t) return 100;
    return Math.max(0, 100 - (days - t) * 30);
  }

  function intensityScore(level) {
    return INTENSITY_SCORE[level] != null ? INTENSITY_SCORE[level] : INTENSITY_SCORE.normal;
  }

  function stabilityScore(employmentType, insurance) {
    var base = EMPLOYMENT_SCORE[employmentType] != null ? EMPLOYMENT_SCORE[employmentType] : EMPLOYMENT_SCORE.contract;
    return base + (insurance ? 50 : 0);
  }

  // 필수조건(하드필터). 점수와 분리. limits의 각 값이 null/undefined면 제한 없음.
  function applyHardFilters(jobs, limits) {
    limits = limits || {};
    var survivors = [];
    var rejected = [];
    jobs.forEach(function (job) {
      var reasons = [];
      var workHours = monthlyWorkHours(job.start, job.end, job.breakMin, job.daysPerWeek);
      var payWon = monthlyPayWon(job, workHours);
      var payManwon = payWon / 10000;

      if (limits.minPay != null && payManwon < limits.minPay) {
        reasons.push({ code: 'MIN_PAY', actual: payManwon, limit: limits.minPay });
      }
      if (limits.maxEndTime && timeToMinutes(job.end) > timeToMinutes(limits.maxEndTime)) {
        reasons.push({ code: 'MAX_END_TIME', actual: job.end, limit: limits.maxEndTime });
      }
      if (limits.maxCommute != null && job.commuteMin > limits.maxCommute) {
        reasons.push({ code: 'MAX_COMMUTE', actual: job.commuteMin, limit: limits.maxCommute });
      }
      if (limits.maxDays != null && job.daysPerWeek > limits.maxDays) {
        reasons.push({ code: 'MAX_DAYS', actual: job.daysPerWeek, limit: limits.maxDays });
      }

      if (reasons.length === 0) survivors.push(job);
      else rejected.push({ job: job, reasons: reasons });
    });
    return { survivors: survivors, rejected: rejected };
  }

  function computeRawScores(job, targets) {
    targets = targets || DEFAULT_TARGETS;
    var workHours = monthlyWorkHours(job.start, job.end, job.breakMin, job.daysPerWeek);
    var commuteHours = monthlyCommuteHours(job.commuteMin, job.daysPerWeek);
    var payWon = monthlyPayWon(job, workHours);
    return {
      workHours: workHours,
      commuteHours: commuteHours,
      monthlyPayWon: payWon,
      nominalWageWon: nominalWageWon(payWon, workHours),
      realWageWon: realWageWon(payWon, workHours, commuteHours),
      commute: commuteScore(job.commuteMin, targets.commuteTarget),
      endTime: endTimeScore(job.end, targets.endTimeTarget),
      startTime: startTimeScore(job.start, targets.startTimeTarget),
      days: daysScore(job.daysPerWeek, targets.daysTarget),
      intensity: intensityScore(job.intensity),
      stability: stabilityScore(job.employmentType, job.insurance)
    };
  }

  // 별 0개 항목은 분모에서도 제외. 전부 0이면 null (호출측에서 "1개 이상 선택" 안내).
  function totalScore(rawWithPay, weights) {
    var sumW = 0, sum = 0;
    SCORE_KEYS.forEach(function (k) {
      var w = weights[k] || 0;
      if (w > 0) {
        sumW += w;
        sum += rawWithPay[k] * w;
      }
    });
    if (sumW === 0) return null;
    return sum / sumW;
  }

  /**
   * 전체 파이프라인: 필수조건 필터 → 항목별 점수 → 급여 상대정규화 → 가중합 → 정렬.
   * 반환: { ranked: [{job, raw, total}], rejected: [{job, reasons}], error }
   * error: 'NO_JOBS' | 'ALL_REJECTED' | 'NO_WEIGHTS' | null
   */
  function rankJobs(jobs, weights, targets, limits) {
    if (!jobs || jobs.length === 0) return { ranked: [], rejected: [], error: 'NO_JOBS' };

    var filtered = applyHardFilters(jobs, limits);
    if (filtered.survivors.length === 0) {
      return { ranked: [], rejected: filtered.rejected, error: 'ALL_REJECTED' };
    }

    var raws = filtered.survivors.map(function (job) {
      return { job: job, raw: computeRawScores(job, targets) };
    });
    var realWages = raws.map(function (r) { return r.raw.realWageWon; });
    var payScores = payScoreBand(realWages);

    var scored = raws.map(function (r, i) {
      var full = {};
      Object.keys(r.raw).forEach(function (k) { full[k] = r.raw[k]; });
      full.pay = payScores[i];
      var total = totalScore(full, weights);
      return { job: r.job, raw: full, total: total };
    });

    if (scored.some(function (s) { return s.total === null; })) {
      return { ranked: [], rejected: filtered.rejected, error: 'NO_WEIGHTS' };
    }

    scored.sort(function (a, b) {
      return (b.total - a.total) || (b.raw.realWageWon - a.raw.realWageWon);
    });

    return { ranked: scored, rejected: filtered.rejected, error: null };
  }

  /**
   * 1위 근거 데이터 (문장은 app.js가 i18n으로 조립 — 이 함수는 한글을 모른다).
   * ponytail: 최저점 항목 하나만 비교 대상으로 삼는 단순 휴리스틱.
   *   더 정교한 기여도 분석 필요해지면 그때 확장.
   */
  function explainData(ranked, weights) {
    if (!ranked || ranked.length === 0) return null;
    var top = ranked[0];
    var activeKeys = SCORE_KEYS.filter(function (k) { return (weights[k] || 0) > 0; });
    if (activeKeys.length === 0) return null;

    var contrib = activeKeys.map(function (k) {
      return { key: k, value: top.raw[k] * (weights[k] || 0) };
    }).sort(function (a, b) { return b.value - a.value; });
    var bestKeys = contrib.slice(0, 2).map(function (c) { return c.key; });

    var worstKey = activeKeys.slice().sort(function (a, b) {
      return top.raw[a] - top.raw[b];
    })[0];

    var compareJob = ranked.length > 1 ? ranked[1].job : null;

    return {
      topJobId: top.job.id,
      bestKeys: bestKeys,
      worstKey: worstKey,
      compareJobId: compareJob ? compareJob.id : null
    };
  }

  return {
    DEFAULT_TARGETS: DEFAULT_TARGETS,
    INTENSITY_LEVELS: INTENSITY_LEVELS,
    EMPLOYMENT_TYPES: EMPLOYMENT_TYPES,
    SCORE_KEYS: SCORE_KEYS,
    timeToMinutes: timeToMinutes,
    monthlyWorkHours: monthlyWorkHours,
    monthlyCommuteHours: monthlyCommuteHours,
    monthlyPayWon: monthlyPayWon,
    nominalWageWon: nominalWageWon,
    realWageWon: realWageWon,
    payScoreBand: payScoreBand,
    commuteScore: commuteScore,
    endTimeScore: endTimeScore,
    startTimeScore: startTimeScore,
    daysScore: daysScore,
    intensityScore: intensityScore,
    stabilityScore: stabilityScore,
    applyHardFilters: applyHardFilters,
    computeRawScores: computeRawScores,
    totalScore: totalScore,
    rankJobs: rankJobs,
    explainData: explainData
  };
});
