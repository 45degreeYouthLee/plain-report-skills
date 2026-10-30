/* project-tracking：历史节点筛选（只筛选，不隐藏当前信息）与深浅主题切换 */
(function () {
  'use strict';
  var buttons = document.querySelectorAll('[data-filter]');
  buttons.forEach(function (b) {
    b.addEventListener('click', function () {
      var f = b.dataset.filter;
      buttons.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      document.querySelectorAll('.node-item').forEach(function (n) {
        var show = !f || (f.indexOf('kind:') === 0 ? n.dataset.kind === f.slice(5) : n.dataset.line === f.slice(5));
        n.hidden = !show;
      });
    });
  });
  // 给表格单元格补上列名，窄屏上下排列时显示
  document.querySelectorAll('.tbl table').forEach(function (table) {
    var heads = [].map.call(table.querySelectorAll('thead th'), function (th) { return th.textContent; });
    table.querySelectorAll('tbody tr').forEach(function (tr) {
      [].forEach.call(tr.children, function (td, i) { if (heads[i]) td.setAttribute('data-label', heads[i]); });
    });
  });
  var theme = document.getElementById('theme');
  if (theme) theme.addEventListener('click', function () {
    var el = document.documentElement;
    var dark = el.dataset.theme ? el.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    el.dataset.theme = dark ? 'light' : 'dark';
  });
})();
