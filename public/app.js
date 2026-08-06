const soundFiles = {
  only: '/audio/0721only.mp3',
  ciallo: '/audio/ciallo.mp3'
};

const sounds = Object.fromEntries(Object.entries(soundFiles).map(([key, src]) => [key, new Audio(src)]));
const buttonImages = {
  only: ['/images/nene1.webp', '/images/nene2.webp'],
  ciallo: ['/images/meguru1.webp', '/images/meguru2.webp']
};

// Preload both states so the pressed image is ready on the first click.
Object.values(buttonImages).flat().forEach((src) => {
  const image = new Image();
  image.src = src;
});

const toast = document.querySelector('.toast');
let toastTimer;
const toastMessages = {
  only: 'オナニー',
  ciallo: 'Ciallo～(∠・ω- )⌒☆'
};

function getNextJuly21() {
  const now = new Date();
  const target = new Date(now.getFullYear(), 6, 21, 0, 0, 0, 0);
  if (target <= now) target.setFullYear(target.getFullYear() + 1);
  return target;
}

function updateCountdown() {
  const remaining = Math.max(0, getNextJuly21() - new Date());
  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const seconds = totalSeconds % 60;
  document.querySelector('#days-left').textContent = days;
  document.querySelector('#hours-left').textContent = String(hours).padStart(2, '0');
  document.querySelector('#seconds-left').textContent = String(seconds).padStart(2, '0');
}

function renderCounts(counts) {
  document.querySelector('#total-count').textContent = counts.total.toLocaleString('en-US');
  document.querySelector('#only-count').textContent = counts.only.toLocaleString('en-US');
  document.querySelector('#ciallo-count').textContent = counts.ciallo.toLocaleString('en-US');
  const max = Math.max(counts.only, counts.ciallo, 1);
  document.querySelector('#only-bar').style.width = `${counts.only / max * 100}%`;
  document.querySelector('#ciallo-bar').style.width = `${counts.ciallo / max * 100}%`;
  document.querySelector('[data-rank="only"]').textContent = `你是第 ${counts.only + 1} 个 0721 的人`;
  document.querySelector('[data-rank="ciallo"]').textContent = `你是第 ${counts.ciallo + 1} 个 Ciallo～(∠・ω- )⌒☆ 的人`;
}

async function refreshCounts() {
  try {
    const response = await fetch('/api/counts', { cache: 'no-store' });
    if (response.ok) renderCounts(await response.json());
  } catch { /* The stage still lets local audio play when the server is unavailable. */ }
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2200);
}

document.querySelectorAll('.sound-card').forEach((card) => {
  const key = card.dataset.sound;
  card.querySelector('.play-button').addEventListener('click', async () => {
    const audio = sounds[key];
    audio.currentTime = 0;
    card.classList.remove('is-playing');
    card.dataset.playing = 'false';
    void card.offsetWidth;
    card.classList.add('is-playing');
    card.dataset.playing = 'true';

    const stopPressedState = () => {
      card.classList.remove('is-playing');
      card.dataset.playing = 'false';
    };
    audio.addEventListener('ended', stopPressedState, { once: true });
    audio.play().catch(() => {
      stopPressedState();
      showToast('请点击浏览器允许播放音效');
    });

    try {
      const response = await fetch(`/api/click/${key}`, { method: 'POST' });
      if (response.ok) {
        renderCounts(await response.json());
        showToast(toastMessages[key]);
      }
    } catch {
      showToast('音效已播放，计数服务暂时离线');
    }
  });
});

refreshCounts();
setInterval(refreshCounts, 5000);
updateCountdown();
setInterval(updateCountdown, 1000);
