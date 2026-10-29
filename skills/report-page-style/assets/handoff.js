/* report-page-style handoff.js — 持续交接页的版本切换。由 build-handoff.mjs 内联进页面。
   地址 #vN 或 #vN:锚点 决定显示哪一轮；后退、前进、直接改地址都会同步正文。 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var root = $('handoff-root');
  var count = Number(root.dataset.versions);
  var current = count;
  if (count < 2) root.classList.add('single');

  function parse() {
    var m = /^#v(\d+)(?::([A-Za-z0-9_-]+))?$/.exec(location.hash);
    if (m && Number(m[1]) >= 1 && Number(m[1]) <= count) return {version: Number(m[1]), anchor: m[2] || '', valid: true};
    return {version: count, anchor: '', valid: false};
  }
  function reveal(id) {
    var target = $(id);
    if (!target) return;
    for (var p = target; p; p = p.parentElement) if (p.tagName === 'DETAILS') p.open = true;
    target.scrollIntoView({block: 'start'});
  }
  function render(version, anchor) {
    current = version;
    $('handoff-panel').replaceChildren($('handoff-v' + version).content.cloneNode(true));
    document.querySelectorAll('[data-version]').forEach(function (b) { b.setAttribute('aria-selected', String(Number(b.dataset.version) === version)); });
    $('previous').disabled = version === 1;
    $('next').disabled = version === count;
    $('position').textContent = '第 ' + version + ' / ' + count + ' 轮' + (version === count ? '（最新）' : '（历史截点）');
    if (anchor) reveal(anchor);
  }
  function applyLocation() {
    var p = parse();
    if (!p.valid) history.replaceState(null, '', '#v' + count);
    render(p.version, p.anchor);
  }
  function navigate(version, anchor) {
    var fragment = '#v' + version + (anchor ? ':' + anchor : '');
    if (location.hash !== fragment) history.pushState(null, '', fragment);
    render(version, anchor);
  }

  $('timeline').addEventListener('click', function (e) {
    var b = e.target.closest('[data-version]');
    if (b) navigate(Number(b.dataset.version));
  });
  $('timeline').addEventListener('keydown', function (e) {
    var keys = {ArrowLeft: Math.max(1, current - 1), ArrowRight: Math.min(count, current + 1), Home: 1, End: count};
    if (!Object.prototype.hasOwnProperty.call(keys, e.key)) return;
    e.preventDefault();
    navigate(keys[e.key]);
    var b = document.querySelector('[data-version="' + current + '"]');
    if (b) b.focus();
  });
  $('previous').addEventListener('click', function () { navigate(Math.max(1, current - 1)); });
  $('next').addEventListener('click', function () { navigate(Math.min(count, current + 1)); });

  // 深浅主题：默认跟随系统，按钮手动切换
  $('theme').addEventListener('click', function () {
    var el = document.documentElement;
    var dark = el.dataset.theme ? el.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    el.dataset.theme = dark ? 'light' : 'dark';
  });

  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[href^="#v"]');
    if (link) {
      var m = /^#v(\d+):([A-Za-z0-9_-]+)$/.exec(link.getAttribute('href'));
      if (m) { e.preventDefault(); navigate(Number(m[1]), m[2]); }
    }
    if (e.target.closest('[data-copy-review]')) {
      var data = $('review-data');
      (navigator.clipboard ? navigator.clipboard.writeText(data.value) : Promise.reject())
        .then(function () { $('copy-result').textContent = '核对包已复制。'; })
        .catch(function () { data.focus(); data.select(); $('copy-result').textContent = '已选中文本，请手动复制。'; });
    }
  });
  window.addEventListener('hashchange', applyLocation);
  window.addEventListener('popstate', applyLocation);
  applyLocation();
})();
