/**
 * 최소 i18n 로더. 라이브러리 없음.
 * strings.ko.js가 먼저 로드되어 window.STRINGS_KO를 만들어 둔다고 가정.
 * 언어를 늘릴 때: strings.en.js 등을 추가하고 LANG_MAP에 한 줄만 더한다.
 */
(function (root) {
  'use strict';

  var LANG_MAP = { ko: 'STRINGS_KO' }; // 언어 늘리면 { ko: 'STRINGS_KO', en: 'STRINGS_EN' }

  function currentLang() {
    return (root.document && document.documentElement.lang) || 'ko';
  }

  function dict() {
    var varName = LANG_MAP[currentLang()] || LANG_MAP.ko;
    return root[varName] || root.STRINGS_KO || {};
  }

  function t(key, vars) {
    var s = dict()[key];
    if (s == null) return key; // 키 없으면 키 자체를 보여줘 누락을 눈에 띄게 함
    if (vars) {
      // 한 번의 패스로만 치환 — 치환된 값 안에 다른 {키} 문자열이 들어있어도 재치환되지 않게 함
      s = s.replace(/\{(\w+)\}/g, function (m, k) {
        return Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : m;
      });
    }
    return s;
  }

  function applyI18n(rootEl) {
    rootEl = rootEl || document;
    rootEl.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    rootEl.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
    });
    rootEl.querySelectorAll('[data-i18n-title]').forEach(function (el) {
      el.title = t(el.getAttribute('data-i18n-title'));
    });
  }

  root.t = t;
  root.applyI18n = applyI18n;
})(typeof window !== 'undefined' ? window : this);
