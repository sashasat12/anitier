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
})();
