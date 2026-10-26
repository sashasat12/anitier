/* Русские названия: словарь, поиск и переключатель языка названий. */
(() => {
  'use strict';
  const T = window.AniTierTests;

  function rawAniList(id, malId, title) {
    return {
      id,
      idMal: malId,
      title: { romaji: title, english: title, native: '' },
      synonyms: [],
      format: 'TV',
      episodes: 12,
      status: 'FINISHED',
      seasonYear: 2013,
      startDate: { year: 2013, month: 4, day: 7 },
      endDate: { year: 2013, month: 9, day: 29 },
      averageScore: 85,
      description: 'Test.',
      genres: ['Action'],
      studios: { nodes: [] },
      coverImage: { large: '' },
      siteUrl: '',
      nextAiringEpisode: null,
      isAdult: false,
    };
  }

  function makeFetch() {
    return async (url, options = {}) => {
      const parsed = new URL(url);
      if (parsed.hostname === 'graphql.anilist.co') {
        const body = JSON.parse(options.body || '{}');
        const vars = body.variables || {};
        const media = Array.isArray(vars.idMal_in) && vars.idMal_in.length
          ? vars.idMal_in.map(mal => rawAniList(7000 + Number(mal), Number(mal), 'Original ' + mal))
          : [];
        return new Response(JSON.stringify({
          data: { Page: { pageInfo: { hasNextPage: false }, media } },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (parsed.hostname === 'kitsu.io') {
        return new Response(JSON.stringify({ data: [], meta: { count: 0 } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
  }

  T.test('titles: русский запрос находит тайтл через словарь, когда обычный поиск пуст', async () => {
    const app = await T.mountApp({
      query: '?test=1',
      setup(win) { win.fetch = makeFetch(); },
    });
    try {
      const api = app.win.__anitierTest;
      await api.init();
      const doc = app.win.document;
      const input = doc.querySelector('#search-input');

      input.value = 'Атака титанов';
      input.dispatchEvent(new app.win.Event('input', { bubbles: true }));

      await T.waitFor(
        () => !api.state.db.loading && api.state.db.query === 'Атака титанов' && api.state.db.items.length > 0,
        'Русский запрос не нашёл тайтл через словарь',
        8000,
      );

      const item = api.state.db.items[0];
      T.eq(item.malId, 16498, 'Карточка получена по MAL ID из словаря');
      T.eq(api.state.db.resolveVia, 'dictionary');
      T.includes(doc.querySelector('#db-grid').textContent, 'Атака титанов', 'Карточка показывает русское название');
    } finally {
      app.close();
    }
  });

  T.test('titles: переключатель названий меняет карточки на оригинальные и обратно', async () => {
    const app = await T.mountApp({ query: '?test=1' });
    try {
      const api = app.win.__anitierTest;
      await api.init();
      const doc = app.win.document;
      const App = app.win.AniTier;

      api.state.db.loading = false;
      api.state.db.error = null;
      api.state.db.items = [{
        id: 1,
        malId: 1,
        title: 'Cowboy Bebop',
        titleRu: 'Ковбой Бибоп',
        originalTitle: 'Cowboy Bebop',
        altTitle: '',
        image: '',
        episodes: 26,
        type: 'TV',
        status: 'Завершено',
        score: 8.7,
        year: 1998,
        genres: [],
      }];
      App.renderDB();
      T.includes(doc.querySelector('#db-grid .card-title').textContent, 'Ковбой Бибоп');

      doc.querySelector('[data-action="open-settings"]').click();
      const select = doc.querySelector('select[data-action="settings-title-lang"]');
      T.assert(select, 'В настройках есть выбор языка названий');
      select.value = 'original';
      select.dispatchEvent(new app.win.Event('change', { bubbles: true }));

      T.eq(api.state.settings.titleLang, 'original');
      T.includes(doc.querySelector('#db-grid .card-title').textContent, 'Cowboy Bebop', 'Карточка переключилась на оригинал');

      const again = doc.querySelector('select[data-action="settings-title-lang"]');
      again.value = 'ru';
      again.dispatchEvent(new app.win.Event('change', { bubbles: true }));
      T.includes(doc.querySelector('#db-grid .card-title').textContent, 'Ковбой Бибоп', 'Вернулось русское название');
    } finally {
      app.close();
    }
  });
  T.test('titles: догрузка из Wikidata кэшируется и не повторяется', async () => {
    const app = await T.mountApp({ query: '?test=1' });
    const win = app.win;
    let calls = 0;
    win.fetch = async url => {
      if (!String(url).includes('query.wikidata.org')) {
        return new win.Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      calls += 1;
      return new win.Response(JSON.stringify({
        results: { bindings: [{ mal: { value: '999901' }, label: { value: 'Тестовое русское имя' } }] },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    try {
      const first = await win.AniTier.fetchRussianTitles([999901]);
      T.eq(first[999901], 'Тестовое русское имя');
      T.eq(calls, 1);

      const second = await win.AniTier.fetchRussianTitles([999901]);
      T.eq(second[999901], 'Тестовое русское имя');
      T.eq(calls, 1, 'Второй раз сеть не дёргается');

      const cached = await win.AniTier.mediaGet('titles', '999901');
      T.assert(cached && cached.title === 'Тестовое русское имя', 'Название сохранено в IndexedDB');
    } finally {
      app.close();
    }
  });

  T.test('titles: догруженное название применяется к карточкам', async () => {
    const app = await T.mountApp({ query: '?test=1' });
    const win = app.win;
    win.fetch = async url => {
      if (!String(url).includes('query.wikidata.org')) {
        return new win.Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new win.Response(JSON.stringify({
        results: { bindings: [{ mal: { value: '999902' }, label: { value: 'Русское имя' } }] },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    try {
      const api = win.__anitierTest;
      await api.init();
      const doc = win.document;
      api.state.db.loading = false;
      api.state.db.error = null;
      api.state.db.items = [{
        id: 999902, malId: 999902, title: 'Original title', titleRu: '', originalTitle: 'Original title',
        altTitle: '', image: '', episodes: 12, type: 'TV', status: 'Завершено', score: 8, year: 2020, genres: [],
      }];
      win.AniTier.renderDB();

      await api.enrichRussianTitles();
      await T.waitFor(() => api.state.db.items[0].titleRu === 'Русское имя', 'Название не применилось', 6000);
      T.includes(doc.querySelector('#db-grid .card-title').textContent, 'Русское имя');
    } finally {
      app.close();
    }
  });
})();
