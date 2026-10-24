(() => {
  'use strict';
  const T = window.AniTierTests;

  function core() {
    const C = window.AniTierCore;
    T.assert(C, 'core.js должен быть подключён и выставлять window.AniTierCore');
    return C;
  }

  T.test('core: ограничение страницы — 20 тайтлов', () => {
    const C = core();
    T.eq(C.PAGE_LIMIT, 20);
  });

  T.test('core: поиск с фильтрами собирает переменные AniList', () => {
    const C = core();
    const variables = C.buildAniListVariables({
      mode: 'popular',
      query: '  naruto  ',
      filters: { type: 'tv', status: 'airing', year: '2024', genre: '1', minScore: '8' },
      page: 2,
      limit: 20,
    });

    T.eq(variables.search, 'naruto');
    T.eq(variables.format, 'TV');
    T.eq(variables.status, 'RELEASING');
    T.eq(variables.genre, 'Action');
    T.eq(variables.averageScoreGreater, 79);
    T.eq(variables.seasonYear, 2024);
    T.eq(variables.page, 2);
    T.eq(variables.perPage, 20);
    T.eq(variables.type, 'ANIME');
    T.eq(variables.isAdult, false);
    T.eq(variables.sort, ['POPULARITY_DESC']);
  });

  T.test('core: фильтры без текста применяются к базе AniList', () => {
    const C = core();
    const variables = C.buildAniListVariables({
      mode: 'score',
      query: '',
      filters: { type: 'movie', status: 'complete', year: '', genre: '', minScore: '' },
      page: 1,
    });

    T.eq(variables.format, 'MOVIE');
    T.eq(variables.status, 'FINISHED');
    T.eq(variables.perPage, 20);
    T.eq(variables.sort, ['SCORE_DESC']);
    T.eq(variables.search, undefined);
  });

  T.test('core: режимы базы задают сортировку и формат AniList', () => {
    const C = core();
    const popular = C.buildAniListVariables({ mode: 'popular', page: 1 });
    const score = C.buildAniListVariables({ mode: 'score', page: 1 });
    const movie = C.buildAniListVariables({ mode: 'movie', page: 1 });
    const airing = C.buildAniListVariables({ mode: 'airing', page: 1 });
    const search = C.buildAniListVariables({ mode: 'popular', query: 'frieren', page: 1 });

    T.eq(popular.sort, ['POPULARITY_DESC']);
    T.eq(score.sort, ['SCORE_DESC']);
    T.eq(movie.format, 'MOVIE');
    T.eq(movie.sort, ['POPULARITY_DESC']);
    T.eq(airing.status, 'RELEASING');
    T.eq(airing.sort, ['POPULARITY_DESC']);
    T.eq(search.search, 'frieren');
    T.eq(search.sort, undefined);
  });

  T.test('core: фильтры уточняют режимы до сортировки', () => {
    const C = core();
    const rankedMovies = C.buildAniListVariables({
      mode: 'score', filters: { type: 'movie', status: 'complete', year: '2024', genre: '1', minScore: '8' },
    });
    T.eq(rankedMovies.format, 'MOVIE');
    T.eq(rankedMovies.status, 'FINISHED');
    T.eq(rankedMovies.seasonYear, 2024);
    T.eq(rankedMovies.genre, 'Action');
    T.eq(rankedMovies.averageScoreGreater, 79);
    T.eq(rankedMovies.sort, ['SCORE_DESC']);

    const airing = C.buildAniListVariables({ mode: 'airing', filters: { type: 'tv' } });
    T.eq(airing.status, 'RELEASING');
    T.eq(airing.format, 'TV');
    T.eq(airing.sort, ['POPULARITY_DESC']);

    const movies = C.buildAniListVariables({ mode: 'movie', filters: { year: '2025' } });
    T.eq(movies.format, 'MOVIE');
    T.eq(movies.seasonYear, 2025);
    T.eq(movies.sort, ['POPULARITY_DESC']);
  });

  T.test('core: demo-фильтр учитывает запрос, тип, год, жанр и рейтинг', () => {
    const C = core();
    const items = [
      {
        id: 1, title: 'Наруто', altTitle: 'Naruto', type: 'TV', status: 'Завершено',
        year: 2002, score: 8.0, genres: ['Боевик', 'Приключения'],
      },
      {
        id: 2, title: 'Твоё имя', altTitle: 'Kimi no Na wa', type: 'Movie', status: 'Завершено',
        year: 2016, score: 8.8, genres: ['Драма', 'Романтика'],
      },
      {
        id: 3, title: 'Фильм без рейтинга', altTitle: 'Untitled', type: 'Movie', status: 'Анонс',
        year: 2027, score: null, genres: ['Драма'],
      },
    ];

    const filtered = C.filterItems(items, {
      query: 'kimi',
      filters: { type: 'movie', status: 'complete', year: '2016', genre: '22', minScore: '8' },
    });

    T.eq(filtered.map(item => item.id), [2]);
  });

  T.test('core: активные фильтры считаются и нормализуются', () => {
    const C = core();
    const filters = C.normalizeFilters({ type: ' tv ', status: '', year: '2016', genre: '1', minScore: '8' });

    T.eq(filters.type, 'tv');
    T.eq(filters.year, '2016');
    T.eq(C.countActiveFilters(filters), 4);
    T.assert(C.hasActiveFilters(filters));
    T.assert(!C.hasActiveFilters(C.normalizeFilters({})));
  });

  T.test('core: страница отдаёт по 20 и знает, есть ли следующая', () => {
    const C = core();
    const items = Array.from({ length: 45 }, (_, index) => ({ id: index + 1 }));

    const first = C.slicePage(items, 1, 20);
    const third = C.slicePage(items, 3, 20);

    T.eq(first.items.length, 20);
    T.eq(first.items[0].id, 1);
    T.eq(first.hasNext, true);
    T.eq(third.items.length, 5);
    T.eq(third.items[0].id, 41);
    T.eq(third.hasNext, false);
  });

  T.test('core: dedupeById убирает повторы при догрузке', () => {
    const C = core();
    const merged = C.dedupeById([{ id: 1, title: 'A' }, { id: 2, title: 'B' }, { id: 1, title: 'A2' }]);
    T.eq(merged.map(item => item.id), [1, 2]);
    T.eq(merged[0].title, 'A');
  });

  T.test('core: нормализация названий и ключи для склейки источников', () => {
    const C = core();
    T.eq(C.normalizeTitleKey('  Frieren: Beyond Journey’s End! '), 'frieren beyond journey s end');
    T.eq(C.normalizeTitleKey('Ван-Пис'), 'ван пис');

    const keys = C.animeIdentityKeys({
      id: 52991,
      malId: 52991,
      title: 'Провожающая в последний путь Фрирен',
      altTitle: 'Sousou no Frieren',
      aliases: ['Frieren: Beyond Journey’s End'],
      year: 2023,
    });
    T.assert(keys.includes('mal:52991'));
    T.assert(keys.includes('title:sousou no frieren:2023'));
    T.assert(keys.includes('title:frieren beyond journey s end:2023'));
  });

  T.test('core: mergeUniqueAnime склеивает AniList и Kitsu без повторов', () => {
    const C = core();
    const seen = new Set();
    const groups = [
      [
        { id: 52991, title: 'Фрирен', altTitle: 'Sousou no Frieren', aliases: ['Frieren'], year: 2023 },
        { id: 2, title: 'AniList Only', altTitle: '', aliases: [], year: 2024 },
      ],
      [
        { id: -1000001, title: 'Sousou no Frieren', altTitle: 'Frieren', aliases: [], year: 2023 },
        { id: -1000002, title: 'Kitsu Only', altTitle: '', aliases: [], year: 2024 },
      ],
    ];

    const merged = C.mergeUniqueAnime(groups, seen);
    T.eq(merged.map(item => item.title), ['Фрирен', 'AniList Only', 'Kitsu Only']);

    const repeated = C.mergeUniqueAnime([
      [{ id: 52991, title: 'Фрирен', altTitle: 'Sousou no Frieren', year: 2023 }],
    ], seen);
    T.eq(repeated.length, 0);
  });
  T.test('core: язык запроса и русские жанры', () => {
    const C = core();
    T.eq(C.detectQueryLang('Фрирен'), 'ru');
    T.eq(C.detectQueryLang('Атака титанов'), 'ru');
    T.eq(C.detectQueryLang('葬送のフリーレン'), 'ja');
    T.eq(C.detectQueryLang('Jujutsu Kaisen'), 'en');
    T.eq(C.detectQueryLang(''), 'en');

    T.eq(C.normalizeSearchLang('RU'), 'ru');
    T.eq(C.normalizeSearchLang('ja'), 'ja');
    T.eq(C.normalizeSearchLang('немецкий'), 'auto');
    T.eq(C.normalizeSearchLang(null), 'auto');

    T.eq(C.genreRu('Slice of Life'), 'Повседневность');
    T.eq(C.genreRu('Sci-Fi'), 'Фантастика');
    T.eq(C.genreRu('Ecchi'), 'Этти');
    T.eq(C.genreRu('Elf'), 'Эльфы');
    T.eq(C.genreRu('Magic'), 'Магия');
    T.eq(C.genreRu('Драма'), 'Драма');
    T.eq(C.genreRu('Unknown Genre'), 'Unknown Genre');

    T.eq(C.firstCyrillic(['Sousou no Frieren', 'Провожающая в последний путь Фрирен']), 'Провожающая в последний путь Фрирен');
    T.eq(C.firstCyrillic(['Sousou no Frieren', '']), '');
  });

  T.test('core: резервная копия проверяет формат и версию', () => {
    const C = core();
    const valid = C.parseBackupJson(JSON.stringify({
      kind: 'anitier.backup',
      version: 2,
      createdAt: '2026-10-23T12:00:00.000Z',
      data: { state: { watched: {} } },
    }));
    T.eq(valid.version, 2);
    T.eq(valid.data.state.watched, {});
    T.eq(valid.createdAt, '2026-10-23T12:00:00.000Z');

    let error = '';
    try { C.parseBackupJson('{'); } catch (err) { error = err.message; }
    T.includes(error, 'не JSON');

    error = '';
    try { C.parseBackupJson(JSON.stringify({ kind: 'other', version: 2, data: {} })); } catch (err) { error = err.message; }
    T.includes(error, 'не резервная копия');

    error = '';
    try { C.parseBackupJson(JSON.stringify({ kind: 'anitier.backup', version: 99, data: {} })); } catch (err) { error = err.message; }
    T.includes(error, 'более новой версии');

    error = '';
    try { C.parseBackupJson(JSON.stringify({ kind: 'anitier.backup', version: 2 })); } catch (err) { error = err.message; }
    T.includes(error, 'нет данных');
  });

  T.test('core: ссылки TikTok распознаются и превращаются в плеер', () => {
    const C = core();
    T.assert(C.isTikTokUrl('https://www.tiktok.com/@user/video/7412345678901234567'));
    T.assert(C.isTikTokUrl('https://vm.tiktok.com/ZMabc123/'));
    T.assert(!C.isTikTokUrl('http://www.tiktok.com/@user/video/7412345678901234567'));
    T.assert(!C.isTikTokUrl('https://tiktok.com.evil.example/video/7412345678901234567'));
    T.assert(!C.isTikTokUrl('https://example.com/video/7412345678901234567'));

    T.eq(C.extractTikTokId('https://www.tiktok.com/@user/video/7412345678901234567?is_from_webapp=1'), '7412345678901234567');
    T.eq(C.extractTikTokId('https://www.tiktok.com/embed/v2/7412345678901234567'), '7412345678901234567');
    T.eq(C.extractTikTokId('https://www.tiktok.com/@user/video/'), '');
    T.eq(C.tiktokPlayerUrl('7412345678901234567'), 'https://www.tiktok.com/player/v1/7412345678901234567?autoplay=1&music_info=0&description=0&rel=0');
    T.eq(C.tiktokPlayerUrl(''), '');
  });

  T.test('core: размеры файлов показываются по-русски', () => {
    const C = core();
    T.eq(C.formatBytes(0), '0 Б');
    T.eq(C.formatBytes(512), '512 Б');
    T.eq(C.formatBytes(2048), '2 КБ');
    T.eq(C.formatBytes(5 * 1024 * 1024), '5.0 МБ');
    T.eq(C.formatBytes(40 * 1024 * 1024), '40 МБ');
  });
})();
