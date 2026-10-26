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

  T.test('core: поиск в тир-листе идёт по жанрам, студиям и алиасам', () => {
    const C = core();
    const items = [
      { id: 1, title: 'Альфа', altTitle: 'Alpha', genres: ['Action'], studios: ['Mappa'], year: 2020 },
      { id: 2, title: 'Бета', originalTitle: 'Beta', genres: ['Romance'], studios: ['Kyoto Animation'], year: 2021 },
      { id: 3, title: 'Гамма', aliases: ['Gamma'], genres: ['Drama'], studios: ['Ufotable'], year: 2020 },
    ];
    const ids = list => list.map(item => item.id);

    T.eq(ids(C.filterItems(items, { query: 'mappa' })), [1], 'Ищет по студии');
    T.eq(ids(C.filterItems(items, { query: 'романтика' })), [2], 'Ищет по русскому жанру');
    T.eq(ids(C.filterItems(items, { query: 'gamma' })), [3], 'Ищет по алиасу');
    T.eq(ids(C.filterItems(items, { query: 'beta' })), [2], 'Ищет по оригинальному названию');
    T.eq(ids(C.filterItems(items, { filters: { year: '2020', genre: '1' } })), [1], 'Фильтры года и жанра складываются');

    const options = C.listFilterOptions(items);
    T.eq(options.years, [2021, 2020], 'Годы идут по убыванию');
    T.eq(options.genres.map(genre => genre.label), ['Экшен', 'Драма', 'Романтика'], 'В фильтре только жанры из списка');
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

  T.test('core: склейка учитывает альтернативные названия и годы, не сливая похожие тайтлы', () => {
    const C = core();
    const merged = C.mergeUniqueAnime([
      [
        { id: -1, title: 'Атака титанов', aliases: ['Shingeki no Kyojin', 'Attack on Titan'], year: 2013 },
        { id: -2, title: 'Naruto', year: 2002 },
        { id: -3, title: 'Blue Lock', year: 2022 },
        { id: -4, title: 'Twin Title', year: 2020 },
        { id: -5, title: 'Twin Title', year: 2024 },
        { id: -6, title: 'Title Without Year' },
      ],
      [
        { id: -101, title: 'Attack on Titan', aliases: ['Атака титанов'], year: 2013 },
        { id: -102, title: 'Naruto: Shippuuden', aliases: ['Naruto Shippuden'], year: 2007 },
        { id: -103, title: 'Blue Period', year: 2021 },
        { id: -104, title: 'Twin Title', year: 2020 },
        { id: -105, title: 'Twin Title', year: 2024 },
        { id: -106, title: 'Title Without Year', year: 2024 },
      ],
    ]);

    T.eq(merged.length, 9, 'Дубликат по альтернативным названиям убирается; разные годы и похожие названия остаются');
    T.eq(merged.map(item => item.id), [-1, -2, -102, -3, -103, -4, -5, -6, -106]);
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

  T.test('core: размер резервной копии ограничен 30 МБ', () => {
    const C = core();
    T.assert(C.isBackupSizeAllowed(30 * 1024 * 1024));
    T.assert(!C.isBackupSizeAllowed(30 * 1024 * 1024 + 1));
    T.assert(!C.isBackupSizeAllowed(-1));
    T.assert(!C.isBackupSizeAllowed(Infinity));
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
    T.eq(C.tiktokSearchUrl('Frieren: Beyond Journey’s End'), 'https://www.tiktok.com/search?q=Frieren%3A%20Beyond%20Journey%E2%80%99s%20End');
    T.eq(C.tiktokSearchUrl(''), '');
  });

  T.test('core: размеры файлов показываются по-русски', () => {
    const C = core();
    T.eq(C.formatBytes(0), '0 Б');
    T.eq(C.formatBytes(512), '512 Б');
    T.eq(C.formatBytes(2048), '2 КБ');
    T.eq(C.formatBytes(5 * 1024 * 1024), '5.0 МБ');
    T.eq(C.formatBytes(40 * 1024 * 1024), '40 МБ');
  });

  T.test('core: напоминания берут ближайшие серии отслеживаемых тайтлов', () => {
    const C = core();
    const now = new Date('2026-10-25T12:00:00+03:00').getTime();
    const iso = ms => new Date(ms).toISOString();
    const data = {
      tracked: {
        episodes: [
          { anime: { id: 1, title: 'Вышла сегодня' }, episodes: [{ n: 5, date: iso(now - 3600000) }] },
          { anime: { id: 2, title: 'Следующая серия' }, episodes: [] },
        ],
        seasons: [
          {
            anime: { id: 9, title: 'База' },
            sequel: { id: 10, title: 'Сиквел', nextEpisode: { n: 2, date: iso(now + 86400000) } },
          },
        ],
      },
    };
    const epInfo = { 2: { next: { n: 7, date: iso(now + 2 * 3600000) } } };
    const items = C.buildReleaseNotificationItems(data, epInfo, { now });

    T.eq(items.length, 3);
    T.eq(items[0].title, 'Вышла сегодня', 'Вышедшая сегодня серия идёт первой');
    T.eq(items[0].n, 5);
    T.eq(new Date(items[0].date).getTime(), now + 60000, 'Прошедшую серию напоминаем через минуту');
    T.eq(items[1].title, 'Следующая серия');
    T.eq(items[1].n, 7);
    T.eq(items[2].title, 'Сиквел');
    T.eq(items[2].n, 2);
  });

  T.test('core: напоминания пропускают старые и далёкие серии', () => {
    const C = core();
    const now = new Date('2026-10-25T12:00:00+03:00').getTime();
    const iso = ms => new Date(ms).toISOString();
    const data = {
      tracked: {
        episodes: [
          { anime: { id: 1, title: 'Позавчера' }, episodes: [{ n: 3, date: iso(now - 2 * 86400000) }] },
          { anime: { id: 2, title: 'Через месяц' }, episodes: [] },
        ],
        seasons: [],
      },
    };
    const epInfo = { 2: { next: { n: 1, date: iso(now + 30 * 86400000) } } };
    const items = C.buildReleaseNotificationItems(data, epInfo, { now });

    T.eq(items.length, 0, 'В напоминания попадают только серии на ближайшие две недели');
  });

  T.test('core: автопрокрутка ускоряется у края и молчит в середине', () => {
    const C = core();
    T.eq(C.dragScrollDelta(400, 800), 0, 'В середине экрана прокрутки нет');
    T.eq(C.dragScrollDelta(10, 800) < 0, true, 'У верхнего края тянем вверх');
    T.eq(C.dragScrollDelta(790, 800) > 0, true, 'У нижнего края тянем вниз');
    T.assert(C.dragScrollDelta(795, 800) > C.dragScrollDelta(700, 800), 'Чем ближе к краю, тем быстрее');
    T.assert(C.dragScrollDelta(795, 800) <= 30, 'Скорость ограничена');
    T.eq(C.dragScrollDelta(795, 0), 0, 'Без высоты экрана прокрутки нет');
  });

  T.test('core: версии сравниваются по числам, а не по строкам', () => {
    const C = core();
    T.eq(C.compareVersions('1.8.0', '1.7.9'), 1);
    T.eq(C.compareVersions('v1.8.0', '1.8.0'), 0);
    T.eq(C.compareVersions('1.8', '1.8.0'), 0);
    T.eq(C.compareVersions('1.10.0', '1.9.9'), 1, '10 новее 9');
    T.eq(C.compareVersions('1.7.0', '2.0.0'), -1);
  });

  T.test('core: ответ GitHub превращается в версию релиза', () => {
    const C = core();
    const release = C.parseLatestRelease({
      tag_name: 'v1.9.0',
      name: 'AniTier 1.9.0',
      html_url: 'https://github.com/sashasat12/anitier/releases/tag/v1.9.0',
      body: 'Что нового',
    });
    T.eq(release.version, '1.9.0');
    T.eq(release.name, 'AniTier 1.9.0');
    T.includes(release.url, 'releases/tag/v1.9.0');
    T.eq(C.parseLatestRelease(null), null);
    T.eq(C.parseLatestRelease({ name: '' }), null);
  });

  T.test('core: премьеры скрываются, если тайтл уже в своих списках', () => {
    const C = core();
    const upcoming = [
      { id: 1, title: 'Соло-левелинг', year: 2027, airedFrom: '2027-01-10' },
      { id: 2, malId: 55, title: 'Другой тайтл', year: 2027, airedFrom: '2027-02-10' },
      { id: 3, title: 'Ремейк', year: 2027, airedFrom: '2027-03-10' },
      { id: 4, title: 'Свободный тайтл', year: 2027, airedFrom: '2027-04-10' },
    ];
    const watched = [{ id: 1, title: 'Соло-левелинг', year: 2027 }];
    const planned = [{ id: 900, malId: 55, title: 'Совсем другое название', year: 2025 }];

    const left = C.excludeListed(upcoming, [...watched, ...planned]);
    T.eq(left.map(a => a.id), [3, 4], 'Остаются только тайтлы вне списков');

    /* Ремейк с тем же названием, но другим годом — это другое аниме. */
    const remake = C.excludeListed(
      [{ id: 3, title: 'Ремейк', year: 2027 }],
      [{ id: 5, title: 'Ремейк', year: 2019 }],
    );
    T.eq(remake.length, 1, 'Старое аниме с тем же названием не прячет ремейк');

    T.eq(C.excludeListed(upcoming, []).length, upcoming.length, 'Без списков ничего не теряется');
    T.eq(C.excludeListed([], watched).length, 0);
  });

  T.test('core: премьеры фильтруются по месяцу, типу, жанру и поиску', () => {
    const C = core();
    const items = [
      {
        id: 1, title: 'Альфа', altTitle: 'Alpha', type: 'TV', genres: ['Action'],
        studios: ['Mappa'], airedFrom: '2026-11-05',
      },
      {
        id: 2, title: 'Бета', originalTitle: 'Beta', type: 'Movie', genres: ['Romance'],
        airedFrom: '2026-12-01',
      },
      {
        id: 3, title: 'Гамма', aliases: ['Gamma'], type: 'TV', genres: ['Drama'],
        airedFrom: '2027-01-15',
      },
    ];
    const ids = list => list.map(item => item.id);

    T.eq(ids(C.filterUpcoming(items, { query: 'alpha' })), [1], 'Ищет по altTitle');
    T.eq(ids(C.filterUpcoming(items, { query: 'gamma' })), [3], 'Ищет по алиасу');
    T.eq(ids(C.filterUpcoming(items, { query: 'романтика' })), [2], 'Ищет по русскому жанру');
    T.eq(ids(C.filterUpcoming(items, { filters: { type: 'tv' } })), [1, 3], 'Фильтр по типу');
    T.eq(ids(C.filterUpcoming(items, { filters: { genre: '22' } })), [2], 'Фильтр по жанру');
    T.eq(ids(C.filterUpcoming(items, { month: '2026-12' })), [2], 'Фильтр по месяцу');
    T.eq(ids(C.filterUpcoming(items, { sort: 'title' })), [1, 2, 3], 'Сортировка по названию');
    T.eq(ids(C.filterUpcoming(items, { sort: 'date' })), [1, 2, 3], 'Сортировка по дате');
    T.eq(ids(C.filterUpcoming(items, { month: '2026-11', filters: { type: 'movie' } })), [], 'Фильтры складываются');
    T.eq(C.upcomingMonthKey('2026-11-05'), '2026-11');
    T.eq(C.upcomingMonthKey(''), '');
  });

  T.test('core: сортировка тир-листа не меняет ручной порядок', () => {
    const C = core();
    const items = [
      { id: 1, title: 'Бета', score: 9, addedAt: 100 },
      { id: 2, title: 'Альфа', score: 7, addedAt: 300 },
      { id: 3, title: 'Гамма', score: null, addedAt: 200 },
    ];
    const ids = list => list.map(a => a.id);

    T.eq(ids(C.sortListItems(items, 'default')), [1, 2, 3], 'По умолчанию ручной порядок');
    T.eq(ids(C.sortListItems(items, 'title')), [2, 1, 3], 'По названию');
    T.eq(ids(C.sortListItems(items, 'score')), [1, 2, 3], 'По оценке, без оценки в конце');
    T.eq(ids(C.sortListItems(items, 'added')), [2, 3, 1], 'Сначала недавно добавленные');
    T.eq(
      ids(C.sortListItems(items, 'progress', { 1: { watched: [1, 2, 3] }, 2: { watched: [1] } })),
      [1, 2, 3],
      'По числу просмотренных серий',
    );
    T.eq(ids(items), [1, 2, 3], 'Исходный массив остался нетронутым');
    T.eq(C.normalizeListSort('странное'), 'default', 'Неизвестный порядок — ручной');
    T.eq(C.normalizeListSort('TITLE'), 'title', 'Порядок не зависит от регистра');
  });

  T.test('core: случайный тайтл не выходит за границы и не падает на пустом списке', () => {
    const C = core();
    T.eq(C.randomItem([]), null, 'Пустой список — null');
    T.eq(C.randomItem(null), null, 'Без массива — null');
    const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
    T.eq(C.randomItem(items, () => 0).id, 1, 'Ноль — первый элемент');
    T.eq(C.randomItem(items, () => 0.99).id, 3, 'Почти единица — последний элемент');
    T.eq(C.randomItem(items, () => 1).id, 3, 'Единица не выходит за границу');
    T.eq(C.randomItem(items, () => -1).id, 1, 'Отрицательное значение безопасно');
  });

  T.test('core: «Мои серии» берут будущие серии отслеживаемых тайтлов', () => {
    const C = core();
    const now = Date.parse('2026-10-26T12:00:00Z');
    const data = {
      tracked: {
        episodes: [
          {
            anime: { id: 1, title: 'Альфа' },
            episodes: [
              { n: 1, date: '2026-10-20T10:00:00Z' },
              { n: 4, date: '2026-11-01T10:00:00Z' },
            ],
          },
        ],
        seasons: [
          { anime: { id: 2, title: 'Сезон' }, sequel: { id: 3, title: 'Сезон 2' } },
        ],
      },
    };
    const epInfo = {
      1: { next: { n: 5, date: '2026-11-08T10:00:00Z' } },
      3: { next: { n: 1, date: '2026-10-30T10:00:00Z' } },
    };

    const items = C.buildCalendarItems(data, epInfo, { now, from: now });
    T.eq(items.map(item => `${item.id}:${item.n}`), ['3:1', '1:4', '1:5'], 'Прошедшие серии отброшены, порядок по дате');
    T.eq(items[0].title, 'Сезон 2', 'Название берётся из продолжения');
    T.eq(C.buildCalendarItems(data, epInfo, { now, from: now, max: 1 }).length, 1, 'Лимит соблюдается');
    T.eq(C.buildCalendarItems({ tracked: {} }, {}, { now }), [], 'Без отслеживания список пуст');
  });

  T.test('core: .ics содержит события и экранирует спецсимволы', () => {
    const C = core();
    const now = Date.parse('2026-10-26T12:00:00Z');
    const text = C.buildIcs([
      { id: 7, title: 'Альфа, бета; гамма', n: 5, date: '2026-11-08T10:00:00Z' },
    ], { now });

    T.includes(text, 'BEGIN:VCALENDAR');
    T.includes(text, 'END:VCALENDAR');
    T.includes(text, 'DTSTART:20261108T100000Z');
    T.includes(text, 'DTSTAMP:20261026T120000Z');
    T.includes(text, 'UID:anitier-7-5@anitier');
    T.includes(text, 'SUMMARY:Альфа\\, бета\\; гамма — серия 5', 'Запятая и точка с запятой экранированы');
    T.eq(text.includes('\r\n'), true, 'Строки разделены CRLF');
    T.eq((text.match(/BEGIN:VEVENT/g) || []).length, 1, 'Одно событие на серию');
    T.eq((C.buildIcs([], { now }).match(/BEGIN:VEVENT/g) || []).length, 0, 'Без серий событий нет');
  });

  T.test('core: история изменений начинается с текущей версии и идёт по убыванию', () => {
    const C = core();
    const list = C.CHANGELOG;
    T.assert(Array.isArray(list) && list.length > 0, 'История изменений не пуста');
    T.eq(list[0].version, C.APP_VERSION, 'Первая запись — текущая версия');
    for (let i = 1; i < list.length; i++) {
      T.eq(C.compareVersions(list[i - 1].version, list[i].version), 1, `Порядок версий: ${list[i - 1].version} выше ${list[i].version}`);
    }
    for (const entry of list) {
      T.assert(entry.title, `У версии ${entry.version} есть заголовок`);
      T.assert(Array.isArray(entry.items) && entry.items.length > 0, `У версии ${entry.version} есть пункты`);
    }
  });
  T.test('core: раскладка PNG ставит постеры в колонки и считает высоту', () => {
    const C = core();
    const groups = [
      { tier: 'S', label: 'S', name: 'Шедевр', items: [{ id: 1 }, { id: 2 }, { id: 3 }] },
      { tier: 'A', label: 'A', name: 'Отлично', items: Array.from({ length: 10 }, (_, i) => ({ id: 10 + i })) },
      { tier: 'B', label: 'B', name: 'Хорошо', items: [] },
    ];
    const layout = C.buildTierImageLayout(groups);

    T.eq(layout.columns, 9, 'На ширине 1400 помещается 9 постеров');
    T.eq(layout.tiers.length, 2, 'Пустой тир не рисуется');
    T.eq(layout.tiers[0].items.length, 3);
    T.eq(layout.tiers[0].items[1].x - layout.tiers[0].items[0].x, layout.posterWidth + layout.posterGap);
    T.eq(layout.tiers[0].items[2].y, layout.tiers[0].items[0].y, 'Три постерa в одном ряду');
    T.eq(layout.tiers[1].rows, 2, 'Десять постеров занимают два ряда');
    T.eq(layout.tiers[1].items[9].y > layout.tiers[1].items[0].y, true, 'Десятый постер ниже');
    T.eq(layout.height > layout.tiers[1].y, true, 'Высота холста больше последнего тира');
    T.eq(layout.omitted, 0);
  });

  T.test('core: PNG ограничивает число постеров и сообщает об остатке', () => {
    const C = core();
    const groups = [
      { tier: 'S', label: 'S', name: 'Шедевр', items: Array.from({ length: 6 }, (_, i) => ({ id: i + 1 })) },
      { tier: 'A', label: 'A', name: 'Отлично', items: Array.from({ length: 6 }, (_, i) => ({ id: 100 + i })) },
    ];
    const layout = C.buildTierImageLayout(groups, { maxItems: 7 });
    T.eq(layout.tiers[0].items.length, 6);
    T.eq(layout.tiers[1].items.length, 1);
    T.eq(layout.omitted, 5);

    const none = C.buildTierImageLayout(groups, { maxItems: 0 });
    T.eq(none.tiers.length, 0);
    T.eq(none.omitted, 12);
    T.eq(none.height > 0, true, 'Даже пустой холст имеет высоту');
  });
})();
