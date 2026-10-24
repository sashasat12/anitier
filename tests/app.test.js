(() => {
  'use strict';
  const T = window.AniTierTests;

  function fuzzyDate(offsetDays) {
    const d = new Date(Date.now() + offsetDays * 86400000);
    return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
  }

  function rawAniList(id, title, extra = {}) {
    return {
      id,
      idMal: id,
      title: { romaji: title, english: title, native: '' },
      synonyms: [],
      format: 'TV',
      episodes: 12,
      status: 'FINISHED',
      seasonYear: 2024,
      startDate: { year: 2024, month: 1, day: 1 },
      endDate: { year: 2024, month: 3, day: 31 },
      averageScore: 80,
      description: '',
      genres: ['Action'],
      studios: { nodes: [] },
      coverImage: { large: '' },
      siteUrl: `https://anilist.co/anime/${id}`,
      nextAiringEpisode: null,
      ...extra,
    };
  }

  function anilistResponse(media, hasNext = false) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          Page: {
            pageInfo: { hasNextPage: hasNext },
            media,
          },
        },
      }),
    };
  }

  function okJson(payload) {
    return { ok: true, status: 200, json: async () => payload };
  }

  function dbPage(page) {
    const start = (page - 1) * 20;
    const count = page === 1 ? 20 : 5;
    return Array.from({ length: count }, (_, index) => (
      rawAniList(1000 + start + index, `База ${start + index + 1}`)
    ));
  }

  function frierenAniList() {
    return rawAniList(1, 'Sousou no Frieren', {
      idMal: 52991,
      episodes: 28,
      seasonYear: 2023,
      startDate: { year: 2023, month: 9, day: 29 },
      endDate: { year: 2024, month: 3, day: 22 },
      averageScore: 91,
      description: 'Elf mage Frieren.',
      genres: ['Adventure', 'Drama', 'Fantasy'],
      studios: { nodes: [{ name: 'MADHOUSE' }] },
      siteUrl: 'https://anilist.co/anime/1',
    });
  }

  function anilistUnique() {
    return rawAniList(2, 'AniList Unique', {
      idMal: 60001,
      format: 'MOVIE',
      episodes: 1,
      status: 'RELEASING',
      seasonYear: 2024,
      averageScore: 80,
      description: 'Only from AniList.',
      genres: ['Action'],
      siteUrl: 'https://anilist.co/anime/2',
    });
  }

  function searchMedia(query, page) {
    if (page !== 1) return [];
    const value = String(query || '').toLowerCase();
    if (value.includes('frieren')) return [frierenAniList(), anilistUnique()];
    if (value.includes('naruto')) {
      return [rawAniList(402, 'Naruto', {
        idMal: 404,
        startDate: { year: 2002, month: 10, day: 3 },
        endDate: { year: 2007, month: 2, day: 8 },
        averageScore: 82,
      })];
    }
    return [];
  }

  function baseFetch(calls, options = {}) {
    let dbRequests = 0;

    return async (url, fetchOptions = {}) => {
      const parsed = new URL(url);
      const record = { url, host: parsed.hostname, vars: null };

      if (parsed.hostname === 'graphql.anilist.co') {
        const body = JSON.parse(fetchOptions.body || '{}');
        record.vars = body.variables || {};
        calls.push(record);
        if (options.onAniList) options.onAniList(record.vars);

        const vars = record.vars;
        const page = Number(vars.page) || 1;

        if (body.query && body.query.includes('AnimeFranchise')) {
          const currentId = Number(vars.id || 1000);
          const current = rawAniList(currentId, currentId === 1000 ? 'База 1' : 'Следующий сезон', {
            relations: currentId === 1000 ? { edges: [
              { relationType: 'PREQUEL', node: rawAniList(999, 'Предыдущий сезон') },
              { relationType: 'SEQUEL', node: rawAniList(1001, 'Следующий сезон', { seasonYear: 2025 }) },
            ] } : { edges: [] },
          });
          return anilistResponse([current], false);
        }

        if (vars.search) return anilistResponse(searchMedia(vars.search, page), false);

        if (vars.status === 'RELEASING') {
          return anilistResponse([
            rawAniList(101, 'В эфире 1', {
              status: 'RELEASING',
              startDate: fuzzyDate(-10),
              endDate: null,
              nextAiringEpisode: {
                episode: 6,
                airingAt: Math.floor((Date.now() + 7 * 86400000) / 1000),
              },
            }),
          ], false);
        }

        if (vars.status === 'FINISHED' && vars.endDateGreater) {
          return anilistResponse([
            rawAniList(102, 'Завершилось 1', {
              startDate: fuzzyDate(-100),
              endDate: fuzzyDate(-2),
            }),
          ], false);
        }

        if (vars.status === 'NOT_YET_RELEASED') {
          return anilistResponse(page === 1 ? [
            rawAniList(103, 'Скоро 1', {
              status: 'NOT_YET_RELEASED',
              startDate: fuzzyDate(5),
              endDate: null,
            }),
          ] : [], false);
        }

        if (vars.format === 'MOVIE') {
          return anilistResponse([
            rawAniList(201, 'Фильм 1', { format: 'MOVIE' }),
            rawAniList(202, 'Фильм 2', { format: 'MOVIE' }),
          ], false);
        }

        if (vars.sort && ['POPULARITY_DESC', 'SCORE_DESC'].includes(vars.sort[0])) {
          dbRequests += 1;
          if (dbRequests === 1 && options.firstDB) {
            await options.firstDB;
            return anilistResponse([
              rawAniList(401, 'Старый результат', { startDate: fuzzyDate(-500) }),
            ], false);
          }
          return anilistResponse(dbPage(page), page === 1);
        }

        return anilistResponse([], false);
      }

      calls.push(record);

      if (parsed.hostname === 'kitsu.io') {
        const text = String(parsed.searchParams.get('filter[text]') || '').toLowerCase();
        const offset = Number(parsed.searchParams.get('page[offset]') || 0);
        const data = offset === 0 && text.includes('frieren') ? [
          {
            id: '10',
            type: 'anime',
            attributes: {
              canonicalTitle: 'Sousou no Frieren',
              titles: { en: "Frieren: Beyond Journey's End", en_jp: 'Sousou no Frieren', ja_jp: '葬送のフリーレン' },
              synopsis: 'Elf mage Frieren.',
              subtype: 'TV',
              status: 'finished',
              episodeCount: 28,
              averageRating: '88.8',
              startDate: '2023-09-29',
              endDate: '2024-03-22',
              slug: 'sousou-no-frieren',
              posterImage: { large: '' },
            },
            relationships: {
              categories: { data: [{ type: 'categories', id: 'c1' }] },
              mappings: { data: [{ type: 'mappings', id: 'm1' }] },
            },
          },
          {
            id: '20',
            type: 'anime',
            attributes: {
              canonicalTitle: 'Kitsu Unique',
              titles: { en: 'Kitsu Unique', en_jp: 'Kitsu Unique', ja_jp: '' },
              synopsis: 'Only from Kitsu.',
              subtype: 'movie',
              status: 'current',
              episodeCount: 1,
              averageRating: '75.0',
              startDate: '2024-02-02',
              endDate: null,
              slug: 'kitsu-unique',
              posterImage: { large: '' },
            },
            relationships: {
              categories: { data: [] },
              mappings: { data: [] },
            },
          },
        ] : [];

        return okJson({
          data,
          included: [
            { type: 'categories', id: 'c1', attributes: { title: 'Adventure' } },
            { type: 'mappings', id: 'm1', attributes: { externalSite: 'myanimelist/anime', externalId: '52991' } },
          ],
          links: { next: null },
        });
      }

      throw new Error(`Неожиданный запрос: ${url}`);
    };
  }

  T.test('app: сначала уведомления и премьеры, потом база по 20', async () => {
    const calls = [];
    const app = await T.mountApp({
      query: '?test=1',
      setup(win) { win.fetch = baseFetch(calls); },
    });

    try {
      await app.win.__anitierTest.init();
      const state = app.win.__anitierTest.state;

      const dbIndex = calls.findIndex(call => (
        call.vars
        && call.vars.sort
        && call.vars.sort[0] === 'POPULARITY_DESC'
        && !call.vars.format
        && !call.vars.status
        && !call.vars.search
      ));
      T.assert(dbIndex >= 0, 'Запрос базы должен быть выполнен');

      const priorityCalls = calls.filter(call => (
        call.vars && ['RELEASING', 'FINISHED', 'NOT_YET_RELEASED'].includes(call.vars.status)
      ));
      T.eq(priorityCalls.length, 3, 'Должны быть запросы уведомлений и премьер');
      for (const call of priorityCalls) {
        T.assert(calls.indexOf(call) < dbIndex, `Запрос до базы: ${call.url}`);
      }

      T.assert(calls.every(call => ['graphql.anilist.co', 'kitsu.io'].includes(call.host)), 'Запросы должны идти только в AniList и Kitsu');
      T.eq(calls[dbIndex].vars.perPage, 20);
      T.eq(state.db.items.length, 20);
      T.eq(app.win.document.querySelectorAll('#db-grid .card').length, 20);
      T.eq(state.db.hasNext, true);
    } finally {
      app.close();
    }
  });

  T.test('app: карточка связывает сезоны, оценки и прогресс раздельно', async () => {
    const calls = [];
    const app = await T.mountApp({ query: '?test=1', setup(win) { win.fetch = baseFetch(calls); } });
    try {
      await app.win.__anitierTest.init();
      const doc = app.win.document;
      doc.querySelector('#db-grid .card').click();
      await T.waitFor(() => doc.querySelector('.franchise-link[data-id="1001"]'), 'В карточке не появился переход к продолжению');
      const seasonCard = doc.querySelector('.franchise-link[data-id="1001"]');
      T.assert(seasonCard.querySelector('.franchise-poster img').getAttribute('src'), 'Карточка сезона должна содержать постер');
      T.includes(seasonCard.textContent, 'Следующий сезон');
      T.includes(seasonCard.textContent, '2025');
      T.assert(doc.querySelector('.franchise-current[aria-current="true"]'), 'Текущая часть должна быть отмечена в порядке просмотра');
      doc.querySelector('[data-action="set-tier"][data-id="1000"][data-tier="B"]').click();
      doc.querySelector('.franchise-link[data-id="1001"]').click();
      await T.waitFor(() => app.win.__anitierTest.state.modalId === 1001, 'Переход к следующему сезону не сработал');
      doc.querySelector('[data-action="set-tier"][data-id="1001"][data-tier="A"]').click();
      doc.querySelector('[data-action="toggle-ep"][data-id="1001"][data-ep="1"]').click();
      const state = app.win.__anitierTest.state;
      T.eq(state.lists.watched.A[0].id, 1001);
      T.eq(state.lists.watched.B[0].id, 1000);
      T.eq(state.progress[1001].watched, [1]);
      T.eq(state.progress[1000], undefined);
    } finally { app.close(); }
  });

  T.test('app: повторный запрос обслуживается локальным кэшем', async () => {
    const calls = [];
    const app = await T.mountApp({ query: '?test=1', setup(win) { win.fetch = baseFetch(calls); } });
    try {
      const api = app.win.__anitierTest;
      await api.init();
      const variables = { search: 'persistent-cache-proof-unique', page: 1, perPage: 20, type: 'ANIME', isAdult: false };
      await api.fetchAniList(variables);
      const before = calls.length;
      api.clearMemoryApiCache();
      await api.fetchAniList(variables);
      T.eq(calls.length, before, 'Повторный запрос должен прочитаться из IndexedDB');
    } finally { app.close(); }
  });

  T.test('app: фильтры меняют переменные AniList и сбрасываются', async () => {
    const calls = [];
    const app = await T.mountApp({
      query: '?test=1',
      setup(win) { win.fetch = baseFetch(calls); },
    });

    try {
      await app.win.__anitierTest.init();
      const doc = app.win.document;
      const toggle = doc.querySelector('[data-action="toggle-filters"]');
      T.assert(toggle, 'Кнопка фильтров должна существовать');
      toggle.click();
      T.eq(doc.querySelector('#db-filters').hidden, false);

      doc.querySelector('[data-mode="score"]').click();
      await T.waitFor(() => app.win.__anitierTest.state.db.mode === 'score' && !app.win.__anitierTest.state.db.loading,
        'Режим рейтинга не включился');

      const type = doc.querySelector('#filter-type');
      T.assert(type, 'Фильтр типа должен существовать');
      type.value = 'movie';
      type.dispatchEvent(new app.win.Event('change', { bubbles: true }));

      await T.waitFor(
        () => !app.win.__anitierTest.state.db.loading
          && calls.some(call => call.vars && call.vars.format === 'MOVIE'),
        'Запрос с фильтром format=MOVIE не выполнился',
      );

      const filteredCall = [...calls].reverse().find(call => call.vars && call.vars.format === 'MOVIE');
      T.eq(filteredCall.vars.perPage, 20);
      T.eq(filteredCall.vars.sort, ['SCORE_DESC'], 'Фильтр применяется вместе с сортировкой по рейтингу');
      T.eq(app.win.__anitierTest.state.db.mode, 'score', 'Фильтр не должен сбрасывать режим сортировки');
      T.eq(doc.querySelectorAll('#db-grid .card').length, 2);
      T.eq(doc.querySelector('#filter-count').textContent, '1');
      T.eq(doc.querySelector('#filter-count').hidden, false);

      doc.querySelector('[data-action="reset-filters"]').click();
      await T.waitFor(
        () => !app.win.__anitierTest.state.db.loading
          && doc.querySelectorAll('#db-grid .card').length === 20,
        'Сброс фильтров не вернул популярную базу',
      );
      T.eq(doc.querySelector('#filter-count').hidden, true);
      T.eq(app.win.__anitierTest.state.db.mode, 'score', 'Сброс фильтров должен сохранить выбранный режим');
    } finally {
      app.close();
    }
  });

  T.test('app: поиск не теряется, если предыдущая загрузка ещё идёт', async () => {
    const calls = [];
    let resolveFirstDB;
    const firstDB = new Promise(resolve => { resolveFirstDB = resolve; });

    const app = await T.mountApp({
      query: '?test=1',
      setup(win) { win.fetch = baseFetch(calls, { firstDB }); },
    });

    try {
      const initPromise = app.win.__anitierTest.init();
      const doc = app.win.document;

      await T.waitFor(
        () => calls.some(call => call.vars && call.vars.sort && call.vars.sort[0] === 'POPULARITY_DESC'),
        'Первая загрузка базы не началась',
      );

      const input = doc.querySelector('#search-input');
      input.value = 'naruto';
      input.dispatchEvent(new app.win.Event('input', { bubbles: true }));

      await T.waitFor(
        () => app.win.__anitierTest.state.db.query === 'naruto',
        'Поисковый запрос не применился',
      );

      resolveFirstDB();
      await initPromise;

      await T.waitFor(
        () => {
          const grid = doc.querySelector('#db-grid');
          return grid && grid.textContent.includes('Naruto') && !grid.textContent.includes('Старый результат');
        },
        'После гонки запросов показан старый результат',
      );

      const searchCall = [...calls].reverse().find(call => call.vars && call.vars.search === 'naruto');
      T.assert(searchCall, 'Должен был выполниться поиск в AniList с search=naruto');
      T.eq(searchCall.host, 'graphql.anilist.co');
    } finally {
      app.close();
    }
  });

  T.test('app: ползунок только для длинных тайтлов, у коротких — кнопки серий', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });

    try {
      await app.win.__anitierTest.init();
      const doc = app.win.document;
      doc.querySelector('[data-action="tab"][data-tab="notifications"]').click();

      await T.waitFor(
        () => doc.querySelector('[data-action="notif-tab"][data-notif-tab="tracked"]'),
        'Не появились группы уведомлений',
      );
      const shortBlock = doc.querySelector('[data-ep-block="52991"]');
      T.eq(shortBlock.querySelectorAll('input[data-action="ep-slider"]').length, 0, 'У тайтла с семью вышедшими сериями нет ползунка');
      T.eq(shortBlock.querySelectorAll('.ep-chip').length, 7, 'У короткого тайтла должны быть кнопки серий');

      doc.querySelector('[data-action="notif-tab"][data-notif-tab="recent"]').click();
      await T.waitFor(
        () => doc.querySelector('input[data-action="ep-slider"][data-id="21"]'),
        'У длинного тайтла нет ползунка прогресса серий',
      );

      const longBlock = doc.querySelector('[data-ep-block="21"]');
      const slider = longBlock.querySelector('input[data-action="ep-slider"]');
      T.eq(Number(slider.max), 1200);
      T.eq(longBlock.querySelectorAll('.ep-chip').length, 0, 'У длинного тайтла не должно быть кнопок серий');
      T.eq(longBlock.querySelectorAll('.ep-step').length, 0, 'У длинного тайтла не должно быть шагов − / +');

      const id = Number(slider.dataset.id);
      slider.value = '5';
      slider.dispatchEvent(new app.win.Event('input', { bubbles: true }));
      slider.dispatchEvent(new app.win.Event('change', { bubbles: true }));

      await T.waitFor(
        () => {
          const progress = app.win.__anitierTest.state.progress[id];
          return progress && progress.watched.length === 5;
        },
        'Ползунок не сохранил просмотренные серии',
      );

      const updated = doc.querySelector(`input[data-action="ep-slider"][data-id="${id}"]`);
      T.eq(updated.value, '5');
      T.includes(doc.querySelector(`[data-ep-block="${id}"] .ep-watched`).textContent, '5');
    } finally {
      app.close();
    }
  });

  T.test('app: поиск идёт через AniList и Kitsu без повторов', async () => {
    const calls = [];
    let anilistSearch = '';
    const app = await T.mountApp({
      query: '?test=1',
      setup(win) {
        win.fetch = baseFetch(calls, {
          onAniList(vars) { if (vars.search) anilistSearch = vars.search; },
        });
      },
    });

    try {
      await app.win.__anitierTest.init();
      const doc = app.win.document;
      const input = doc.querySelector('#search-input');
      input.value = 'Фрирен';
      input.dispatchEvent(new app.win.Event('input', { bubbles: true }));

      await T.waitFor(
        () => {
          const s = app.win.__anitierTest.state.db;
          return !s.loading && s.query === 'Фрирен' && s.items.length === 3;
        },
        'Поиск через AniList и Kitsu не вернул результаты',
        8000,
      );

      const state = app.win.__anitierTest.state;
      T.eq(anilistSearch, 'Sousou no Frieren', 'Русский запрос должен уходить в AniList как английское название');
      T.eq(state.db.sources, ['AniList', 'Kitsu']);
      T.eq(state.db.items.filter(item => item.title.includes('Фрирен')).length, 1, 'Фрирен не должна повторяться');
      T.eq(new Set(state.db.items.map(item => item.id)).size, 3, 'В выдаче не должно быть повторов по id');
      T.eq(doc.querySelectorAll('#db-grid .card').length, 3);
      T.includes(doc.querySelector('#db-status').textContent, 'AniList + Kitsu');
    } finally {
      app.close();
    }
  });

  T.test('app: язык поиска сохраняется и меняет разрешение запроса', async () => {
    const calls = [];
    let anilistSearch = '';
    const app = await T.mountApp({
      query: '?test=1',
      setup(win) {
        win.fetch = baseFetch(calls, {
          onAniList(vars) { if (vars.search) anilistSearch = vars.search; },
        });
      },
    });

    try {
      await app.win.__anitierTest.init();
      const doc = app.win.document;
      const state = app.win.__anitierTest.state;
      const select = doc.querySelector('#search-lang');
      T.assert(select, 'Селектор языка поиска должен существовать');
      T.eq(select.value, 'auto');
      T.eq(select.options.length, 4);

      const input = doc.querySelector('#search-input');
      input.value = 'Фрирен';
      input.dispatchEvent(new app.win.Event('input', { bubbles: true }));

      await T.waitFor(
        () => !state.db.loading && state.db.query === 'Фрирен' && state.db.items.length === 3,
        'Русский запрос не разрешился через словарь',
        8000,
      );
      T.eq(anilistSearch, 'Sousou no Frieren');
      T.eq(state.db.resolveVia, 'dictionary');

      select.value = 'en';
      select.dispatchEvent(new app.win.Event('change', { bubbles: true }));

      await T.waitFor(
        () => !state.db.loading && state.db.resolveVia === 'raw',
        'Смена языка не перезапустила поиск с исходным запросом',
        8000,
      );
      T.eq(state.db.resolvedQuery, 'Фрирен');
      T.eq(anilistSearch, 'Фрирен', 'При английском языке запрос уходит как есть');

      const saved = JSON.parse(app.win.localStorage.getItem('anitier.v1') || '{}');
      T.eq(saved.settings.searchLang, 'en', 'Язык поиска должен сохраняться');
    } finally {
      app.close();
    }
  });

  T.test('app: расширенный словарь распознаёт русский запрос и объясняет пустую выдачу', async () => {
    const calls = [];
    let anilistSearch = '';
    const app = await T.mountApp({
      query: '?test=1',
      setup(win) {
        win.fetch = baseFetch(calls, { onAniList(vars) { if (vars.search) anilistSearch = vars.search; } });
      },
    });
    try {
      await app.win.__anitierTest.init();
      T.eq(app.win.AniTier.searchQueryForAlt('Доктор Стоун'), 'Dr. Stone');
      T.eq(app.win.AniTier.searchQueryForAlt('Доктор'), 'Доктор', 'Неполное совпадение не должно подставлять случайное название');
      const input = app.win.document.querySelector('#search-input');
      input.value = 'Доктор Стоун';
      input.dispatchEvent(new app.win.Event('input', { bubbles: true }));
      const state = app.win.__anitierTest.state;
      await T.waitFor(() => !state.db.loading && state.db.query === 'Доктор Стоун' && state.db.resolveVia === 'dictionary', 'Запрос не прошёл через словарь');
      T.eq(state.db.items.length, 0);
      T.eq(anilistSearch, 'Dr. Stone');
      const status = app.win.document.querySelector('#db-status').textContent;
      T.includes(status, 'словарь AniTier');
      T.includes(status, 'AniList + Kitsu', 'При пустой выдаче должно быть видно, какие источники проверены');
    } finally { app.close(); }
  });

  T.test('app: вкладка и параметры каталога восстанавливаются из localStorage', async () => {
    const saved = {
      watched: {},
      planned: {},
      settings: {
        searchLang: 'en',
        catalog: { tab: 'watched', mode: 'score', query: 'Frieren', filters: { type: 'movie', year: '2024', minScore: '8' } },
      },
    };
    const app = await T.mountApp({
      query: '?demo=1&test=1',
      setup(win) { win.localStorage.setItem('anitier.v1', JSON.stringify(saved)); },
    });
    try {
      await app.win.__anitierTest.init();
      const state = app.win.__anitierTest.state;
      const doc = app.win.document;
      T.eq(state.tab, 'watched');
      T.eq(state.db.mode, 'score');
      T.eq(state.db.query, 'Frieren');
      T.eq(state.db.filters, { type: 'movie', status: '', year: '2024', genre: '', minScore: '8' });
      T.eq(doc.querySelector('#search-input').value, 'Frieren');
      T.eq(doc.querySelector('#filter-type').value, 'movie');
      T.eq(doc.querySelector('#filter-year').value, '2024');
      T.eq(doc.querySelector('#filter-score').value, '8');
      T.eq(doc.querySelector('#view-watched').hidden, false);
      T.eq(doc.querySelector('#view-db').hidden, true);

      doc.querySelector('[data-action="mode"][data-mode="airing"]').click();
      const type = doc.querySelector('#filter-type');
      type.value = 'tv';
      type.dispatchEvent(new app.win.Event('change', { bubbles: true }));
      const status = doc.querySelector('#filter-status');
      status.value = 'complete';
      status.dispatchEvent(new app.win.Event('change', { bubbles: true }));
      doc.querySelector('#filter-year').value = '';
      doc.querySelector('#filter-score').value = '';
      doc.querySelector('#filter-score').dispatchEvent(new app.win.Event('change', { bubbles: true }));
      const input = doc.querySelector('#search-input');
      input.value = 'Доктор Стоун';
      input.dispatchEvent(new app.win.Event('input', { bubbles: true }));
      doc.querySelector('[data-action="tab"][data-tab="upcoming"]').click();
      await T.waitFor(() => {
        const current = JSON.parse(app.win.localStorage.getItem('anitier.v1') || '{}');
        return current.settings && current.settings.catalog && current.settings.catalog.query === 'Доктор Стоун';
      }, 'Изменения каталога не сохранились', 6000);
      const stored = JSON.parse(app.win.localStorage.getItem('anitier.v1'));
      T.eq(stored.settings.catalog.tab, 'upcoming');
      T.eq(stored.settings.catalog.mode, 'airing');
      T.eq(stored.settings.catalog.filters, { type: 'tv', status: 'complete', year: '', genre: '', minScore: '' });
    } finally { app.close(); }
  });

  T.test('app: перевод описания кэшируется и не повторяет запрос', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    const calls = [];

    try {
      app.win.AniTier.clearTranslationCache();
      app.win.fetch = async (url) => {
        const parsed = new URL(url);
        calls.push(parsed);
        if (parsed.hostname !== 'api.mymemory.translated.net') throw new Error(`Неожиданный запрос: ${url}`);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            responseStatus: 200,
            responseData: { translatedText: 'Эльфийка-маг Фрирен.' },
          }),
        };
      };

      const first = await app.win.__anitierTest.translateText('Elf mage Frieren.');
      const second = await app.win.__anitierTest.translateText('Elf mage Frieren.');

      T.eq(first, 'Эльфийка-маг Фрирен.');
      T.eq(second, first);
      T.eq(calls.length, 1, 'Повторный перевод должен браться из кэша');
      T.eq(calls[0].searchParams.get('langpair'), 'en|ru');
      T.eq(app.win.AniTier.cachedTranslation('Elf mage Frieren.'), first);
    } finally {
      app.win.AniTier.clearTranslationCache();
      app.close();
    }
  });

  T.test('app: в описании карточки можно переключить перевод и оригинал', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const win = app.win;
      const App = win.AniTier;
      App.clearTranslationCache();
      await win.__anitierTest.init();
      let requests = 0;
      win.fetch = async url => {
        requests += 1;
        T.includes(String(url), 'api.mymemory.translated.net');
        return {
          ok: true,
          status: 200,
          json: async () => ({ responseStatus: 200, responseData: { translatedText: 'Маг-путешественник ищет дорогу домой.' } }),
        };
      };
      const anime = App.mapAniList(rawAniList(9001, 'Journey Mage', {
        idMal: 69001,
        description: 'A traveling mage is looking for the way home.',
      }));
      const state = win.__anitierTest.state;
      state.modalId = anime.id;
      state.franchiseById.set(anime.id, []);
      App.renderModal();
      T.includes(win.document.querySelector('.modal-synopsis').textContent, 'A traveling mage');

      await win.__anitierTest.translateModalSynopsis(anime.id);
      let synopsis = win.document.querySelector('.modal-synopsis');
      T.eq(synopsis.textContent, 'Маг-путешественник ищет дорогу домой.');
      T.eq(win.document.querySelector('[data-action="synopsis-mode"][data-mode="translated"]').getAttribute('aria-pressed'), 'true');

      win.document.querySelector('[data-action="synopsis-mode"][data-mode="original"]').click();
      T.eq(state.synopsisModes.get(anime.id), 'original', 'Кнопка должна менять выбранный язык описания');
      synopsis = win.document.querySelector('.modal-synopsis');
      T.eq(synopsis.textContent, 'A traveling mage is looking for the way home.');
      T.eq(win.document.querySelector('[data-action="synopsis-mode"][data-mode="original"]').getAttribute('aria-pressed'), 'true');

      win.document.querySelector('[data-action="synopsis-mode"][data-mode="translated"]').click();
      T.eq(win.document.querySelector('.modal-synopsis').textContent, 'Маг-путешественник ищет дорогу домой.');
      T.eq(requests, 1, 'Переключение не должно повторно запрашивать перевод');
    } finally {
      app.win.AniTier.clearTranslationCache();
      app.close();
    }
  });

  T.test('app: русский синоним AniList становится основным названием', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });

    try {
      const a = app.win.AniTier.mapAniList({
        id: 999,
        idMal: null,
        title: { romaji: 'Sousou no Frieren', english: "Frieren: Beyond Journey's End", native: '葬送のフリーレン' },
        synonyms: ['Провожающая в последний путь Фрирен'],
        format: 'TV',
        episodes: 28,
        status: 'FINISHED',
        seasonYear: 2023,
        startDate: { year: 2023, month: 9, day: 29 },
        endDate: { year: 2024, month: 3, day: 22 },
        averageScore: 91,
        description: 'Elf mage Frieren.',
        genres: ['Adventure', 'Drama', 'Fantasy'],
        studios: { nodes: [] },
        coverImage: { large: '' },
        siteUrl: 'https://anilist.co/anime/999',
        nextAiringEpisode: null,
      });

      T.eq(a.title, 'Провожающая в последний путь Фрирен');
      T.eq(a.altTitle, 'Sousou no Frieren');
      T.eq(a.originalTitle, 'Sousou no Frieren');
      T.eq(a.title, app.win.AniTierCore.firstCyrillic(['Sousou no Frieren', a.title]));
    } finally {
      app.close();
    }
  });

  T.test('app: демо-база листается по 20 и фильтруется', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });

    try {
      await app.win.__anitierTest.init();
      const doc = app.win.document;

      T.eq(doc.querySelectorAll('#db-grid .card').length, 20);
      T.includes(doc.querySelector('#db-status').textContent, '20');
      T.eq(doc.querySelector('#db-more').textContent, 'Следующая страница');

      doc.querySelector('#db-more').click();
      await T.waitFor(
        () => doc.querySelectorAll('#db-grid .card').length === 27,
        'Вторая страница демо-базы не загрузилась',
      );
      T.eq(doc.querySelector('#db-more').hidden, true);

      doc.querySelector('[data-action="toggle-filters"]').click();
      const type = doc.querySelector('#filter-type');
      type.value = 'movie';
      type.dispatchEvent(new app.win.Event('change', { bubbles: true }));

      await T.waitFor(
        () => doc.querySelectorAll('#db-grid .card').length === 2,
        'Фильтр «Фильм» не применился к демо-базе',
      );
      T.eq(doc.querySelector('#filter-count').textContent, '1');

      doc.querySelector('[data-action="reset-filters"]').click();
      await T.waitFor(
        () => doc.querySelectorAll('#db-grid .card').length === 20,
        'Сброс фильтра не вернул первую страницу',
      );

      const input = doc.querySelector('#search-input');
      input.value = 'Фрирен';
      input.dispatchEvent(new app.win.Event('input', { bubbles: true }));
      await T.waitFor(
        () => doc.querySelectorAll('#db-grid .card').length === 1
          && doc.querySelector('#db-grid').textContent.includes('Фрирен'),
        'Поиск по демо-базе не сработал',
      );
    } finally {
      app.close();
    }
  });
  T.test('app: свои карточки сохраняются, попадают в списки и удаляются', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });

    try {
      await app.win.__anitierTest.init();
      const App = app.win.AniTier;
      const state = app.win.__anitierTest.state;

      const card = App.upsertCustomCard({
        id: -1,
        customId: 'custom-1',
        title: 'Своя карточка',
        year: 2024,
        episodes: 12,
        type: 'TV',
        genres: ['Драма'],
      });
      T.assert(card, 'Своя карточка должна сохраниться');
      T.eq(state.customCards.length, 1);
      T.eq(App.getAnime(-1).title, 'Своя карточка');

      const stored = JSON.parse(app.win.localStorage.getItem('anitier.v1'));
      T.eq(stored.customCards[0].customId, 'custom-1');
      T.eq(stored.customCards[0].id, -1);

      App.addToList('watched', card, 'S');
      T.assert(App.hasIn('watched', -1), 'Своя карточка должна попасть в тир-лист');

      T.eq(App.addMoment(-1, { id: 'bad', kind: 'tiktok', url: 'https://example.com/video/1' }), null);
      App.addMoment(-1, {
        id: 'moment-1',
        kind: 'tiktok',
        url: 'https://www.tiktok.com/@user/video/7412345678901234567',
        title: 'Любимая сцена',
      });
      T.eq(App.momentsFor(-1).length, 1);

      App.deleteCustomCard(-1);
      T.eq(state.customCards.length, 0);
      T.assert(!App.hasIn('watched', -1), 'Удаление карточки должно убрать её из списков');
      T.eq(App.momentsFor(-1).length, 0, 'Моменты удалённой карточки должны исчезнуть');
    } finally {
      app.close();
    }
  });

  T.test('app: режим «Мои карточки» показывает только свои тайтлы', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });

    try {
      await app.win.__anitierTest.init();
      const App = app.win.AniTier;
      const doc = app.win.document;

      App.upsertCustomCard({ id: -1, customId: 'custom-1', title: 'Только моя', year: 2024 });
      doc.querySelector('[data-action="mode"][data-mode="custom"]').click();

      await T.waitFor(
        () => doc.querySelectorAll('#db-grid .card').length === 1,
        'Режим своих карточек не показал одну карточку',
      );
      T.eq(doc.querySelector('#db-grid .card-title').textContent, 'Только моя');
      T.includes(doc.querySelector('#db-status').textContent, 'Свои карточки');
    } finally {
      app.close();
    }
  });

  T.test('app: резервная копия восстанавливает списки, карточки и моменты', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });

    try {
      await app.win.__anitierTest.init();
      const App = app.win.AniTier;
      const state = app.win.__anitierTest.state;

      const card = App.upsertCustomCard({
        id: -1,
        customId: 'custom-1',
        title: 'До копии',
        year: 2024,
        image: 'data:image/jpeg;base64,AAAA',
      });
      App.addToList('watched', card, 'A');
      App.addMoment(-1, {
        id: 'moment-1',
        kind: 'tiktok',
        url: 'https://www.tiktok.com/@user/video/7412345678901234567',
        title: 'Сцена',
      });

      const payload = App.buildBackupPayload();
      T.eq(payload.kind, 'anitier.backup');
      T.eq(payload.version, 2);
      T.eq(payload.data.state.customCards.length, 1);
      T.eq(payload.data.moments['-1'].length, 1);
      T.includes(JSON.stringify(payload.data.state.customCards[0].image), 'data:image/jpeg');

      app.win.localStorage.clear();
      App.loadState();
      App.loadMoments();
      T.eq(state.customCards.length, 0);
      T.eq(state.moments['-1'], undefined);

      App.applyBackupData(payload.data);
      T.eq(state.customCards.length, 1);
      T.eq(state.customCards[0].title, 'До копии');
      T.assert(App.hasIn('watched', -1), 'Список из копии должен восстановиться');
      T.eq(App.momentsFor(-1).length, 1);
      T.eq(App.momentsFor(-1)[0].title, 'Сцена');

      const restoredText = JSON.stringify(payload);
      app.win.confirm = () => true;
      const ok = await app.win.__anitierTest.restoreBackupText(restoredText, 'тест');
      T.eq(ok, true);
      T.eq(state.customCards.length, 1);
      T.includes(app.win.document.querySelector('#backup-content').textContent, 'Копия восстановлена');
    } finally {
      app.close();
    }
  });

  T.test('app: ошибка записи резервной копии возвращает исходные значения хранилища', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const win = app.win;
      const storage = win.localStorage;
      const originals = {
        [win.AniTier.LS_KEY]: JSON.stringify({ watched: { S: [{ id: 77, title: 'Старое' }] } }),
        [win.AniTier.MOMENTS_KEY]: JSON.stringify({ '77': [] }),
        [win.AniTier.TRANSLATIONS_KEY]: JSON.stringify({ old: 'перевод' }),
      };
      for (const [key, value] of Object.entries(originals)) storage.setItem(key, value);
      const originalSetItem = storage.setItem.bind(storage);
      let failOnce = true;
      storage.setItem = (key, value) => {
        if (key === win.AniTier.MOMENTS_KEY && failOnce) {
          failOnce = false;
          throw new Error('QuotaExceededError');
        }
        return originalSetItem(key, value);
      };

      let error = '';
      try {
        win.AniTier.applyBackupData({
          state: { watched: { A: [{ id: 88, title: 'Новое' }] }, planned: {} },
          moments: {},
          translations: {},
        });
      } catch (err) { error = err.message; }

      T.includes(error, 'Прежние данные возвращены');
      for (const [key, value] of Object.entries(originals)) T.eq(storage.getItem(key), value, `Не восстановлен ${key}`);
      T.eq(win.__anitierTest.state.lists.watched.S[0].title, 'Старое');
    } finally { app.close(); }
  });

  T.test('app: медиаархив переносит постеры, видео и GIF записи', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const App = app.win.AniTier;
      await App.mediaPut('images', 'test-poster', new Blob(['poster-data'], { type: 'image/jpeg' }));
      await App.mediaPut('media', 'test-video', new Blob(['video-data'], { type: 'video/mp4' }));
      const archive = await app.win.__anitierTest.buildMediaArchive();
      T.eq(archive.count, 2);
      await App.mediaDelete('images', 'test-poster');
      await App.mediaDelete('media', 'test-video');
      app.win.confirm = () => true;
      T.eq(await app.win.__anitierTest.importMediaFile(archive.blob), true);
      T.eq(await (await App.mediaGet('images', 'test-poster')).text(), 'poster-data');
      T.eq(await (await App.mediaGet('media', 'test-video')).text(), 'video-data');
    } finally { app.close(); }
  });

  T.test('app: медиаархив передаётся в Android небольшими частями', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const win = app.win;
      const received = [];
      let fileName = '';
      win.AniTierAndroid = {
        beginMediaSave(name) { fileName = name; win.__anitierMediaSaveReady(true); },
        writeMediaChunk(value) { received.push(win.atob(value)); return true; },
        finishMediaSave(ok) { win.__anitierMediaSaveFinished(ok); },
      };
      const bytes = new Uint8Array(600000);
      for (let i = 0; i < bytes.length; i++) bytes[i] = i % 251;
      await win.__anitierTest.androidSaveMedia(new Blob([bytes]));
      T.eq(fileName, 'anitier-media.bin');
      T.eq(received.length, 3, 'Архив должен уйти тремя фрагментами по 256 КиБ');
      T.eq(received.join('').length, bytes.length);
      T.eq(received.join('').charCodeAt(599999), bytes[599999]);
    } finally { app.close(); }
  });

  T.test('app: Google Drive сохраняет копию multipart и перезаписывает файл', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });

    try {
      const calls = [];
      app.win.fetch = async (url, options = {}) => {
        calls.push({
          url: String(url),
          method: options.method || 'GET',
          headers: options.headers || {},
          body: options.body,
        });
        const body = String(url).includes('/upload/drive/')
          ? { id: 'file-1', name: 'anitier-backup.json' }
          : { files: [{ id: 'file-1', name: 'anitier-backup.json' }] };
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      };

      const saved = await app.win.AniTier.driveSaveBackup('token', '{"kind":"test"}');
      T.eq(saved.id, 'file-1');
      T.eq(calls.length, 2);
      T.includes(calls[0].url, 'drive/v3/files?');
      T.eq(calls[1].method, 'PATCH');
      T.includes(calls[1].headers['Content-Type'], 'multipart/related; boundary=');
      const multipart = await calls[1].body.text();
      T.includes(multipart, '"name":"anitier-backup.json"');
      T.includes(multipart, '{"kind":"test"}');
      T.assert(multipart.startsWith('--'), 'Тело должно начинаться с multipart-границы');
    } finally {
      app.close();
    }
  });
})();
