/**
 * 다른 앱(알바몬/사람인/당근알바 등)의 "공유하기"로 들어온 title/text/url에서
 * 급여·근무시간·요일·업체명·원문링크를 최선을 다해(best-effort) 뽑아낸다.
 * 확신 없는 항목은 null/빈 값으로 남겨 사람이 등록 폼에서 확인·수정하게 한다.
 * 순수 함수만. DOM 접근 없음. 브라우저(<script>)와 node(require) 양쪽에서 동작.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ShareParse = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];
  var WEEKS_PER_MONTH = 4.345; // score.js와 동일 값 (이 파일은 score.js에 의존하지 않음)

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  // score.js는 시급을 "원" 단위, 월급을 "만원" 단위로 저장한다고 가정하고 계산한다
  // (monthlyPayWon = hourly면 amount 그대로, monthly면 amount*10000). 그래서 파싱된
  // 숫자도 그 단위에 맞춰 변환해야 한다 — 안 맞추면 월급이 10000배로 계산되는 버그가 남.
  // 실제 공고엔 연봉(사람인)·일급(알바천국)도 흔한데 score.js엔 그 단위가 없어서
  // 전부 월급(만원)으로 환산해 넣는다.
  function parsePay(text, daysPerWeek) {
    var m = text.match(/(시급|일급|주급|월급|연봉)\s*[:\-]?\s*([0-9][0-9,]*)\s*(만원|원)?/);
    if (!m) return { payAmount: null, payType: null };
    var amount = Number(m[2].replace(/,/g, ''));
    var kind = m[1];

    if (kind === '시급') {
      if (m[3] === '만원') amount *= 10000;
      return { payAmount: amount, payType: 'hourly' };
    }

    var manwon = m[3] === '원' ? amount / 10000 : amount;
    if (kind === '월급') return { payAmount: Math.round(manwon), payType: 'monthly' };
    if (kind === '연봉') return { payAmount: Math.round(manwon / 12), payType: 'monthly' };
    if (kind === '주급') return { payAmount: Math.round(manwon * WEEKS_PER_MONTH), payType: 'monthly' };
    // 일급은 주 몇 일 나가는지를 알아야 월급이 나온다. "요일협의"처럼 알 수 없으면
    // 비워둬서 사람이 직접 넣게 한다 — 임의로 5일을 가정하면 순위가 통째로 틀어진다.
    if (!daysPerWeek) return { payAmount: null, payType: null };
    return { payAmount: Math.round(manwon * daysPerWeek * WEEKS_PER_MONTH), payType: 'monthly' };
  }

  function parseTime(text) {
    var m = text.match(/(\d{1,2})\s*[:시]\s*(\d{2})?\s*[~\-–]\s*(\d{1,2})\s*[:시]\s*(\d{2})?/);
    if (!m) return { start: null, end: null };
    var h1 = Number(m[1]), h2 = Number(m[3]);
    if (h1 > 23 || h2 > 23) return { start: null, end: null };
    return { start: pad2(h1) + ':' + (m[2] || '00'), end: pad2(h2) + ':' + (m[4] || '00') };
  }

  function parseDays(text) {
    var m = text.match(/주\s*([1-7])\s*일/);
    if (m) return Number(m[1]);
    if (text.indexOf('평일') !== -1) return 5;
    var range = text.match(/(월|화|수|목|금|토|일)\s*[~\-]\s*(월|화|수|목|금|토|일)/);
    if (range) {
      var from = WEEKDAYS.indexOf(range[1]), to = WEEKDAYS.indexOf(range[2]);
      if (from !== -1 && to !== -1 && to >= from) return to - from + 1;
    }
    return null;
  }

  function parseName(title, text) {
    // 구인앱 공고는 홍보성 제목이 맨 위에 오고 회사명이 그 아래에 따로 있다. 제목을 회사명
    // 칸에 넣으면 순위 목록이 통째로 광고문구가 되므로, 법인 표기가 있는 줄을 먼저 찾는다.
    var corp = (text || '').match(/^.*(?:\(주\)|\(유\)|㈜|주식회사).*$/m);
    if (corp) return corp[0].trim().slice(0, 40);
    if (title) {
      var head = title.split(/\s[-|:]{1,2}\s/)[0].trim();
      if (head) return head.slice(0, 40);
    }
    var firstLine = (text || '').split('\n')[0].trim();
    return firstLine.slice(0, 40);
  }

  function parseUrl(explicitUrl, text) {
    if (explicitUrl) return explicitUrl;
    var m = (text || '').match(/https?:\/\/\S+/);
    return m ? m[0] : null;
  }

  function parse(input) {
    var title = input && input.title || '';
    var text = input && input.text || '';
    var combined = (title + '\n' + text).trim();
    var daysPerWeek = parseDays(combined);
    var pay = parsePay(combined, daysPerWeek); // 일급 환산에 근무일수가 필요해 먼저 구한다
    var time = parseTime(combined);
    return {
      name: parseName(title, text),
      payAmount: pay.payAmount,
      payType: pay.payType,
      start: time.start,
      end: time.end,
      daysPerWeek: daysPerWeek,
      sourceUrl: parseUrl(input && input.url, combined)
    };
  }

  return { parse: parse };
});
