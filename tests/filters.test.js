/* Фильтры базы: несколько значений и ползунок рейтинга. */
(() => {
  'use strict';
  const T = window.AniTierTests;

  function choose(app, key, values) {
    const doc = app.win.document;
    doc.querySelector(`[data-filter-menu="${key}"]`).click();
    const panel = doc.querySelector(`[data-filter-panel="${key}"]`);
    T.eq(panel.hidden, false, `Меню ${key} открылось`);
    for (const value of values) {
      const box = panel.querySelector(`input[value="${value}"]`);
      T.assert(box, `Нет варианта ${key}:${value}`);
      box.checked = true;
      box.dispatchEvent(new app.win.Event('change', { bubbles: true }));
    }
    return panel;
  }

  T.test('filters: можно выбрать несколько годов, жанров, типов и статусов', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const api = app.win.__anitierTest;
      await api.init();
      const doc = app.win.document;
      doc.querySelector('[data-action="toggle-filters"]').click();

      const yearPanel = choose(app, 'year', ['2024', '2023']);
      T.eq(api.state.db.filters.year, ['2024', '2023'], 'Оба года сохранены');
      T.eq(doc.querySelector('[data-filter-value="year"]').textContent, '2024, 2023');
      T.eq(yearPanel.hidden, false, 'Меню не закрывается после выбора');

      choose(app, 'genre', ['1', '4']);
      T.eq(api.state.db.filters.genre, ['1', '4'], 'Оба жанра сохранены');
      T.eq(doc.querySelector('[data-filter-value="genre"]').textContent, 'Экшен, Комедия');

      choose(app, 'type', ['tv', 'movie']);
      T.eq(api.state.db.filters.type, ['tv', 'movie']);

      choose(app, 'status', ['complete']);
      T.eq(api.state.db.filters.status, ['complete']);

      T.eq(api.state.db.filters.year.length, 2);
      T.eq(doc.querySelector('#filter-count').textContent, '4', 'Счётчик считает поля');
      T.eq(doc.querySelector('[data-filter-menu="genre"]').classList.contains('has-value'), true);
      T.eq(doc.querySelector('#db-grid .card') !== null, true, 'Сетка не пустая');
    } finally {
      app.close();
    }
  });

  T.test('filters: ползунок задаёт минимальный рейтинг и сбрасывается', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const api = app.win.__anitierTest;
      await api.init();
      const doc = app.win.document;
      doc.querySelector('[data-action="toggle-filters"]').click();

      const score = doc.querySelector('#filter-score');
      T.eq(score.type, 'range');
      T.eq(score.value, '0');

      score.value = '8';
      score.dispatchEvent(new app.win.Event('input', { bubbles: true }));
      T.eq(doc.querySelector('#filter-score-value').textContent, 'от 8', 'Подпись обновляется сразу');
      score.dispatchEvent(new app.win.Event('change', { bubbles: true }));
      T.eq(api.state.db.filters.minScore, '8');
      T.eq(doc.querySelector('#filter-count').textContent, '1');

      choose(app, 'genre', ['1']);
      T.eq(api.state.db.filters.genre, ['1']);
      T.eq(doc.querySelector('#filter-count').textContent, '2');

      doc.querySelector('[data-action="reset-filters"]').click();
      T.eq(api.state.db.filters, { type: [], status: [], year: [], genre: [], tags: [], minScore: '' });
      T.eq(doc.querySelector('#filter-score').value, '0');
      T.eq(doc.querySelector('#filter-score-value').textContent, 'Любой');
      T.eq(doc.querySelector('#filter-count').hidden, true);
      T.eq(doc.querySelector('[data-filter-panel="genre"]').hidden, true, 'Сброс закрывает меню');
      T.eq(doc.querySelector('[data-filter-value="genre"]').textContent, 'Любой');
    } finally {
      app.close();
    }
  });

  T.test('filters: меню закрывается по Esc и клику вне фильтра', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const api = app.win.__anitierTest;
      await api.init();
      const doc = app.win.document;
      doc.querySelector('[data-action="toggle-filters"]').click();

      const button = doc.querySelector('[data-filter-menu="year"]');
      button.click();
      T.eq(doc.querySelector('[data-filter-panel="year"]').hidden, false);
      doc.dispatchEvent(new app.win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      T.eq(doc.querySelector('[data-filter-panel="year"]').hidden, true, 'Esc закрывает меню');
      T.eq(button.getAttribute('aria-expanded'), 'false');

      button.click();
      doc.querySelector('#search-input').click();
      T.eq(doc.querySelector('[data-filter-panel="year"]').hidden, true, 'Клик вне фильтра закрывает меню');
    } finally {
      app.close();
    }
  });

  /* Меню тегов на телефоне: раньше фокус уходил в поиск, открывалась
     клавиатура, приходил resize — и меню закрывалось до выбора тега. */
  T.test('filters: меню тегов открывается без фокуса в поиске', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const api = app.win.__anitierTest;
      await api.init();
      const doc = app.win.document;
      doc.querySelector('[data-action="toggle-filters"]').click();
      doc.querySelector('[data-filter-menu="tags"]').click();

      const panel = doc.querySelector('[data-filter-panel="tags"]');
      T.eq(panel.hidden, false, 'Меню тегов открылось');
      const search = panel.querySelector('.filter-menu-search input');
      T.assert(search, 'В меню тегов есть поле поиска');
      T.eq(search.value, '', 'Поле поиска пустое');
      T.assert(doc.activeElement !== search, 'Фокус не должен попадать в поиск тегов');
      T.eq(panel.querySelectorAll('.filter-option').length, window.AniTierCore.TAGS.length, 'Показаны все теги');
    } finally {
      app.close();
    }
  });

  T.test('filters: тег выбирается в меню и применяется к поиску', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const api = app.win.__anitierTest;
      await api.init();
      const doc = app.win.document;
      doc.querySelector('[data-action="toggle-filters"]').click();
      doc.querySelector('[data-filter-menu="tags"]').click();

      const panel = doc.querySelector('[data-filter-panel="tags"]');
      const box = panel.querySelector('input[value="Shounen"]');
      T.assert(box, 'Есть чекбокс тега Shounen');
      box.checked = true;
      box.dispatchEvent(new app.win.Event('change', { bubbles: true }));

      T.eq(api.state.db.filters.tags, ['Shounen'], 'Тег попал в фильтры');
      T.eq(doc.querySelector('[data-filter-value="tags"]').textContent, 'Сёнэн', 'Подпись фильтра по-русски');
      T.eq(doc.querySelector('#filter-count').textContent, '1', 'Счётчик фильтров');
      T.eq(panel.hidden, false, 'Меню остаётся открытым после выбора');

      await T.waitFor(
        () => doc.querySelector('#db-grid').textContent.includes('Ничего не нашлось'),
        'Фильтр по тегу применён к выдаче',
        8000,
      );

      box.checked = false;
      box.dispatchEvent(new app.win.Event('change', { bubbles: true }));
      T.eq(api.state.db.filters.tags, [], 'Тег снимается повторным нажатием');
      T.eq(doc.querySelector('[data-filter-value="tags"]').textContent, 'Любой');
    } finally {
      app.close();
    }
  });

  T.test('filters: поиск по тегам скрывает лишние пункты и пустые группы', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const api = app.win.__anitierTest;
      await api.init();
      const doc = app.win.document;
      doc.querySelector('[data-action="toggle-filters"]').click();
      doc.querySelector('[data-filter-menu="tags"]').click();

      const panel = doc.querySelector('[data-filter-panel="tags"]');
      const search = panel.querySelector('.filter-menu-search input');
      const options = [...panel.querySelectorAll('.filter-option')];
      const groups = [...panel.querySelectorAll('.filter-menu-group')];
      T.assert(groups.length > 1, 'Теги разбиты на группы');

      search.value = 'сён';
      search.dispatchEvent(new app.win.Event('input', { bubbles: true }));

      const shown = options.filter(option => !option.hidden);
      T.eq(shown.length, 1, 'Под запрос подходит один тег');
      T.includes(shown[0].textContent, 'Сёнэн');
      const shownGroups = groups.filter(group => !group.hidden);
      T.eq(shownGroups.length, 1, 'Видна только группа с совпадением');
      T.eq(shownGroups[0].textContent.trim(), 'Аудитория', 'Заголовок группы по-русски');

      search.value = '';
      search.dispatchEvent(new app.win.Event('input', { bubbles: true }));
      T.eq(options.filter(option => !option.hidden).length, options.length, 'Очистка возвращает все теги');
      T.eq(groups.filter(group => !group.hidden).length, groups.length, 'Очистка возвращает все группы');
    } finally {
      app.close();
    }
  });

  T.test('filters: повторное открытие меню тегов сбрасывает поиск', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const api = app.win.__anitierTest;
      await api.init();
      const doc = app.win.document;
      doc.querySelector('[data-action="toggle-filters"]').click();
      const button = doc.querySelector('[data-filter-menu="tags"]');
      button.click();

      const panel = doc.querySelector('[data-filter-panel="tags"]');
      const search = panel.querySelector('.filter-menu-search input');
      search.value = 'меха';
      search.dispatchEvent(new app.win.Event('input', { bubbles: true }));

      doc.querySelector('#search-input').click();
      T.eq(panel.hidden, true, 'Клик вне фильтра закрывает меню');

      button.click();
      T.eq(panel.hidden, false, 'Меню открылось снова');
      T.eq(panel.querySelector('.filter-menu-search input').value, '', 'Поиск очищен');
      T.eq([...panel.querySelectorAll('.filter-option')].filter(option => option.hidden).length, 0, 'Все теги снова видны');
    } finally {
      app.close();
    }
  });

  T.test('filters: клавиатура не закрывает меню, поворот экрана закрывает', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const api = app.win.__anitierTest;
      await api.init();
      const doc = app.win.document;
      doc.querySelector('[data-action="toggle-filters"]').click();
      doc.querySelector('[data-filter-menu="tags"]').click();

      const panel = doc.querySelector('[data-filter-panel="tags"]');
      T.eq(panel.hidden, false, 'Меню открыто');

      app.win.dispatchEvent(new app.win.Event('resize'));
      T.eq(panel.hidden, false, 'Resize без смены ширины (клавиатура) не закрывает меню');

      Object.defineProperty(app.win, 'innerWidth', { value: 720, configurable: true });
      app.win.dispatchEvent(new app.win.Event('resize'));
      T.eq(panel.hidden, true, 'Смена ширины (поворот) закрывает меню');
    } finally {
      app.close();
    }
  });
})();
