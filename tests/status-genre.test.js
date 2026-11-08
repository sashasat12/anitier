/* Статусы и жанры: коды, синонимы, Kitsu (пункт 27). */
(() => {
  'use strict';
  const T = window.AniTierTests;

  T.test('core: статусы нормализуются из русских строк, кодов и API-значений', () => {
    const C = window.AniTierCore;
    T.eq(C.normalizeStatusCode('В эфире'), 'airing');
    T.eq(C.normalizeStatusCode('Завершено'), 'finished');
    T.eq(C.normalizeStatusCode('Анонс'), 'upcoming');
    T.eq(C.normalizeStatusCode('RELEASING'), 'airing');
    T.eq(C.normalizeStatusCode('FINISHED'), 'finished');
    T.eq(C.normalizeStatusCode('NOT_YET_RELEASED'), 'upcoming');
    T.eq(C.normalizeStatusCode('HIATUS'), 'hiatus');
    T.eq(C.normalizeStatusCode('current'), 'airing');
    T.eq(C.normalizeStatusCode('complete'), 'finished');
    T.eq(C.animeStatusCode({ status: 'В эфире' }), 'airing', 'код выводится из legacy status');
    T.eq(C.animeStatusCode({ statusCode: 'finished', status: 'В эфире' }), 'finished', 'statusCode приоритетнее');
    T.eq(C.isOngoingStatus('airing'), true);
    T.eq(C.isOngoingStatus('hiatus'), true);
    T.eq(C.isOngoingStatus('finished'), false);
  });

  T.test('core: фильтры и collectSeasons работают по кодам статусов', () => {
    const C = window.AniTierCore;
    const airing = { id: 1, status: 'В эфире', type: 'tv', year: 2024, genres: ['Action'] };
    const finished = { id: 2, statusCode: 'finished', type: 'tv', year: 2023, genres: ['Drama'] };
    const upcoming = { id: 3, status: 'Анонс', statusCode: 'upcoming', type: 'tv', year: 2026, genres: [] };

    T.eq(C.matchesFilters(airing, { status: ['airing'] }), true);
    T.eq(C.matchesFilters(finished, { status: ['complete'] }), true, 'ключ фильтра complete совместим');
    T.eq(C.matchesFilters(upcoming, { status: ['upcoming'] }), true);
    T.eq(C.matchesFilters(airing, { status: ['complete'] }), false);

    const seasons = C.collectSeasons([
      {
        id: 10,
        relations: [
          { relationType: 'SEQUEL', anime: { id: 11, status: 'В эфире', type: 'TV', airedFrom: '2026-01-01' } },
          { relationType: 'SEQUEL', anime: { id: 12, statusCode: 'finished', type: 'TV', airedTo: new Date().toISOString() } },
        ],
      },
    ], { now: Date.now() });
    T.assert(seasons.some(s => s.sequel && s.sequel.id === 11), 'legacy русский статус учитывается');
    T.eq(seasons[0].sequel.id, 11, 'airing приоритетнее finished');
    T.eq(seasons[0].statusCode, 'airing');
  });

  T.test('core: жанровые синонимы и русские подписи матчатся', () => {
    const C = window.AniTierCore;
    T.eq(C.genreIdByName('Science Fiction'), '24');
    T.eq(C.genreIdByName('Экшен'), '1');
    T.eq(C.genreIdByName('Action'), '1');
    T.eq(C.genreRu('Science Fiction'), 'Фантастика');
    T.eq(C.genreRu('Экшен'), 'Экшен');

    const animeSciFi = { id: 1, status: 'Завершено', statusCode: 'finished', type: 'tv', year: 2024, genres: ['Science Fiction'], tags: [] };
    T.eq(C.matchesFilters(animeSciFi, { genre: ['24'] }), true, 'Science Fiction проходит фильтр Фантастика');

    const animeRuGenre = { id: 2, statusCode: 'finished', type: 'tv', year: 2024, genres: ['Экшен'], tags: [] };
    T.eq(C.matchesFilters(animeRuGenre, { genre: ['1'] }), true, 'Экшен проходит фильтр Экшен');

    const normalized = C.normalizeFilters({ genre: ['Science Fiction'] });
    T.eq(normalized.genre, ['24'], 'normalizeFilters принимает синоним жанра');
  });

  T.test('api: mapKitsu отделяет канонические жанры от тегов категорий', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      await app.win.__anitierTest.init();
      const App = app.win.AniTier;
      const mapped = App.mapKitsu({
        id: '123',
        attributes: {
          canonicalTitle: 'Test',
          titles: { en: 'Test' },
          subtype: 'TV',
          status: 'current',
          episodeCount: 12,
          startDate: '2024-01-01',
          synopsis: 'x',
          posterImage: { large: '' },
        },
        relationships: {
          categories: { data: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }] },
          mappings: { data: [] },
        },
      }, new Map([
        ['c1', 'Science Fiction'],
        ['c2', 'Elf'],
        ['c3', 'Action'],
      ]), new Map());

      T.eq(mapped.statusCode, 'airing');
      T.assert(mapped.genres.includes('Sci-Fi') || mapped.genres.includes('Action'), 'канонические жанры сохранены');
      T.assert(!mapped.genres.includes('Elf'), 'тег категории не подменяет жанр');
      T.assert(mapped.tags.includes('Elf'), 'категория Kitsu остаётся тегом');
      T.assert(mapped.tags.includes('Science Fiction'), 'категория Kitsu остаётся тегом');
    } finally {
      app.close();
    }
  });
})();
