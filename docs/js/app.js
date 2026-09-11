/**
 * 상태관리 + localStorage + 렌더링. 프레임워크 없음, 순수 DOM API.
 * score.js(계산)와 strings.ko.js/i18n.js(문구)만 의존.
 */
(function () {
  'use strict';

  var STORAGE_KEYS = {
    jobs: 'jobscale.jobs',
    weights: 'jobscale.weights',
    limits: 'jobscale.limits',
    targets: 'jobscale.targets'
  };

  var TEMPLATES = {
    parenting: { pay: 3, commute: 5, endTime: 5, startTime: 4, days: 4, intensity: 3, stability: 2 },
    money:     { pay: 5, commute: 2, endTime: 1, startTime: 1, days: 1, intensity: 1, stability: 2 },
    easy:      { pay: 3, commute: 3, endTime: 3, startTime: 2, days: 3, intensity: 5, stability: 3 },
    balance:   { pay: 3, commute: 4, endTime: 4, startTime: 3, days: 5, intensity: 3, stability: 4 }
  };

  var DEFAULT_WEIGHTS = { pay: 3, commute: 3, endTime: 3, startTime: 3, days: 3, intensity: 3, stability: 3 };
  var DEFAULT_LIMITS = { minPay: null, maxEndTime: null, maxCommute: null, maxDays: null };
  var LABEL_KEY = {
    pay: 'weight.pay', commute: 'weight.commute', endTime: 'weight.endTime',
    startTime: 'weight.startTime', days: 'weight.days', intensity: 'weight.intensity', stability: 'weight.stability'
  };

  function clone(obj) { return Array.isArray(obj) ? obj.slice() : Object.assign({}, obj); }

  function load(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : clone(fallback);
    } catch (e) {
      return clone(fallback);
    }
  }
  // 공유 링크로 열람 중(state.viewOnly)일 때 첫 저장 시도는 "내 원래 데이터를 덮어쓴다"는
  // 확인을 한 번 받는다 — 그 전엔 아무 것도 localStorage에 쓰지 않는다.
  function persist(key, value) {
    if (state.viewOnly) {
      if (!confirm(t('share.overwriteConfirm'))) return;
      state.viewOnly = false;
      var banner = document.getElementById('share-banner');
      if (banner) banner.hidden = true;
    }
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (e) { /* ponytail: 저장공간 초과 등은 조용히 무시 — 다음 저장 때 재시도됨 */ }
  }

  var state = {
    jobs: load(STORAGE_KEYS.jobs, []),
    weights: load(STORAGE_KEYS.weights, DEFAULT_WEIGHTS),
    limits: load(STORAGE_KEYS.limits, DEFAULT_LIMITS),
    targets: load(STORAGE_KEYS.targets, JobScore.DEFAULT_TARGETS),
    editingJobId: null,
    viewOnly: false,
    activeTemplate: null
  };

  function persistJobs() { persist(STORAGE_KEYS.jobs, state.jobs); }
  function persistWeights() { persist(STORAGE_KEYS.weights, state.weights); }
  function persistLimits() { persist(STORAGE_KEYS.limits, state.limits); }
  function persistTargets() { persist(STORAGE_KEYS.targets, state.targets); }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function uid() { return 'j' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  // 백업 파일/공유 링크처럼 외부에서 들어온 데이터는 형태가 깨져 있을 수 있어, 점수 계산이
  // 필요로 하는 최소 필드(pay.amount/pay.unit, start, end)가 없는 job은 걸러낸다.
  function sanitizeJobs(list) {
    if (!Array.isArray(list)) return [];
    return list.filter(function (j) {
      return j && typeof j === 'object' && j.pay && typeof j.pay.amount === 'number' &&
        typeof j.pay.unit === 'string' && typeof j.start === 'string' && typeof j.end === 'string';
    });
  }
  function clampWeights(weights) {
    var out = clone(DEFAULT_WEIGHTS);
    if (weights) {
      JobScore.SCORE_KEYS.forEach(function (k) {
        if (typeof weights[k] === 'number') out[k] = Math.max(0, Math.min(5, Math.round(weights[k])));
      });
    }
    return out;
  }
  function numOrNull(v) {
    if (v === '' || v == null) return null;
    var n = Number(v);
    return isNaN(n) ? null : n;
  }

  // ---------- 라우팅 (네이티브 hidden 속성, 프레임워크 없음) ----------
  // history.pushState로 화면 이동을 기록해서, 안드로이드/브라우저 뒤로가기가
  // 앱을 바로 이탈하지 않고 이전 화면(홈)으로 돌아오게 한다. fromPopstate가 true면
  // (뒤로가기로 호출된 경우) 다시 pushState하지 않아 히스토리가 쌓이지 않게 한다.
  function showView(name, fromPopstate) {
    document.querySelectorAll('.view').forEach(function (v) { v.hidden = (v.id !== 'view-' + name); });
    if (name === 'criteria') renderCriteria();
    if (name === 'compare') renderCompare();
    if (name === 'home') renderHome();
    window.scrollTo(0, 0);
    if (!fromPopstate) {
      if (name === 'home') history.replaceState({ view: 'home' }, '');
      else history.pushState({ view: name }, '');
    }
  }

  // ---------- 홈 ----------
  function updateTemplateButtons() {
    document.querySelectorAll('[data-template]').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-template') === state.activeTemplate);
    });
  }

  function renderHome() {
    updateTemplateButtons();
    var result = JobScore.rankJobs(state.jobs, state.weights, state.targets, state.limits);
    var listEl = document.getElementById('job-list');
    var explainEl = document.getElementById('explain-text');
    document.getElementById('job-count-label').textContent = t('home.myJobs', { count: state.jobs.length });

    explainEl.textContent = '';

    if (state.jobs.length === 0) {
      listEl.innerHTML = '<p class="empty">' + t('home.empty') + '</p>';
      return;
    }
    if (result.error === 'ALL_REJECTED') {
      listEl.innerHTML = '<p class="notice">' + t('home.allRejected') + '</p>' + renderRejectedList(result.rejected);
      return;
    }
    if (result.error === 'NO_WEIGHTS') {
      listEl.innerHTML = '<p class="notice">' + t('home.noWeights') + '</p>';
      return;
    }

    var medals = ['🥇', '🥈', '🥉'];
    var html = result.ranked.map(function (r, i) {
      var medal = medals[i] || (i + 1) + '.';
      return '<li class="job-card" data-id="' + r.job.id + '">' +
        '<span class="medal">' + medal + '</span>' +
        '<span class="job-name">' + escapeHtml(r.job.name) + '</span>' +
        '<span class="job-score">' + t('score.fitLabel') + ' ' + Math.round(r.total) + t('score.suffix') + '</span>' +
        '<span class="job-wage">' + t('wage.realLabel') + ' ' + Math.round(r.raw.realWageWon).toLocaleString() + t('wage.won') + '</span>' +
        '</li>';
    }).join('');

    if (result.ranked.length === 1) html += '<p class="hint">' + t('home.oneJobHint') + '</p>';
    html += renderRejectedList(result.rejected);
    listEl.innerHTML = '<ul class="job-cards">' + html + '</ul>';

    var explain = JobScore.explainData(result.ranked, state.weights);
    explainEl.textContent = buildExplainSentence(explain);

    listEl.querySelectorAll('.job-card').forEach(function (card) {
      card.addEventListener('click', function () { openJobForm(card.getAttribute('data-id')); });
    });
  }

  function renderRejectedList(rejected) {
    if (!rejected || rejected.length === 0) return '';
    return '<ul class="job-cards rejected">' + rejected.map(function (r) {
      var reasonText = r.reasons.map(function (reason) {
        return t('reason.' + reason.code, { actual: reason.actual, limit: reason.limit });
      }).join(', ');
      return '<li class="job-card rejected-card" data-id="' + r.job.id + '">' +
        '<span class="job-name">' + escapeHtml(r.job.name) + '</span>' +
        '<span class="reject-label">' + t('home.rejectedLabel') + '</span>' +
        '<span class="reject-reason">' + escapeHtml(reasonText) + '</span>' +
        '</li>';
    }).join('') + '</ul>';
  }

  function jobNameById(id) {
    var j = state.jobs.filter(function (x) { return x.id === id; })[0];
    return j ? j.name : '';
  }

  // 조사(이/가, 은/는, 과/와)는 언어별 문법이라 KO_JOSA(strings.ko.js)에 위임.
  // ponytail: 다른 언어 붙을 때 KO_JOSA가 없으면 빈 문자열 — 그 언어의 strings.*.js에서 필요하면 각자 구현.
  function josa(fn, word) {
    return (window.KO_JOSA && window.KO_JOSA[fn]) ? window.KO_JOSA[fn](word) : '';
  }

  function buildExplainSentence(explain) {
    if (!explain) return '';
    var topName = jobNameById(explain.topJobId);
    var best1 = t(LABEL_KEY[explain.bestKeys[0]]);
    var sentence;
    if (explain.bestKeys.length > 1) {
      sentence = t('explain.top2', {
        top: topName, topSubj: josa('subject', topName),
        best1: best1, best1And: josa('and', best1),
        best2: t(LABEL_KEY[explain.bestKeys[1]])
      });
    } else {
      sentence = t('explain.top1', { top: topName, topSubj: josa('subject', topName), best1: best1 });
    }
    if (explain.compareJobId) {
      var worst = t(LABEL_KEY[explain.worstKey]);
      sentence += t('explain.weakerThan', {
        worst: worst, worstTopic: josa('topic', worst),
        compare: jobNameById(explain.compareJobId)
      });
    }
    return sentence;
  }

  // ---------- 템플릿 (P6) ----------
  function applyTemplate(name) {
    if (name === 'custom') { showView('criteria'); return; }
    state.weights = clone(TEMPLATES[name]);
    state.activeTemplate = name;
    persistWeights();
    showView('home');
  }

  // ---------- 내 기준 화면 (P2 + P3) ----------
  function renderCriteria() {
    JobScore.SCORE_KEYS.forEach(function (key) {
      var input = document.querySelector('[data-weight="' + key + '"]');
      if (input) input.value = state.weights[key] || 0;
      updateStarLabel(key);
    });
    document.getElementById('limit-minPay').value = state.limits.minPay == null ? '' : state.limits.minPay;
    document.getElementById('limit-maxEndTime').value = state.limits.maxEndTime || '';
    document.getElementById('limit-maxCommute').value = state.limits.maxCommute == null ? '' : state.limits.maxCommute;
    document.getElementById('limit-maxDays').value = state.limits.maxDays == null ? '' : state.limits.maxDays;

    document.getElementById('target-commute').value = state.targets.commuteTarget;
    document.getElementById('target-endTime').value = state.targets.endTimeTarget;
    document.getElementById('target-startTime').value = state.targets.startTimeTarget;
    document.getElementById('target-days').value = state.targets.daysTarget;

    renderCriteriaLiveRank();
  }

  function updateStarLabel(key) {
    var v = Math.max(0, Math.min(5, state.weights[key] || 0));
    var el = document.querySelector('[data-star-label="' + key + '"]');
    if (el) el.textContent = '★'.repeat(v) + '☆'.repeat(5 - v);
  }

  // P2 완료판정: 별 바꾸면 0.1초 내 순위 변경 — 기준 화면 안에 미리보기 순위를 띄워 즉시 보여준다.
  function renderCriteriaLiveRank() {
    var el = document.getElementById('criteria-live-rank');
    if (!el) return;
    var result = JobScore.rankJobs(state.jobs, state.weights, state.targets, state.limits);
    if (result.ranked.length === 0) { el.innerHTML = ''; return; }
    var medals = ['🥇', '🥈', '🥉'];
    el.innerHTML = result.ranked.map(function (r, i) {
      return '<div class="live-rank-row"><span>' + (medals[i] || (i + 1) + '.') + ' ' + escapeHtml(r.job.name) +
        '</span><span>' + Math.round(r.total) + t('score.suffix') + '</span></div>';
    }).join('');
  }

  function saveCriteria() {
    state.activeTemplate = null; // 직접 조정했으니 더 이상 어느 템플릿과도 일치한다고 표시하지 않음
    JobScore.SCORE_KEYS.forEach(function (key) {
      var input = document.querySelector('[data-weight="' + key + '"]');
      if (input) state.weights[key] = parseInt(input.value, 10) || 0;
    });
    state.limits.minPay = numOrNull(document.getElementById('limit-minPay').value);
    state.limits.maxEndTime = document.getElementById('limit-maxEndTime').value || null;
    state.limits.maxCommute = numOrNull(document.getElementById('limit-maxCommute').value);
    state.limits.maxDays = numOrNull(document.getElementById('limit-maxDays').value);

    var commuteTargetInput = parseInt(document.getElementById('target-commute').value, 10);
    state.targets.commuteTarget = isNaN(commuteTargetInput) ? JobScore.DEFAULT_TARGETS.commuteTarget : commuteTargetInput;
    state.targets.endTimeTarget = document.getElementById('target-endTime').value || JobScore.DEFAULT_TARGETS.endTimeTarget;
    state.targets.startTimeTarget = document.getElementById('target-startTime').value || JobScore.DEFAULT_TARGETS.startTimeTarget;
    var daysTargetInput = parseInt(document.getElementById('target-days').value, 10);
    state.targets.daysTarget = isNaN(daysTargetInput) ? JobScore.DEFAULT_TARGETS.daysTarget : daysTargetInput;

    persistWeights(); persistLimits(); persistTargets();
    showView('home');
  }

  // ---------- 공고 등록 폼 (P1) ----------
  function openJobForm(id) {
    state.editingJobId = id || null;
    var job = id ? state.jobs.filter(function (j) { return j.id === id; })[0] : null;
    document.getElementById('jf-name').value = job ? job.name : '';
    document.getElementById('jf-payAmount').value = job ? job.pay.amount : '';
    document.getElementById('jf-payType').value = job ? job.pay.unit : 'monthly';
    document.getElementById('jf-start').value = job ? job.start : '09:00';
    document.getElementById('jf-end').value = job ? job.end : '18:00';
    document.getElementById('jf-days').value = job ? job.daysPerWeek : 5;
    document.getElementById('jf-commute').value = job ? job.commuteMin : '';
    document.getElementById('jf-break').value = job ? job.breakMin : 0;
    document.getElementById('jf-intensity').value = job ? job.intensity : 'normal';
    document.getElementById('jf-employmentType').value = job ? job.employmentType : 'regular';
    document.getElementById('jf-insurance').checked = job ? !!job.insurance : false;
    document.getElementById('jf-delete').hidden = !job;
    clearFormErrors();
    showView('jobform');
  }

  function clearFormErrors() {
    document.querySelectorAll('.field-error').forEach(function (el) { el.textContent = ''; });
  }

  function validateJobForm() {
    clearFormErrors();
    var ok = true;
    function requireField(fieldId, errId) {
      if (!document.getElementById(fieldId).value) {
        document.getElementById(errId).textContent = t('job.validation.required');
        ok = false;
      }
    }
    requireField('jf-name', 'jf-name-err');
    requireField('jf-payAmount', 'jf-payAmount-err');
    requireField('jf-start', 'jf-start-err');
    requireField('jf-end', 'jf-end-err');
    requireField('jf-commute', 'jf-commute-err');

    var payVal = document.getElementById('jf-payAmount').value;
    if (payVal && (isNaN(Number(payVal)) || Number(payVal) < 0)) {
      document.getElementById('jf-payAmount-err').textContent = t('job.validation.number'); ok = false;
    }
    var commuteVal = document.getElementById('jf-commute').value;
    if (commuteVal && (isNaN(Number(commuteVal)) || Number(commuteVal) < 0)) {
      document.getElementById('jf-commute-err').textContent = t('job.validation.number'); ok = false;
    }
    return ok;
  }

  function saveJobForm() {
    if (!validateJobForm()) return;
    var job = {
      id: state.editingJobId || uid(),
      name: document.getElementById('jf-name').value.trim(),
      pay: { amount: Number(document.getElementById('jf-payAmount').value), unit: document.getElementById('jf-payType').value },
      start: document.getElementById('jf-start').value,
      end: document.getElementById('jf-end').value,
      daysPerWeek: parseInt(document.getElementById('jf-days').value, 10) || 5,
      commuteMin: Number(document.getElementById('jf-commute').value),
      breakMin: parseInt(document.getElementById('jf-break').value, 10) || 0,
      intensity: document.getElementById('jf-intensity').value,
      employmentType: document.getElementById('jf-employmentType').value,
      insurance: document.getElementById('jf-insurance').checked
    };
    if (state.editingJobId) {
      state.jobs = state.jobs.map(function (j) { return j.id === job.id ? job : j; });
    } else {
      state.jobs.push(job);
    }
    persistJobs();
    state.editingJobId = null;
    showView('home');
  }

  function deleteJob() {
    if (!state.editingJobId) return;
    var job = state.jobs.filter(function (j) { return j.id === state.editingJobId; })[0];
    if (job && !confirm(t('job.deleteConfirm', { name: job.name }))) return;
    state.jobs = state.jobs.filter(function (j) { return j.id !== state.editingJobId; });
    persistJobs();
    state.editingJobId = null;
    showView('home');
  }

  // ---------- 나란히 비교 (P5) ----------
  function renderCompare() {
    var result = JobScore.rankJobs(state.jobs, state.weights, state.targets, state.limits);
    var el = document.getElementById('compare-table-wrap');
    if (result.ranked.length === 0) {
      el.innerHTML = '<p class="empty">' + t('compare.empty') + '</p>';
      return;
    }
    var rows = [
      { label: t('compare.pay'), get: function (r) { return Math.round(r.raw.monthlyPayWon / 10000) + t('unit.manwon'); } },
      { label: t('compare.realWage'), get: function (r) { return Math.round(r.raw.realWageWon).toLocaleString() + t('wage.won'); } },
      { label: t('compare.workTime'), get: function (r) { return r.job.start + '~' + r.job.end; } },
      { label: t('compare.commute'), get: function (r) { return r.job.commuteMin + t('unit.min'); } },
      { label: t('compare.days'), get: function (r) { return r.job.daysPerWeek + t('unit.day'); } },
      { label: t('compare.intensity'), get: function (r) { return t('intensity.' + r.job.intensity); } }
    ];
    var head = '<tr><th></th>' + result.ranked.map(function (r) { return '<th>' + escapeHtml(r.job.name) + '</th>'; }).join('') + '</tr>';
    var body = rows.map(function (row) {
      return '<tr><th>' + row.label + '</th>' + result.ranked.map(function (r) { return '<td>' + row.get(r) + '</td>'; }).join('') + '</tr>';
    }).join('');
    var scoreRow = '<tr class="total-row"><th>' + t('compare.total') + '</th>' + result.ranked.map(function (r) {
      return '<td><div class="bar"><div class="bar-fill" style="width:' + Math.round(r.total) + '%"></div></div>' + Math.round(r.total) + t('score.suffix') + '</td>';
    }).join('') + '</tr>';
    el.innerHTML = '<table class="compare-table"><thead>' + head + '</thead><tbody>' + body + scoreRow + '</tbody></table>';
  }

  // ---------- 백업/복원 (P7) ----------
  function exportBackup() {
    var data = { jobs: state.jobs, weights: state.weights, limits: state.limits, targets: state.targets, savedAt: new Date().toISOString() };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'jobscale-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    alert(t('backup.exportDone'));
  }

  function importBackup(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        if (!Array.isArray(data.jobs)) throw new Error('invalid');
        state.jobs = sanitizeJobs(data.jobs);
        state.weights = clampWeights(data.weights);
        state.limits = data.limits || clone(DEFAULT_LIMITS);
        state.targets = data.targets || clone(JobScore.DEFAULT_TARGETS);
        persistJobs(); persistWeights(); persistLimits(); persistTargets();
        alert(t('backup.importDone'));
        showView('home');
      } catch (e) {
        alert(t('backup.importError'));
      }
    };
    reader.readAsText(file);
  }

  // ---------- 링크 공유 (P7) — 서버 없이 URL 해시에 데이터를 담는다 ----------
  function buildShareLink() {
    var data = { jobs: state.jobs, weights: state.weights, limits: state.limits, targets: state.targets };
    var encoded = encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(data)))));
    return location.origin + location.pathname + '#share=' + encoded;
  }

  function shareResult() {
    var link = buildShareLink();
    if (navigator.share) {
      navigator.share({ title: t('app.title'), url: link }).catch(function () {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(link).then(function () { alert(t('share.copied')); });
    } else {
      prompt(t('share.link'), link);
    }
  }

  function loadFromShareHash() {
    var m = location.hash.match(/share=([^&]+)/);
    if (!m) return false;
    try {
      var json = decodeURIComponent(escape(atob(decodeURIComponent(m[1]))));
      var data = JSON.parse(json);
      state.jobs = sanitizeJobs(data.jobs);
      state.weights = clampWeights(data.weights);
      state.limits = data.limits || clone(DEFAULT_LIMITS);
      state.targets = data.targets || clone(JobScore.DEFAULT_TARGETS);
      state.viewOnly = true;
      document.getElementById('share-banner').hidden = false;
      return true;
    } catch (e) { return false; }
  }

  // ---------- 초기화 ----------
  function populateSelect(id, values, prefix) {
    var sel = document.getElementById(id);
    sel.innerHTML = values.map(function (v) { return '<option value="' + v + '">' + t(prefix + v) + '</option>'; }).join('');
  }

  function init() {
    applyI18n();
    loadFromShareHash();
    populateSelect('jf-intensity', JobScore.INTENSITY_LEVELS, 'intensity.');
    populateSelect('jf-employmentType', JobScore.EMPLOYMENT_TYPES, 'employment.');

    document.querySelectorAll('[data-nav]').forEach(function (btn) {
      btn.addEventListener('click', function () { showView(btn.getAttribute('data-nav')); });
    });
    document.querySelectorAll('[data-template]').forEach(function (btn) {
      btn.addEventListener('click', function () { applyTemplate(btn.getAttribute('data-template')); });
    });
    document.getElementById('add-job-btn').addEventListener('click', function () { openJobForm(null); });
    document.getElementById('criteria-save-btn').addEventListener('click', saveCriteria);
    document.getElementById('jobform-save-btn').addEventListener('click', saveJobForm);
    document.getElementById('jobform-cancel-btn').addEventListener('click', function () { showView('home'); });
    document.getElementById('jf-delete').addEventListener('click', deleteJob);

    JobScore.SCORE_KEYS.forEach(function (key) {
      var input = document.querySelector('[data-weight="' + key + '"]');
      if (input) input.addEventListener('input', function () {
        state.weights[key] = parseInt(input.value, 10) || 0;
        state.activeTemplate = null;
        updateStarLabel(key);
        persistWeights();
        renderCriteriaLiveRank();
      });
    });

    document.getElementById('backup-export-btn').addEventListener('click', exportBackup);
    document.getElementById('backup-import-input').addEventListener('change', function (e) {
      if (e.target.files[0]) importBackup(e.target.files[0]);
    });
    document.getElementById('share-btn').addEventListener('click', shareResult);

    showView('home');
    window.addEventListener('popstate', function (e) {
      showView((e.state && e.state.view) || 'home', true);
    });

    if ('serviceWorker' in navigator) {
      // 크롬은 새 서비스워커 확인을 24시간에 한 번으로 제한한다(자동 체크 기준).
      // register() 직후 update()를 직접 호출하면 이 제한과 무관하게 매번 새 버전을 확인한다.
      navigator.serviceWorker.register('sw.js').then(function (reg) {
        reg.update();
      }).catch(function () {});
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    try { init(); } catch (e) { console.error('INIT_FAILED', e.message, e.stack); }
  });
})();
