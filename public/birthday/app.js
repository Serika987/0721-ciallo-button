// 生贺页 —— 克制编辑风：仅透明度 + 轻微位移的滚动渐入
const revealEls = document.querySelectorAll('.reveal');

if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  revealEls.forEach((el) => io.observe(el));
} else {
  // 无 IntersectionObserver 时直接显示，避免内容不可见
  revealEls.forEach((el) => el.classList.add('in'));
}
