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
      const notification = doc.querySelector('.notif');
      const visual = notification.querySelector('.notif-visual');
      T.assert(visual, 'Дата и постер должны быть в одном визуальном столбце');
      T.assert(visual.querySelector('.notif-date').compareDocumentPosition(visual.querySelector('.notif-poster')) & app.win.Node.DOCUMENT_POSITION_FOLLOWING, 'Дата должна располагаться над постером');
      T.eq(app.win.getComputedStyle(notification).flexDirection, 'column', 'Уведомление должно быть вертикальной карточкой');
      T.eq(app.win.getComputedStyle(doc.querySelector('#notif-list')).display, 'grid', 'Уведомления раскладываются сеткой карточек');
      T.assert(notification.querySelector('.notif-actions'), 'У карточки уведомления есть быстрые действия');
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

  T.test('app: перетаскивание к нижнему тиру прокручивает страницу', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    const win = app.win;
    const calls = [];
    try {
      await win.__anitierTest.init();
      const doc = win.document;
      win.AniTier.scrollPageBy = delta => calls.push({ x: 0, y: delta });
      win.requestAnimationFrame = callback => win.setTimeout(() => callback(Date.now()), 0);
      win.cancelAnimationFrame = id => win.clearTimeout(id);
      const source = doc.createElement('div');
      source.className = 'tier-card';
      source.dataset.list = 'watched';
      source.dataset.id = '1';
      const target = doc.createElement('div');
      target.className = 'tier-drop';
      target.dataset.list = 'watched';
      target.dataset.tier = 'F';
      doc.body.append(source, target);
      doc.elementFromPoint = () => target;

      const pointerEvent = (name, values) => {
        const event = new win.Event(name, { bubbles: true, cancelable: true });
        for (const [key, value] of Object.entries(values)) Object.defineProperty(event, key, { value });
        return event;
      };

      /* Палец: карточка поднимается после долгого нажатия. */
      source.dispatchEvent(pointerEvent('pointerdown', {
        pointerType: 'touch', isPrimary: true, pointerId: 7, clientX: 20, clientY: 30,
      }));
      await new Promise(resolve => win.setTimeout(resolve, 400));
      T.assert(doc.querySelector('.tier-drag-ghost'), 'Под пальцем появляется призрак карточки');
      doc.dispatchEvent(pointerEvent('pointermove', {
        pointerType: 'touch', isPrimary: true, pointerId: 7, clientX: 20, clientY: win.innerHeight - 1,
      }));
      await T.waitFor(() => calls.some(call => call.y > 0), 'Перетаскивание пальцем не прокрутило страницу');
      doc.dispatchEvent(pointerEvent('pointerup', {
        pointerType: 'touch', isPrimary: true, pointerId: 7, clientX: 20, clientY: win.innerHeight - 1,
      }));
      T.assert(!target.classList.contains('is-over'), 'Зона сброса должна очиститься после отпускания');
      T.eq(doc.querySelector('.tier-drag-ghost'), null, 'Призрак исчезает после отпускания');

      /* Мышь: перетаскивание начинается сразу после сдвига. */
      calls.length = 0;
      source.dataset.id = '1';
      source.dispatchEvent(pointerEvent('pointerdown', {
        pointerType: 'mouse', isPrimary: true, button: 0, pointerId: 8, clientX: 20, clientY: 30,
      }));
      doc.dispatchEvent(pointerEvent('pointermove', {
        pointerType: 'mouse', isPrimary: true, pointerId: 8, clientX: 22, clientY: 40,
      }));
      doc.dispatchEvent(pointerEvent('pointermove', {
        pointerType: 'mouse', isPrimary: true, pointerId: 8, clientX: 22, clientY: win.innerHeight - 1,
      }));
      await T.waitFor(() => calls.some(call => call.y > 0), 'Перетаскивание мышью не прокрутило страницу');
      doc.dispatchEvent(pointerEvent('pointerup', {
        pointerType: 'mouse', isPrimary: true, pointerId: 8, clientX: 22, clientY: win.innerHeight - 1,
      }));
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

  T.test('app: длинное описание переводится частями до лимита MyMemory', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    const calls = [];

    try {
      app.win.AniTier.clearTranslationCache();
      app.win.fetch = async url => {
        const parsed = new URL(url);
        calls.push(parsed);
        const chunk = parsed.searchParams.get('q');
        T.assert(chunk.length <= 500, `Часть перевода превышает лимит: ${chunk.length}`);
        return {
          ok: true,
          status: 200,
          json: async () => ({ responseStatus: 200, responseData: { translatedText: `Часть ${calls.length}` } }),
        };
      };

      const source = 'A'.repeat(1200);
      const first = await app.win.__anitierTest.translateText(source);
      const second = await app.win.__anitierTest.translateText(source);

      T.eq(first, 'Часть 1 Часть 2 Часть 3');
      T.eq(second, first, 'Перевод всего описания должен кэшироваться');
      T.eq(calls.length, 3, 'Каждая часть запрашивается один раз');
    } finally {
      app.win.AniTier.clearTranslationCache();
      app.close();
    }
  });

  T.test('app: автоматический перевод переключается с MyMemory на Google', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    const calls = [];

    try {
      app.win.AniTier.clearTranslationCache();
      app.win.fetch = async url => {
        const parsed = new URL(url);
        calls.push(parsed);
        if (parsed.hostname === 'api.mymemory.translated.net') {
          return { ok: true, status: 200, json: async () => ({ responseStatus: 403 }) };
        }
        T.eq(parsed.hostname, 'translate.googleapis.com');
        return { ok: true, status: 200, json: async () => [[[`Привет по-русски`, 'Hello']], null, 'en'] };
      };

      const translated = await app.win.__anitierTest.translateText('Hello', 'auto');

      T.eq(translated, 'Привет по-русски');
      T.eq(calls.map(url => url.hostname), ['api.mymemory.translated.net', 'translate.googleapis.com']);
      T.eq(app.win.AniTier.cachedTranslationProvider('Hello', 'auto'), 'google');
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
        const host = new URL(url).hostname;
        if (host === 'translate.googleapis.com') {
          return { ok: true, status: 200, json: async () => [[['Перевод от Google', 'A traveling mage']], null, 'en'] };
        }
        T.eq(host, 'api.mymemory.translated.net');
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

      const provider = win.document.querySelector('[data-action="synopsis-provider"]');
      provider.value = 'google';
      provider.dispatchEvent(new win.Event('change', { bubbles: true }));
      await T.waitFor(
        () => win.document.querySelector('.synopsis-translation-status').textContent.includes('Google'),
        'Переводчик не переключился на Google',
      );
      T.eq(win.document.querySelector('.modal-synopsis').textContent, 'Перевод от Google');
      T.eq(state.settings.translationProvider, 'google');
    } finally {
      app.win.AniTier.clearTranslationCache();
      app.close();
    }
  });

  T.test('app: общий TikTok можно привязать к выбранной карточке аниме', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const win = app.win;
      const App = win.AniTier;
      await win.__anitierTest.init();
      win.fetch = async url => {
        T.includes(String(url), 'www.tiktok.com/oembed');
        return { ok: true, status: 200, json: async () => ({ title: 'Frieren edit', thumbnail_url: 'https://example.com/cover.jpg' }) };
      };
      const anime = App.mapAniList(rawAniList(9010, 'Sousou no Frieren', {
        idMal: 9010,
        title: { romaji: 'Sousou no Frieren', english: 'Frieren: Beyond Journey’s End', native: '葬送のフリーレン' },
      }));
      App.addToList('watched', anime, 'S', true);

      T.assert(App.receiveSharedTikTok('Найдено видео: https://www.tiktok.com/@anime/video/7412345678901234567'));
      await T.waitFor(() => win.document.querySelector('#tiktok-import-search'), 'Не открылся выбор аниме для ссылки TikTok');
      const search = win.document.querySelector('#tiktok-import-search');
      search.value = 'frieren';
      search.dispatchEvent(new win.Event('input', { bubbles: true }));
      win.document.querySelector('[data-action="tiktok-import-save"][data-id="9010"]').click();

      const moments = App.momentsFor(anime.id);
      T.eq(moments.length, 1);
      T.eq(moments[0].kind, 'tiktok');
      T.includes(moments[0].url, '7412345678901234567');
      T.eq(win.document.querySelector('#tiktok-import-modal').hidden, true);
    } finally {
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

  T.test('app: системная кнопка «назад» закрывает модалку и возвращает на базу', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const win = app.win;
      const App = win.AniTier;
      const state = win.__anitierTest.state;
      await win.__anitierTest.init();

      T.eq(App.handleAndroidBack(), true, 'Первый «назад» на главной не выходит из приложения');
      T.includes(
        win.document.querySelector('#toasts').textContent,
        'ещё раз',
        'Показана подсказка о повторном нажатии',
      );
      T.eq(App.handleAndroidBack(), false, 'Второе нажатие подряд выходит из приложения');

      if (!win.document.querySelector('#db-grid .card')) {
        await T.waitFor(() => win.document.querySelector('#db-grid .card'), 'Карточки базы не отрисовались');
      }
      const opened = win.document.querySelector('#db-grid .card');
      T.assert(opened, 'В базе должна быть хотя бы одна карточка');
      opened.click();
      T.assert(state.modalId != null, 'Карточка должна открыть модалку');

      T.eq(App.handleAndroidBack(), true);
      T.eq(state.modalId, null, 'Назад закрывает модалку');
      T.assert(win.document.querySelector('#modal').hidden, 'Модалка должна скрыться');

      win.document.querySelector('[data-action="tab"][data-tab="watched"]').click();
      T.eq(state.tab, 'watched');
      T.eq(App.handleAndroidBack(), true);
      T.eq(state.tab, 'db', 'Со второй вкладки назад ведёт на базу');
    } finally {
      app.close();
    }
  });

  T.test('app: напоминания на телефоне планируются и переключаются', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const win = app.win;
      const App = win.AniTier;
      const calls = [];
      let enabled = false;
      win.AniTierAndroid = {
        areReleaseNotificationsEnabled: () => enabled,
        setReleaseNotificationsEnabled: value => { enabled = value; calls.push(['set', value]); },
        scheduleReleaseNotifications: json => { calls.push(['schedule', json]); },
      };

      await win.__anitierTest.init();
      await App.fetchNotifications(true);
      App.syncReleaseNotifications();
      T.eq(calls[0][0], 'schedule', 'Расписание отправляется в Android');
      const items = JSON.parse(calls[0][1]);
      T.assert(Array.isArray(items) && items.length > 0, 'В Android уходит массив серий');
      for (const item of items) {
        T.assert(item.id != null && item.title && item.n > 0, 'У серии есть id, название и номер');
        T.assert(!Number.isNaN(new Date(item.date).getTime()), 'Дата серии разбирается');
      }

      App.toggleReleaseNotifications();
      T.eq(calls[calls.length - 1][0], 'set');
      T.eq(enabled, true, 'Переключатель включает напоминания');

      const scheduleCalls = () => calls.filter(call => call[0] === 'schedule').length;
      const before = scheduleCalls();
      App.onReleaseNotificationPermissionResult(true);
      T.eq(enabled, true);
      T.eq(scheduleCalls(), before + 1, 'После разрешения расписание обновляется');
    } finally {
      app.close();
    }
  });

  T.test('app: на сайте напоминания не включаются без Android', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const win = app.win;
      delete win.AniTierAndroid;
      T.eq(win.AniTier.releaseNotificationsEnabled(), false);
      win.AniTier.toggleReleaseNotifications();
      T.assert(win.document.querySelector('#release-notif-toggle') === null || win.document.querySelector('#release-notif-toggle').hidden);
    } finally {
      app.close();
    }
  });

  T.test('app: настройки открываются, показывают версию и меняют язык поиска', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const win = app.win;
      const App = win.AniTier;
      const doc = win.document;
      const state = win.__anitierTest.state;
      await win.__anitierTest.init();

      doc.querySelector('[data-action="open-settings"]').click();
      const modal = doc.querySelector('#settings-modal');
      T.eq(modal.hidden, false, 'Модалка настроек открывается');
      const content = doc.querySelector('#settings-content').textContent;
      T.includes(content, 'Настройки');
      T.includes(content, win.AniTierCore.APP_VERSION, 'В настройках видна версия приложения');
      T.includes(content, 'Проверить обновления');
      T.includes(content, 'GitHub');

      const lang = doc.querySelector('select[data-action="settings-search-lang"]');
      lang.value = 'en';
      lang.dispatchEvent(new win.Event('change', { bubbles: true }));
      T.eq(state.settings.searchLang, 'en', 'Язык поиска применяется');
      const saved = JSON.parse(win.localStorage.getItem(win.AniTier.LS_KEY) || '{}');
      T.eq(saved.settings ? saved.settings.searchLang : null, 'en', 'Настройка сохраняется');

      T.eq(App.handleAndroidBack(), true, 'Назад закрывает настройки');
      T.eq(modal.hidden, true);
    } finally {
      app.close();
    }
  });

  T.test('app: поиск и фильтры внутри «Просмотрено» показывают нужные тайтлы', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const win = app.win;
      const App = win.AniTier;
      const doc = win.document;
      await win.__anitierTest.init();

      const make = (id, title, extra) => Object.assign({
        id,
        malId: id,
        title,
        altTitle: '',
        originalTitle: '',
        type: 'TV',
        status: 'Завершено',
        year: 2020,
        score: 8,
        genres: ['Action'],
        studios: ['Mappa'],
        episodes: 12,
        image: '',
      }, extra);

      App.addToList('watched', make(9401, 'Альфа', { year: 2020, score: 8.5 }), 'S', true);
      App.addToList('watched', make(9402, 'Бета', {
        genres: ['Romance'], studios: ['Kyoto Animation'], year: 2021, score: 7,
      }), 'A', true);
      App.addToList('watched', make(9403, 'Гамма', {
        genres: ['Drama'], studios: ['Ufotable'], year: 2020, score: 9,
      }), 'B', true);
      App.switchTab('watched');

      const tools = doc.querySelector('#list-tools-watched');
      T.assert(tools, 'В тир-листе есть панель поиска и фильтров');
      const search = doc.querySelector('#watched-search');
      T.assert(search, 'Есть поле поиска по списку');
      T.eq(
        [...doc.querySelector('#watched-year').options].slice(1).map(option => option.value),
        ['2021', '2020'],
        'Годы берутся из самого списка',
      );
      T.eq(doc.querySelector('#watched-genre').options.length, 4, 'В жанрах только три жанра из списка');

      const cards = () => doc.querySelectorAll('#tiers-watched .tier-card').length;
      T.eq(cards(), 3, 'Без фильтров видны все тайтлы');

      search.value = 'mappa';
      search.dispatchEvent(new win.Event('input', { bubbles: true }));
      T.eq(cards(), 1, 'Поиск по студии оставил один тайтл');
      T.eq(doc.querySelector('#watched-search'), search, 'Поле поиска не пересоздаётся при вводе');
      T.includes(doc.querySelector('#list-status-watched').textContent, 'Показано 1 из 3');
      T.eq(doc.querySelector('#stats-watched .stat b').textContent, '1', 'Статистика считает показанные тайтлы');
      T.includes(doc.querySelector('#tiers-watched').textContent, 'Альфа');
      T.assert(!doc.querySelector('#tiers-watched').textContent.includes('Бета'), 'Другие тайтлы скрыты');

      search.value = '';
      search.dispatchEvent(new win.Event('input', { bubbles: true }));
      T.eq(cards(), 3, 'Пустой поиск возвращает весь список');

      const genre = doc.querySelector('#watched-genre');
      genre.value = '22';
      genre.dispatchEvent(new win.Event('change', { bubbles: true }));
      T.eq(cards(), 1, 'Фильтр по жанру оставил романтику');
      T.includes(doc.querySelector('#tiers-watched').textContent, 'Бета');

      const year = doc.querySelector('#watched-year');
      year.value = '2020';
      year.dispatchEvent(new win.Event('change', { bubbles: true }));
      T.eq(cards(), 0, 'Фильтры по году и жанру складываются');
      T.includes(doc.querySelector('#list-status-watched').textContent, 'Показано 0 из 3');

      doc.querySelector('#list-tools-watched [data-action="reset-list"]').click();
      T.eq(cards(), 3, 'Сброс возвращает весь список');
      T.eq(doc.querySelector('#watched-search').value, '', 'Поле поиска очищено');
      T.eq(doc.querySelector('#list-status-watched').textContent, '', 'Статус фильтров скрывается без фильтров');
    } finally {
      app.close();
    }
  });

  T.test('app: карточки тир-листа заполняют ряд без пустой полосы справа', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const win = app.win;
      const App = win.AniTier;
      const doc = win.document;
      await win.__anitierTest.init();

      const make = (id, title) => App.mapAniList(rawAniList(id, title, { idMal: id, title: { romaji: title } }));
      App.addToList('planned', make(9201, 'Alpha Show'), 'S', true);
      App.addToList('planned', make(9202, 'Beta Show'), 'S', true);
      App.switchTab('planned');

      const drop = doc.querySelector('#tiers-planned .tier-drop[data-tier="S"]');
      T.assert(drop, 'Ряд тира S отрисован');
      const cards = [...drop.querySelectorAll('.tier-card')];
      T.eq(cards.length, 2, 'В тире два тайтла');

      const width = cards[0].getBoundingClientRect().width;
      T.assert(width > 126, `Карточка крупнее прежних 126px: ${Math.round(width)}`);
      T.assert(width <= 241, 'Карточка не растягивается сверх предела');

      const row = drop.getBoundingClientRect();
      const left = cards[0].getBoundingClientRect().left - row.left;
      const right = row.right - cards[cards.length - 1].getBoundingClientRect().right;
      T.assert(Math.abs(left - right) <= 2, `Ряд заполнен симметрично: слева ${Math.round(left)}, справа ${Math.round(right)}`);
    } finally {
      app.close();
    }
  });

  T.test('app: история изменений открывается из настроек и возвращает назад', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const win = app.win;
      const App = win.AniTier;
      const doc = win.document;
      await win.__anitierTest.init();

      App.openSettings();
      const open = doc.querySelector('#settings-content [data-action="open-changelog"]');
      T.assert(open, 'В настройках есть кнопка истории изменений');
      open.click();

      const content = doc.querySelector('#settings-content');
      T.includes(content.textContent, 'История изменений');
      T.includes(content.textContent, win.AniTierCore.APP_VERSION, 'Текущая версия в списке');
      T.includes(content.textContent, '1.0.0', 'Видна и старая версия');
      T.eq(content.querySelectorAll('.changelog-release').length, win.AniTierCore.CHANGELOG.length, 'Показаны все записи');
      T.assert(content.querySelector('.changelog-badge'), 'Текущая версия помечена');

      content.querySelector('[data-action="settings-back"]').click();
      T.includes(doc.querySelector('#settings-content').textContent, 'Настройки', 'Назад возвращает в настройки');
      T.assert(doc.querySelector('#settings-content [data-action="open-changelog"]'), 'Кнопка истории снова на месте');

      doc.querySelector('[data-action="open-changelog"]').click();
      T.eq(App.handleAndroidBack(), true, 'Системная «назад» из истории не закрывает настройки');
      T.eq(doc.querySelector('#settings-modal').hidden, false, 'Модалка осталась открытой');
      T.assert(doc.querySelector('#settings-content [data-action="open-changelog"]'), 'Вернулись в настройки');
      T.eq(App.handleAndroidBack(), true, 'Повторное «назад» закрывает настройки');
      T.eq(doc.querySelector('#settings-modal').hidden, true);
    } finally {
      app.close();
    }
  });

  T.test('app: проверка обновлений сравнивает версию с GitHub', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const win = app.win;
      const App = win.AniTier;
      const doc = win.document;
      App.openSettings();

      App.fetchLatestRelease = async () => ({
        version: '99.0.0',
        name: 'Новая сборка',
        url: 'https://github.com/sashasat12/anitier/releases/tag/v99.0.0',
        notes: '',
      });
      await App.checkForUpdates();
      const text = doc.querySelector('#settings-content').textContent;
      T.includes(text, '99.0.0', 'Показана версия с GitHub');
      T.assert(doc.querySelector('#settings-content [data-action="open-link"][data-url*="releases/tag"]'), 'Есть кнопка релиза');

      App.fetchLatestRelease = async () => ({ version: win.AniTierCore.APP_VERSION, name: '', url: '', notes: '' });
      await App.checkForUpdates();
      T.includes(doc.querySelector('#settings-content').textContent, 'последняя версия');

      App.fetchLatestRelease = async () => { throw new Error('Сети нет'); };
      await App.checkForUpdates();
      T.includes(doc.querySelector('#settings-content').textContent, 'Сети нет', 'Ошибка показывается в настройках');
    } finally {
      app.close();
    }
  });

  T.test('app: при запуске спрашивает разрешение на проверку обновлений', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const win = app.win;
      await win.__anitierTest.init();
      const App = win.AniTier;
      const doc = win.document;
      const state = win.__anitierTest.state;
      const card = doc.getElementById('update-card');
      T.assert(card, 'Нет карточки обновления');
      T.eq(card.hidden, true, 'По умолчанию карточка скрыта');
      T.eq(App.normalizeUpdateCheck('чепуха'), 'ask', 'Неизвестный режим проверки сбрасывается на «спрашивать»');

      state.settings.updateCheck = 'ask';
      await App.autoCheckUpdates();
      T.eq(card.hidden, false, 'При первом запуске спрашиваем разрешение');
      T.includes(card.textContent, 'Проверять обновления при запуске?', 'В карточке есть вопрос');

      card.querySelector('[data-action="update-deny"]').click();
      T.eq(state.settings.updateCheck, 'off', 'Отказ запоминается');
      T.eq(card.hidden, true, 'Карточка закрывается после отказа');

      let calls = 0;
      App.fetchLatestRelease = async () => {
        calls++;
        return {
          version: '99.0.0',
          name: 'Новая сборка',
          url: 'https://github.com/sashasat12/anitier/releases/tag/v99.0.0',
          notes: '',
        };
      };

      state.settings.updateCheck = 'ask';
      state.settings.lastUpdateCheck = 0;
      await App.autoCheckUpdates();
      card.querySelector('[data-action="update-allow"]').click();
      T.eq(state.settings.updateCheck, 'on', 'Разрешение сохраняется');
      await T.waitFor(() => calls === 1, 'После разрешения проверка не запустилась', 3000);
      await T.waitFor(() => !card.hidden && card.textContent.includes('99.0.0'), 'Карточка не показала новую версию', 3000);
      T.includes(card.textContent, 'Открыть релиз', 'В браузере предлагаем открыть релиз');
      T.eq(state.updateCard.url, 'https://github.com/sashasat12/anitier/releases/tag/v99.0.0', 'Ссылка ведёт на релиз');

      card.querySelector('[data-action="dismiss-update"]').click();
      T.eq(card.hidden, true, 'Карточку можно отложить');

      state.settings.updateCheck = 'on';
      state.settings.lastUpdateCheck = 0;
      calls = 0;
      await App.autoCheckUpdates();
      T.eq(calls, 1, 'В режиме «Проверять при запуске» запрос уходит');
      T.eq(card.hidden, false);
      await App.autoCheckUpdates();
      T.eq(calls, 1, 'Повторная проверка ждёт 12 часов');

      card.querySelector('[data-action="dismiss-update"]').click();
      state.settings.updateCheck = 'off';
      calls = 0;
      await App.autoCheckUpdates();
      T.eq(calls, 0, 'В режиме «Не проверять» запросов нет');
      T.eq(card.hidden, true);

      state.settings.updateCheck = 'off';
      state.settings.lastUpdateCheck = 123;
      App.saveState();
      App.loadState();
      T.eq(state.settings.updateCheck, 'off', 'Режим проверки переживает перезапуск');
      T.eq(state.settings.lastUpdateCheck, 123, 'Время последней проверки сохраняется');

      App.openSettings();
      const picker = doc.querySelector('select[data-action="settings-update-check"]');
      T.assert(picker, 'В настройках нет выбора режима проверки');
      T.eq(picker.value, 'off', 'Селект показывает сохранённый режим');
      state.updateCard = { mode: 'ask' };
      App.renderUpdateCard();
      T.eq(card.hidden, false);
      picker.value = 'off';
      picker.dispatchEvent(new win.Event('change', { bubbles: true }));
      T.eq(state.settings.updateCheck, 'off', 'Смена режима из настроек сохраняется');
      T.eq(card.hidden, true, 'Смена режима убирает карточку');
      App.closeSettings();
    } finally {
      app.close();
    }
  });

  T.test('app: в APK карточка обновления ведёт на APK', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const win = app.win;
      await win.__anitierTest.init();
      const App = win.AniTier;
      win.AniTierAndroid = { openUrl: () => {} };
      App.showUpdateAvailable({
        version: '99.0.0',
        name: '',
        url: 'https://github.com/sashasat12/anitier/releases/tag/v99.0.0',
        notes: '',
      });
      const card = win.document.getElementById('update-card');
      T.eq(card.hidden, false);
      T.includes(card.textContent, 'Скачать APK', 'В APK предлагаем скачать APK');
      T.includes(win.__anitierTest.state.updateCard.url, '/releases/latest/download/AniTier.apk');
    } finally {
      app.close();
    }
  });

  T.test('app: GitHub из настроек открывается через мост Android или новую вкладку', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const win = app.win;
      const App = win.AniTier;
      const doc = win.document;
      await win.__anitierTest.init();
      App.openSettings();

      const opened = [];
      win.AniTierAndroid = { openUrl: url => opened.push(['bridge', url]) };
      const github = doc.querySelector('#settings-content [data-action="open-link"]');
      T.assert(github, 'Кнопка GitHub есть в настройках');
      T.includes(github.dataset.url, 'github.com/sashasat12/anitier');
      github.click();
      T.eq(opened.length, 1, 'В APK ссылка уходит в мост');
      T.eq(String(opened[0][0]), 'bridge', 'Вызван системный мост');
      T.includes(String(opened[0][1]), 'github.com', 'Мост получил ссылку');

      delete win.AniTierAndroid;
      const popups = [];
      win.open = (...args) => { popups.push(args); return null; };
      github.click();
      T.eq(popups.length, 1, 'В браузере ссылка открывается новой вкладкой');
      T.includes(popups[0][0], 'github.com');

      opened.length = 0;
      App.openExternalLink('javascript:alert(1)');
      T.eq(opened.length, 0, 'Опасные схемы не открываются');
    } finally {
      app.close();
    }
  });
  T.test('app: автопрокрутка реально двигает страницу, пока палец у края', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1', height: 600 });
    try {
      const win = app.win;
      const doc = win.document;
      await win.__anitierTest.init();

      const spacer = doc.createElement('div');
      spacer.style.cssText = 'height:3000px;width:1px';
      doc.body.appendChild(spacer);
      win.scrollTo(0, 0);
      const scroller = doc.scrollingElement || doc.documentElement;

      const source = doc.createElement('div');
      source.className = 'tier-card';
      source.dataset.list = 'watched';
      source.dataset.id = '1';
      const target = doc.createElement('div');
      target.className = 'tier-drop';
      target.dataset.list = 'watched';
      target.dataset.tier = 'F';
      doc.body.append(source, target);
      doc.elementFromPoint = () => target;

      const pointerEvent = (name, values) => {
        const event = new win.Event(name, { bubbles: true, cancelable: true });
        for (const [key, value] of Object.entries(values)) Object.defineProperty(event, key, { value });
        return event;
      };

      source.dispatchEvent(pointerEvent('pointerdown', {
        pointerType: 'mouse', isPrimary: true, button: 0, pointerId: 3, clientX: 20, clientY: 30,
      }));
      doc.dispatchEvent(pointerEvent('pointermove', {
        pointerType: 'mouse', isPrimary: true, pointerId: 3, clientX: 22, clientY: 40,
      }));
      doc.dispatchEvent(pointerEvent('pointermove', {
        pointerType: 'mouse', isPrimary: true, pointerId: 3, clientX: 22, clientY: win.innerHeight - 1,
      }));

      await T.waitFor(() => scroller.scrollTop > 0, 'Страница не начала прокручиваться');
      const first = scroller.scrollTop;
      await new Promise(resolve => win.setTimeout(resolve, 250));
      T.assert(scroller.scrollTop > first, 'Прокрутка продолжается, пока курсор у нижнего края');

      doc.dispatchEvent(pointerEvent('pointerup', {
        pointerType: 'mouse', isPrimary: true, pointerId: 3, clientX: 22, clientY: win.innerHeight - 1,
      }));
      const stopped = scroller.scrollTop;
      await new Promise(resolve => win.setTimeout(resolve, 200));
      T.eq(scroller.scrollTop, stopped, 'После отпускания прокрутка прекращается');
    } finally {
      app.close();
    }
  });
  T.test('app: долгое нажатие на карточке не обрывается выделением и меню', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const win = app.win;
      const doc = win.document;
      await win.__anitierTest.init();

      const card = doc.createElement('div');
      card.className = 'tier-card';
      card.dataset.list = 'watched';
      card.dataset.id = '1';
      doc.body.appendChild(card);

      const down = new win.Event('pointerdown', { bubbles: true, cancelable: true });
      Object.defineProperty(down, 'pointerType', { value: 'touch' });
      Object.defineProperty(down, 'isPrimary', { value: true });
      Object.defineProperty(down, 'clientX', { value: 10 });
      Object.defineProperty(down, 'clientY', { value: 10 });
      Object.defineProperty(down, 'pointerId', { value: 1 });
      card.dispatchEvent(down);

      const menu = new win.Event('contextmenu', { bubbles: true, cancelable: true });
      card.dispatchEvent(menu);
      T.eq(menu.defaultPrevented, true, 'Контекстное меню по долгому нажатию отменяется');

      const select = new win.Event('selectstart', { bubbles: true, cancelable: true });
      card.dispatchEvent(select);
      T.eq(select.defaultPrevented, true, 'Выделение текста на карточке не начинается');

      await T.waitFor(() => card.classList.contains('dragging'), 'Долгое нажатие не включило перетаскивание');
      T.assert(doc.querySelector('.tier-drag-ghost'), 'Появился призрак карточки');
      T.eq(card.hasAttribute('draggable'), false, 'Нативного перетаскивания у карточки нет');
      const up = new win.Event('pointerup', { bubbles: true, cancelable: true });
      Object.defineProperty(up, 'clientX', { value: 10 });
      Object.defineProperty(up, 'clientY', { value: 10 });
      card.dispatchEvent(up);
    } finally {
      app.close();
    }
  });
  T.test('app: поиск в TikTok идёт в приложение, иначе в браузер', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const win = app.win;
      const App = win.AniTier;
      await win.__anitierTest.init();

      const asked = [];
      win.AniTierAndroid = { openTikTokSearch: query => { asked.push(query); return true; } };
      App.openTikTokSearch('Атака титанов');
      T.eq(asked.length, 1, 'Поиск уходит в приложение TikTok');
      T.eq(asked[0], 'Атака титанов');

      delete win.AniTierAndroid;
      const popups = [];
      win.open = (...args) => { popups.push(args); return null; };
      App.openTikTokSearch('Bleach');
      T.eq(popups.length, 1, 'Без приложения открывается браузер');
      T.includes(decodeURIComponent(popups[0][0]), 'tiktok.com/search');
      T.includes(decodeURIComponent(popups[0][0]), 'Bleach');

      T.eq(App.openTikTokSearch('   '), false, 'Пустой запрос ничего не открывает');
    } finally {
      app.close();
    }
  });
  T.test('app: «Скоро» прячет тайтлы из своих списков и фильтрует премьеры', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const win = app.win;
      const doc = win.document;
      await win.__anitierTest.init();

      doc.querySelector('[data-action="tab"][data-tab="upcoming"]').click();
      await T.waitFor(() => doc.querySelectorAll('#upcoming-grid .card').length > 0, 'Премьеры не отрисовались', 8000);

      const cards = () => [...doc.querySelectorAll('#upcoming-grid .card')];
      const total = cards().length;
      T.assert(total > 2, 'В демо-режиме несколько премьер');
      T.assert(doc.querySelector('#upcoming-month').options.length > 1, 'Месяцы попали в фильтр');

      const watchedId = Number(cards()[0].dataset.id);
      win.AniTier.addToList('watched', win.AniTier.getAnime(watchedId), 'S');
      await T.waitFor(() => cards().length === total - 1, 'Просмотренный тайтл остался в «Скоро»', 5000);
      T.assert(cards().every(card => Number(card.dataset.id) !== watchedId), 'Просмотренного нет в «Скоро»');
      T.includes(doc.querySelector('#upcoming-status').textContent, 'скрыто', 'Статус сообщает о скрытых тайтлах');

      const plannedId = Number(cards()[0].dataset.id);
      win.AniTier.addToList('planned', win.AniTier.getAnime(plannedId), 'A');
      await T.waitFor(() => cards().length === total - 2, 'Запланированный тайтл остался в «Скоро»', 5000);

      const leftId = Number(cards()[0].dataset.id);
      const title = win.AniTier.getAnime(leftId).title;
      const search = doc.querySelector('#upcoming-search');
      search.value = title;
      search.dispatchEvent(new win.Event('input', { bubbles: true }));
      await T.waitFor(
        () => cards().length === 1 && Number(cards()[0].dataset.id) === leftId,
        'Поиск по названию не сузил премьеры',
        4000,
      );

      const type = win.AniTier.getAnime(leftId).type.toLowerCase();
      const typeSelect = doc.querySelector('#upcoming-type');
      typeSelect.value = type;
      typeSelect.dispatchEvent(new win.Event('change', { bubbles: true }));
      await T.waitFor(
        () => cards().length > 0 && cards().every(card => win.AniTier.getAnime(Number(card.dataset.id)).type.toLowerCase() === type),
        'Фильтр по типу не сработал',
        4000,
      );

      doc.querySelector('[data-action="reset-upcoming"]').click();
      await T.waitFor(() => cards().length === total - 2, 'Сброс фильтров не вернул премьеры', 4000);
      T.eq(doc.querySelector('#upcoming-search').value, '', 'Сброс очистил строку поиска');
    } finally {
      app.close();
    }
  });
  T.test('app: начатые тайтлы продолжаются одной кнопкой, отмена возвращает прогресс', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const win = app.win;
      const App = win.AniTier;
      const doc = win.document;
      await win.__anitierTest.init();

      const anime = {
        id: 8801, malId: 8801, title: 'Длинный сериал', altTitle: '', originalTitle: '',
        type: 'TV', status: 'Завершено', year: 2024, score: 8, genres: ['Action'],
        studios: ['Mappa'], episodes: 12, image: '',
      };
      App.addToList('watched', anime, 'S', true);
      App.setWatchedUpTo(anime.id, 3, 12);
      App.switchTab('db');

      const block = doc.querySelector('#continue-block');
      const row = doc.querySelector('#continue-row');
      T.eq(block.hidden, false, 'Блок «Продолжить просмотр» показан');
      T.includes(row.textContent, 'Длинный сериал');
      T.includes(row.textContent, 'Просмотрено 3 из 12');
      T.assert(row.querySelector('[data-action="quick-watch"]'), 'У карточки есть кнопка следующей серии');

      row.querySelector('[data-action="quick-watch"]').click();
      T.eq(App.state.progress[anime.id].watched.length, 4, 'Кнопка отметила следующую серию');
      T.includes(row.textContent, 'Просмотрено 4 из 12', 'Блок обновился сразу');
      const toasts = () => [...doc.querySelectorAll('#toasts .toast')];
      T.assert(toasts().length > 0, 'Появился тост с отменой');
      const undo = [...doc.querySelectorAll('#toasts .toast-action')].pop();
      T.assert(undo, 'В тосте есть кнопка «Отменить»');
      undo.click();
      T.eq(App.state.progress[anime.id].watched.length, 3, 'Отмена вернула прежний прогресс');
      T.includes(row.textContent, 'Просмотрено 3 из 12', 'Отмена обновила блок');

      App.switchTab('watched');
      const card = doc.querySelector(`#tiers-watched .tier-card[data-id="${anime.id}"]`);
      T.assert(card, 'Тайтл есть в тир-листе');
      card.querySelector('[data-action="remove"]').click();
      T.eq(App.state.lists.watched.S.length, 0, 'Карточка убрана из тира');
      const removeUndo = [...doc.querySelectorAll('#toasts .toast-action')].pop();
      T.assert(removeUndo, 'Удаление предлагает отмену');
      removeUndo.click();
      T.eq(App.findTier('watched', anime.id), 'S', 'Отмена вернула тайтл в тот же тир');
    } finally {
      app.close();
    }
  });

  T.test('app: порядок карточек меняется, ручной порядок тира сохраняется', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const win = app.win;
      const App = win.AniTier;
      const doc = win.document;
      await win.__anitierTest.init();

      const make = (id, title, score) => ({
        id, malId: id, title, altTitle: '', originalTitle: '',
        type: 'TV', status: 'Завершено', year: 2024, score, genres: ['Action'],
        studios: ['Mappa'], episodes: 12, image: '',
      });
      App.addToList('watched', make(8811, 'Альфа', 6), 'S', true);
      App.addToList('watched', make(8812, 'Бета', 9), 'S', true);
      App.switchTab('watched');

      const order = () => [...doc.querySelectorAll('#tiers-watched .tier-card')].map(card => Number(card.dataset.id));
      T.eq(order(), [8812, 8811], 'По умолчанию — ручной порядок, последний сверху');

      const sort = doc.querySelector('#watched-sort');
      T.assert(sort, 'В панели есть выбор порядка');
      sort.value = 'title';
      sort.dispatchEvent(new win.Event('change', { bubbles: true }));
      T.eq(order(), [8811, 8812], 'По названию');
      T.eq(sort.value, 'title', 'Выбор порядка сохраняется после перерисовки');

      sort.value = 'score';
      sort.dispatchEvent(new win.Event('change', { bubbles: true }));
      T.eq(order(), [8812, 8811], 'По оценке');

      sort.value = 'default';
      sort.dispatchEvent(new win.Event('change', { bubbles: true }));
      T.eq(order(), [8812, 8811], 'Возврат к ручному порядку');
      T.eq(App.state.lists.watched.S.map(item => item.id), [8812, 8811], 'Сортировка не переставила данные тира');
    } finally {
      app.close();
    }
  });

  T.test('app: случайный тайтл выбирается из отфильтрованного плана', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const win = app.win;
      const App = win.AniTier;
      const doc = win.document;
      await win.__anitierTest.init();

      const make = (id, title) => ({
        id, malId: id, title, altTitle: '', originalTitle: '',
        type: 'TV', status: 'Завершено', year: 2024, score: 8, genres: ['Action'],
        studios: ['Mappa'], episodes: 12, image: '',
      });
      App.addToList('planned', make(8821, 'Первый кандидат'), 'S', true);
      App.addToList('planned', make(8822, 'Второй кандидат'), 'A', true);
      App.switchTab('planned');

      const search = doc.querySelector('#planned-search');
      search.value = 'Первый';
      search.dispatchEvent(new win.Event('input', { bubbles: true }));

      const button = doc.querySelector('[data-action="random-planned"]');
      T.assert(button, 'В плане есть кнопка «Что посмотреть?»');
      button.click();
      T.eq(App.state.modalId, 8821, 'Открылась карточка единственного подходящего тайтла');
      T.includes(doc.querySelector('#modal-content').textContent, 'Первый кандидат');
      App.closeModal();

      search.value = 'ничего не найдётся';
      search.dispatchEvent(new win.Event('input', { bubbles: true }));
      button.click();
      const toast = [...doc.querySelectorAll('#toasts .toast')].pop();
      T.includes(toast.textContent, 'нет тайтлов', 'Пустой результат объясняется');
    } finally {
      app.close();
    }
  });

  T.test('app: ссылки открывают вкладку и карточку, адрес обновляется', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1#watched' });
    try {
      const win = app.win;
      const App = win.AniTier;
      await win.__anitierTest.init();

      T.eq(App.state.tab, 'watched', 'Ссылка #watched открыла «Просмотрено»');

      const anime = App.state.notifications.tracked.episodes[0].anime;
      App.openModal(anime.id);
      T.eq(win.location.hash, `#anime/${anime.id}`, 'Открытая карточка попала в адрес');
      T.eq(App.state.modalId, anime.id);
      App.closeModal();
      T.eq(win.location.hash, '#watched', 'Закрытие вернуло ссылку вкладки');

      win.location.hash = '#planned';
      await T.waitFor(() => App.state.tab === 'planned', 'Смена адреса не переключила вкладку', 3000);
      T.eq(App.state.tab, 'planned', 'Вкладка «Запланировано» открылась по ссылке');
    } finally {
      app.close();
    }
  });

  T.test('app: «Мои серии» показывают серии и экспортируются в .ics', async () => {
    const app = await T.mountApp({
      query: '?demo=1&test=1',
      setup(win) {
        win.__savedFiles = [];
        win.AniTierAndroid = {
          saveBackup(text, fileName) { win.__savedFiles.push({ text, fileName }); },
        };
      },
    });
    try {
      const win = app.win;
      const App = win.AniTier;
      const doc = win.document;
      await win.__anitierTest.init();

      App.switchTab('upcoming');
      const mine = doc.querySelector('#upcoming-mine');
      T.assert(mine, 'Есть кнопка «Только мои серии»');
      mine.click();
      T.eq(App.state.upcoming.view.mine, true, 'Режим «Мои серии» включён');
      T.includes(doc.querySelector('#upcoming-grid').textContent, 'Серия', 'В календаре есть ближайшие серии');
      T.assert(doc.querySelectorAll('#upcoming-grid .calendar-row').length > 0, 'Календарь отрисован строками');
      T.includes(doc.querySelector('#upcoming-status').textContent, 'Мои серии');

      doc.querySelector('[data-action="export-ics"]').click();
      const saved = win.__savedFiles[0];
      T.assert(saved, 'Файл передан в Android-мост');
      T.eq(saved.fileName, 'anitier-episodes.ics');
      T.includes(saved.text, 'BEGIN:VCALENDAR');
      T.includes(saved.text, 'BEGIN:VEVENT');
      T.includes(saved.text, 'SUMMARY:');

      mine.click();
      T.eq(App.state.upcoming.view.mine, false, 'Режим «Мои серии» выключается');
    } finally {
      app.close();
    }
  });
})();
