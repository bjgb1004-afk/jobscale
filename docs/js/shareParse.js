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

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  // score.js는 시급을 "원" 단위, 월급을 "만원" 단위로 저장한다고 가정하고 계산한다
  // (monthlyPayWon = hourly면 amount 그대로, monthly면 amount*10000). 그래서 파싱된
  // 숫자도 그 단위에 맞춰 변환해야 한다 — 안 맞추면 월급이 10000배로 계산되는 버그가 남.
  function parsePay(text) {
    var m = text.match(/(시급|월급)\s*[:\-]?\s*([0-9][0-9,]*)\s*(만원|원)?/);
    if (!m) return { payAmount: null, payType: null };
    var amount = Number(m[2].replace(/,/g, ''));
    var isHourly = m[1] === '시급';
    if (isHourly) {
      if (m[3] === '만원') amount *= 10000;
    } else if (m[3] === '원') {
      amount = Math.round(amount / 10000);
    }
    return { payAmount: amount, payType: isHourly ? 'hourly' : 'monthly' };
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
    var pay = parsePay(combined);
    var time = parseTime(combined);
    return {
      name: parseName(title, text),
      payAmount: pay.payAmount,
      payType: pay.payType,
      start: time.start,
      end: time.end,
      daysPerWeek: parseDays(combined),
      sourceUrl: parseUrl(input && input.url, combined)
    };
  }

  return { parse: parse };
});
