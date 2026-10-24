/* ============================================================
   AniTier — состояние, localStorage и операции со списками
   Загружается после core.js и до app-api.js, app-render.js, app.js.
   ============================================================ */
(function (App) {
  'use strict';

  /* Рендер загружается позже: вызовы происходят во время работы приложения. */
  const toast = (...args) => App.toast(...args);
  const refreshViews = (...args) => App.refreshViews(...args);
  const updateEpisodeUI = (...args) => App.updateEpisodeUI(...args);

  /* ---------------- константы ---------------- */
  const C = window.AniTierCore;
  if (!C) throw new Error('core.js не загружен');

  const LS_KEY = 'anitier.v1';
  const MOMENTS_KEY = 'anitier.moments.v1';
  const TRANSLATIONS_KEY = 'anitier.translations.v1';
  const CUSTOM_LIMIT = 100;
  const MOMENTS_PER_ANIME = 24;
  const CUSTOM_IMAGE_MAX = 12 * 1024 * 1024;
  const MOMENT_VIDEO_MAX = 40 * 1024 * 1024;
  const MOMENT_GIF_MAX = 12 * 1024 * 1024;
  const MEDIA_DB = 'anitier-media';
  const MEDIA_DB_VERSION = 1;
  const PAGE_LIMIT = C.PAGE_LIMIT;
  const LONG_TITLE_EPS = 60;
  const ANILIST_TIMEOUT = 9000;
  const SEARCH_TIMEOUT = 6000;
  const ANILIST_ENDPOINT = 'https://graphql.anilist.co';
  const KITSU_ENDPOINT = 'https://kitsu.io/api/edge/anime';
  const ANILIST_QUERY = `query AnimePage(
    $page: Int,
    $perPage: Int,
    $search: String,
    $sort: [MediaSort],
    $type: MediaType,
    $status: MediaStatus,
    $format: MediaFormat,
    $seasonYear: Int,
    $genre: String,
    $averageScoreGreater: Int,
    $startDateGreater: FuzzyDateInt,
    $startDateLesser: FuzzyDateInt,
    $endDateGreater: FuzzyDateInt,
    $endDateLesser: FuzzyDateInt
  ) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { hasNextPage }
      media(
        search: $search,
        type: $type,
        status: $status,
        format: $format,
        seasonYear: $seasonYear,
        genre: $genre,
        sort: $sort,
        averageScore_greater: $averageScoreGreater,
        startDate_greater: $startDateGreater,
        startDate_lesser: $startDateLesser,
        endDate_greater: $endDateGreater,
        endDate_lesser: $endDateLesser,
        isAdult: false
      ) {
        id
        idMal
        title { romaji english native }
        synonyms
        format
        episodes
        status
        seasonYear
        startDate { year month day }
        endDate { year month day }
        averageScore
        description(asHtml: false)
        genres
        studios(isMain: true) { nodes { name } }
        coverImage { extraLarge large }
        siteUrl
        nextAiringEpisode { episode airingAt }
      }
    }
  }`;
  const ANILIST_TRACKED_QUERY = `query TrackedAnime(
    $idMal_in: [Int],
    $page: Int,
    $perPage: Int
  ) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { hasNextPage }
      media(idMal_in: $idMal_in, type: ANIME, isAdult: false) {
        id
        idMal
        title { romaji english native }
        synonyms
        format
        episodes
        status
        seasonYear
        startDate { year month day }
        endDate { year month day }
        averageScore
        description(asHtml: false)
        genres
        studios(isMain: true) { nodes { name } }
        coverImage { extraLarge large }
        siteUrl
        nextAiringEpisode { episode airingAt }
        relations {
          edges {
            relationType
            node {
              id
              idMal
              title { romaji english native }
              synonyms
              format
              episodes
              status
              seasonYear
              startDate { year month day }
              endDate { year month day }
              averageScore
              description(asHtml: false)
              genres
              studios(isMain: true) { nodes { name } }
              coverImage { extraLarge large }
              siteUrl
              nextAiringEpisode { episode airingAt }
            }
          }
        }
      }
    }
  }`;

  const ANILIST_SCHEDULE_QUERY = `query RecentEpisodes(
    $page: Int,
    $perPage: Int,
    $airingAtGreater: Int,
    $airingAtLesser: Int
  ) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { hasNextPage }
      airingSchedules(
        airingAt_greater: $airingAtGreater,
        airingAt_lesser: $airingAtLesser,
        sort: TIME_DESC
      ) {
        airingAt
        episode
        media {
          id
          idMal
          title { romaji english native }
          synonyms
          format
          episodes
          status
          seasonYear
          startDate { year month day }
          endDate { year month day }
          averageScore
          description(asHtml: false)
          genres
          studios(isMain: true) { nodes { name } }
          coverImage { extraLarge large }
          siteUrl
          nextAiringEpisode { episode airingAt }
        }
      }
    }
  }`;

  const TEST_MODE = new URLSearchParams(location.search).has('test');

  const TIERS = [
    { id: 'S', label: 'S', name: 'Шедевр' },
    { id: 'A', label: 'A', name: 'Отлично' },
    { id: 'B', label: 'B', name: 'Хорошо' },
    { id: 'C', label: 'C', name: 'Средне' },
    { id: 'D', label: 'D', name: 'Слабо' },
    { id: 'F', label: 'F', name: 'Провал' },
    { id: 'N', label: '?', name: 'Без оценки' },
  ];
  const TIER_IDS = TIERS.map(t => t.id);
  const LIST_LABELS = { watched: 'Просмотрено', planned: 'Запланировано' };
  const EXCHANGE_FILTERS = [
    { id: 'all', label: 'Все' },
    { id: 'new', label: 'Новые' },
    { id: 'diff', label: 'Расхождения' },
  ];

  const TYPE_RU = {
    TV: 'ТВ',
    Movie: 'Фильм',
    OVA: 'OVA',
    ONA: 'ONA',
    Special: 'Спешл',
    Music: 'Клип',
    'TV Special': 'ТВ-спешл',
  };
  const typeRu = (t) => TYPE_RU[t] || t || '';

  const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const MONTHS_FULL = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

  const VIEW_TABS = ['db', 'notifications', 'watched', 'planned', 'upcoming'];
  const DB_MODES = ['popular', 'score', 'airing', 'movie', 'custom'];
  const TRANSLATION_PROVIDERS = ['auto', 'mymemory', 'google'];

  function normalizeTranslationProvider(value) {
    return TRANSLATION_PROVIDERS.includes(value) ? value : 'auto';
  }

  function normalizeCatalogPreferences(raw) {
    const value = raw && typeof raw === 'object' ? raw : {};
    return {
      tab: VIEW_TABS.includes(value.tab) ? value.tab : 'db',
      mode: DB_MODES.includes(value.mode) ? value.mode : 'popular',
      query: String(value.query == null ? '' : value.query).trim().slice(0, 160),
      filters: C.normalizeFilters(value.filters),
    };
  }

  /* Русские названия для популярных тайтлов (MAL id) */
  const RU_TITLES = {
    1: 'Ковбой Бибоп',
    19: 'Монстр',
    20: 'Наруто',
    21: 'Ван-Пис',
    30: 'Евангелион',
    1535: 'Тетрадь смерти',
    1575: 'Код Гиас: Восставший Лелуш',
    5114: 'Стальной алхимик: Братство',
    6547: 'Ангельские ритмы!',
    9253: 'Врата Штейна',
    11061: 'Хантер × Хантер',
    11757: 'Мастера меча онлайн',
    16498: 'Атака титанов',
    19815: 'Нет игры — нет жизни',
    20583: 'Волейбол!!',
    22319: 'Токийский гуль',
    23273: 'Твоя апрельская ложь',
    28851: 'Форма голоса',
    30276: 'Ванпанчмен',
    31240: 'Re:Zero. Жизнь с нуля в другом мире',
    31964: 'Моя геройская академия',
    32281: 'Твоё имя',
    34599: 'Созданный в Бездне',
    38000: 'Клинок, рассекающий демонов',
    40748: 'Магическая битва',
    41467: 'Блич: Тысячелетняя кровавая война',
    44511: 'Человек-бензопила',
    47917: 'Боччи на рок-концерте!',
    52991: 'Провожающая в последний путь Фрирен',
  };

  /* Демо-данные на случай отсутствия сети */
  const DEMO_BASE = [
    [52991, 'Провожающая в последний путь Фрирен', 'Sousou no Frieren', 28, 2023, 9.3, 'TV', ['Приключения', 'Драма', 'Фэнтези'], 'Эльфийка-магичка Фрирен переживает своих спутников и отправляется в новое путешествие, чтобы понять людей и время.'],
    [5114, 'Стальной алхимик: Братство', 'Fullmetal Alchemist: Brotherhood', 64, 2009, 9.1, 'TV', ['Приключения', 'Драма', 'Фэнтези'], 'Братья Элрики ищут философский камень, чтобы вернуть тела после неудачной попытки воскрешения матери.'],
    [9253, 'Врата Штейна', 'Steins;Gate', 24, 2011, 9.0, 'TV', ['Драма', 'Фантастика', 'Триллер'], 'Учёный-самоучка открывает способ отправлять сообщения в прошлое — и запускает цепочку трагедий.'],
    [11061, 'Хантер × Хантер', 'Hunter x Hunter (2011)', 148, 2011, 9.0, 'TV', ['Приключения', 'Фэнтези', 'Сёнен'], 'Гон идёт в опасную профессию охотника, чтобы найти отца.'],
    [28851, 'Форма голоса', 'Koe no Katachi', 1, 2016, 8.9, 'Movie', ['Драма', 'Романтика'], 'История о буллинге, вине и попытке снова научиться слышать друг друга.'],
    [32281, 'Твоё имя', 'Kimi no Na wa', 1, 2016, 8.8, 'Movie', ['Драма', 'Романтика', 'Фантастика'], 'Двое подростков начинают меняться телами и искать друг друга сквозь время и расстояние.'],
    [47917, 'Боччи на рок-концерте!', 'Bocchi the Rock!', 12, 2022, 8.8, 'TV', ['Комедия', 'Музыка'], 'Застенчивая гитаристка мечтает о сцене и впервые оказывается в настоящей группе.'],
    [41467, 'Блич: Тысячелетняя кровавая война', 'Bleach: Sennen Kessen-hen', 13, 2022, 8.8, 'TV', ['Боевик', 'Сёнен', 'Сверхъестественное'], 'Финальная война синигами и квинси начинается.'],
    [1, 'Ковбой Бибоп', 'Cowboy Bebop', 26, 1998, 8.8, 'TV', ['Боевик', 'Фантастика', 'Драма'], 'Охотники за головами бороздят космос под джаз и собственные воспоминания.'],
    [34599, 'Созданный в Бездне', 'Made in Abyss', 13, 2017, 8.7, 'TV', ['Приключения', 'Драма', 'Фэнтези'], 'Девочка и робот спускаются в бездну, откуда почти никто не возвращается.'],
    [21, 'Ван-Пис', 'One Piece', null, 1999, 8.7, 'TV', ['Приключения', 'Комедия', 'Сёнен'], 'Луффи и его команда ищут легендарное сокровище и свободу.'],
    [40748, 'Магическая битва', 'Jujutsu Kaisen', 24, 2020, 8.6, 'TV', ['Боевик', 'Сёнен', 'Сверхъестественное'], 'Школьник попадает в мир проклятий и становится учеником сильнейшего мага.'],
    [1535, 'Тетрадь смерти', 'Death Note', 37, 2006, 8.6, 'TV', ['Детектив', 'Психологическое', 'Триллер'], 'Найдя тетрадь, убивающую любого, чьё имя в неё вписано, старшеклассник бросает вызов полиции и гениальному детективу.'],
    [23273, 'Твоя апрельская ложь', 'Shigatsu wa Kimi no Uso', 22, 2014, 8.6, 'TV', ['Драма', 'Музыка', 'Романтика'], 'Встреча с скрипачкой возвращает пианисту вкус к музыке и жизни.'],
    [20583, 'Волейбол!!', 'Haikyuu!!', 25, 2014, 8.6, 'TV', ['Комедия', 'Спорт'], 'Ученическая команда по волейболу мечтает попасть на национальный турнир.'],
    [16498, 'Атака титанов', 'Shingeki no Kyojin', 25, 2013, 8.5, 'TV', ['Боевик', 'Драма', 'Фэнтези'], 'Человечество укрывается за стенами от титанов, пожирающих людей.'],
    [38000, 'Клинок, рассекающий демонов', 'Kimetsu no Yaiba', 26, 2019, 8.5, 'TV', ['Боевик', 'Сёнен', 'Сверхъестественное'], 'Танджиро становится истребителем демонов, чтобы спасти сестру.'],
    [44511, 'Человек-бензопила', 'Chainsaw Man', 12, 2022, 8.5, 'TV', ['Боевик', 'Сёнен', 'Сверхъестественное'], 'Дьявол-подросток с бензопилой на голове ищет деньги, мечты и немного нежности.'],
    [30276, 'Ванпанчмен', 'One Punch Man', 12, 2015, 8.5, 'TV', ['Боевик', 'Комедия', 'Пародия'], 'Герой, побеждающий любого врага одним ударом, страдает от скуки.'],
    [30, 'Евангелион', 'Neon Genesis Evangelion', 26, 1995, 8.5, 'TV', ['Драма', 'Меха', 'Психологическое'], 'Подростки пилотируют биомеханических евангелионов, защищая город от ангелов.'],
    [31964, 'Моя геройская академия', 'Boku no Hero Academia', 13, 2016, 8.3, 'TV', ['Боевик', 'Сёнен', 'Супергерои'], 'Мальчик без суперсилы попадает в академию героев благодаря встрече с легендой.'],
    [31240, 'Re:Zero. Жизнь с нуля в другом мире', 'Re:Zero kara Hajimeru Isekai Seikatsu', 25, 2016, 8.2, 'TV', ['Драма', 'Фэнтези', 'Исекай'], 'Попав в другой мир, герой обнаруживает, что после смерти возвращается в прошлое.'],
    [19815, 'Нет игры — нет жизни', 'No Game No Life', 12, 2014, 8.1, 'TV', ['Комедия', 'Фэнтези', 'Исекай'], 'Брат и сестра — непобедимые геймеры — попадают в мир, где всё решают игры.'],
    [20, 'Наруто', 'Naruto', 220, 2002, 8.0, 'TV', ['Боевик', 'Приключения', 'Сёнен'], 'Молодой ниндзя с лисом внутри мечтает стать главой деревни.'],
    [22319, 'Токийский гуль', 'Tokyo Ghoul', 12, 2014, 7.8, 'TV', ['Боевик', 'Психологическое', 'Сверхъестественное'], 'После встречи с гулем студент оказывается между двумя мирами.'],
    [6547, 'Ангельские ритмы!', 'Angel Beats!', 13, 2010, 7.8, 'TV', ['Драма', 'Сверхъестественное', 'Школа'], 'Попав в загробную школу, подростки объявляют войну ангелу-старосте.'],
    [11757, 'Мастера меча онлайн', 'Sword Art Online', 25, 2012, 7.5, 'TV', ['Боевик', 'Приключения', 'Романтика'], 'Игроки оказываются заперты в VRMMO, где смерть в игре означает смерть в реальности.'],
  ];

  /* ---------------- утилиты ---------------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const escXml = (s) => String(s ?? '').replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return Math.abs(h);
  }

  function plural(n, one, few, many) {
    const a = Math.abs(n) % 100;
    const b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b > 1 && b < 5) return few;
    if (b === 1) return one;
    return many;
  }

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const endOfToday = () => { const d = new Date(); d.setHours(23, 59, 59, 999); return d; };
  const startOfTomorrow = () => { const d = startOfToday(); d.setDate(d.getDate() + 1); return d; };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const daysBetween = (a, b) => Math.round((b - a) / 86400000);
  const parseDate = (s) => { if (!s) return null; const d = new Date(s); return Number.isNaN(d.getTime()) ? null : d; };
  function fuzzyDateInt(value) {
    const d = value instanceof Date ? value : parseDate(value);
    if (!d) return null;
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }

  function monthLabel(iso) {
    const d = parseDate(iso);
    return d ? `${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}` : 'Дата уточняется';
  }
  function dateShort(iso) {
    const d = parseDate(iso);
    return d ? `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}` : '—';
  }
  function countdownLabel(iso) {
    const d = parseDate(iso);
    if (!d) return 'дата уточняется';
    const target = new Date(d); target.setHours(0, 0, 0, 0);
    const days = daysBetween(startOfToday(), target);
    if (days <= 0) return 'сегодня';
    if (days === 1) return 'завтра';
    if (days < 14) return `через ${days} ${plural(days, 'день', 'дня', 'дней')}`;
    if (days < 45) {
      const w = Math.round(days / 7);
      return `через ${w} ${plural(w, 'неделю', 'недели', 'недель')}`;
    }
    const m = Math.round(days / 30);
    return `через ~${m} ${plural(m, 'месяц', 'месяца', 'месяцев')}`;
  }
  function relativePast(iso) {
    const d = parseDate(iso);
    if (!d) return 'недавно';
    const days = daysBetween(new Date(d.getFullYear(), d.getMonth(), d.getDate()), startOfToday());
    if (days <= 0) return 'сегодня';
    if (days === 1) return 'вчера';
    return `${days} ${plural(days, 'день', 'дня', 'дней')} назад`;
  }

  /* ---------------- постеры-заглушки ---------------- */
  const posterCache = new Map();
  function makePoster(title, id) {
    const key = String(id) + '|' + title;
    if (posterCache.has(key)) return posterCache.get(key);
    const h = hash(key) % 360;
    const h2 = (h + 48) % 360;
    const letter = (String(title || '?').trim().charAt(0) || '?').toUpperCase();
    const label = escXml(String(title || '').slice(0, 34));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="540" viewBox="0 0 360 540">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="hsl(${h},68%,30%)"/>
<stop offset="1" stop-color="hsl(${h2},72%,10%)"/>
</linearGradient>
<linearGradient id="f" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#000" stop-opacity="0"/>
<stop offset="1" stop-color="#000" stop-opacity=".78"/>
</linearGradient>
</defs>
<rect width="360" height="540" fill="url(#g)"/>
<circle cx="310" cy="80" r="130" fill="hsl(${h2},90%,62%)" opacity=".16"/>
<circle cx="40" cy="470" r="170" fill="hsl(${h},90%,60%)" opacity=".13"/>
<g opacity=".07" stroke="#fff" stroke-width="1">
<path d="M0 90h360M0 180h360M0 270h360M0 360h360M0 450h360"/>
<path d="M60 0v540M140 0v540M220 0v540M300 0v540"/>
</g>
<text x="180" y="318" font-family="Segoe UI, Arial, sans-serif" font-size="190" font-weight="700" fill="#ffffff" fill-opacity=".9" text-anchor="middle">${escXml(letter)}</text>
<rect y="360" width="360" height="180" fill="url(#f)"/>
<text x="180" y="492" font-family="Segoe UI, Arial, sans-serif" font-size="17" font-weight="600" fill="#ffffff" fill-opacity=".85" text-anchor="middle">${label}</text>
<text x="180" y="516" font-family="Segoe UI, Arial, sans-serif" font-size="10" letter-spacing="3" fill="#ffffff" fill-opacity=".5" text-anchor="middle">ANITIER</text>
</svg>`;
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    posterCache.set(key, url);
    return url;
  }

  window.posterFallback = function (img) {
    img.onerror = null;
    img.src = makePoster(img.dataset.title || 'Anime', img.dataset.id || '0');
  };

  /* ---------------- состояние ---------------- */
  const state = {
    tab: 'db',
    offline: false,
    forceDemo: new URLSearchParams(location.search).has('demo'),
    settings: {
      searchLang: 'auto',
      translationProvider: 'auto',
      catalog: normalizeCatalogPreferences(),
    },
    modalId: null,
    exchange: {
      open: false,
      mode: 'export',
      list: 'watched',
      code: '',
      parsed: null,
      comparison: null,
      filter: 'all',
      error: '',
    },
    byId: new Map(),
    franchiseById: new Map(),
    franchiseLoading: new Set(),
    franchiseErrors: new Map(),
    synopsisModes: new Map(),
    synopsisTranslating: new Set(),
    customCards: [],
    moments: {},
    customForm: { open: false, editingId: null, error: '', busy: false },
    momentForm: { open: false, animeId: null, mode: 'tiktok', error: '', busy: false, url: '', title: '' },
    tiktokImport: { open: false, url: '', title: '', thumb: '', query: '', loading: false },
    backup: { open: false, busy: false, message: '', error: false },
    lists: { watched: emptyTiers(), planned: emptyTiers() },
    progress: {},
    epInfo: {},
    seenNotifications: new Set(),
    booting: true,
    bootstrapDone: false,
    db: {
      mode: 'popular',
      query: '',
      filters: C.normalizeFilters(C.DEFAULT_FILTERS),
      page: 1,
      items: [],
      loading: false,
      hasNext: true,
      error: null,
      revision: 0,
      queued: false,
      touched: false,
      sources: [],
      resolvedQuery: '',
      resolveVia: '',
      alt: createAltSearchState(),
    },
    notifications: {
      tab: null,
      tabTouched: false,
      tracked: { episodes: [], seasons: [] },
      recent: { episodes: [], films: [] },
      completed: [],
      loading: false,
      loaded: false,
      error: null,
      queued: false,
    },
    upcoming: { items: [], loading: false, loaded: false, error: null, queued: false },
  };

  function emptyTiers() {
    const o = {};
    for (const t of TIER_IDS) o[t] = [];
    return o;
  }

  function createAltSearchState() {
    return {
      anilistPage: 1,
      kitsuPage: 1,
      anilistDone: false,
      kitsuDone: false,
      buffer: [],
      seen: new Set(),
      sources: [],
      failedSources: [],
      providerOk: false,
    };
  }

  function normalizeTiers(raw) {
    const out = emptyTiers();
    if (!raw || typeof raw !== 'object') return out;
    for (const t of TIER_IDS) {
      const arr = Array.isArray(raw[t]) ? raw[t] : [];
      const seen = new Set();
      out[t] = arr.filter(a => {
        if (!a || a.id == null || seen.has(a.id)) return false;
        seen.add(a.id);
        return true;
      }).map(snapshotAnime);
    }
    return out;
  }

  function snapshotAnime(a) {
    return {
      id: a.id,
      malId: a.malId ?? null,
      title: a.title,
      altTitle: a.altTitle || '',
      originalTitle: a.originalTitle || '',
      image: a.image || '',
      custom: Boolean(a.custom),
      customId: a.customId || '',
      episodes: a.episodes ?? null,
      type: a.type || '',
      status: a.status || '',
      score: typeof a.score === 'number' ? a.score : null,
      year: a.year || null,
      airedFrom: a.airedFrom || null,
      airedTo: a.airedTo || null,
      synopsis: a.synopsis ? String(a.synopsis).slice(0, 700) : '',
      genres: Array.isArray(a.genres) ? a.genres.slice(0, 12) : [],
      studios: Array.isArray(a.studios) ? a.studios.slice(0, 6) : [],
      url: a.url || '',
      source: a.source || '',
      sourceId: a.sourceId ?? null,
      demo: Boolean(a.demo),
    };
  }

  /* ---------------- свои карточки ---------------- */
  function newUid() {
    try {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    } catch { /* старый WebView */ }
    return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function nextCustomId() {
    let min = 0;
    const consider = (value) => {
      const id = Number(value);
      if (Number.isInteger(id) && id < min) min = id;
    };
    for (const card of state.customCards) consider(card.id);
    for (const name of ['watched', 'planned']) {
      for (const tier of TIER_IDS) {
        for (const item of state.lists[name][tier] || []) consider(item.id);
      }
    }
    return min - 1;
  }

  function normalizeCustomCard(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const id = Number(raw.id);
    const title = String(raw.title == null ? '' : raw.title).trim().slice(0, 300);
    if (!Number.isInteger(id) || id >= 0 || !title) return null;
    const customId = String(raw.customId || '').trim().slice(0, 100) || `legacy-${Math.abs(id)}`;
    const image = typeof raw.image === 'string' && /^data:image\//i.test(raw.image) && raw.image.length < 700000
      ? raw.image
      : '';
    const episodes = Number(raw.episodes);
    const score = Number(raw.score);
    const year = Number(raw.year);
    const genres = Array.isArray(raw.genres)
      ? raw.genres.map(value => String(value == null ? '' : value).trim().slice(0, 60)).filter(Boolean).slice(0, 12)
      : [];
    return {
      id,
      customId,
      custom: true,
      title,
      altTitle: String(raw.altTitle == null ? '' : raw.altTitle).trim().slice(0, 300),
      originalTitle: String(raw.originalTitle == null ? '' : raw.originalTitle).trim().slice(0, 300),
      image,
      episodes: Number.isFinite(episodes) && episodes > 0 ? Math.floor(episodes) : null,
      type: String(raw.type == null ? '' : raw.type).trim().slice(0, 40),
      status: String(raw.status == null ? '' : raw.status).trim().slice(0, 40),
      score: Number.isFinite(score) && score >= 0 && score <= 10 ? score : null,
      year: Number.isFinite(year) && year > 0 ? Math.floor(year) : null,
      airedFrom: null,
      airedTo: null,
      synopsis: String(raw.synopsis == null ? '' : raw.synopsis).trim().slice(0, 2000),
      genres,
      studios: [],
      url: '',
      source: 'custom',
      sourceId: null,
      demo: false,
      createdAt: Number(raw.createdAt) || Date.now(),
      updatedAt: Number(raw.updatedAt) || Date.now(),
    };
  }

  function getCustomCard(id) {
    return state.customCards.find(card => card.id === Number(id)) || null;
  }

  function upsertCustomCard(raw) {
    const card = normalizeCustomCard(raw);
    if (!card) return null;
    const index = state.customCards.findIndex(item => item.id === card.id);
    if (index >= 0) state.customCards[index] = card;
    else state.customCards.unshift(card);
    if (state.customCards.length > CUSTOM_LIMIT) state.customCards.length = CUSTOM_LIMIT;
    state.byId.set(card.id, card);

    for (const name of ['watched', 'planned']) {
      for (const tier of TIER_IDS) {
        const items = state.lists[name][tier];
        const at = items.findIndex(item => item.id === card.id);
        if (at >= 0) items[at] = snapshotAnime(card);
      }
    }

    saveState();
    refreshViews();
    return card;
  }

  function deleteCustomCard(id) {
    const card = getCustomCard(id);
    if (!card) return null;
    state.customCards = state.customCards.filter(item => item.id !== card.id);
    for (const name of ['watched', 'planned']) {
      for (const tier of TIER_IDS) {
        state.lists[name][tier] = state.lists[name][tier].filter(item => item.id !== card.id);
      }
    }
    delete state.progress[card.id];
    delete state.epInfo[card.id];
    if (state.moments[String(card.id)]) {
      delete state.moments[String(card.id)];
      saveMoments();
    }
    state.byId.delete(card.id);
    saveState();
    refreshViews();
    return card;
  }

  /* ---------------- моменты ---------------- */
  function normalizeMoment(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const id = String(raw.id || '').trim().slice(0, 100);
    const kind = ['tiktok', 'video', 'gif'].includes(raw.kind) ? raw.kind : '';
    if (!id || !kind) return null;
    const url = String(raw.url || '').trim().slice(0, 1000);
    const mediaKey = String(raw.mediaKey || '').trim().slice(0, 120);
    if (kind === 'tiktok' && !C.isTikTokUrl(url)) return null;
    if (kind !== 'tiktok' && !mediaKey) return null;
    const thumb = typeof raw.thumb === 'string'
      && (/^data:image\//i.test(raw.thumb) || /^https:\/\//i.test(raw.thumb))
      && raw.thumb.length < 500000
      ? raw.thumb
      : '';
    const size = Number(raw.size);
    return {
      id,
      kind,
      title: String(raw.title == null ? '' : raw.title).trim().slice(0, 200),
      url,
      videoId: kind === 'tiktok' ? String(raw.videoId || '').replace(/[^0-9]/g, '').slice(0, 32) : '',
      mediaKey,
      thumb,
      mime: String(raw.mime || '').slice(0, 100),
      size: Number.isFinite(size) && size > 0 ? Math.floor(size) : 0,
      createdAt: Number(raw.createdAt) || Date.now(),
    };
  }

  function loadMoments() {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(MOMENTS_KEY) || 'null'); } catch { raw = null; }
    state.moments = {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return;
    for (const [key, list] of Object.entries(raw)) {
      if (!Array.isArray(list)) continue;
      const items = list.map(normalizeMoment).filter(Boolean).slice(0, MOMENTS_PER_ANIME);
      if (items.length) state.moments[key] = items;
    }
  }

  function saveMoments() {
    try {
      localStorage.setItem(MOMENTS_KEY, JSON.stringify(state.moments));
    } catch (err) {
      console.warn('moments', err);
      toast('Не удалось сохранить моменты: браузер не даёт место');
    }
  }

  function momentsFor(id) {
    return state.moments[String(id)] || [];
  }

  function findMoment(animeId, momentId) {
    return momentsFor(animeId).find(item => item.id === momentId) || null;
  }

  function addMoment(animeId, raw) {
    const moment = normalizeMoment(raw);
    if (!moment) return null;
    const key = String(animeId);
    const list = state.moments[key] ? [...state.moments[key]] : [];
    const index = list.findIndex(item => item.id === moment.id);
    if (index >= 0) list[index] = moment;
    else list.unshift(moment);
    state.moments[key] = list.slice(0, MOMENTS_PER_ANIME);
    saveMoments();
    return moment;
  }

  function removeMoment(animeId, momentId) {
    const key = String(animeId);
    const list = momentsFor(animeId);
    const moment = list.find(item => item.id === momentId) || null;
    if (!moment) return null;
    const next = list.filter(item => item.id !== momentId);
    if (next.length) state.moments[key] = next;
    else delete state.moments[key];
    saveMoments();
    return moment;
  }

  /* ---------------- резервные копии ---------------- */
  function buildBackupPayload() {
    saveState();
    saveMoments();
    const read = (key) => {
      try {
        const raw = JSON.parse(localStorage.getItem(key) || 'null');
        return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
      } catch {
        return {};
      }
    };
    return {
      app: 'AniTier',
      kind: C.BACKUP_KIND,
      version: C.BACKUP_VERSION,
      createdAt: new Date().toISOString(),
      data: {
        state: read(LS_KEY),
        moments: read(MOMENTS_KEY),
        translations: read(TRANSLATIONS_KEY),
      },
    };
  }

  function applyBackupData(data) {
    const rawState = data && data.state;
    if (!rawState || typeof rawState !== 'object' || Array.isArray(rawState)) {
      throw new Error('В копии нет данных приложения.');
    }

    const cleanState = {
      watched: rawState.watched && typeof rawState.watched === 'object' ? rawState.watched : {},
      planned: rawState.planned && typeof rawState.planned === 'object' ? rawState.planned : {},
      customCards: Array.isArray(rawState.customCards) ? rawState.customCards : [],
      progress: rawState.progress && typeof rawState.progress === 'object' ? rawState.progress : {},
      epInfo: rawState.epInfo && typeof rawState.epInfo === 'object' ? rawState.epInfo : {},
      seenNotifications: Array.isArray(rawState.seenNotifications) ? rawState.seenNotifications : [],
      settings: rawState.settings && typeof rawState.settings === 'object'
        ? {
          searchLang: C.normalizeSearchLang(rawState.settings.searchLang),
          translationProvider: normalizeTranslationProvider(rawState.settings.translationProvider),
          catalog: normalizeCatalogPreferences(rawState.settings.catalog),
        }
        : { searchLang: 'auto', translationProvider: 'auto', catalog: normalizeCatalogPreferences() },
    };

    const moments = {};
    if (data.moments && typeof data.moments === 'object' && !Array.isArray(data.moments)) {
      for (const [key, list] of Object.entries(data.moments)) {
        if (!Array.isArray(list)) continue;
        const items = list.map(normalizeMoment).filter(Boolean).slice(0, MOMENTS_PER_ANIME);
        if (items.length) moments[key] = items;
      }
    }

    const translations = {};
    if (data.translations && typeof data.translations === 'object' && !Array.isArray(data.translations)) {
      for (const [key, value] of Object.entries(data.translations)) {
        if (typeof value === 'string' && value && value.length < 4000) translations[key] = value;
      }
    }

    const nextValues = new Map([
      [LS_KEY, JSON.stringify(cleanState)],
      [MOMENTS_KEY, JSON.stringify(moments)],
      [TRANSLATIONS_KEY, Object.keys(translations).length ? JSON.stringify(translations) : null],
    ]);
    let previousValues;
    try {
      previousValues = new Map([...nextValues.keys()].map(key => [key, localStorage.getItem(key)]));
    } catch {
      throw new Error('Не удалось прочитать текущие данные перед восстановлением.');
    }

    try {
      for (const [key, value] of nextValues) {
        if (value == null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      }
    } catch {
      let rollbackFailed = false;
      for (const [key, value] of previousValues) {
        try {
          if (value == null) localStorage.removeItem(key);
          else localStorage.setItem(key, value);
        } catch { rollbackFailed = true; }
      }
      loadState();
      loadMoments();
      if (App.reloadTranslationCache) App.reloadTranslationCache();
      throw new Error(rollbackFailed
        ? 'Не удалось восстановить копию или вернуть прежние данные. Проверьте хранилище браузера.'
        : 'Браузер не смог записать копию: не хватает места. Прежние данные возвращены.');
    }

    loadState();
    loadMoments();
    if (App.reloadTranslationCache) App.reloadTranslationCache();
    refreshViews();
    return {
      cards: state.customCards.length,
      moments: Object.keys(state.moments).length,
    };
  }

  /* ---------------- IndexedDB для картинок и медиа ---------------- */
  let mediaDbPromise = null;

  function openMediaDB() {
    if (mediaDbPromise) return mediaDbPromise;
    mediaDbPromise = new Promise(resolve => {
      if (typeof indexedDB === 'undefined') { resolve(null); return; }
      let request = null;
      try { request = indexedDB.open(MEDIA_DB, MEDIA_DB_VERSION); } catch { resolve(null); return; }
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('images')) db.createObjectStore('images');
        if (!db.objectStoreNames.contains('media')) db.createObjectStore('media');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    });
    return mediaDbPromise;
  }

  async function mediaPut(storeName, key, value) {
    const db = await openMediaDB();
    if (!db) return false;
    return new Promise(resolve => {
      try {
        const tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).put(value, key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
        tx.onabort = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }

  async function mediaGet(storeName, key) {
    const db = await openMediaDB();
    if (!db) return null;
    return new Promise(resolve => {
      try {
        const tx = db.transaction(storeName, 'readonly');
        const request = tx.objectStore(storeName).get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  async function mediaDelete(storeName, key) {
    const db = await openMediaDB();
    if (!db) return false;
    return new Promise(resolve => {
      try {
        const tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).delete(key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }

  async function mediaEntries() {
    const db = await openMediaDB();
    if (!db) throw new Error('Хранилище медиа недоступно.');
    return new Promise((resolve, reject) => {
      const entries = [];
      try {
        const tx = db.transaction(['images', 'media'], 'readonly');
        for (const storeName of ['images', 'media']) {
          const request = tx.objectStore(storeName).openCursor();
          request.onsuccess = () => {
            const cursor = request.result;
            if (!cursor) return;
            if (cursor.value instanceof Blob) entries.push({ store: storeName, key: String(cursor.key), blob: cursor.value });
            cursor.continue();
          };
        }
        tx.oncomplete = () => resolve(entries);
        tx.onerror = tx.onabort = () => reject(new Error('Не удалось прочитать медиа из хранилища.'));
      } catch (error) { reject(error); }
    });
  }

  async function mediaPutMany(entries) {
    const db = await openMediaDB();
    if (!db) throw new Error('Хранилище медиа недоступно.');
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(['images', 'media'], 'readwrite');
        for (const entry of entries) tx.objectStore(entry.store).put(entry.blob, entry.key);
        tx.oncomplete = () => resolve(entries.length);
        tx.onerror = tx.onabort = () => reject(new Error('Не удалось записать медиа. Исходные файлы сохранены.'));
      } catch (error) { reject(error); }
    });
  }

  function loadState() {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch { raw = null; }
    if (!raw) {
      state.lists.watched = emptyTiers();
      state.lists.planned = emptyTiers();
      state.progress = {};
      state.epInfo = {};
      state.seenNotifications = new Set();
      state.customCards = [];
      state.settings.searchLang = 'auto';
      state.settings.catalog = normalizeCatalogPreferences();
      return;
    }
    state.lists.watched = normalizeTiers(raw.watched);
    state.lists.planned = normalizeTiers(raw.planned);
    const customSeen = new Set();
    state.customCards = (Array.isArray(raw.customCards) ? raw.customCards : [])
      .map(normalizeCustomCard)
      .filter(card => {
        if (!card || customSeen.has(card.id)) return false;
        customSeen.add(card.id);
        return true;
      })
      .slice(0, CUSTOM_LIMIT);
    state.seenNotifications = new Set(Array.isArray(raw.seenNotifications) ? raw.seenNotifications : []);
    state.settings.searchLang = C.normalizeSearchLang(raw.settings && raw.settings.searchLang);
    state.settings.translationProvider = normalizeTranslationProvider(raw.settings && raw.settings.translationProvider);
    state.settings.catalog = normalizeCatalogPreferences(raw.settings && raw.settings.catalog);

    state.progress = {};
    if (raw.progress && typeof raw.progress === 'object') {
      for (const [key, val] of Object.entries(raw.progress)) {
        const arr = Array.isArray(val?.watched) ? val.watched : [];
        const watched = [...new Set(arr.map(Number).filter(n => Number.isInteger(n) && n > 0))].sort((a, b) => a - b);
        if (watched.length) state.progress[key] = { watched, updated: Number(val.updated) || 0 };
      }
    }

    state.epInfo = {};
    if (raw.epInfo && typeof raw.epInfo === 'object') {
      for (const [key, val] of Object.entries(raw.epInfo)) {
        if (val && Number.isFinite(Number(val.count))) {
          state.epInfo[key] = { ...val, source: val.source === 'demo' ? 'demo' : 'api' };
        }
      }
    }
  }

  function saveState() {
    try {
      const epInfo = {};
      const cutoff = Date.now() - 7 * 86400000;
      for (const [key, val] of Object.entries(state.epInfo)) {
        if (val && Number(val.fetchedAt) > cutoff) epInfo[key] = val;
      }
      localStorage.setItem(LS_KEY, JSON.stringify({
        watched: state.lists.watched,
        planned: state.lists.planned,
        customCards: state.customCards,
        progress: state.progress,
        epInfo,
        seenNotifications: [...state.seenNotifications],
        settings: {
          searchLang: C.normalizeSearchLang(state.settings.searchLang),
          translationProvider: normalizeTranslationProvider(state.settings.translationProvider),
          catalog: normalizeCatalogPreferences(state.settings.catalog),
        },
      }));
    } catch (err) {
      console.warn('localStorage', err);
      toast('Не удалось сохранить список: браузер не даёт место');
    }
  }

  function allIn(name) {
    return TIER_IDS.flatMap(t => state.lists[name][t] || []);
  }
  function hasIn(name, id) {
    return TIER_IDS.some(t => (state.lists[name][t] || []).some(a => a.id === id));
  }
  function findTier(name, id) {
    for (const t of TIER_IDS) {
      if ((state.lists[name][t] || []).some(a => a.id === id)) return t;
    }
    return null;
  }
  function getAnime(id) {
    const custom = state.customCards.find(card => card.id === id);
    if (custom) return custom;
    if (state.byId.has(id)) return state.byId.get(id);
    const n = state.notifications;
    const pools = [
      ...(n.tracked.episodes || []).map(group => group.anime),
      ...(n.tracked.seasons || []).flatMap(item => [item.anime, item.sequel]),
      ...(n.recent.episodes || []).map(group => group.anime),
      ...(n.recent.films || []),
      ...(n.completed || []),
      state.db.items,
      state.upcoming.items,
    ];
    for (const p of pools) {
      const found = p.find(a => a && a.id === id);
      if (found) return found;
    }
    for (const name of ['watched', 'planned']) {
      for (const t of TIER_IDS) {
        const found = (state.lists[name][t] || []).find(a => a.id === id);
        if (found) return found;
      }
    }
    return null;
  }

  function watchedSet(id) {
    const p = state.progress[id];
    return new Set(p && Array.isArray(p.watched) ? p.watched : []);
  }

  function watchedCount(id) {
    const p = state.progress[id];
    return p && Array.isArray(p.watched) ? p.watched.length : 0;
  }

  function toggleEpisode(id, ep) {
    const p = state.progress[id] || { watched: [] };
    const set = new Set(p.watched || []);
    if (set.has(ep)) set.delete(ep); else set.add(ep);
    const watched = [...set].filter(n => Number.isInteger(n) && n > 0).sort((a, b) => a - b);
    if (watched.length) state.progress[id] = { watched, updated: Date.now() };
    else delete state.progress[id];
    saveState();
    updateEpisodeUI(id);
  }

  function setWatchedUpTo(id, n, max) {
    const limit = Math.max(0, Math.min(Number(n) || 0, Number(max) || 0));
    if (limit <= 0) delete state.progress[id];
    else state.progress[id] = { watched: Array.from({ length: limit }, (_, i) => i + 1), updated: Date.now() };
    saveState();
    updateEpisodeUI(id);
  }

  function clearProgress(id) {
    delete state.progress[id];
    saveState();
    updateEpisodeUI(id);
  }

  function episodeStats(a) {
    const info = state.epInfo[a.id] || null;
    const planned = Number(a.episodes) || Number(info?.total) || null;
    const ongoing = a.status === 'В эфире';
    let available = 0;
    if (ongoing) available = info ? Math.max(0, Number(info.count) || 0) : 0;
    else available = planned || (info ? Math.max(0, Number(info.count) || 0) : 0);
    return { info, total: planned, available, ongoing };
  }

  const epWord = (n) => plural(n, 'серия', 'серии', 'серий');

  function addToList(name, anime, tier = 'N', silent = false) {
    if (!anime) return;
    const t = TIER_IDS.includes(tier) ? tier : 'N';
    const other = name === 'watched' ? 'planned' : 'watched';
    removeFromList(other, anime.id, true);
    for (const k of TIER_IDS) state.lists[name][k] = state.lists[name][k].filter(x => x.id !== anime.id);
    state.lists[name][t].unshift(snapshotAnime(anime));
    state.byId.set(anime.id, anime);
    saveState();
    refreshViews();
    if (!silent) {
      const names = { watched: 'Просмотрено', planned: 'Запланировано' };
      toast(`«${anime.title}» → ${names[name]}${t !== 'N' ? ' · тир ' + (t === 'N' ? '?' : t) : ''}`);
    }
  }

  function removeFromList(name, id, silent = false) {
    let removed = false;
    for (const k of TIER_IDS) {
      const before = state.lists[name][k].length;
      state.lists[name][k] = state.lists[name][k].filter(x => x.id !== id);
      if (state.lists[name][k].length !== before) removed = true;
    }
    if (removed && !silent) {
      saveState();
      refreshViews();
    }
    return removed;
  }

  function moveToTier(name, id, tier) {
    if (!TIER_IDS.includes(tier)) return;
    let entry = null;
    for (const k of TIER_IDS) {
      const idx = state.lists[name][k].findIndex(x => x.id === id);
      if (idx >= 0) {
        entry = state.lists[name][k].splice(idx, 1)[0];
        break;
      }
    }
    if (!entry) return;
    state.lists[name][tier].unshift(entry);
    saveState();
    refreshViews();
  }

  function toggleList(name, anime) {
    if (!anime) return;
    if (hasIn(name, anime.id)) {
      removeFromList(name, anime.id);
      toast(`«${anime.title}» убрано из списка «${name === 'watched' ? 'Просмотрено' : 'Запланировано'}»`);
    } else {
      addToList(name, anime);
    }
  }

  Object.assign(App, {
    LS_KEY,
    MOMENTS_KEY,
    TRANSLATIONS_KEY,
    CUSTOM_LIMIT,
    MOMENTS_PER_ANIME,
    CUSTOM_IMAGE_MAX,
    MOMENT_VIDEO_MAX,
    MOMENT_GIF_MAX,
    MEDIA_DB,
    MEDIA_DB_VERSION,
    PAGE_LIMIT,
    LONG_TITLE_EPS,
    ANILIST_TIMEOUT,
    SEARCH_TIMEOUT,
    ANILIST_ENDPOINT,
    KITSU_ENDPOINT,
    ANILIST_QUERY,
    ANILIST_TRACKED_QUERY,
    ANILIST_SCHEDULE_QUERY,
    TEST_MODE,
    TIERS,
    TIER_IDS,
    LIST_LABELS,
    EXCHANGE_FILTERS,
    TYPE_RU,
    typeRu,
    MONTHS_SHORT,
    MONTHS_FULL,
    VIEW_TABS,
    RU_TITLES,
    DEMO_BASE,
    $,
    $$,
    esc,
    escXml,
    hash,
    plural,
    epWord,
    sleep,
    startOfToday,
    endOfToday,
    startOfTomorrow,
    addDays,
    daysBetween,
    parseDate,
    fuzzyDateInt,
    monthLabel,
    dateShort,
    countdownLabel,
    relativePast,
    makePoster,
    posterCache,
    state,
    emptyTiers,
    createAltSearchState,
    normalizeTiers,
    snapshotAnime,
    newUid,
    nextCustomId,
    normalizeCustomCard,
    getCustomCard,
    upsertCustomCard,
    deleteCustomCard,
    normalizeMoment,
    loadMoments,
    saveMoments,
    momentsFor,
    findMoment,
    addMoment,
    removeMoment,
    buildBackupPayload,
    applyBackupData,
    openMediaDB,
    mediaPut,
    mediaGet,
    mediaDelete,
    mediaEntries,
    mediaPutMany,
    loadState,
    saveState,
    allIn,
    hasIn,
    findTier,
    getAnime,
    addToList,
    removeFromList,
    moveToTier,
    toggleList,
    watchedSet,
    watchedCount,
    toggleEpisode,
    setWatchedUpTo,
    clearProgress,
    episodeStats,
  });
})(window.AniTier = window.AniTier || {});
