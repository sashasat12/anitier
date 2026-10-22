/* ============================================================
   AniTier Mobile — установка, офлайн-оболочка, подсказки
   ============================================================ */
(() => {
  'use strict';

  const installBtn = document.getElementById('install-app');
  const standalone = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
  const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  let deferredPrompt = null;
  let hintTimer = 0;

  if (standalone) document.documentElement.classList.add('is-standalone');

  function showHint(message) {
    let hint = document.querySelector('.mobile-hint');
    if (!hint) {
      hint = document.createElement('div');
      hint.className = 'mobile-hint';
      hint.setAttribute('role', 'status');
      document.body.appendChild(hint);
    }
    hint.textContent = message;
    hint.hidden = false;
    clearTimeout(hintTimer);
    hintTimer = window.setTimeout(() => { hint.hidden = true; }, 6500);
  }

  if (installBtn) {
    if (isIos && !standalone) {
      installBtn.hidden = false;
      installBtn.addEventListener('click', () => {
        showHint('В Safari нажмите «Поделиться» → «На экран „Домой“».');
      });
    }

    window.addEventListener('beforeinstallprompt', event => {
      event.preventDefault();
      deferredPrompt = event;
      if (!standalone) installBtn.hidden = false;
    });

    installBtn.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      try {
        await deferredPrompt.userChoice;
      } catch (_) { /* пользователь мог закрыть окно */ }
      deferredPrompt = null;
      installBtn.hidden = true;
    });

    window.addEventListener('appinstalled', () => {
      deferredPrompt = null;
      installBtn.hidden = true;
      showHint('AniTier установлен. Теперь он открывается с главного экрана.');
    });
  }

  window.addEventListener('offline', () => {
    showHint('Нет сети — открываем сохранённые данные.');
  });
  window.addEventListener('online', () => {
    showHint('Сеть восстановлена.');
  });

  const secure = location.protocol === 'https:'
    || location.hostname === 'localhost'
    || location.hostname === '127.0.0.1';

  if ('serviceWorker' in navigator && secure) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(error => {
        console.warn('AniTier: service worker не зарегистрирован', error);
      });
    });
  }
})();
