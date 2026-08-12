// 广西民族师范学院附属中学 宣传页交互：滚动浮现 / 数字滚动 / 条形图
(function () {
  "use strict";

  var reducedMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function formatValue(value, decimals) {
    return decimals > 0
      ? value.toFixed(decimals)
      : Math.round(value).toLocaleString("zh-Hans-CN");
  }

  function animateCount(el) {
    var target = parseFloat(el.dataset.count);
    var decimals = parseInt(el.dataset.decimals || "0", 10);
    if (reducedMotion) {
      el.textContent = formatValue(target, decimals);
      return;
    }
    var duration = 1200;
    var start = null;

    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      var value = target * eased;
      el.textContent = formatValue(value, decimals);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function activate(scope) {
    scope.querySelectorAll("[data-count]").forEach(animateCount);
    scope.querySelectorAll(".bar-track span[data-width]").forEach(function (bar) {
      bar.style.width = bar.dataset.width + "%";
    });
  }

  var revealables = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    revealables.forEach(function (el) {
      el.classList.add("visible");
      activate(el);
    });
    return;
  }

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("visible");
        activate(entry.target);
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.18 }
  );
  revealables.forEach(function (el) {
    observer.observe(el);
  });
})();
