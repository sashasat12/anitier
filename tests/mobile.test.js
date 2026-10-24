/* Мобильная оболочка: нижняя навигация, сетка карточек и PWA-манифест. */
(() => {
  'use strict';

  const T = window.AniTierTests;

  T.test('mobile: оболочка, нижняя навигация и PWA-манифест', async () => {
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;left:-20000px;top:0;width:390px;height:844px;border:0;';
    frame.src = '../mobile/index.html?test=1';

    const loaded = new Promise((resolve, reject) => {
      frame.onload = resolve;
      frame.onerror = reject;
    });

    document.body.appendChild(frame);
    await loaded;

    const win = frame.contentWindow;
    const doc = frame.contentDocument;

    try {
      await T.waitFor(() => win.__anitierTest, 'Мобильная оболочка не выставила тестовый API', 4000);

      const nav = doc.querySelector('.tabs');
      const tabs = [...doc.querySelectorAll('.tabs .tab')];
      T.assert(nav, 'Нет нижней навигации');
      T.eq(nav.parentElement.tagName, 'BODY', 'Навигация должна быть вне шапки, иначе fixed считается от .topbar');
      T.eq(getComputedStyle(nav).position, 'fixed', 'Навигация должна быть закреплена');
      T.assert(
        Math.abs(nav.getBoundingClientRect().bottom - win.innerHeight) <= 1,
        'Нижняя навигация не прижата к низу экрана',
      );
      T.eq(tabs.length, 5, 'В нижней навигации должно быть 5 разделов');
      T.includes(nav.textContent, 'Скоро', 'Потерялся раздел «Скоро»');
      T.assert(!tabs.some(tab => tab.scrollWidth > tab.clientWidth + 1), 'Подпись вкладки не помещается');
      const franchiseScroller = doc.createElement('div');
      franchiseScroller.className = 'franchise-list';
      doc.body.appendChild(franchiseScroller);
      T.eq(getComputedStyle(franchiseScroller).gridAutoFlow, 'column', 'Сезоны должны прокручиваться по горизонтали');
      T.eq(getComputedStyle(franchiseScroller).overflowX, 'auto', 'Список сезонов должен реагировать на свайп');
      franchiseScroller.remove();

      const gridColumns = getComputedStyle(doc.querySelector('#db-grid'))
        .gridTemplateColumns
        .split(/\s+/)
        .filter(Boolean);
      T.eq(gridColumns.length, 2, 'На телефоне должно быть две карточки в ряд');
      T.assert(
        doc.documentElement.scrollWidth <= win.innerWidth + 1,
        'Появился горизонтальный скролл',
      );

      const modal = doc.getElementById('modal');
      T.eq(getComputedStyle(modal).alignItems, 'end', 'Модалка должна открываться снизу');
      T.eq(
        getComputedStyle(modal.querySelector('.modal-panel')).animationName,
        'none',
        'Анимация модалки не должна выталкивать шторку за экран',
      );

      const exchangeModal = doc.getElementById('exchange-modal');
      T.assert(exchangeModal, 'Нет модалки обмена тир-листами');
      T.eq(getComputedStyle(exchangeModal).alignItems, 'end', 'Обмен должен открываться нижней шторкой');
      T.assert(doc.querySelector('[data-action="exchange-export"]'), 'Нет кнопки экспорта на телефоне');
      T.assert(doc.querySelector('[data-action="exchange-import"]'), 'Нет кнопки импорта на телефоне');
      T.assert(doc.getElementById('exchange-content'), 'Нет контейнера обмена');

      win.__anitierTest.openExchange('import', 'watched');
      T.eq(exchangeModal.hidden, false, 'Модалка обмена не открылась');
      const exchangePanel = doc.getElementById('exchange-panel');
      const exchangeRect = exchangePanel.getBoundingClientRect();
      T.assert(exchangeRect.width <= win.innerWidth + 1, 'Шторка обмена шире экрана');
      T.assert(exchangeRect.bottom <= win.innerHeight + 1, 'Шторка обмена выходит за низ экрана');
      T.assert(
        doc.documentElement.scrollWidth <= win.innerWidth + 1,
        'Обмен тир-листами добавил горизонтальный скролл',
      );
      win.__anitierTest.closeExchange();
      T.eq(exchangeModal.hidden, true, 'Модалка обмена не закрылась');

      const manifest = await fetch('../mobile/manifest.webmanifest');
      T.eq(manifest.status, 200, 'Манифест не отдаётся');
      T.includes(
        manifest.headers.get('content-type') || '',
        'application/manifest+json',
        'Неверный Content-Type манифеста',
      );

      const icon192 = await fetch('../mobile/icons/icon-192.png');
      const icon512 = await fetch('../mobile/icons/icon-512.png');
      T.eq(icon192.status, 200, 'Нет иконки 192×192');
      T.eq(icon512.status, 200, 'Нет иконки 512×512');

      const phone = await fetch('../AniTier-phone.html');
      T.eq(phone.status, 200, 'Нет автономного файла для телефона');
      const phoneHtml = await phone.text();
      T.assert(!/<script\s+src=/i.test(phoneHtml), 'В автономном файле остались внешние скрипты');
      T.assert(!/rel="stylesheet"/i.test(phoneHtml), 'В автономном файле остались внешние стили');
      T.includes(phoneHtml, 'fetchAniList', 'В автономном файле нет кода приложения');
      T.includes(phoneHtml, 'id="exchange-modal"', 'В автономном файле нет окна обмена тир-листами');
      T.includes(phoneHtml, 'ANITIER-TIER-1:', 'В автономном файле нет кода обмена тир-листами');
      T.assert(!phoneHtml.includes('serviceWorker'), 'Service worker не работает с file:// и не должен попадать в автономный файл');
    } finally {
      frame.remove();
    }
  });
})();
