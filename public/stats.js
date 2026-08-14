// 来访量上报：页面加载时上报一次 PV/UV。静默失败，绝不阻塞渲染。
(function () {
  'use strict';
  var sent = false; // 每文档只报一次；不用 sessionStorage（会误杀"刷新也算 PV"）

  function getAnonId() {
    try {
      var id = localStorage.getItem('vid');
      if (id) return id;
      id = (crypto && typeof crypto.randomUUID === 'function')
        ? crypto.randomUUID() // HTTPS 安全上下文下可用
        : 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12); // 降级
      localStorage.setItem('vid', id);
      return id;
    } catch {
      return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
    }
  }

  function report() {
    if (sent) return;
    sent = true;
    var payload = JSON.stringify({ id: getAnonId(), path: location.pathname });
    try {
      fetch('/api/visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true, // 页面加载后立刻卸载也不中断请求
        cache: 'no-store'
      }).catch(function () {
        // 回退 sendBeacon（旧 Safari / X5 无 keepalive；sendBeacon 发 text/plain，服务端不校验 Content-Type）
        if (navigator.sendBeacon) navigator.sendBeacon('/api/visit', payload);
      });
    } catch {
      if (navigator.sendBeacon) navigator.sendBeacon('/api/visit', payload);
    }
  }

  if ('requestIdleCallback' in window) requestIdleCallback(report);
  else setTimeout(report, 0);
})();
