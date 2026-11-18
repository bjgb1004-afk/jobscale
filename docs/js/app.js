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
    targets: 'jobscale.targets',
    feedSido: 'jobscale.feedSido'
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
    feedSido: load(STORAGE_KEYS.feedSido, null), // 마지막에 고른 지역을 기억한다
    feed: null,      // data/jobs.json 내용 (한 번만 받아서 재사용)
    feedState: 'idle' // idle | loading | error
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
    // 공고 추가 버튼만 data-nav가 없다(뷰 전환이 아니라 폼을 여는 버튼) — jobform일 때 직접 켠다.
    document.querySelectorAll('.topnav button').forEach(function (b) {
      var mine = b.id === 'add-job-btn' ? 'jobform' : b.getAttribute('data-nav');
      b.classList.toggle('active', mine === name);
    });
    if (name === 'criteria') renderCriteria();
    if (name === 'compare') renderCompare();
    if (name === 'home') renderHome();
    if (name === 'feed') openFeed();
    window.scrollTo(0, 0);
    if (!fromPopstate) {
      if (name === 'home') history.replaceState({ view: 'home' }, '');
      else history.pushState({ view: name }, '');
    }
  }

  // ---------- 홈 ----------
  // 활성 템플릿은 저장하지 않고 현재 가중치에서 되찾는다 — 앱을 다시 열거나 백업을 복원해도
  // 선택 상태가 그대로 보인다(예전엔 메모리에만 있어서 재실행하면 표시가 사라졌다).
  function matchedTemplate() {
    return Object.keys(TEMPLATES).filter(function (name) {
      return JobScore.SCORE_KEYS.every(function (k) { return TEMPLATES[name][k] === state.weights[k]; });
    })[0] || null;
  }

  function updateTemplateButtons() {
    var active = matchedTemplate();
    document.querySelectorAll('[data-template]').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-template') === active);
    });
  }

  // 공고에서 담아온 job은 근무시간 등을 표준값으로 채웠다 — 추정값을 숨기지 않고 드러낸다.
  // 카드를 누르면 수정 화면으로 가고, 거기서 저장하면 needsCheck 없는 job으로 덮여 배지가 사라진다.
  function renderNeedsCheck(job) {
    var fields = Array.isArray(job.needsCheck) ? job.needsCheck : [];
    if (!fields.length) return '';
    var notes = fields.map(function (f) { return t('job.needsCheck.' + f); }).join(' ');
    return '<span class="needs-check">' + t('job.needsCheck') + '</span>' +
      '<span class="needs-check-note">' + escapeHtml(notes) + '</span>';
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
      bindCardOpen(listEl);
      bindDeleteButtons(listEl, renderHome);
      return;
    }
    if (result.error === 'NO_WEIGHTS') {
      listEl.innerHTML = '<p class="notice">' + t('home.noWeights') + '</p>';
      return;
    }

    // 1위는 짙은 hero 카드 + "가장 잘 맞음" 꼬리표, 나머지는 순위 숫자만.
    var html = result.ranked.map(function (r, i) {
      var sourceLink = r.job.sourceUrl
        ? '<a class="job-source-link" href="' + escapeHtml(r.job.sourceUrl) + '" target="_blank" rel="noopener">' + t('home.viewSource') + '</a>'
        : '';
      return '<li class="job-card' + (i === 0 ? ' hero' : '') + '" data-id="' + r.job.id + '">' +
        '<span class="job-rank">' + (i === 0 ? t('home.heroTag') : i + 1) + '</span>' +
        '<div class="job-main">' +
          '<span class="job-name">' + escapeHtml(r.job.name) + '</span>' +
          renderNeedsCheck(r.job) +
          '<div class="job-foot">' +
            '<span class="job-wage">' + t('wage.realLabel') + ' ' + Math.round(r.raw.realWageWon).toLocaleString() + t('wage.won') + '</span>' +
            '<span class="job-score">' + Math.round(r.total) + '<i>' + t('score.suffix') + '</i></span>' +
          '</div>' +
          sourceLink +
        '</div>' +
        '<button type="button" class="job-delete-btn" data-id="' + r.job.id + '" aria-label="' + t('job.delete') + '">✕</button>' +
        '</li>';
    }).join('');

    if (result.ranked.length === 1) html += '<p class="hint">' + t('home.oneJobHint') + '</p>';
    html += renderRejectedList(result.rejected);
    listEl.innerHTML = '<ul class="job-cards">' + html + '</ul>';

    var explain = JobScore.explainData(result.ranked, state.weights);
    explainEl.textContent = buildExplainSentence(explain);

    bindCardOpen(listEl);
    bindDeleteButtons(listEl, renderHome);
  }

  // 카드를 누르면 수정 화면. 전부 탈락한 경우에도 붙여야 한다 — 안 그러면 조건에 걸린 공고를
  // 고칠 길이 삭제밖에 없다(담아온 공고는 추정값 때문에 전부 탈락하는 일이 실제로 생긴다).
  function bindCardOpen(container) {
    container.querySelectorAll('.job-card').forEach(function (card) {
      card.addEventListener('click', function (e) {
        if (e.target.closest('.job-source-link') || e.target.closest('.job-delete-btn') || e.target.closest('.reject-delete-btn')) return;
        openJobForm(card.getAttribute('data-id'));
      });
    });
  }

  // 순위 목록(job-delete-btn)과 탈락 카드(reject-delete-btn) 둘 다 같은 공용 삭제 버튼 패턴.
  function bindDeleteButtons(container, onDeleted) {
    container.querySelectorAll('.job-delete-btn, .reject-delete-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (deleteJobById(btn.getAttribute('data-id'))) onDeleted();
      });
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
        // 담아온 공고는 퇴근시간 등이 추정값이라 그것 때문에 탈락하기 쉽다.
        // 탈락 카드에서도 "이 값은 추정"이라고 말해주지 않으면 고칠 생각을 못 한다.
        renderNeedsCheck(r.job) +
        '<button type="button" class="reject-delete-btn" data-id="' + r.job.id + '" aria-label="' + t('job.delete') + '">✕</button>' +
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
    el.innerHTML = result.ranked.map(function (r, i) {
      return '<div class="live-rank-row"><span>' + (i + 1) + '. ' + escapeHtml(r.job.name) +
        '</span><span class="live-rank-score">' + Math.round(r.total) + t('score.suffix') + '</span>' +
        '<button type="button" class="job-delete-btn" data-id="' + r.job.id + '" aria-label="' + t('job.delete') + '">✕</button>' +
        '</div>';
    }).join('');
    bindDeleteButtons(el, renderCriteriaLiveRank);
  }

  function saveCriteria() {
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
  // score.js가 월급=만원 단위, 시급·일급=원 단위로 계산하므로(monthlyPayWon 참고) 입력창
  // 옆에 단위를 보여줘야 사람이 헷갈려서 10000배 틀린 값을 넣는 걸 막을 수 있다.
  function updatePayUnitLabel() {
    var isMonthly = document.getElementById('jf-payType').value === 'monthly';
    document.getElementById('jf-payUnit').textContent = t(isMonthly ? 'unit.manwon' : 'unit.won');
  }

  // prefill: 공유하기로 들어온 공고를 파싱한 값(shareParse 결과). 새 공고(id 없음)일 때만 쓰임.
  function openJobForm(id, prefill) {
    state.editingJobId = id || null;
    var job = id ? state.jobs.filter(function (j) { return j.id === id; })[0] : null;
    state.draftSourceUrl = job ? job.sourceUrl : (prefill && prefill.sourceUrl) || null;
    document.getElementById('jf-name').value = job ? job.name : (prefill && prefill.name) || '';
    document.getElementById('jf-payAmount').value = job ? job.pay.amount : (prefill && prefill.payAmount) || '';
    document.getElementById('jf-payType').value = job ? job.pay.unit : (prefill && prefill.payType) || 'monthly';
    updatePayUnitLabel();
    document.getElementById('jf-start').value = job ? job.start : (prefill && prefill.start) || '09:00';
    document.getElementById('jf-end').value = job ? job.end : (prefill && prefill.end) || '18:00';
    document.getElementById('jf-days').value = job ? job.daysPerWeek : (prefill && prefill.daysPerWeek) || 5;
    document.getElementById('jf-commute').value = job ? job.commuteMin : '';
    document.getElementById('jf-break').value = job ? job.breakMin : '';
    document.getElementById('jf-intensity').value = job ? job.intensity : 'normal';
    document.getElementById('jf-employmentType').value = job ? job.employmentType : 'regular';
    document.getElementById('jf-insurance').checked = job ? !!job.insurance : false;
    document.getElementById('jf-weekendWork').checked = job ? !!job.weekendWork : false;
    document.getElementById('jf-delete').hidden = !job;
    document.getElementById('jf-paste').value = '';
    document.getElementById('jf-paste-result').textContent = '';
    clearFormErrors();
    showView('jobform');
  }

  // 공유 인텐트로는 급여·근무시간이 안 넘어오는 경우가 대부분이다(구인앱이 링크만 보내거나,
  // 사람인처럼 자체 공유창을 써서 아예 목록에 안 뜬다). 그래서 공고 화면에서 복사한 텍스트를
  // 직접 붙여넣어 같은 파서로 채우는 경로를 둔다 — 정보가 실제로 있는 유일한 출처가 화면 텍스트다.
  function applyPastedText() {
    var resultEl = document.getElementById('jf-paste-result');
    var text = document.getElementById('jf-paste').value.trim();
    if (!text) { resultEl.textContent = ''; return; }

    var parsed = ShareParse.parse({ title: '', text: text, url: '' });
    var filled = [];
    function fill(id, value, labelKey) {
      if (value == null || value === '') return;
      document.getElementById(id).value = value;
      filled.push(t(labelKey));
    }
    fill('jf-name', parsed.name, 'job.name');
    if (parsed.payAmount != null) {
      document.getElementById('jf-payType').value = parsed.payType;
      fill('jf-payAmount', parsed.payAmount, 'job.pay');
      updatePayUnitLabel();
    }
    fill('jf-start', parsed.start, 'job.start');
    fill('jf-end', parsed.end, 'job.end');
    fill('jf-days', parsed.daysPerWeek, 'job.days');
    if (parsed.sourceUrl) state.draftSourceUrl = parsed.sourceUrl;

    resultEl.textContent = filled.length
      ? t('job.paste.filled', { fields: filled.join(', ') })
      : t('job.paste.nothing');
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
      insurance: document.getElementById('jf-insurance').checked,
      weekendWork: document.getElementById('jf-weekendWork').checked,
      sourceUrl: state.draftSourceUrl || null
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

  // 등록폼의 삭제 버튼(state.editingJobId)과 탈락 카드의 바로삭제(id 직접 전달)가 공용으로 쓴다.
  function deleteJobById(id) {
    var job = state.jobs.filter(function (j) { return j.id === id; })[0];
    if (job && !confirm(t('job.deleteConfirm', { name: job.name }))) return false;
    state.jobs = state.jobs.filter(function (j) { return j.id !== id; });
    persistJobs();
    return true;
  }

  function deleteJob() {
    if (!state.editingJobId) return;
    if (!deleteJobById(state.editingJobId)) return;
    state.editingJobId = null;
    showView('home');
  }

  // ---------- 공고 찾기 (공공기관 채용공고) ----------
  // 앱은 서버가 없다(정적 사이트). 그래서 공공데이터 API를 브라우저에서 직접 부르지 않고,
  // GitHub Actions가 하루 한 번 받아 커밋해둔 data/jobs.json만 읽는다 — 인증키가 앱에 안 들어간다.
  function openFeed() {
    if (state.feed || state.feedState === 'loading') { renderFeed(); return; }
    state.feedState = 'loading';
    renderFeed();
    fetch('./data/jobs.json')
      .then(function (res) { if (!res.ok) throw new Error('http ' + res.status); return res.json(); })
      .then(function (data) { state.feed = data; state.feedState = 'idle'; })
      .catch(function () { state.feedState = 'error'; })
      .then(function () { renderFeed(); });
  }

  function jobBySourceUrl(url) {
    if (!url) return null;
    return state.jobs.filter(function (j) { return j.sourceUrl === url; })[0] || null;
  }

  function renderFeed() {
    var listEl = document.getElementById('feed-list');
    var sourceEl = document.getElementById('feed-source');
    var selEl = document.getElementById('feed-sido');

    if (state.feedState === 'loading') { listEl.innerHTML = '<p class="empty">' + t('feed.loading') + '</p>'; return; }
    if (state.feedState === 'error' || !state.feed) { listEl.innerHTML = '<p class="notice">' + t('feed.error') + '</p>'; return; }

    var regions = state.feed.regions || {};
    var codes = Object.keys(regions);
    if (!state.feedSido || codes.indexOf(state.feedSido) < 0) state.feedSido = codes[0] || null;
    if (selEl.options.length !== codes.length) {
      selEl.innerHTML = codes.map(function (c) {
        return '<option value="' + escapeHtml(c) + '">' + escapeHtml(regions[c]) + '</option>';
      }).join('');
    }
    selEl.value = state.feedSido;

    // 공공데이터는 출처 표시가 이용 조건이다 — 선택이 아니다.
    sourceEl.textContent = t('feed.source', { updated: state.feed.updated || '' });

    // JSON이 최대 하루 묵을 수 있어 렌더 시점에도 마감 지난 건을 거른다.
    var today = FeedImport.todayKST();
    var items = FeedImport.visibleItems(state.feed.items, state.feedSido, today);
    if (!items.length) { listEl.innerHTML = '<p class="empty">' + t('feed.empty') + '</p>'; return; }

    var anyAdded = false;
    var html = items.map(function (it) {
      var left = FeedImport.daysLeft(it.end, today);
      var added = !!jobBySourceUrl(it.url);
      if (added) anyAdded = true;
      var incomeNote = it.incomeBound === 'min' ? t('feed.incomeMin') : it.incomeBound === 'max' ? t('feed.incomeMax') : '';
      var action = it.incomeWon === 0
        ? '<span class="feed-unpaid">' + t('feed.unpaid') + '</span>'   // 무급은 점수로 견줄 게 없다
        : '<button type="button" class="feed-add-btn" data-feed-id="' + escapeHtml(it.id) + '"' +
          (added ? ' disabled>' + t('feed.added') : '>' + t('feed.add')) + '</button>';
      return '<li class="feed-card">' +
        '<div class="feed-head">' +
          '<span class="feed-dday' + (left <= 3 ? ' urgent' : '') + '">' +
            (left === 0 ? t('feed.ddayToday') : t('feed.dday', { days: left })) + '</span>' +
          '<span class="feed-org">' + escapeHtml(it.org) + '</span>' +
        '</div>' +
        '<p class="feed-title">' + escapeHtml(it.title) + '</p>' +
        '<p class="feed-meta">' + escapeHtml([it.jobType, it.field].filter(Boolean).join(' · ')) + '</p>' +
        '<p class="feed-income">' + escapeHtml(it.income || '') +
          (incomeNote ? ' <span class="feed-income-note">(' + incomeNote + ')</span>' : '') + '</p>' +
        '<div class="feed-actions">' +
          (it.url ? '<a class="job-source-link" href="' + escapeHtml(it.url) + '" target="_blank" rel="noopener">' + t('home.viewSource') + '</a>' : '') +
          action +
        '</div>' +
        '</li>';
    }).join('');

    listEl.innerHTML = '<p class="hint">' + t('feed.count', { count: items.length }) + '</p>' +
      '<ul class="feed-cards">' + html + '</ul>' +
      (anyAdded ? '<p class="hint">' + t('feed.addedToast') + '</p>' : '');

    listEl.querySelectorAll('.feed-add-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { addFromFeed(btn.getAttribute('data-feed-id')); });
    });
  }

  // 등록 폼을 거치지 않으므로, 폼이 보장하던 유효성을 feedImport.js가 대신 지킨다.
  function addFromFeed(id) {
    var item = ((state.feed && state.feed.items) || []).filter(function (i) { return i.id === id; })[0];
    if (!item || jobBySourceUrl(item.url)) return;
    state.jobs.push(FeedImport.buildJob(item, uid()));
    persistJobs();
    renderFeed();
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
      { label: t('compare.intensity'), get: function (r) { return t('intensity.' + r.job.intensity); } },
      { label: t('compare.weekendWork'), get: function (r) { return t(r.job.weekendWork ? 'unit.yes' : 'unit.no'); } }
    ];
    var head = '<tr><th></th>' + result.ranked.map(function (r) { return '<th>' + escapeHtml(r.job.name) + '</th>'; }).join('') + '</tr>';
    var body = rows.map(function (row) {
      return '<tr><th>' + row.label + '</th>' + result.ranked.map(function (r) { return '<td>' + row.get(r) + '</td>'; }).join('') + '</tr>';
    }).join('');
    var scoreRow = '<tr class="total-row"><th>' + t('compare.total') + '</th>' + result.ranked.map(function (r) {
      return '<td><div class="bar"><div class="bar-fill" style="width:' + Math.round(r.total) + '%"></div></div>' + Math.round(r.total) + t('score.suffix') + '</td>';
    }).join('') + '</tr>';
    var deleteRow = '<tr><th></th>' + result.ranked.map(function (r) {
      return '<td><button type="button" class="job-delete-btn" data-id="' + r.job.id + '" aria-label="' + t('job.delete') + '">✕</button></td>';
    }).join('') + '</tr>';
    el.innerHTML = '<table class="compare-table"><thead>' + head + '</thead><tbody>' + body + scoreRow + deleteRow + '</tbody></table>';
    var hint = document.getElementById('compare-scroll-hint');
    if (hint) hint.hidden = el.scrollWidth <= el.clientWidth;
    bindDeleteButtons(el, renderCompare);
  }

  // ---------- 임금계산기 ----------
  // calc-type이 시급/일급이면 '원' 단위 입력, 월급/연봉이면 '만원' 단위 입력
  // (등록폼의 updatePayUnitLabel과 같은 이유 — 숫자를 1만배 잘못 넣는 실수를 막음).
  function updateCalcUnitLabel() {
    var type = document.getElementById('calc-type').value;
    var isWon = type === 'hourly' || type === 'daily';
    document.getElementById('calc-amount-unit').textContent = t(isWon ? 'unit.won' : 'unit.manwon');
  }

  function won(n) { return Math.round(n).toLocaleString() + t('wage.won'); }

  function runCalculator() {
    document.getElementById('calc-amount-err').textContent = '';
    var amountInput = document.getElementById('calc-amount').value;
    if (!amountInput) {
      document.getElementById('calc-amount-err').textContent = t('job.validation.required');
      return;
    }
    if (isNaN(Number(amountInput)) || Number(amountInput) < 0) {
      document.getElementById('calc-amount-err').textContent = t('job.validation.number');
      return;
    }
    var type = document.getElementById('calc-type').value;
    var isManwon = type === 'monthly' || type === 'annual';
    var amount = Number(amountInput) * (isManwon ? 10000 : 1);
    var hoursPerDay = Number(document.getElementById('calc-hoursPerDay').value) || 0;
    var daysPerWeek = Number(document.getElementById('calc-daysPerWeek').value) || 0;
    var dependents = parseInt(document.getElementById('calc-dependents').value, 10) || 1;
    var taxFree = Number(document.getElementById('calc-taxFree').value) || 0;
    var otHours = Number(document.getElementById('calc-otHours').value) || 0;
    var holHoursPerDay = Number(document.getElementById('calc-holHoursPerDay').value) || 0;
    var holDays = Number(document.getElementById('calc-holDays').value) || 0;

    var converted = WageCalc.convertAll({ type: type, amount: amount, hoursPerDay: hoursPerDay, daysPerWeek: daysPerWeek });
    // 가산수당은 기본급에서 역산한 통상시급 기준. 세전 총액에 더해야 4대보험·세금도 같이 늘어난다.
    var extra = WageCalc.extraPay(converted.hourly, { overtimeHours: otHours, holidayHoursPerDay: holHoursPerDay, holidayDays: holDays });
    var grossMonthly = converted.monthly + extra.total;
    var net = WageCalc.netPay(grossMonthly, dependents, null, taxFree);

    var el = document.getElementById('calc-result');
    el.hidden = false;
    el.innerHTML =
      '<h3>' + t('calc.result.pretaxTitle') + '</h3>' +
      '<div class="calc-row"><span>' + t('calc.result.hourly') + '</span><span>' + won(converted.hourly) + '</span></div>' +
      '<div class="calc-row"><span>' + t('calc.result.daily') + '</span><span>' + won(converted.daily) + '</span></div>' +
      '<div class="calc-row"><span>' + t('calc.result.monthly') + '</span><span>' + won(converted.monthly) + '</span></div>' +
      '<div class="calc-row"><span>' + t('calc.result.annual') + '</span><span>' + won(converted.annual) + '</span></div>' +
      (extra.total > 0
        ? '<h3>' + t('calc.result.extraTitle') + '</h3>' +
          '<div class="calc-row"><span>' + t('calc.result.overtime') + '</span><span>+' + won(extra.overtime) + '</span></div>' +
          '<div class="calc-row"><span>' + t('calc.result.holiday') + '</span><span>+' + won(extra.holiday) + '</span></div>' +
          '<div class="calc-row net"><span>' + t('calc.result.grossTotal') + '</span><span>' + won(grossMonthly) + '</span></div>'
        : '') +
      '<h3>' + t('calc.result.deductionTitle') + '</h3>' +
      '<div class="calc-row"><span>' + t('calc.result.insurance') + '</span><span>-' + won(net.insurance.total) + '</span></div>' +
      '<div class="calc-row"><span>' + t('calc.result.tax') + '</span><span>-' + won(net.tax.total) + '</span></div>' +
      '<div class="calc-row net"><span>' + t('calc.result.net') + '</span><span>' + won(net.net) + '</span></div>';
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

  // ---------- 공유 받기 (다른 앱의 "공유하기" → 공고 등록 폼 자동 채움) ----------
  // manifest.json의 share_target(GET)이 index.html?title=&text=&url= 형태로 전달함.
  // 파싱은 shareParse.js(순수함수, 별도 테스트 있음)에 위임 — 여기선 폼에 꽂는 것만 담당.
  function handleIncomingShare() {
    var params = new URLSearchParams(location.search);
    if (!params.has('title') && !params.has('text') && !params.has('url')) return;
    var prefill = ShareParse.parse({
      title: params.get('title') || '',
      text: params.get('text') || '',
      url: params.get('url') || ''
    });
    history.replaceState(null, '', location.pathname + location.hash);
    openJobForm(null, prefill);
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
    document.getElementById('jf-payType').addEventListener('change', updatePayUnitLabel);
    document.getElementById('jf-paste-apply').addEventListener('click', applyPastedText);
    document.getElementById('feed-sido').addEventListener('change', function (e) {
      state.feedSido = e.target.value;
      // 지역 선택은 내 비교 데이터가 아니라 화면 설정이다 — 공유 링크 열람 중에도
      // persist()의 "덮어쓸까요?" 확인을 띄우지 않고 바로 기억한다.
      try { localStorage.setItem(STORAGE_KEYS.feedSido, JSON.stringify(state.feedSido)); } catch (err) {}
      renderFeed();
    });
    document.getElementById('calc-type').addEventListener('change', updateCalcUnitLabel);
    document.getElementById('calc-submit-btn').addEventListener('click', runCalculator);
    updateCalcUnitLabel();

    JobScore.SCORE_KEYS.forEach(function (key) {
      var input = document.querySelector('[data-weight="' + key + '"]');
      if (input) input.addEventListener('input', function () {
        state.weights[key] = parseInt(input.value, 10) || 0;
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
    handleIncomingShare();
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
