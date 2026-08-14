// 统计页渲染：fetch /api/stats，渲染 KPI + 最近 30 天柱状图（纯 CSS）。
(function () {
  'use strict';

  var chartEl = document.getElementById('day-chart');
  var emptyEl = document.getElementById('chart-empty');

  function fmt(n) {
    return n.toLocaleString('en-US');
  }

  function renderChart(days) {
    var maxPv = 0;
    var maxUv = 0;
    days.forEach(function (d) {
      if (d.pv > maxPv) maxPv = d.pv;
      if (d.uv > maxUv) maxUv = d.uv;
    });
    if (!maxPv && !maxUv) {
      chartEl.hidden = true;
      emptyEl.hidden = false;
      return;
    }
    var html = '';
    days.forEach(function (d, i) {
      var pvH = maxPv ? Math.round((d.pv / maxPv) * 100) : 0;
      var uvH = maxUv ? Math.round((d.uv / maxUv) * 100) : 0;
      var label = i % 5 === 0 || i === days.length - 1 ? d.date.slice(5) : '';
      html += '<div class="day-col" title="' + d.date + ' · PV ' + d.pv + ' / UV ' + d.uv + '" aria-label="' +
        d.date + ' PV ' + d.pv + ' UV ' + d.uv + '">' +
        '<div class="day-col-inner">' +
        '<span class="day-bar day-bar-pv" style="height:' + pvH + '%"></span>' +
        '<span class="day-bar day-bar-uv" style="height:' + uvH + '%"></span>' +
        '</div>' +
        '<span class="day-date">' + label + '</span>' +
        '</div>';
    });
    chartEl.innerHTML = html;
  }

  fetch('/api/stats', { cache: 'no-store' })
    .then(function (res) {
      return res.ok ? res.json() : Promise.reject(new Error('bad status'));
    })
    .then(function (stats) {
      document.getElementById('kpi-pv').textContent = fmt(stats.pv);
      document.getElementById('kpi-uv').textContent = fmt(stats.uv);
      var today = stats.days[stats.days.length - 1];
      document.getElementById('kpi-today-pv').textContent = today ? fmt(today.pv) : '0';
      document.getElementById('kpi-today-uv').textContent = today ? fmt(today.uv) : '0';
      renderChart(stats.days);
    })
    .catch(function () {
      emptyEl.textContent = '统计服务离线';
      emptyEl.hidden = false;
      chartEl.hidden = true;
    });
})();
