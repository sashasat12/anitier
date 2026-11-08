/* PNG тир-листа: кнопка экспорта и сборка картинки без сети. */
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
      airedFrom: '',
      airedTo: '',
      synopsis: '',
      genres: [],
      url: '',
      source: '',
      sourceId: null,
      demo: false,
      ...overrides,
    };
  }

  T.test('app: экспорт показывает кнопку PNG и собирает картинку', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const api = app.win.__anitierTest;
      await api.init();
      const state = api.state;
      const doc = app.win.document;

      state.lists.watched.S = [
        anime({ id: 1, title: 'Первый тайтл с длинным названием для переноса строк' }),
        anime({ id: 2, title: 'Второй тайтл' }),
      ];
      state.lists.watched.A = [anime({ id: 3, title: 'Третий тайтл' })];
      state.lists.planned.N = [anime({ id: 4, title: 'В планах' })];

      api.openExchange('export', 'watched');
      const button = doc.querySelector('[data-action="tier-png"][data-list="watched"]');
      T.assert(button, 'В окне экспорта должна быть кнопка PNG');
      T.includes(button.textContent, 'PNG');

      const png = await api.buildTierListPngBlob('watched');
      T.eq(png.total, 3);
      T.eq(png.omitted, 0);
      T.eq(png.width, 1400);
      T.assert(png.height > 300, 'Высота картинки должна вмещать тиры');
      T.eq(png.blob.type, 'image/png');
      T.assert(png.blob.size > 1000, 'PNG не должен быть пустым');

      const planned = await api.buildTierListPngBlob('planned');
      T.eq(planned.total, 1);

      let message = '';
      state.lists.planned.N = [];
      try { await api.buildTierListPngBlob('planned'); } catch (err) { message = err.message; }
      T.includes(message, 'нет тайтлов');
    } finally {
      app.close();
    }
  });

  T.test('app: PNG использует язык названий и ограничивает параллелизм', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const api = app.win.__anitierTest;
      await api.init();
      const anime = { title: 'English', titleRu: 'Русское', altTitle: 'Original', originalTitle: 'Native' };
      api.state.settings.titleLang = 'ru';
      T.eq(api.tierPngTitle(anime), 'Русское', 'По умолчанию берётся русское название');
      api.state.settings.titleLang = 'original';
      T.eq(api.tierPngTitle(anime), 'Native', 'В режиме оригинала берётся оригинальное название');

      let active = 0;
      let maxActive = 0;
      await api.mapWithLimit([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 3, async (value) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise(r => setTimeout(r, 15));
        active -= 1;
        return value;
      });
      T.assert(maxActive <= 3, `Параллелизм превысил лимит: ${maxActive}`);
    } finally {
      app.close();
    }
  });
})();
