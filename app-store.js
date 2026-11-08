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
  /* Версия схемы сохранения. Старые копии без поля читаются как 0. */
  const SCHEMA_VERSION = 1;
  const SAVE_DEBOUNCE_MS = 350;
  let saveTimer = 0;
  let savePending = false;
  let saveErrorAt = 0;
  const localImageUrls = new Map();
  const MOMENTS_KEY = 'anitier.moments.v1';
  const TRANSLATIONS_KEY = 'anitier.translations.v1';
  const CUSTOM_LIMIT = 100;
  const MOMENTS_PER_ANIME = 24;
  const CUSTOM_IMAGE_MAX = 12 * 1024 * 1024;
  const MOMENT_VIDEO_MAX = 40 * 1024 * 1024;
  const MOMENT_GIF_MAX = 12 * 1024 * 1024;
  const MEDIA_DB = 'anitier-media';
  const MEDIA_DB_VERSION = 3;
  const POSTER_CACHE_LIMIT = 600;
  const POSTER_CACHE_WIDTH = 240;
  const POSTER_CACHE_HEIGHT = 360;
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
    $idMal_in: [Int],
    $id_in: [Int],
    $status: MediaStatus,
    $status_in: [MediaStatus],
    $format: MediaFormat,
    $format_in: [MediaFormat],
    $seasonYear: Int,
    $genre: String,
    $genre_in: [String],
    $tag_in: [String],
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
        idMal_in: $idMal_in,
        id_in: $id_in,
        status: $status,
        status_in: $status_in,
        format: $format,
        format_in: $format_in,
        seasonYear: $seasonYear,
        genre: $genre,
        genre_in: $genre_in,
        tag_in: $tag_in,
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
        tags { name rank isMediaSpoiler }
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
        tags { name rank isMediaSpoiler }
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
              tags { name rank isMediaSpoiler }
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
          tags { name rank isMediaSpoiler }
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

  const UPDATE_CHECK_MODES = ['ask', 'on', 'off'];

  /* 'ask' — спросить разрешение один раз, 'on' — проверять при запуске, 'off' — не проверять. */
  function normalizeUpdateCheck(value) {
    const key = String(value == null ? '' : value).trim().toLowerCase();
    return UPDATE_CHECK_MODES.includes(key) ? key : 'ask';
  }

  function normalizeCatalogPreferences(raw) {
    const value = raw && typeof raw === 'object' ? raw : {};
    return {
      tab: VIEW_TABS.includes(value.tab) ? value.tab : 'db',
      mode: DB_MODES.includes(value.mode) ? value.mode : 'popular',
      sort: C.normalizeDBSort(value.sort),
      hideMine: Boolean(value.hideMine),
      query: String(value.query == null ? '' : value.query).trim().slice(0, 160),
      filters: C.normalizeFilters(value.filters),
    };
  }

  /* Все настройки читаются и пишутся через одну функцию: иначе сохранение
     и восстановление расходятся, как это было с темой и языками. */
  function normalizeSettings(raw) {
    const value = raw && typeof raw === 'object' ? raw : {};
    return {
      searchLang: C.normalizeSearchLang(value.searchLang),
      titleLang: value.titleLang === 'original' ? 'original' : 'ru',
      synopsisLang: value.synopsisLang === 'original' ? 'original' : 'translated',
      translationProvider: normalizeTranslationProvider(value.translationProvider),
      updateCheck: normalizeUpdateCheck(value.updateCheck),
      lastUpdateCheck: Number(value.lastUpdateCheck) || 0,
      driveAutoBackup: Boolean(value.driveAutoBackup),
      lastDriveBackupAt: Number(value.lastDriveBackupAt) || 0,
      lastDriveBackupTry: Number(value.lastDriveBackupTry) || 0,
      theme: value.theme === 'amoled' ? 'amoled' : 'dark',
      density: value.density === 'compact' ? 'compact' : 'comfortable',
      fontSize: ['small', 'large'].includes(value.fontSize) ? value.fontSize : 'normal',
      searchHistory: Array.isArray(value.searchHistory)
        ? value.searchHistory.map(item => String(item == null ? '' : item).trim()).filter(Boolean).slice(0, 8)
        : [],
      catalog: normalizeCatalogPreferences(value.catalog),
    };
  }

  /* Русские названия лежат в titles-ru.js: данные отдельно от логики. */
  const RU_TITLES = (typeof window !== 'undefined' && window.AniTierTitlesRu && typeof window.AniTierTitlesRu === 'object')
    ? window.AniTierTitlesRu
    : {};
  const RU_TITLES_ANILIST = (typeof window !== 'undefined' && window.AniTierTitlesRuAniList && typeof window.AniTierTitlesRuAniList === 'object')
    ? window.AniTierTitlesRuAniList
    : {};

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
    const h2 = (h + 42) % 360;
    const h3 = (h + 84) % 360;
    const raw = String(title || '?').replace(/\s+/g, ' ').trim();
    const letter = (raw.charAt(0) || '?').toUpperCase();
    const words = raw.split(' ').filter(Boolean);
    const line1 = escXml(words.slice(0, 4).join(' ').slice(0, 36));
    const line2 = escXml(words.slice(4, 8).join(' ').slice(0, 36));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="540" viewBox="0 0 360 540">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="hsl(${h},72%,34%)"/>
<stop offset="0.55" stop-color="hsl(${h2},68%,16%)"/>
<stop offset="1" stop-color="hsl(${h3},74%,10%)"/>
</linearGradient>
<radialGradient id="r" cx="0.8" cy="0.2" r="0.7">
<stop offset="0" stop-color="hsl(${h2},95%,68%)" stop-opacity=".18"/>
<stop offset="1" stop-color="hsl(${h2},95%,68%)" stop-opacity="0"/>
</radialGradient>
<linearGradient id="f" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#000" stop-opacity="0"/>
<stop offset="0.7" stop-color="#000" stop-opacity=".5"/>
<stop offset="1" stop-color="#000" stop-opacity=".88"/>
</linearGradient>
</defs>
<rect width="360" height="540" fill="url(#g)"/>
<rect width="360" height="540" fill="url(#r)"/>
<circle cx="46" cy="486" r="148" fill="hsl(${h},92%,62%)" opacity=".12"/>
<g opacity=".06" stroke="#fff" stroke-width="1">
<path d="M0 108h360M0 216h360M0 324h360M0 432h360"/>
<path d="M72 0v540M144 0v540M216 0v540M288 0v540"/>
</g>
<text x="180" y="292" font-family="Manrope,Segoe UI,Arial,sans-serif" font-size="156" font-weight="800" fill="#ffffff" fill-opacity=".92" text-anchor="middle">${escXml(letter)}</text>
<rect y="356" width="360" height="184" fill="url(#f)"/>
${line2 ? `<text x="180" y="478" font-family="Manrope,Segoe UI,Arial,sans-serif" font-size="15" font-weight="700" fill="#ffffff" fill-opacity=".88" text-anchor="middle">${line2}</text>` : ''}
<text x="180" y="${line2 ? 500 : 488}" font-family="Manrope,Segoe UI,Arial,sans-serif" font-size="${line2 ? 15 : 16}" font-weight="800" fill="#ffffff" text-anchor="middle">${line1}</text>
<text x="180" y="522" font-family="Manrope,Segoe UI,Arial,sans-serif" font-size="9" letter-spacing="6" fill="#ffffff" fill-opacity=".42" text-anchor="middle">ANITIER</text>
</svg>`;
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    posterCache.set(key, url);
    return url;
  }

  window.posterFallback = function (img) {
    img.onerror = null;
    const remote = img.dataset ? img.dataset.posterSrc : '';
    if (!remote) {
      img.src = makePoster(img.dataset.title || 'Anime', img.dataset.id || '0');
      return;
    }
    posterCachedUrl(remote).then(url => {
      if (url) {
        img.src = url;
        return;
      }
      img.src = makePoster(img.dataset.title || 'Anime', img.dataset.id || '0');
    });
  };

  /* Кэш постеров: уменьшенные копии лежат в IndexedDB, чтобы карточки
     открывались без сети. В памяти держим object URL, иначе каждая
     ошибка загрузки создавала бы новый URL на тот же blob. */
  const posterObjectUrls = new Map();
  const posterMisses = new Set();

  function isBlobLike(value) {
    return Boolean(value) && typeof value.size === 'number' && typeof value.type === 'string';
  }

  async function posterCachedUrl(url) {
    const src = String(url || '');
    if (!/^https?:/i.test(src)) return null;
    if (posterObjectUrls.has(src)) return posterObjectUrls.get(src);
    if (posterMisses.has(src)) return null;
    const blob = await mediaGet('posters', src);
    if (!isBlobLike(blob) || !blob.size) {
      posterMisses.add(src);
      return null;
    }
    const objectUrl = URL.createObjectURL(blob);
    posterObjectUrls.set(src, objectUrl);
    return objectUrl;
  }

  /** После записи в кэш убираем отметку «не найдено», иначе fallback её не увидит. */
  function markPosterCached(url) {
    const src = String(url || '');
    posterMisses.delete(src);
  }

  /** Удаляет самые старые записи кэша, когда их больше лимита. */
  async function prunePosters(limit = POSTER_CACHE_LIMIT) {
    const db = await openMediaDB();
    if (!db) return 0;
    const max = Math.max(0, Math.trunc(Number(limit) || 0));
    return new Promise(resolve => {
      let removed = 0;
      try {
        const tx = db.transaction('posters', 'readwrite');
        const store = tx.objectStore('posters');
        const countRequest = store.count();
        countRequest.onsuccess = () => {
          const extra = Math.max(0, countRequest.result - max);
          if (!extra) return;
          const cursorRequest = store.openCursor();
          cursorRequest.onsuccess = () => {
            const cursor = cursorRequest.result;
            if (!cursor || removed >= extra) return;
            cursor.delete();
            removed += 1;
            cursor.continue();
          };
        };
        tx.oncomplete = () => resolve(removed);
        tx.onerror = tx.onabort = () => resolve(removed);
      } catch {
        resolve(removed);
      }
    });
  }

  async function clearPosterStore() {
    for (const url of posterObjectUrls.values()) {
      try { URL.revokeObjectURL(url); } catch { /* noop */ }
    }
    posterObjectUrls.clear();
    posterMisses.clear();
    const db = await openMediaDB();
    if (!db || !db.objectStoreNames.contains('posters')) return false;
    return new Promise(resolve => {
      try {
        const tx = db.transaction('posters', 'readwrite');
        tx.objectStore('posters').clear();
        tx.oncomplete = () => resolve(true);
        tx.onerror = tx.onabort = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }

  /* ---------------- состояние ---------------- */
  const state = {
    tab: 'db',
    offline: false,
    forceDemo: new URLSearchParams(location.search).has('demo'),
    settings: {
      searchLang: 'auto',
      titleLang: 'ru',
      synopsisLang: 'translated',
      translationProvider: 'auto',
      updateCheck: 'ask',
      lastUpdateCheck: 0,
      driveAutoBackup: false,
      lastDriveBackupAt: 0,
      lastDriveBackupTry: 0,
      theme: 'dark',
      density: 'comfortable',
      fontSize: 'normal',
      searchHistory: [],
      catalog: normalizeCatalogPreferences(),
    },
    modalId: null,
    modalTab: 'overview',
    continueCollapsed: false,
    quickMenu: null,
    command: { open: false, query: '', index: 0, results: [] },
    exchange: {
      open: false,
      mode: 'export',
      list: 'watched',
      code: '',
      parsed: null,
      comparison: null,
      filter: 'all',
      error: '',
      importBusy: false,
      importError: '',
      importPlan: null,
      importResult: null,
      importSource: '',
      importToken: 0,
      pngBusy: false,
    },
    byId: new Map(),
    franchiseById: new Map(),
    franchiseLoading: new Set(),
    franchiseErrors: new Map(),
    franchiseExpanded: new Set(),
    franchiseFullById: new Map(),
    franchiseFullLoading: new Set(),
    synopsisModes: new Map(),
    synopsisTranslating: new Set(),
    customCards: [],
    moments: {},
    customForm: { open: false, editingId: null, error: '', busy: false },
    momentForm: { open: false, animeId: null, mode: 'tiktok', error: '', busy: false, url: '', title: '' },
    tiktokImport: { open: false, url: '', title: '', thumb: '', query: '', loading: false },
    backup: { open: false, busy: false, message: '', error: false },
    settingsScreen: { open: false, checking: false, message: '', error: false, latest: null },
    updateCard: null,
    lists: { watched: emptyTiers(), planned: emptyTiers() },
    /* Поиск и фильтры внутри «Просмотрено» и «Запланировано». Фильтры и
       порядок сохраняются между запусками, поисковый запрос — нет. */
    listViews: { watched: emptyListView(), planned: emptyListView() },
    progress: {},
    epInfo: {},
    seenNotifications: new Set(),
    booting: true,
    bootstrapDone: false,
    db: {
      mode: 'popular',
      sort: 'default',
      hideMine: false,
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
    upcoming: {
      items: [],
      loading: false,
      loaded: false,
      error: null,
      queued: false,
      view: { query: '', filters: { type: '', genre: '', year: '', minScore: '', status: '' }, month: '', sort: 'date', mine: false },
    },
  };

  function emptyTiers() {
    const o = {};
    for (const t of TIER_IDS) o[t] = [];
    return o;
  }

  function normalizeListView(raw) {
    const value = raw && typeof raw === 'object' ? raw : {};
    return {
      query: '',
      filters: C.normalizeFilters(value.filters),
      sort: C.normalizeListSort(value.sort),
    };
  }

  function emptyListView() {
    return normalizeListView(null);
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
    const imageKey = String((a && a.imageKey) || '').trim().slice(0, 160);
    const rawImage = String((a && a.image) || '');
    const image = isDataImageUrl(rawImage) && imageKey ? '' : (isDataImageUrl(rawImage) ? rawImage : rawImage);
    return {
      id: a.id,
      malId: a.malId ?? null,
      title: a.title,
      titleRu: a.titleRu || '',
      altTitle: a.altTitle || '',
      originalTitle: a.originalTitle || '',
      image,
      imageKey,
      custom: Boolean(a.custom),
      customId: a.customId || '',
      episodes: a.episodes ?? null,
      airedEpisodes: a.airedEpisodes == null ? null : Math.max(0, Number(a.airedEpisodes) || 0),
      nextEpisode: a.nextEpisode && a.nextEpisode.date
        ? {
          n: Number(a.nextEpisode.n) > 0 ? Number(a.nextEpisode.n) : null,
          date: String(a.nextEpisode.date).slice(0, 40),
        }
        : null,
      type: a.type || '',
      status: a.status || '',
      score: typeof a.score === 'number' ? a.score : null,
      year: a.year || null,
      airedFrom: a.airedFrom || null,
      airedTo: a.airedTo || null,
      synopsis: a.synopsis ? String(a.synopsis).slice(0, 700) : '',
      genres: Array.isArray(a.genres) ? a.genres.slice(0, 12) : [],
      tags: Array.isArray(a.tags) ? a.tags.slice(0, 24) : [],
      spoilerTags: Array.isArray(a.spoilerTags) ? a.spoilerTags.slice(0, 12) : [],
      studios: Array.isArray(a.studios) ? a.studios.slice(0, 6) : [],
      url: a.url || '',
      source: a.source || '',
      sourceId: a.sourceId ?? null,
      demo: Boolean(a.demo),
      addedAt: Number(a.addedAt) || 0,
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
    /* Свои карточки живут в диапазоне -1..-999999. ID источников занимают
       -(1000000 + id) и -(2000000 + id), поэтому глобальный минимум по спискам
       использовать нельзя: он мог дать ID, совпадающий с ID источника. */
    let min = 0;
    for (const card of state.customCards) {
      const id = Number(card.id);
      if (Number.isInteger(id) && id < 0 && id > -1000000 && id < min) min = id;
    }
    const next = min - 1;
    return next > -1000000 ? next : -1;
  }

  function normalizeCustomCard(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const id = Number(raw.id);
    const title = String(raw.title == null ? '' : raw.title).trim().slice(0, 300);
    if (!Number.isInteger(id) || id >= 0 || !title) return null;
    const customId = String(raw.customId || '').trim().slice(0, 100) || `legacy-${Math.abs(id)}`;
    const imageKey = String(raw.imageKey || '').trim().slice(0, 160);
    const legacyImage = isDataImageUrl(raw.image) ? String(raw.image) : '';
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
      imageKey,
      image: legacyImage || resolveLocalImageUrl(imageKey, ''),
      episodes: Number.isFinite(episodes) && episodes > 0 ? Math.floor(episodes) : null,
      type: String(raw.type == null ? '' : raw.type).trim().slice(0, 40),
      status: String(raw.status == null ? '' : raw.status).trim().slice(0, 40),
      score: Number.isFinite(score) && score >= 0 && score <= 10 ? score : null,
      year: Number.isFinite(year) && year > 0 ? Math.floor(year) : null,
      airedFrom: null,
      airedTo: null,
      synopsis: String(raw.synopsis == null ? '' : raw.synopsis).trim().slice(0, 2000),
      genres,
      tags: [],
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
    const thumbKey = String(raw.thumbKey || '').trim().slice(0, 160);
    const rawThumb = typeof raw.thumb === 'string' ? raw.thumb : '';
    const httpsThumb = /^https:\/\//i.test(rawThumb) && rawThumb.length < 2048 ? rawThumb : '';
    const legacyThumb = isDataImageUrl(rawThumb) ? rawThumb : '';
    const size = Number(raw.size);
    return {
      id,
      kind,
      title: String(raw.title == null ? '' : raw.title).trim().slice(0, 200),
      url,
      videoId: kind === 'tiktok' ? String(raw.videoId || '').replace(/[^0-9]/g, '').slice(0, 32) : '',
      mediaKey,
      thumbKey,
      thumb: httpsThumb || legacyThumb || resolveLocalImageUrl(thumbKey, ''),
      mime: String(raw.mime || '').slice(0, 100),
      size: Number.isFinite(size) && size > 0 ? Math.floor(size) : 0,
      createdAt: Number(raw.createdAt) || Date.now(),
    };
  }

  function serializeMoment(moment) {
    const out = { ...moment };
    if (isDataImageUrl(out.thumb)) delete out.thumb;
    if (!out.thumbKey) delete out.thumbKey;
    if (!out.thumb) delete out.thumb;
    if (!out.mediaKey) delete out.mediaKey;
    if (!out.videoId) delete out.videoId;
    if (!out.mime) delete out.mime;
    if (!out.size) delete out.size;
    if (!out.url) delete out.url;
    return out;
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

  function serializeMomentsMap() {
    const out = {};
    for (const [key, list] of Object.entries(state.moments || {})) {
      if (!Array.isArray(list) || !list.length) continue;
      out[key] = list.map(serializeMoment);
    }
    return out;
  }

  function saveMoments() {
    try {
      localStorage.setItem(MOMENTS_KEY, JSON.stringify(serializeMomentsMap()));
    } catch (err) {
      console.warn('moments', err);
      reportSaveError(err);
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
    saveStateNow();
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
      schemaVersion: SCHEMA_VERSION,
      watched: rawState.watched && typeof rawState.watched === 'object' ? rawState.watched : {},
      planned: rawState.planned && typeof rawState.planned === 'object' ? rawState.planned : {},
      customCards: Array.isArray(rawState.customCards) ? rawState.customCards : [],
      progress: rawState.progress && typeof rawState.progress === 'object' ? rawState.progress : {},
      epInfo: rawState.epInfo && typeof rawState.epInfo === 'object' ? rawState.epInfo : {},
      seenNotifications: Array.isArray(rawState.seenNotifications) ? rawState.seenNotifications : [],
      listViews: {
        watched: normalizeListView(rawState.listViews && rawState.listViews.watched),
        planned: normalizeListView(rawState.listViews && rawState.listViews.planned),
      },
      settings: normalizeSettings(rawState.settings),
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
        if (!db.objectStoreNames.contains('posters')) db.createObjectStore('posters');
        if (!db.objectStoreNames.contains('titles')) db.createObjectStore('titles');
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

  function isDataImageUrl(value) {
    return typeof value === 'string' && /^data:image\//i.test(value);
  }

  async function dataUrlToBlob(dataUrl) {
    const res = await fetch(String(dataUrl || ''));
    return res.blob();
  }

  function customThumbKey(card) {
    const id = card && (card.customId || card.id);
    return id ? `custom:${id}:thumb` : '';
  }

  function momentThumbKey(moment) {
    const id = moment && moment.id;
    return id ? `moment:${id}:thumb` : '';
  }

  function resolveLocalImageUrl(key, value) {
    if (isDataImageUrl(value)) return value;
    if (key && localImageUrls.has(key)) return localImageUrls.get(key);
    if (typeof value === 'string' && /^https?:\/\//i.test(value)) return value;
    return '';
  }

  function setLocalImageUrl(key, url) {
    if (!key) return;
    if (!url) localImageUrls.delete(key);
    else localImageUrls.set(key, url);
  }

  async function hydrateLocalImage(key) {
    if (!key) return '';
    if (localImageUrls.has(key)) return localImageUrls.get(key);
    const blob = await mediaGet('images', key);
    if (!isBlobLike(blob) || !blob.size) return '';
    const url = URL.createObjectURL(blob);
    localImageUrls.set(key, url);
    return url;
  }

  function syncCustomImageToLists(id, image, imageKey) {
    if (!id) return;
    for (const name of ['watched', 'planned']) {
      for (const t of TIER_IDS) {
        for (const item of state.lists[name][t] || []) {
          if (item && item.id === id) {
            if (imageKey && !item.imageKey) item.imageKey = imageKey;
            if (image && !isDataImageUrl(image)) item.image = image;
          }
        }
      }
    }
  }

  async function hydrateCardThumbnails(cards) {
    const list = Array.isArray(cards) ? cards : [];
    let changed = false;
    for (const card of list) {
      const key = String((card && (card.imageKey || customThumbKey(card))) || '').trim();
      if (!key || !card || isDataImageUrl(card.image)) continue;
      const url = await hydrateLocalImage(key);
      if (url && card.image !== url) { card.image = url; changed = true; }
      if (key && !card.imageKey) { card.imageKey = key; changed = true; }
      if (card.id && (card.image || card.imageKey)) syncCustomImageToLists(card.id, card.image, card.imageKey);
    }
    return changed;
  }

  async function hydrateMomentThumbnails() {
    let changed = false;
    for (const list of Object.values(state.moments || {})) {
      if (!Array.isArray(list)) continue;
      for (const moment of list) {
        if (!moment || !moment.thumbKey || /^https?:\/\//i.test(moment.thumb || '')) continue;
        const url = await hydrateLocalImage(moment.thumbKey);
        if (url && moment.thumb !== url) { moment.thumb = url; changed = true; }
      }
    }
    return changed;
  }

  async function migrateLocalThumbnails() {
    if (typeof indexedDB === 'undefined') return { migratedCards: 0, migratedMoments: 0 };
    let migratedCards = 0;
    let migratedMoments = 0;
    let changed = false;

    for (const card of state.customCards || []) {
      if (!card) continue;
      const key = customThumbKey(card);
      if (!key) continue;
      if (isDataImageUrl(card.image) && !card.imageKey) {
        try {
          const blob = await dataUrlToBlob(card.image);
          const stored = await mediaPut('images', key, blob);
          if (stored) {
            card.imageKey = key;
            setLocalImageUrl(key, card.image);
            migratedCards += 1;
            changed = true;
          }
        } catch (err) {
          console.warn('custom thumb migrate', err);
        }
      } else if (!card.imageKey && key) {
        card.imageKey = key;
      }
      if (card.imageKey && !isDataImageUrl(card.image)) {
        const url = await hydrateLocalImage(card.imageKey);
        if (url) card.image = url;
      }
    }

    for (const [animeId, list] of Object.entries(state.moments || {})) {
      if (!Array.isArray(list)) continue;
      for (const moment of list) {
        if (!moment) continue;
        if (isDataImageUrl(moment.thumb) && !moment.thumbKey) {
          const key = momentThumbKey(moment);
          try {
            const blob = await dataUrlToBlob(moment.thumb);
            const stored = await mediaPut('images', key, blob);
            if (stored) {
              moment.thumbKey = key;
              setLocalImageUrl(key, moment.thumb);
              migratedMoments += 1;
              changed = true;
            }
          } catch (err) {
            console.warn('moment thumb migrate', err);
          }
        } else if (moment.thumbKey && !/^https?:\/\//i.test(moment.thumb || '')) {
          const url = await hydrateLocalImage(moment.thumbKey);
          if (url) moment.thumb = url;
        }
      }
      void animeId;
    }

    if (changed) {
      saveStateNow();
      saveMoments();
    }
    await hydrateCardThumbnails(allIn('watched'));
    await hydrateCardThumbnails(allIn('planned'));
    await hydrateCardThumbnails(state.customCards);
    await hydrateMomentThumbnails();
    return { migratedCards, migratedMoments };
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

  function migrateState(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const version = Number(raw.schemaVersion);
    let next = { ...raw };
    /* schemaVersion отсутствует/0 — формат до явных миграций. Данные не теряем. */
    if (!Number.isFinite(version) || version < 1) {
      next = {
        ...next,
        watched: next.watched && typeof next.watched === 'object' ? next.watched : {},
        planned: next.planned && typeof next.planned === 'object' ? next.planned : {},
        customCards: Array.isArray(next.customCards) ? next.customCards : [],
        progress: next.progress && typeof next.progress === 'object' ? next.progress : {},
        epInfo: next.epInfo && typeof next.epInfo === 'object' ? next.epInfo : {},
        seenNotifications: Array.isArray(next.seenNotifications) ? next.seenNotifications : [],
        settings: next.settings && typeof next.settings === 'object' ? next.settings : {},
        listViews: next.listViews && typeof next.listViews === 'object' ? next.listViews : {},
        schemaVersion: 1,
      };
    }
    next.schemaVersion = SCHEMA_VERSION;
    return next;
  }

  function loadState() {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch { raw = null; }
    raw = migrateState(raw);
    if (!raw) {
      state.lists.watched = emptyTiers();
      state.lists.planned = emptyTiers();
      state.progress = {};
      state.epInfo = {};
      state.seenNotifications = new Set();
      state.customCards = [];
      Object.assign(state.settings, normalizeSettings(null));
      state.listViews = { watched: emptyListView(), planned: emptyListView() };
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
    Object.assign(state.settings, normalizeSettings(raw.settings));
    /* Старые сохранения без listViews читаются как «все фильтры сброшены». */
    state.listViews = {
      watched: normalizeListView(raw.listViews && raw.listViews.watched),
      planned: normalizeListView(raw.listViews && raw.listViews.planned),
    };

    state.progress = {};
    if (raw.progress && typeof raw.progress === 'object') {
      for (const [key, val] of Object.entries(raw.progress)) {
        const arr = Array.isArray(val && val.watched) ? val.watched : [];
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

  function isQuotaError(err) {
    if (!err) return false;
    return err.name === 'QuotaExceededError'
      || err.name === 'NS_ERROR_DOM_QUOTA_REACHED'
      || err.code === 22
      || err.code === 1014;
  }

  function reportSaveError(err) {
    console.warn('localStorage', err);
    const now = Date.now();
    if (now - saveErrorAt < 4000) return false;
    saveErrorAt = now;
    const quota = isQuotaError(err);
    toast(quota
      ? 'Не удалось сохранить данные: в хранилище браузера не хватает места. Освободите место или сделайте резервную копию и очистите кэш.'
      : 'Не удалось сохранить данные. Попробуйте ещё раз или сделайте резервную копию.');
    return quota;
  }

  function serializeCustomCard(card) {
    const out = { ...card };
    if (isDataImageUrl(out.image) && out.imageKey) out.image = '';
    if (!out.imageKey) delete out.imageKey;
    return out;
  }

  function serializeTierMap(tiers) {
    const out = {};
    for (const t of TIER_IDS) out[t] = (tiers && tiers[t] ? tiers[t] : []).map(snapshotAnime);
    return out;
  }

  function buildStatePayload() {
    const epInfo = {};
    const cutoff = Date.now() - 7 * 86400000;
    for (const [key, val] of Object.entries(state.epInfo)) {
      if (val && Number(val.fetchedAt) > cutoff) epInfo[key] = val;
    }
    return {
      schemaVersion: SCHEMA_VERSION,
      watched: serializeTierMap(state.lists.watched),
      planned: serializeTierMap(state.lists.planned),
      customCards: (state.customCards || []).map(serializeCustomCard),
      progress: state.progress,
      epInfo,
      seenNotifications: [...state.seenNotifications],
      listViews: {
        watched: normalizeListView(state.listViews && state.listViews.watched),
        planned: normalizeListView(state.listViews && state.listViews.planned),
      },
      settings: normalizeSettings(state.settings),
    };
  }

  function saveStateNow() {
    savePending = false;
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = 0; }
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(buildStatePayload()));
      return true;
    } catch (err) {
      reportSaveError(err);
      return false;
    }
  }

  function scheduleStateSave() {
    if ((TEST_MODE && !(App && App._testForceDebounce)) || (App && App._testImmediateSave)) return saveStateNow();
    savePending = true;
    if (saveTimer) return true;
    saveTimer = setTimeout(() => {
      saveTimer = 0;
      if (savePending) saveStateNow();
    }, SAVE_DEBOUNCE_MS);
    return true;
  }

  const saveState = scheduleStateSave;
  const flushStateSave = saveStateNow;

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
    /* Пулы — массивы тайтлов. Раньше здесь стоял spread, и .find вызывался
       у самих тайтлов: getAnime падал, если тайтла не было в byId. */
    const pools = [
      (n.tracked.episodes || []).map(group => group.anime),
      (n.tracked.seasons || []).flatMap(item => [item.anime, item.sequel]),
      (n.recent.episodes || []).map(group => group.anime),
      n.recent.films || [],
      n.completed || [],
      state.db.items,
      state.upcoming.items,
    ].filter(Array.isArray);
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

  /* Возврат прогресса для отмены действия из тоста. */
  function restoreProgress(id, watched) {
    const list = (Array.isArray(watched) ? watched : [])
      .map(Number)
      .filter(n => Number.isInteger(n) && n > 0)
      .sort((a, b) => a - b);
    if (list.length) state.progress[id] = { watched: [...new Set(list)], updated: Date.now() };
    else delete state.progress[id];
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
    const entry = snapshotAnime(anime);
    entry.addedAt = Date.now();
    state.lists[name][t].unshift(entry);
    state.byId.set(anime.id, anime);
    saveState();
    refreshViews();
    if (!silent) {
      const names = { watched: 'Просмотрено', planned: 'Запланировано' };
      toast(`«${anime.title}» → ${names[name]}${t !== 'N' ? ' · тир ' + (t === 'N' ? '?' : t) : ''}`);
    }
  }

  function importTrackedItems(entries) {
    const rows = Array.isArray(entries) ? entries : [];
    const skipped = [];
    let added = 0;
    for (const entry of rows) {
      const anime = entry && entry.anime;
      if (!anime || anime.id == null) continue;
      if (hasIn('watched', anime.id) || hasIn('planned', anime.id)) {
        skipped.push(anime);
        continue;
      }
      const name = entry.list === 'planned' ? 'planned' : 'watched';
      const tier = TIER_IDS.includes(entry.tier) ? entry.tier : 'N';
      const snapshot = snapshotAnime(anime);
      snapshot.addedAt = Date.now();
      state.lists[name][tier].unshift(snapshot);
      state.byId.set(anime.id, anime);
      const watched = Math.max(0, Math.trunc(Number(entry.watched) || 0));
      if (watched > 0) {
        state.progress[anime.id] = {
          watched: Array.from({ length: watched }, (_, index) => index + 1),
          updated: Date.now(),
        };
      }
      added += 1;
    }
    if (added) {
      saveState();
      refreshViews();
    }
    return { added, skipped: skipped.length, skippedItems: skipped };
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
      const tier = findTier(name, anime.id) || 'N';
      const snapshot = snapshotAnime(anime);
      const label = name === 'watched' ? 'Просмотрено' : 'Запланировано';
      if (removeFromList(name, anime.id)) {
        toast(`«${anime.title}» убрано из списка «${label}»`, {
          actionLabel: 'Отменить',
          duration: 5000,
          onAction: () => addToList(name, snapshot, tier, true),
        });
      }
    } else {
      addToList(name, anime);
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', saveStateNow);
    window.addEventListener('beforeunload', saveStateNow);
  }

  Object.assign(App, {
    LS_KEY,
    SCHEMA_VERSION,
    MOMENTS_KEY,
    TRANSLATIONS_KEY,
    CUSTOM_LIMIT,
    MOMENTS_PER_ANIME,
    CUSTOM_IMAGE_MAX,
    MOMENT_VIDEO_MAX,
    MOMENT_GIF_MAX,
    MEDIA_DB,
    MEDIA_DB_VERSION,
    POSTER_CACHE_LIMIT,
    POSTER_CACHE_WIDTH,
    POSTER_CACHE_HEIGHT,
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
    RU_TITLES_ANILIST,
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
    normalizeCatalogPreferences,
    normalizeSettings,
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
    posterCachedUrl,
    markPosterCached,
    prunePosters,
    clearPosterStore,
    isDataImageUrl,
    dataUrlToBlob,
    customThumbKey,
    momentThumbKey,
    setLocalImageUrl,
    hydrateLocalImage,
    hydrateCardThumbnails,
    hydrateMomentThumbnails,
    migrateLocalThumbnails,
    serializeCustomCard,
    serializeMoment,
    serializeMomentsMap,
    migrateState,
    buildStatePayload,
    loadState,
    saveState,
    saveStateNow,
    flushStateSave,
    scheduleStateSave,
    normalizeUpdateCheck,
    UPDATE_CHECK_MODES,
    allIn,
    hasIn,
    findTier,
    getAnime,
    addToList,
    importTrackedItems,
    removeFromList,
    moveToTier,
    toggleList,
    watchedSet,
    watchedCount,
    toggleEpisode,
    setWatchedUpTo,
    clearProgress,
    restoreProgress,
    episodeStats,
  });
})(window.AniTier = window.AniTier || {});
