/* Импорт списков MyAnimeList (XML) и Shikimori (JSON). */
(() => {
  'use strict';
  const T = window.AniTierTests;

  function core() {
    const C = window.AniTierCore;
    T.assert(C, 'core.js должен быть подключён');
    return C;
  }

  const MAL_XML = `<?xml version="1.0" encoding="UTF-8"?>
<myanimelist>
  <myinfo>
    <user_name>tester</user_name>
    <user_export_type>1</user_export_type>
  </myinfo>
  <anime>
    <series_animedb_id>52991</series_animedb_id>
    <series_title><![CDATA[Провожающая в последний путь Фрирен]]></series_title>
    <series_type>TV</series_type>
    <series_episodes>28</series_episodes>
    <series_start>2023-09-29</series_start>
    <my_watched_episodes>28</my_watched_episodes>
    <my_score>10</my_score>
    <my_status>Completed</my_status>
  </anime>
  <anime>
    <series_animedb_id>5114</series_animedb_id>
    <series_title><![CDATA[Стальной алхимик: Братство]]></series_title>
    <series_type>TV</series_type>
    <series_episodes>64</series_episodes>
    <series_start>2009-04-05</series_start>
    <my_watched_episodes>64</my_watched_episodes>
    <my_score>9</my_score>
    <my_status>Completed</my_status>
  </anime>
  <anime>
    <series_animedb_id>44511</series_animedb_id>
    <series_title><![CDATA[Человек-бензопила]]></series_title>
    <series_type>TV</series_type>
    <series_episodes>12</series_episodes>
    <series_start>2022-10-12</series_start>
    <my_watched_episodes>5</my_watched_episodes>
    <my_score>7</my_score>
    <my_status>On-Hold</my_status>
  </anime>
  <anime>
    <series_animedb_id>99999</series_animedb_id>
    <series_title><![CDATA[Неизвестный тайтл]]></series_title>
    <series_type>TV</series_type>
    <series_episodes>12</series_episodes>
    <series_start>2020-01-01</series_start>
    <my_watched_episodes>0</my_watched_episodes>
    <my_score>0</my_score>
    <my_status>Plan to Watch</my_status>
  </anime>
</myanimelist>`;

  const SHIKIMORI_JSON = JSON.stringify([
    {
      id: 1,
      score: 9,
      status: 'completed',
      episodes: 28,
      anime: {
        id: 52991,
        name: 'Sousou no Frieren',
        russian: 'Провожающая в последний путь Фрирен',
        episodes: 28,
        kind: 'tv',
        aired_on: '2023-09-29',
        image: { original: 'https://img.example/frieren.jpg' },
      },
    },
    {
      id: 2,
      score: 0,
      status: 'planned',
      episodes: 0,
      anime: {
        id: 44511,
        name: 'Chainsaw Man',
        russian: 'Человек-бензопила',
        episodes: 12,
        kind: 'tv',
        aired_on: '2022-10-12',
      },
    },
  ]);

  T.test('import: оценка превращается в тир, ноль остаётся без оценки', () => {
    const C = core();
    T.eq(C.tierFromScore(10), 'S');
    T.eq(C.tierFromScore(9), 'S');
    T.eq(C.tierFromScore(8), 'A');
    T.eq(C.tierFromScore(7), 'B');
    T.eq(C.tierFromScore(6), 'C');
    T.eq(C.tierFromScore(5), 'D');
    T.eq(C.tierFromScore(4), 'F');
    T.eq(C.tierFromScore(0), 'N');
    T.eq(C.tierFromScore(''), 'N');
  });

  T.test('import: XML MyAnimeList разбирается и не дублирует тайтлы', () => {
    const C = core();
    const rows = C.parseMalXml(MAL_XML, new DOMParser());
    T.eq(rows.length, 4);

    const frieren = rows.find(row => row.malId === 52991);
    T.eq(frieren.title, 'Провожающая в последний путь Фрирен');
    T.eq(frieren.episodes, 28);
    T.eq(frieren.watched, 28);
    T.eq(frieren.tier, 'S');
    T.eq(frieren.list, 'watched');
    T.eq(frieren.year, 2023);
    T.eq(frieren.source, 'mal');

    const planned = rows.find(row => row.malId === 99999);
    T.eq(planned.list, 'planned');
    T.eq(planned.tier, 'N');

    const duplicate = MAL_XML.replace('99999', '52991');
    T.eq(C.parseMalXml(duplicate, new DOMParser()).length, 3);
  });

  T.test('import: битый и пустой XML отклоняется с понятным текстом', () => {
    const C = core();
    let message = '';
    try { C.parseMalXml('<myanimelist><anime>', new DOMParser()); } catch (err) { message = err.message; }
    T.includes(message, 'XML');

    message = '';
    try { C.parseMalXml('<myanimelist></myanimelist>', new DOMParser()); } catch (err) { message = err.message; }
    T.includes(message, 'нет списка аниме');

    message = '';
    try { C.parseMalXml('', new DOMParser()); } catch (err) { message = err.message; }
    T.includes(message, 'пустой');
  });

  T.test('import: JSON Shikimori читает вложенный anime и оба статуса', () => {
    const C = core();
    const rows = C.parseShikimoriJson(SHIKIMORI_JSON);
    T.eq(rows.length, 2);

    const frieren = rows.find(row => row.malId === 52991);
    T.eq(frieren.title, 'Провожающая в последний путь Фрирен');
    T.eq(frieren.altTitle, 'Sousou no Frieren');
    T.eq(frieren.watched, 28);
    T.eq(frieren.list, 'watched');
    T.eq(frieren.tier, 'S');
    T.eq(frieren.image, 'https://img.example/frieren.jpg');

    const planned = rows.find(row => row.malId === 44511);
    T.eq(planned.list, 'planned');
    T.eq(planned.tier, 'N');
    T.eq(planned.watched, 0);

    const wrapped = C.parseShikimoriJson(JSON.stringify({ anime_rates: JSON.parse(SHIKIMORI_JSON) }));
    T.eq(wrapped.length, 2);
    T.eq(wrapped[0].malId, 52991);
  });

  T.test('import: битый JSON и чужой файл отклоняются', () => {
    const C = core();
    let message = '';
    try { C.parseShikimoriJson('{'); } catch (err) { message = err.message; }
    T.includes(message, 'JSON');

    message = '';
    try { C.parseShikimoriJson('{"foo":1}'); } catch (err) { message = err.message; }
    T.includes(message, 'нет оценок Shikimori');
  });

  function aniListList(name, entries) {
    return { name, isCustomList: false, isSplitCompletedList: false, status: null, userId: 1, user: { id: 1, name: 'tester' }, entries };
  }

  const ANILIST_EXPORT = JSON.stringify({
    data: {
      MediaListCollection: {
        user: { id: 1, name: 'tester' },
        lists: [
          aniListList('Watching', [
            {
              id: 101,
              mediaId: 210,
              status: 'CURRENT',
              format: 'TV',
              score: 72,
              progress: 5,
              repeat: 0,
              notes: '',
              private: false,
              customLists: [],
              media: {
                id: 210,
                idMal: 44511,
                title: { romaji: 'Chainsaw Man', english: null, native: 'チェンソーマン' },
                episodes: 12,
                format: 'TV',
                status: 'FINISHED',
                startDate: { year: 2022, month: 10, day: 12 },
                seasonYear: 2022,
                coverImage: { large: 'https://img.example/chainsaw.jpg', medium: 'https://img.example/chainsaw-m.jpg' },
              },
            },
          ]),
          aniListList('Completed', [
            {
              id: 102,
              mediaId: 5,
              status: 'COMPLETED',
              format: 'TV',
              score: 95,
              progress: 28,
              repeat: 0,
              notes: '',
              private: false,
              customLists: [],
              media: {
                id: 5,
                idMal: 52991,
                title: { romaji: 'Sousou no Frieren', english: 'Frieren: Beyond Journey\'s End', native: '葬送のフリーレン' },
                episodes: 28,
                format: 'TV',
                status: 'FINISHED',
                startDate: { year: 2023, month: 9, day: 29 },
                seasonYear: 2023,
                coverImage: { large: 'https://img.example/frieren.jpg', medium: '' },
              },
            },
          ]),
          aniListList('Planning', [
            {
            id: 103,
            mediaId: 85,
            status: 'PLANNING',
            format: 'TV',
            score: 0,
            progress: 0,
            repeat: 0,
            notes: '',
            private: false,
            customLists: [],
            media: {
              id: 85,
              idMal: 5114,
              title: { romaji: 'Fullmetal Alchemist: Brotherhood', english: 'Fullmetal Alchemist: Brotherhood', native: '鋼の錬金術師 FULLMETAL ALCHEMIST' },
              episodes: 64,
              format: 'TV',
              status: 'FINISHED',
              startDate: { year: 2009, month: 4, day: 5 },
              seasonYear: 2009,
              coverImage: { large: '', medium: '' },
            },
          },
        ]),
        ],
      },
    },
  });

  T.test('import: JSON AniList читает списки, шкалу 0–100 и статусы', () => {
    const C = core();
    const rows = C.parseAniListJson(ANILIST_EXPORT);
    T.eq(rows.length, 3);

    const frieren = rows.find(row => row.malId === 52991);
    T.eq(frieren.title, 'Frieren: Beyond Journey\'s End');
    T.eq(frieren.altTitle, 'Sousou no Frieren');
    T.eq(frieren.watched, 28);
    T.eq(frieren.episodes, 28);
    T.eq(frieren.score, 9.5);
    T.eq(frieren.tier, 'S');
    T.eq(frieren.list, 'watched');
    T.eq(frieren.year, 2023);
    T.eq(frieren.image, 'https://img.example/frieren.jpg');
    T.eq(frieren.source, 'anilist');

    const chainsaw = rows.find(row => row.malId === 44511);
    T.eq(chainsaw.watched, 5);
    T.eq(chainsaw.score, 7.2);
    T.eq(chainsaw.tier, 'B');
    T.eq(chainsaw.list, 'watched');

    const planned = rows.find(row => row.malId === 5114);
    T.eq(planned.list, 'planned');
    T.eq(planned.tier, 'N');
    T.eq(planned.watched, 0);
  });

  T.test('import: JSON AniList понимает плоский массив и шкалу 0–10', () => {
    const C = core();
    const flat = JSON.stringify([
      {
        id: 5,
        mediaId: 5,
        status: 'COMPLETED',
        score: 9,
        progress: 12,
        media: {
          id: 5,
          idMal: 52991,
          title: { romaji: 'Sousou no Frieren', english: '', native: '' },
          episodes: 28,
          format: 'TV',
          seasonYear: 2023,
          coverImage: {},
        },
      },
      {
        id: 6,
        mediaId: 6,
        status: 'PAUSED',
        score: 8,
        progress: 3,
        media: {
          id: 6,
          idMal: 44511,
          title: { romaji: 'Chainsaw Man', english: '', native: '' },
          episodes: 12,
          format: 'TV',
          seasonYear: 2022,
          coverImage: {},
        },
      },
    ]);
    const rows = C.parseAniListJson(flat);
    T.eq(rows.length, 2);
    const frieren = rows.find(row => row.malId === 52991);
    T.eq(frieren.score, 9);
    T.eq(frieren.tier, 'S');
    const paused = rows.find(row => row.malId === 44511);
    T.eq(paused.list, 'watched');
    T.eq(paused.tier, 'A');
  });

  T.test('import: битый и пустой JSON AniList отклоняются с понятным текстом', () => {
    const C = core();
    let message = '';
    try { C.parseAniListJson('{'); } catch (err) { message = err.message; }
    T.includes(message, 'JSON');

    message = '';
    try { C.parseAniListJson(''); } catch (err) { message = err.message; }
    T.includes(message, 'пустой');

    message = '';
    try { C.parseAniListJson('{"foo":1}'); } catch (err) { message = err.message; }
    T.includes(message, 'нет списка AniList');
  });

  T.test('import: план сопоставляет MAL ID, пропускает существующее и считает тиры', () => {
    const C = core();
    const rows = C.parseMalXml(MAL_XML, new DOMParser());
    const resolved = [
      { id: 1, malId: 52991, title: 'Фрирен' },
      { id: 2, malId: 5114, title: 'Алхимик' },
      { id: 3, malId: 44511, title: 'Бензопила' },
    ];
    const lists = {
      watched: { S: [], A: [], B: [{ id: 2 }], C: [], D: [], F: [], N: [] },
      planned: { S: [], A: [], B: [], C: [], D: [], F: [], N: [] },
    };

    const plan = C.planImport(rows, resolved, lists);
    T.eq(plan.entries.length, 2);
    T.eq(plan.already.length, 1);
    T.eq(plan.unmatched.length, 1);
    T.eq(plan.summary.total, 4);
    T.eq(plan.summary.newCount, 2);
    T.eq(plan.summary.already, 1);
    T.eq(plan.summary.unmatched, 1);
    T.eq(plan.summary.watched, 2);
    T.eq(plan.summary.planned, 0);
    T.eq(plan.summary.tierCounts.S, 1);
    T.eq(plan.summary.tierCounts.B, 1);

    const frieren = plan.entries.find(entry => entry.anime.id === 1);
    T.eq(frieren.list, 'watched');
    T.eq(frieren.tier, 'S');
    T.eq(frieren.watched, 28);
  });

  function rawAniList(id, malId, title, episodes) {
    return {
      id,
      idMal: malId,
      title: { romaji: title, english: title, native: '' },
      synonyms: [],
      format: 'TV',
      episodes,
      status: 'FINISHED',
      seasonYear: 2020,
      startDate: { year: 2020, month: 1, day: 1 },
      endDate: { year: 2020, month: 3, day: 31 },
      averageScore: 80,
      description: '',
      genres: ['Action'],
      studios: { nodes: [] },
      coverImage: { large: '' },
      siteUrl: `https://anilist.co/anime/${id}`,
      nextAiringEpisode: null,
    };
  }

  function importFetch(calls) {
    const mediaById = new Map([
      [52991, rawAniList(1, 52991, 'Sousou no Frieren', 28)],
      [5114, rawAniList(2, 5114, 'Fullmetal Alchemist: Brotherhood', 64)],
      [44511, rawAniList(3, 44511, 'Chainsaw Man', 12)],
    ]);
    return async (url, options = {}) => {
      const body = JSON.parse(options.body || '{}');
      const variables = body.variables || {};
      calls.push({ url, variables });
      const media = Array.isArray(variables.idMal_in)
        ? variables.idMal_in.map(id => mediaById.get(Number(id))).filter(Boolean)
        : [];
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: { Page: { pageInfo: { hasNextPage: false }, media } },
        }),
      };
    };
  }

  T.test('app: импорт MAL показывает план, добавляет тиры и прогресс', async () => {
    const calls = [];
    const app = await T.mountApp({
      query: '?demo=1&test=1',
      setup(win) { win.fetch = importFetch(calls); },
    });

    try {
      const api = app.win.__anitierTest;
      await api.init();
      const state = api.state;
      const doc = app.win.document;

      api.openExchange('import', 'watched');
      const file = new app.win.File([MAL_XML], 'mal.xml', { type: 'text/xml' });
      await api.importListFile(file);

      T.eq(state.exchange.importPlan.summary.total, 4);
      T.eq(state.exchange.importPlan.summary.newCount, 3);
      T.eq(state.exchange.importPlan.summary.unmatched, 1);
      const content = doc.getElementById('exchange-content');
      T.includes(content.textContent, 'Добавить 3 тайтла');
      T.includes(content.textContent, 'Неизвестный тайтл');

      api.confirmImportList();
      T.eq(state.lists.watched.S.length, 2);
      T.eq(state.lists.watched.B.length, 1);
      T.eq(state.lists.watched.S.map(item => item.malId).sort().join(','), '5114,52991');
      T.eq(state.progress[52991].watched.length, 28);
      T.eq(state.progress[44511].watched.join(','), '1,2,3,4,5');
      T.eq(state.exchange.importResult.added, 3);
      T.eq(state.exchange.importResult.unmatched, 1);
      T.includes(doc.getElementById('exchange-content').textContent, 'Импорт завершён');

      await api.importListFile(file);
      T.eq(state.exchange.importPlan.summary.newCount, 0);
      T.eq(state.exchange.importPlan.summary.already, 3);
      T.eq(state.exchange.importPlan.summary.unmatched, 1);
      const confirm = doc.querySelector('[data-action="exchange-import-confirm"]');
      T.assert(confirm && confirm.disabled, 'Повторный импорт не должен предлагать добавление');
    } finally {
      app.close();
    }
  });

  T.test('app: импорт Shikimori ставит планы в «Запланировано»', async () => {
    const calls = [];
    const app = await T.mountApp({
      query: '?demo=1&test=1',
      setup(win) { win.fetch = importFetch(calls); },
    });

    try {
      const api = app.win.__anitierTest;
      await api.init();
      const state = api.state;

      api.openExchange('import', 'watched');
      const file = new app.win.File([SHIKIMORI_JSON], 'rates.json', { type: 'application/json' });
      await api.importListFile(file);

      T.eq(state.exchange.importPlan.summary.newCount, 2);
      T.eq(state.exchange.importPlan.summary.watched, 1);
      T.eq(state.exchange.importPlan.summary.planned, 1);

      api.confirmImportList();
      T.eq(state.lists.watched.S.length, 1);
      T.eq(state.lists.planned.N.length, 1);
      T.eq(state.lists.planned.N[0].malId, 44511);
      T.eq(state.progress[52991].watched.length, 28);
    } finally {
      app.close();
    }
  });

  T.test('app: сжатый .json.gz AniList распаковывается и импортируется', async () => {
    const calls = [];
    const app = await T.mountApp({
      query: '?demo=1&test=1',
      setup(win) { win.fetch = importFetch(calls); },
    });

    try {
      const api = app.win.__anitierTest;
      await api.init();
      const state = api.state;
      const doc = app.win.document;

      const gzBytes = await new app.win.Response(
        new app.win.Blob([ANILIST_EXPORT]).stream().pipeThrough(new app.win.CompressionStream('gzip')),
      ).arrayBuffer();
      const file = new app.win.File([gzBytes], 'export.json.gz', { type: 'application/gzip' });

      api.openExchange('import', 'watched');
      await api.importListFile(file);

      T.eq(state.exchange.importPlan.summary.total, 3);
      T.eq(state.exchange.importPlan.summary.newCount, 3);
      T.eq(state.exchange.importPlan.summary.watched, 2);
      T.eq(state.exchange.importPlan.summary.planned, 1);
      T.includes(doc.getElementById('exchange-content').textContent, 'Добавить 3 тайтла');

      api.confirmImportList();
      T.eq(state.lists.watched.S.length, 1);
      T.eq(state.lists.watched.B.length, 1);
      T.eq(state.lists.planned.N.length, 1);
      T.eq(state.progress[52991].watched.length, 28);
      T.eq(state.progress[44511].watched.join(','), '1,2,3,4,5');
      T.eq(state.exchange.importResult.added, 3);

      // Повторный импорт того же файла: новых тайтлов нет, всё «уже у вас»
      await api.importListFile(file);
      T.eq(state.exchange.importPlan.summary.newCount, 0);
      T.eq(state.exchange.importPlan.summary.already, 3);
    } finally {
      app.close();
    }
  });
})();
