/**
 * 공공 채용공고(docs/data/jobs.json의 item)를 앱의 job 객체로 바꾼다.
 *
 * 공고에 없는 칸(근무시간·통근·휴게)은 표준값으로 채운다. 비워두면 안 되는 이유:
 * score.js의 monthlyWorkHours()는 '퇴근 - 출근 <= 0'이면 야간 교대로 보고 24시간을 더해서,
 * 시간이 빈 job은 하루 24시간 근무로 계산돼 실질시급과 순위가 망가진다.
 * 대신 채운 칸을 needsCheck에 적어두고 화면에서 '확인 필요'로 드러낸다.
 *
 * 순수 함수만. DOM 접근 없음. 브라우저(<script>)와 node(require) 양쪽에서 동작.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FeedImport = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var NAME_MAX = 40; // 등록 폼 jf-name의 maxlength와 동일
  var DEFAULTS = { start: '09:00', end: '18:00', breakMin: 60, daysPerWeek: 5, commuteMin: 0, intensity: 'normal' };

  /**
   * 공고 이름: '기관명 · 공고제목'을 폼과 같은 길이로 자른다.
   * 제목이 기관명으로 시작하면(공고 제목에 기관명을 또 적는 경우가 흔하다) 앞의 기관명은 뺀다 —
   * 안 그러면 '서울연구원 · 서울연구원 2026년 …'이 되고 40자 제한에 제목 끝이 잘려나간다.
   */
  function buildName(item) {
    var org = (item.org || '').trim();
    var title = (item.title || '').trim();
    var name = org && title && title.indexOf(org) !== 0 ? org + ' · ' + title : (title || org);
    return name.length > NAME_MAX ? name.slice(0, NAME_MAX) : name;
  }

  /** 연봉(원) → 월급 만원 단위. 급여 미기재(null)면 0으로 넣고 needsCheck에 남긴다. */
  function monthlyManWon(incomeWon) {
    if (typeof incomeWon !== 'number' || !isFinite(incomeWon) || incomeWon <= 0) return 0;
    return Math.round(incomeWon / 12 / 10000);
  }

  function buildJob(item, id) {
    var amount = monthlyManWon(item.incomeWon);
    var needsCheck = ['hours'];                 // 근무시간·통근은 공고에 아예 없다
    if (amount === 0) needsCheck.unshift('pay'); // 급여를 못 넣은 경우만 급여도 확인 대상
    return {
      id: id,
      name: buildName(item),
      pay: { amount: amount, unit: 'monthly' },
      start: DEFAULTS.start,
      end: DEFAULTS.end,
      daysPerWeek: DEFAULTS.daysPerWeek,
      commuteMin: DEFAULTS.commuteMin,
      breakMin: DEFAULTS.breakMin,
      intensity: DEFAULTS.intensity,
      employmentType: item.emp === 'regular' ? 'regular' : 'contract',
      insurance: false,    // 공공기관이라도 공고에 명시가 없어 추정하지 않는다
      weekendWork: false,
      sourceUrl: item.url || null,
      needsCheck: needsCheck
    };
  }

  /** 마감까지 남은 날. 오늘 마감이면 0, 지났으면 음수. */
  function daysLeft(endDate, today) {
    if (!endDate) return null;
    var diff = Date.parse(endDate + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z');
    return isNaN(diff) ? null : Math.round(diff / 86400000);
  }

  /** 한국 기준 오늘(YYYY-MM-DD). 기기 시간대가 뭐든 공고 마감일과 같은 기준으로 센다. */
  function todayKST(now) {
    return new Date((now || new Date()).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  }

  /** 지역 필터 + 마감 지난 건 제거 + 마감 임박순. JSON이 최대 하루 묵을 수 있어 렌더 시점에도 거른다. */
  function visibleItems(items, sido, today) {
    return (items || [])
      .filter(function (it) { return !sido || it.sido === sido; })
      .filter(function (it) { return daysLeft(it.end, today) >= 0; })
      .sort(function (a, b) { return String(a.end).localeCompare(String(b.end)); });
  }

  return {
    buildJob: buildJob,
    monthlyManWon: monthlyManWon,
    buildName: buildName,
    daysLeft: daysLeft,
    todayKST: todayKST,
    visibleItems: visibleItems,
    DEFAULTS: DEFAULTS
  };
});
