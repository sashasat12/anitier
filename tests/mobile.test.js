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
      T.includes(nav.textContent, 'Просмотрено', 'Раздел просмотренного подписан понятно');
      T.assert(!nav.textContent.includes('Смотрю'), 'Старая подпись «Смотрю» убрана');
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

      T.assert(doc.querySelector('#continue-block'), 'Нет блока «Продолжить просмотр»');
      T.assert(doc.querySelector('#continue-row'), 'Нет контейнера начатых тайтлов');
      T.eq(getComputedStyle(doc.querySelector('#continue-row')).gridTemplateColumns.split(/\s+/).length, 1, 'На телефоне начатые тайтлы идут в столбик');
      T.assert(doc.querySelector('#upcoming-mine'), 'Нет кнопки «Только мои серии»');
      T.assert(doc.querySelector('[data-action="export-ics"]'), 'Нет экспорта календаря .ics');
      T.eq(getComputedStyle(doc.querySelector('#toasts')).bottom !== '18px', true, 'Тосты подняты над нижней навигацией');

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

      /* Карточка обновления должна помещаться над нижней навигацией. */
      await win.__anitierTest.init();
      const mobileState = win.__anitierTest.state;
      mobileState.settings.updateCheck = 'ask';
      await win.AniTier.autoCheckUpdates();
      const updateCard = doc.getElementById('update-card');
      T.eq(updateCard.hidden, false, 'Карточка обновления не показалась на телефоне');
      const updateRect = updateCard.getBoundingClientRect();
      T.assert(updateRect.width <= win.innerWidth + 1, 'Карточка обновления шире экрана');
      T.assert(updateRect.bottom <= nav.getBoundingClientRect().top + 1, 'Карточка обновления перекрывает навигацию');
      T.assert(updateRect.top >= 0, 'Карточка обновления уехала за верх экрана');
      T.assert(
        doc.documentElement.scrollWidth <= win.innerWidth + 1,
        'Карточка обновления добавила горизонтальный скролл',
      );
      updateCard.querySelector('[data-action="update-deny"]').click();
      T.eq(updateCard.hidden, true, 'Карточка обновления не закрылась');

      const manifest = await fetch('../mobile/manifest.webmanifest');
      T.eq(manifest.status, 200, 'Манифест не отдаётся');
      T.includes(
        manifest.headers.get('content-type') || '',
        'application/manifest+json',
        'Неверный Content-Type манифеста',
      );
      const manifestJson = await manifest.clone().json();
      T.assert(Array.isArray(manifestJson.shortcuts) && manifestJson.shortcuts.length >= 3, 'В манифесте есть быстрые действия');
      T.eq(manifestJson.share_target && manifestJson.share_target.method, 'GET', 'share_target принимает GET');
      T.eq(manifestJson.share_target && manifestJson.share_target.params && manifestJson.share_target.params.url, 'url', 'share_target читает url');
      T.eq(manifestJson.orientation, 'any', 'PWA разрешает поворот экрана');

      const androidManifest = await (await fetch('../android/AndroidManifest.xml')).text();
      T.assert(!androidManifest.includes('screenOrientation="portrait"'), 'APK не блокирует поворот');

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

  T.test('mobile: меню тегов помещается в экран и не закрывается от клавиатуры', async () => {
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;left:-20000px;top:0;width:390px;height:844px;border:0;';
    frame.src = '../mobile/index.html?demo=1&test=1';

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
      const api = win.__anitierTest;
      await api.init();

      doc.querySelector('[data-action="toggle-filters"]').click();
      doc.querySelector('[data-filter-menu="tags"]').click();
      const panel = doc.querySelector('[data-filter-panel="tags"]');
      T.eq(panel.hidden, false, 'Меню тегов открылось');

      const rect = panel.getBoundingClientRect();
      T.assert(rect.width <= win.innerWidth + 1, 'Меню шире экрана');
      T.assert(rect.left >= -1, 'Меню уехало за левый край');
      T.assert(rect.right <= win.innerWidth + 1, 'Меню уехало за правый край');

      const search = panel.querySelector('.filter-menu-search input');
      T.assert(doc.activeElement !== search, 'Фокус не должен попадать в поиск тегов');

      const groups = [...panel.querySelectorAll('.filter-menu-group')].map(group => group.textContent.trim());
      T.assert(groups.length > 1, 'Теги разбиты на группы');
      T.assert(groups.every(label => !/[A-Za-z]/.test(label)), 'Категории тегов без латиницы');

      const box = panel.querySelector('input[value="Shounen"]');
      T.assert(box, 'Есть тег Shounen');
      box.checked = true;
      box.dispatchEvent(new win.Event('change', { bubbles: true }));
      T.eq(api.state.db.filters.tags, ['Shounen'], 'Тег выбран на телефоне');
      T.eq(doc.querySelector('[data-filter-value="tags"]').textContent, 'Сёнэн');

      /* Клавиатура меняет только высоту — меню должно остаться открытым. */
      win.dispatchEvent(new win.Event('resize'));
      T.eq(panel.hidden, false, 'Resize без смены ширины не закрывает меню');
      T.assert(doc.documentElement.scrollWidth <= win.innerWidth + 1, 'Появился горизонтальный скролл');
    } finally {
      frame.remove();
    }
  });

  T.test('mobile: меню тегов — шторка над навигацией со сбросом', async () => {
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;left:-20000px;top:0;width:390px;height:844px;border:0;';
    frame.src = '../mobile/index.html?demo=1&test=1';

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
      const api = win.__anitierTest;
      await api.init();

      doc.querySelector('[data-action="toggle-filters"]').click();
      doc.querySelector('[data-filter-menu="tags"]').click();
      const panel = doc.querySelector('[data-filter-panel="tags"]');
      T.eq(panel.hidden, false, 'Меню тегов открылось');

      const css = win.getComputedStyle(panel);
      T.eq(css.position, 'fixed', 'Меню на телефоне — фиксированная шторка');
      T.includes(css.bottom, '66px', 'Шторка прижата к низу над навигацией');
      T.eq(css.left, '12px', 'Шторка по центру экрана');
      T.eq(css.right, '12px', 'Шторка по центру экрана');
      T.eq(panel.style.width, '', 'Позицию не перебивают инлайн-стили десктопа');

      const nav = doc.querySelector('.tabs');
      T.assert(nav, 'Есть нижняя навигация');
      T.assert(Number(css.zIndex) > Number(win.getComputedStyle(nav).zIndex), 'Шторка выше навигации');

      const footer = panel.querySelector('.filter-menu-footer [data-action="clear-tag-filter"]');
      T.assert(footer, 'В меню есть кнопка «Сбросить теги»');

      const box = panel.querySelector('input[value="Shounen"]');
      box.checked = true;
      box.dispatchEvent(new win.Event('change', { bubbles: true }));
      T.eq(api.state.db.filters.tags, ['Shounen'], 'Тег выбран');

      footer.click();
      T.eq(api.state.db.filters.tags, [], 'Сброс очищает выбранные теги');
      T.eq(panel.hidden, true, 'Меню закрылось после сброса');
    } finally {
      frame.remove();
    }
  });
})();
