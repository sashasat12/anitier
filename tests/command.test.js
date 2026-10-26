/* Глобальный поиск: окно, результаты, клавиатура. */
(() => {
  'use strict';
  const T = window.AniTierTests;

  function anime(overrides = {}) {
    return {
      id: 1,
      malId: 1,
      title: 'Тайтл',
      altTitle: '',
      image: '',
      episodes: 12,
      type: 'TV',
      status: 'Завершено',
      score: 8,
      year: 2020,
      genres: [],
      ...overrides,
    };
  }

  function typeQuery(app, value) {
    const input = app.win.document.getElementById('command-input');
    input.value = value;
    input.dispatchEvent(new app.win.Event('input', { bubbles: true }));
  }

  function key(app, name, options = {}) {
    app.win.document.dispatchEvent(new app.win.KeyboardEvent('keydown', {
      key: name,
      bubbles: true,
      ...options,
    }));
  }

  T.test('app: глобальный поиск открывается кнопкой и Ctrl+K', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const api = app.win.__anitierTest;
      await api.init();
      const doc = app.win.document;
      const state = api.state;

      state.lists.watched.S = [anime({ id: 1, title: 'Фрирен', altTitle: 'Sousou no Frieren', year: 2023 })];
      state.lists.planned.B = [anime({ id: 2, title: 'Фрирен: Продолжение', year: 2026 })];
      state.db.items = [
        anime({ id: 1, title: 'Фрирен', year: 2023 }),
        anime({ id: 2, title: 'Фрирен: Продолжение', year: 2026 }),
      ];

      const button = doc.querySelector('[data-action="open-command"]');
      T.assert(button, 'В шапке должна быть кнопка глобального поиска');
      button.focus();
      button.click();

      const modal = doc.getElementById('command-modal');
      const input = doc.getElementById('command-input');
      T.eq(modal.hidden, false, 'Окно поиска открыто');
      T.eq(doc.activeElement, input, 'Фокус в поле поиска');
      T.assert(doc.body.classList.contains('no-scroll'), 'Фон не прокручивается');
      T.includes(doc.getElementById('command-results').textContent, 'Начните вводить');
      T.eq(input.hasAttribute('aria-activedescendant'), false, 'Без запроса активной строки нет');

      typeQuery(app, 'фрирен');
      const rows = doc.querySelectorAll('.command-row');
      T.eq(rows.length, 2, 'Дубль из базы не показывается');
      T.includes(rows[0].textContent, 'Фрирен');
      T.includes(rows[0].textContent, 'Просмотрено · S');
      T.includes(rows[1].textContent, 'Планы · B');
      T.eq(rows[0].id, 'command-row-0', 'У строки есть id для aria-activedescendant');
      T.eq(input.getAttribute('aria-activedescendant'), 'command-row-0', 'Озвучивается первая строка');

      key(app, 'ArrowDown');
      T.eq(input.getAttribute('aria-activedescendant'), 'command-row-1', 'Озвучивание следует за выбором');
      T.assert(doc.querySelectorAll('.command-row')[1].classList.contains('is-active'), 'Выбор перешёл вниз');
      key(app, 'Home');
      T.assert(doc.querySelectorAll('.command-row')[0].classList.contains('is-active'), 'Home ведёт к первому');
      key(app, 'End');
      T.assert(doc.querySelectorAll('.command-row')[1].classList.contains('is-active'), 'End ведёт к последнему');
      key(app, 'Enter');

      T.eq(modal.hidden, true, 'После выбора окно поиска закрыто');
      const card = doc.getElementById('modal');
      T.eq(card.hidden, false, 'Карточка открыта');
      T.includes(doc.getElementById('modal-title').textContent, 'Продолжение');

      key(app, 'k', { ctrlKey: true });
      T.eq(modal.hidden, false, 'Ctrl+K снова открывает поиск');
      T.eq(card.hidden, true, 'Карточка закрылась перед поиском');
      key(app, 'Escape');
      T.eq(modal.hidden, true, 'Esc закрывает поиск');
      T.eq(doc.activeElement, button, 'Фокус вернулся на кнопку в шапке');
      T.assert(!doc.body.classList.contains('no-scroll'), 'Прокрутка вернулась');
    } finally {
      app.close();
    }
  });

  T.test('app: глобальный поиск открывает результат мышью и показывает промах', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const api = app.win.__anitierTest;
      await api.init();
      const doc = app.win.document;
      const state = api.state;

      state.db.items = [anime({ id: 42, title: 'Ковбой Бибоп', year: 1998 })];
      api.openCommand();
      typeQuery(app, 'ковбой');
      const row = doc.querySelector('.command-row');
      T.assert(row, 'Результат должен быть');
      T.includes(row.textContent, 'База');

      row.click();
      T.eq(doc.getElementById('command-modal').hidden, true);
      T.eq(doc.getElementById('modal').hidden, false);
      T.includes(doc.getElementById('modal-title').textContent, 'Ковбой Бибоп');
      doc.querySelector('#modal .modal-close').click();

      api.openCommand();
      typeQuery(app, 'абракадабра');
      T.includes(doc.getElementById('command-results').textContent, 'Ничего не нашлось');
      doc.querySelector('#command-modal .modal-backdrop').click();
      T.eq(doc.getElementById('command-modal').hidden, true, 'Клик по фону закрывает');
    } finally {
      app.close();
    }
  });
  T.test('app: глобальный поиск прокручивает активную строку в видимую область', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const api = app.win.__anitierTest;
      await api.init();
      const doc = app.win.document;

      api.state.db.items = Array.from({ length: 8 }, (_, i) => anime({
        id: 900 + i,
        title: `Тестовый тайтл ${i + 1}`,
        year: 2000 + i,
      }));

      api.openCommand();
      const box = doc.getElementById('command-results');
      typeQuery(app, 'тестовый');
      T.eq(doc.querySelectorAll('.command-row').length, 8, 'Восемь результатов');
      T.eq(box.scrollTop, 0, 'Сначала список сверху');

      doc.dispatchEvent(new app.win.KeyboardEvent('keydown', { key: 'End', bubbles: true }));
      const last = doc.querySelectorAll('.command-row')[7];
      T.assert(last.classList.contains('is-active'), 'End выбирает последнюю строку');
      T.assert(box.scrollTop > 0, 'Список прокрутился к последней строке');
      const boxRect = box.getBoundingClientRect();
      const rowRect = last.getBoundingClientRect();
      T.assert(rowRect.bottom <= boxRect.bottom + 1, 'Последняя строка видна целиком');

      doc.dispatchEvent(new app.win.KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
      const first = doc.querySelectorAll('.command-row')[0];
      T.assert(first.classList.contains('is-active'), 'Home выбирает первую строку');
      const topRect = box.getBoundingClientRect();
      T.assert(first.getBoundingClientRect().top >= topRect.top - 1, 'Первая строка видна');
      T.assert(box.scrollTop < 20, 'Список вернулся к началу');
      key(app, 'Escape');
    } finally {
      app.close();
    }
  });
})();
