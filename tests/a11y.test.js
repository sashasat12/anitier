/* Доступность и пустые состояния: вкладки, фокус, aria-live, подсказки. */
(() => {
  'use strict';
  const T = window.AniTierTests;

  T.test('a11y: вкладки размечены как ARIA Tabs и переключаются стрелками', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const api = app.win.__anitierTest;
      await api.init();
      const doc = app.win.document;

      const tabs = [...doc.querySelectorAll('.tabs .tab')];
      T.eq(tabs.length, 5, 'Пять разделов');
      T.eq(doc.getElementById('tab-db').getAttribute('aria-selected'), 'true');
      T.eq(doc.getElementById('tab-db').tabIndex, 0);
      T.eq(doc.getElementById('tab-db').getAttribute('aria-controls'), 'view-db');
      T.eq(doc.getElementById('tab-watched').getAttribute('aria-selected'), 'false');
      T.eq(doc.getElementById('tab-watched').tabIndex, -1);
      T.eq(doc.getElementById('view-db').getAttribute('aria-labelledby'), 'tab-db');

      doc.getElementById('tab-watched').click();
      T.eq(doc.getElementById('tab-watched').getAttribute('aria-selected'), 'true');
      T.eq(doc.getElementById('tab-watched').tabIndex, 0);
      T.eq(doc.getElementById('tab-db').getAttribute('aria-selected'), 'false');
      T.eq(doc.getElementById('tab-db').tabIndex, -1);
      T.eq(doc.getElementById('view-db').hidden, true, 'Старый раздел скрыт');
      T.eq(doc.getElementById('view-watched').hidden, false, 'Новый раздел открыт');

      doc.getElementById('tab-watched').focus();
      doc.getElementById('tab-watched').dispatchEvent(new app.win.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      T.eq(doc.activeElement, doc.getElementById('tab-planned'), 'Фокус ушёл на соседнюю вкладку');
      T.eq(doc.getElementById('tab-planned').getAttribute('aria-selected'), 'true');
      T.eq(doc.getElementById('view-planned').hidden, false);

      doc.getElementById('tab-planned').dispatchEvent(new app.win.KeyboardEvent('keydown', { key: 'End', bubbles: true }));
      T.eq(doc.activeElement, doc.getElementById('tab-upcoming'));
      doc.getElementById('tab-upcoming').dispatchEvent(new app.win.KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
      T.eq(doc.activeElement, doc.getElementById('tab-db'));
    } finally {
      app.close();
    }
  });

  T.test('a11y: пустой список предлагает найти аниме и ведёт в базу', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const api = app.win.__anitierTest;
      await api.init();
      const doc = app.win.document;

      doc.getElementById('tab-watched').click();
      const empty = doc.getElementById('empty-watched');
      T.assert(empty, 'Блок пустого состояния создан');
      T.eq(empty.hidden, false);
      T.includes(empty.textContent, 'Пока пусто');
      const button = empty.querySelector('[data-action="find-more"]');
      T.assert(button, 'Есть кнопка действия');
      T.includes(button.textContent, 'Найти аниме');

      button.click();
      T.eq(api.state.tab, 'db', 'Открылась база');
      await T.waitFor(() => doc.activeElement === doc.getElementById('search-input'), 'Фокус в поле поиска');

      api.state.lists.watched.S = [{
        id: 1, malId: 1, title: 'Тайтл', altTitle: '', image: '', episodes: 12,
        type: 'TV', status: 'Завершено', score: 8, year: 2020, genres: [],
      }];
      doc.getElementById('tab-watched').click();
      T.eq(doc.getElementById('empty-watched').hidden, true, 'Со списком подсказка скрыта');
    } finally {
      app.close();
    }
  });

  T.test('a11y: пустая выдача базы предлагает сбросить фильтры', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const api = app.win.__anitierTest;
      await api.init();
      const doc = app.win.document;
      const db = api.state.db;

      db.items = [];
      db.loading = false;
      db.error = null;
      db.filters = { type: 'tv', status: '', year: '', genre: '', minScore: '10' };
      doc.getElementById('tab-db').click();

      const grid = doc.getElementById('db-grid');
      const reset = grid.querySelector('[data-action="reset-filters"]');
      T.assert(reset, 'Кнопка сброса фильтров есть');
      T.includes(reset.textContent, 'Сбросить фильтры');
      T.includes(grid.textContent, 'Ничего не нашлось');
    } finally {
      app.close();
    }
  });

  T.test('a11y: тосты и карточка обновления объявляются экранному диктору', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const api = app.win.__anitierTest;
      await api.init();
      const doc = app.win.document;

      const toasts = doc.getElementById('toasts');
      T.eq(toasts.getAttribute('role'), 'status');
      T.eq(toasts.getAttribute('aria-live'), 'polite');
      const card = doc.getElementById('update-card');
      T.eq(card.getAttribute('role'), 'status');
      T.eq(card.getAttribute('aria-live'), 'polite');
    } finally {
      app.close();
    }
  });

  T.test('a11y: клавиатурный фокус видим у вкладок и карточек', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const api = app.win.__anitierTest;
      await api.init();
      const doc = app.win.document;

      const style = doc.querySelector('link[href*="styles.css"]');
      T.assert(style, 'Стили подключены');
      const text = await fetch(style.href).then(response => response.text());
      T.includes(text, ':focus-visible');
      T.includes(text, 'outline: 2px solid var(--accent)');
      T.includes(text, '.empty-cta');
    } finally {
      app.close();
    }
  });

  T.test('a11y: Alt+стрелки переносят карточку между тирами', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const api = app.win.__anitierTest;
      await api.init();
      const doc = app.win.document;
      const win = app.win;

      win.AniTier.addToList('watched', {
        id: 777001, malId: 777001, title: 'Тир-клавиша', altTitle: '', image: '',
        episodes: 12, type: 'TV', status: 'Завершено', score: 8, year: 2022, genres: [],
      }, 'C', true);
      doc.getElementById('tab-watched').click();

      const card = doc.querySelector('#tiers-watched .tier-card[data-id="777001"]');
      T.assert(card, 'Карточка попала в тир C');
      T.eq(card.getAttribute('aria-keyshortcuts'), 'Alt+ArrowUp Alt+ArrowDown');
      T.eq(api.state.lists.watched.C[0].id, 777001);

      card.focus();
      card.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true, bubbles: true }));
      T.eq(api.state.lists.watched.B[0].id, 777001, 'Alt+↑ поднял карточку в тир B');
      T.eq(api.state.lists.watched.C.length, 0, 'В тире C карточки не осталось');
      T.eq(doc.activeElement.dataset.id, '777001', 'Фокус остался на карточке');

      doc.activeElement.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true }));
      T.eq(api.state.lists.watched.C[0].id, 777001, 'Alt+↓ вернул карточку в тир C');

      const top = doc.querySelector('#tiers-watched .tier-card[data-id="777001"]');
      top.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      T.eq(api.state.lists.watched.B.length, 0, 'Без зажатого Alt карточка не двигается');
      T.eq(api.state.lists.watched.C[0].id, 777001, 'Карточка осталась в тире C');
    } finally {
      app.close();
    }
  });

  T.test('a11y: фокус зацикливается внутри открытой карточки', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const api = app.win.__anitierTest;
      await api.init();
      const doc = app.win.document;
      const win = app.win;

      const card = doc.querySelector('#db-grid .card');
      T.assert(card, 'В демо-базе есть карточка');
      card.click();

      const modal = doc.getElementById('modal');
      T.eq(modal.hidden, false, 'Карточка открылась');
      const dialog = modal.querySelector('[role="dialog"]');
      T.assert(dialog, 'У карточки есть роль диалога');

      const selector = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
      const focusables = [...dialog.querySelectorAll(selector)].filter(node => node.getClientRects().length > 0);
      T.assert(focusables.length > 1, 'Внутри карточки есть несколько элементов фокуса');

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      last.focus();
      last.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
      T.eq(doc.activeElement, first, 'Tab с последнего элемента возвращает к первому');

      first.focus();
      first.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
      T.eq(doc.activeElement, last, 'Shift+Tab с первого элемента уходит к последнему');
    } finally {
      app.close();
    }
  });
})();
