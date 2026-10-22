/* ============================================================
   AniTier — база аниме, уведомления, тир-листы, календарь премьер
   Данные: AniList GraphQL + Kitsu API. Хранение: localStorage.
   ============================================================ */
(() => {
  'use strict';

  /* ---------------- константы ---------------- */
  const C = window.AniTierCore;
  if (!C) throw new Error('core.js не загружен');

  const LS_KEY = 'anitier.v1';
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
      alt: createAltSearchState(),
    },
    notifications: { airing: [], completed: [], loading: false, loaded: false, error: null, queued: false },
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
      image: a.image || '',
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

  function loadState() {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch { raw = null; }
    if (!raw) {
      state.lists.watched = emptyTiers();
      state.lists.planned = emptyTiers();
      state.progress = {};
      state.epInfo = {};
      state.seenNotifications = new Set();
      return;
    }
    state.lists.watched = normalizeTiers(raw.watched);
    state.lists.planned = normalizeTiers(raw.planned);
    state.seenNotifications = new Set(Array.isArray(raw.seenNotifications) ? raw.seenNotifications : []);

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
        progress: state.progress,
        epInfo,
        seenNotifications: [...state.seenNotifications],
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
    if (state.byId.has(id)) return state.byId.get(id);
    const pools = [state.notifications.airing, state.notifications.completed, state.db.items, state.upcoming.items];
    for (const p of pools) {
      const found = p.find(a => a.id === id);
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

  /* ---------------- AniList API ---------------- */
  const anilistCache = new Map();

  function anilistCacheKey(variables) {
    return JSON.stringify(variables);
  }

  async function fetchAniList(variables, options = {}) {
    const useCache = options.cache !== false;
    const key = anilistCacheKey(variables);
    if (useCache && anilistCache.has(key)) return anilistCache.get(key);
    if (!navigator.onLine) throw new Error('Нет подключения к интернету');

    const body = JSON.stringify({ query: ANILIST_QUERY, variables });
    const json = await fetchWithTimeout(ANILIST_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body,
    }, options.timeout || ANILIST_TIMEOUT);

    const pageData = json?.data?.Page;
    if (!pageData || !Array.isArray(pageData.media)) throw new Error('AniList: неверный ответ');
    if (useCache) anilistCache.set(key, pageData);
    state.offline = false;
    return pageData;
  }

  /* ---------------- поиск в AniList и Kitsu ---------------- */
  function altType(value) {
    const key = String(value || '').toUpperCase();
    if (key === 'TV_SHORT') return 'TV';
    if (key === 'MOVIE') return 'Movie';
    if (key === 'OVA') return 'OVA';
    if (key === 'ONA') return 'ONA';
    if (key === 'SPECIAL') return 'Special';
    if (key === 'MUSIC') return 'Music';
    if (key === 'TV') return 'TV';
    return '';
  }

  function altStatus(value) {
    const key = String(value || '').toUpperCase();
    if (key === 'RELEASING' || key === 'CURRENT' || key === 'HIATUS') return 'В эфире';
    if (key === 'NOT_YET_RELEASED' || key === 'TBA' || key === 'UPCOMING') return 'Анонс';
    return 'Завершено';
  }

  function stripHtml(value) {
    return String(value || '')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&quot;/g, '"')
      .replace(/&#0?39;|&apos;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function altDate(value) {
    if (!value || !value.year) return null;
    const month = String(value.month || 1).padStart(2, '0');
    const day = String(value.day || 1).padStart(2, '0');
    return `${value.year}-${month}-${day}T00:00:00+00:00`;
  }

  function altYear(date) {
    const match = String(date || '').match(/^(\d{4})/);
    return match ? Number(match[1]) : null;
  }

  function mapAniList(raw) {
    const malId = raw.idMal ? Number(raw.idMal) : null;
    const ru = malId ? RU_TITLES[malId] : '';
    const titles = raw.title || {};
    const title = ru || titles.english || titles.romaji || titles.native || 'Без названия';
    let altTitle = '';
    if (ru) altTitle = titles.english || titles.romaji || titles.native || '';
    else if (titles.english && titles.romaji && titles.english !== titles.romaji) altTitle = titles.romaji;
    else if (titles.native && titles.native !== title) altTitle = titles.native;

    const score = raw.averageScore == null ? null : Number(raw.averageScore);
    const nextEpisode = raw.nextAiringEpisode?.airingAt
      ? {
        n: Number(raw.nextAiringEpisode.episode) || null,
        date: new Date(Number(raw.nextAiringEpisode.airingAt) * 1000).toISOString(),
      }
      : null;
    const airedEpisodes = raw.status === 'RELEASING' && nextEpisode
      ? Math.max(0, (Number(nextEpisode.n) || 1) - 1)
      : (raw.status === 'FINISHED' && raw.episodes != null ? Number(raw.episodes) : null);

    const a = {
      id: malId || -(2000000 + Number(raw.id)),
      malId,
      title,
      altTitle,
      image: raw.coverImage?.extraLarge || raw.coverImage?.large || '',
      episodes: raw.episodes ?? null,
      type: altType(raw.format),
      status: altStatus(raw.status),
      score: Number.isFinite(score) ? Math.round(score) / 10 : null,
      year: raw.seasonYear || null,
      airedFrom: altDate(raw.startDate),
      airedTo: altDate(raw.endDate),
      synopsis: stripHtml(raw.description),
      genres: Array.isArray(raw.genres) ? raw.genres : [],
      studios: (raw.studios?.nodes || []).map(node => node.name).filter(Boolean),
      url: raw.siteUrl || `https://anilist.co/anime/${raw.id}`,
      source: 'AniList',
      sourceId: raw.id,
      aliases: [titles.romaji, titles.english, titles.native, ...(raw.synonyms || [])],
      airedEpisodes,
      nextEpisode,
    };
    state.byId.set(a.id, a);
    return a;
  }

  function mapKitsu(raw, categories = new Map(), mappings = new Map()) {
    const attrs = raw.attributes || {};
    const titles = attrs.titles || {};
    const mappingIds = (raw.relationships?.mappings?.data || []).map(ref => ref.id);
    const malMapping = mappingIds
      .map(id => mappings.get(id))
      .find(mapping => mapping && mapping.externalSite === 'myanimelist/anime' && /^\d+$/.test(String(mapping.externalId)));
    const malId = malMapping ? Number(malMapping.externalId) : null;
    const ru = malId ? RU_TITLES[malId] : '';
    const title = ru || attrs.canonicalTitle || titles.en || titles.en_jp || titles.ja_jp || 'Без названия';
    let altTitle = '';
    if (ru) altTitle = attrs.canonicalTitle || titles.en || titles.en_jp || '';
    else if (titles.en && titles.en !== title) altTitle = titles.en;
    else if (titles.en_jp && titles.en_jp !== title) altTitle = titles.en_jp;
    else if (titles.ja_jp && titles.ja_jp !== title) altTitle = titles.ja_jp;

    const categoryIds = (raw.relationships?.categories?.data || []).map(ref => ref.id);
    const genres = [...new Set(categoryIds.map(id => categories.get(id)).filter(Boolean))];
    const rating = attrs.averageRating == null ? null : Number(attrs.averageRating);
    const year = altYear(attrs.startDate);

    const a = {
      id: malId || -(1000000 + Number(raw.id)),
      malId,
      title,
      altTitle,
      image: attrs.posterImage?.large || attrs.posterImage?.original || attrs.posterImage?.medium || '',
      episodes: attrs.episodeCount ?? null,
      type: altType(attrs.subtype),
      status: altStatus(attrs.status),
      score: Number.isFinite(rating) ? Math.round((rating / 10) * 10) / 10 : null,
      year,
      airedFrom: attrs.startDate || null,
      airedTo: attrs.endDate || null,
      synopsis: stripHtml(attrs.synopsis),
      genres,
      studios: [],
      url: `https://kitsu.io/anime/${attrs.slug || raw.id}`,
      source: 'Kitsu',
      sourceId: raw.id,
      aliases: [attrs.canonicalTitle, titles.en, titles.en_jp, titles.ja_jp],
    };
    state.byId.set(a.id, a);
    return a;
  }

  async function fetchWithTimeout(url, options = {}, timeoutMs = SEARCH_TIMEOUT) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: ctrl.signal });
      if (!res.ok) throw new Error(`Источник ответил ${res.status}`);
      return await res.json();
    } catch (err) {
      if (err && err.name === 'AbortError') throw new Error('Источник не отвечает');
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  async function fetchAniListPage(query, page) {
    const pageData = await fetchAniList({
      search: query,
      page,
      perPage: PAGE_LIMIT,
      type: 'ANIME',
      isAdult: false,
    }, { timeout: SEARCH_TIMEOUT });
    return {
      source: 'AniList',
      ok: true,
      items: pageData.media.map(mapAniList),
      hasNext: Boolean(pageData.pageInfo?.hasNextPage),
    };
  }

  async function fetchKitsuPage(query, page) {
    const offset = (page - 1) * PAGE_LIMIT;
    const url = `${KITSU_ENDPOINT}?filter[text]=${encodeURIComponent(query)}&page[limit]=${PAGE_LIMIT}&page[offset]=${offset}&include=categories,mappings`;
    const json = await fetchWithTimeout(url, { headers: { Accept: 'application/vnd.api+json' } });
    if (!Array.isArray(json?.data)) throw new Error('Kitsu: неверный ответ');
    if (json.data.length && !json.data.some(item => item?.attributes)) throw new Error('Kitsu: неверный ответ');
    state.offline = false;

    const categories = new Map();
    const mappings = new Map();
    for (const item of json.included || []) {
      if (item?.type === 'categories') categories.set(item.id, item.attributes?.title);
      if (item?.type === 'mappings') mappings.set(item.id, item.attributes);
    }

    return {
      source: 'Kitsu',
      ok: true,
      items: json.data.map(item => mapKitsu(item, categories, mappings)),
      hasNext: Boolean(json.links?.next),
    };
  }

  function searchQueryForAlt(query) {
    const raw = String(query || '').trim();
    if (!raw || !/[\u0400-\u04ff]/.test(raw)) return raw;
    const needle = C.normalizeTitleKey(raw);
    if (!needle) return raw;
    const hit = DEMO_BASE.find(([, ru, alt]) => {
      const ruKey = C.normalizeTitleKey(ru);
      const altKey = C.normalizeTitleKey(alt);
      return (ruKey && (ruKey.includes(needle) || needle.includes(ruKey)))
        || (altKey && altKey.includes(needle));
    });
    return hit ? hit[2] : raw;
  }

  async function fillAltPage(s, revision) {
    const alt = s.alt;
    const query = searchQueryForAlt(s.query);
    let rounds = 0;

    while (alt.buffer.length < PAGE_LIMIT && rounds < 3) {
      const jobs = [];
      if (!alt.anilistDone) {
        jobs.push(
          fetchAniListPage(query, alt.anilistPage)
            .catch(error => ({ source: 'AniList', ok: false, error })),
        );
      }
      if (!alt.kitsuDone) {
        jobs.push(
          fetchKitsuPage(query, alt.kitsuPage)
            .catch(error => ({ source: 'Kitsu', ok: false, error })),
        );
      }
      if (!jobs.length) break;
      rounds += 1;

      const results = await Promise.all(jobs);
      if (revision !== s.revision) {
        return { aborted: true, ok: false, items: [], hasNext: false, sources: [] };
      }

      const groups = [];
      let succeeded = 0;
      for (const result of results) {
        if (!result.ok) {
          if (result.source === 'AniList') alt.anilistDone = true;
          if (result.source === 'Kitsu') alt.kitsuDone = true;
          continue;
        }

        succeeded += 1;
        alt.providerOk = true;
        if (!alt.sources.includes(result.source)) alt.sources.push(result.source);
        const items = (result.items || []).filter(item => C.matchesFilters(item, s.filters));
        groups.push(items);

        if (result.source === 'AniList') {
          alt.anilistPage += 1;
          alt.anilistDone = !result.hasNext || !result.items.length;
        } else if (result.source === 'Kitsu') {
          alt.kitsuPage += 1;
          alt.kitsuDone = !result.hasNext || !result.items.length;
        }
      }

      alt.buffer.push(...C.mergeUniqueAnime(groups, alt.seen));
      if (!succeeded) break;
    }

    const items = alt.buffer.splice(0, PAGE_LIMIT);
    const hasNext = alt.buffer.length > 0 || !alt.anilistDone || !alt.kitsuDone;
    return {
      aborted: false,
      ok: alt.providerOk,
      items,
      hasNext,
      sources: alt.sources.slice(),
    };
  }

  /* ---------------- демо-данные ---------------- */
  let demoCache = null;
  function demoAll() {
    if (demoCache) return demoCache;
    demoCache = DEMO_BASE.map(([id, title, alt, eps, year, score, type, genres, syn]) => ({
      id, title, altTitle: alt,
      image: makePoster(title, id),
      episodes: eps,
      type,
      status: 'Завершено',
      score,
      year,
      airedFrom: `${year}-04-02T00:00:00+00:00`,
      airedTo: null,
      synopsis: syn,
      genres,
      studios: [],
      url: `https://myanimelist.net/anime/${id}`,
      demo: true,
    }));
    return demoCache;
  }
  const demoAnime = () => demoAll().map(a => ({ ...a }));

  function demoNotifications() {
    const base = demoAll();
    const airedCounts = [7, 4, 9, 3, 6, 11, 2];
    const airing = [0, 2, 6, 7, 9, 11, 14].map((idx, i) => {
      const a = base[idx];
      const total = Math.max(1, Number(a.episodes) || 12);
      const aired = Math.max(1, Math.min(airedCounts[i] || 1, total));
      return {
        ...a,
        status: 'В эфире',
        episodes: total,
        airedFrom: new Date(Date.now() - (aired * 7 + i * 3 + 3) * 86400000).toISOString(),
        airedTo: null,
        demoEp: {
          aired,
          total,
          lastAired: new Date(Date.now() - (i + 1) * 86400000).toISOString(),
          nextDate: new Date(Date.now() + (i + 2) * 86400000).toISOString(),
        },
      };
    });

    const completed = [1, 3, 8, 12, 17, 18].map((idx, i) => {
      const a = base[idx];
      return {
        ...a,
        status: 'Завершено',
        episodes: Number(a.episodes) || 12,
        airedFrom: new Date(Date.now() - (140 + i * 11) * 86400000).toISOString(),
        airedTo: new Date(Date.now() - (i * 4 + 2) * 86400000).toISOString(),
      };
    });

    for (const a of [...airing, ...completed]) state.byId.set(a.id, a);
    return { airing, completed };
  }

  function seedDemoEpisodeInfo() {
    for (const a of [...state.notifications.airing, ...state.notifications.completed]) {
      if (!a.demoEp || state.epInfo[a.id]) continue;
      state.epInfo[a.id] = {
        count: Math.min(Number(a.demoEp.aired) || 0, Number(a.episodes) || 99),
        last: Number(a.demoEp.aired) || 0,
        lastAired: a.demoEp.lastAired || null,
        next: a.demoEp.nextDate ? { n: (Number(a.demoEp.aired) || 0) + 1, date: a.demoEp.nextDate } : null,
        fetchedAt: Date.now(),
        total: Number(a.episodes) || null,
        source: 'demo',
      };
    }
  }

  function demoUpcoming() {
    const offsets = [1, 3, 6, 10, 15, 22, 30, 41, 52, 63, 75, 86];
    return demoAll().slice(8, 20).map((a, i) => ({
      ...a,
      status: 'Анонс',
      score: null,
      airedFrom: addDays(startOfToday(), offsets[i] || 30).toISOString(),
    }));
  }

  /* ---------------- отрисовка: карточки ---------------- */
  function imgAttrs(a, alt) {
    return `src="${esc(a.image || makePoster(a.title, a.id))}" alt="${esc(alt !== undefined ? alt : a.title)}" loading="lazy" data-title="${esc(a.title)}" data-id="${a.id}" onerror="posterFallback(this)"`;
  }

  function cardHTML(a, ctx) {
    const inW = hasIn('watched', a.id);
    const inP = hasIn('planned', a.id);
    const wc = watchedCount(a.id);
    const stats = episodeStats(a);
    const pTotal = stats.total || stats.available || 0;
    const pct = pTotal ? Math.min(100, Math.round((wc / pTotal) * 100)) : 0;
    const metaBits = [typeRu(a.type) || '—', a.year || '—', a.episodes ? `${a.episodes} эп.` : 'серий: ?'];
    return `<article class="card" data-action="open" data-id="${a.id}" tabindex="0" aria-label="${esc(a.title)}">
      <div class="poster">
        <img ${imgAttrs(a)}>
        <div class="poster-shade"></div>
        ${a.score ? `<span class="badge-score">★ ${a.score.toFixed(1)}</span>` : ''}
        <span class="badge-eps">${a.episodes ? a.episodes + ' эп.' : '? эп.'}</span>
        <div class="card-actions">
          <button class="mini-btn ${inW ? 'is-on' : ''}" data-action="add-watched" data-id="${a.id}" title="Просмотрено" aria-label="Отметить просмотренным">✓</button>
          <button class="mini-btn ${inP ? 'is-on' : ''}" data-action="add-planned" data-id="${a.id}" title="В планы" aria-label="Добавить в планы">◷</button>
        </div>
      </div>
      <div class="card-body">
        <h3 class="card-title">${esc(a.title)}</h3>
        <p class="card-meta">${esc(metaBits.join(' · '))}</p>
        ${ctx === 'upcoming' && a.airedFrom ? `<p class="card-date"><span>${esc(dateShort(a.airedFrom))}</span><span class="dot"></span><span class="soon">${esc(countdownLabel(a.airedFrom))}</span></p>` : ''}
        ${wc > 0 ? `<div class="card-progress"><span class="cp-bar"><i style="width:${pct}%"></i></span><span class="cp-label">✓ ${wc}${pTotal ? ' / ' + pTotal : ''}</span></div>` : ''}
      </div>
    </article>`;
  }

  function tierCardHTML(list, a, tier) {
    const wc = watchedCount(a.id);
    return `<article class="tier-card" draggable="true" data-action="open" data-id="${a.id}" data-list="${list}" data-tier="${tier}" tabindex="0">
      <img ${imgAttrs(a)}>
      <button class="tc-remove" data-action="remove" data-id="${a.id}" data-list="${list}" title="Убрать из списка" aria-label="Убрать из списка">✕</button>
      <div class="tc-body">
        <div class="tc-title" title="${esc(a.title)}">${esc(a.title)}</div>
        <div class="tc-meta">${a.episodes ? a.episodes + ' эп.' : '? эп.'}${a.score ? ' · ★ ' + a.score.toFixed(1) : ''}${wc ? ' · ✓ ' + wc : ''}</div>
      </div>
    </article>`;
  }

  function skeletonCards(n) {
    return Array.from({ length: n }, () => `<div class="skel"><div class="skel-poster"></div><div class="skel-line"></div><div class="skel-line short"></div></div>`).join('');
  }
  function skeletonRows(n) {
    return Array.from({ length: n }, () => `<div class="skel" style="height:104px"></div>`).join('');
  }

  function msgBlock(emoji, title, text, action) {
    return `<div class="msg">
      <span class="emoji">${emoji}</span>
      <h3>${esc(title)}</h3>
      <p>${esc(text)}</p>
      ${action ? `<button class="btn btn-ghost" data-action="${action}">Попробовать снова</button>` : ''}
    </div>`;
  }

  /* ---------------- фильтры и отрисовка базы ---------------- */
  function initFilterOptions() {
    const yearSelect = $('#filter-year');
    if (yearSelect && yearSelect.options.length <= 1) {
      const maxYear = new Date().getFullYear() + 1;
      for (let year = maxYear; year >= 1990; year -= 1) {
        yearSelect.appendChild(new Option(String(year), String(year)));
      }
    }

    const genreSelect = $('#filter-genre');
    if (genreSelect && genreSelect.options.length <= 1) {
      for (const genre of C.GENRES) {
        genreSelect.appendChild(new Option(genre.label, String(genre.id)));
      }
    }
  }

  function syncFilterUI() {
    const filters = state.db.filters;
    const fieldIds = {
      type: '#filter-type',
      status: '#filter-status',
      year: '#filter-year',
      genre: '#filter-genre',
      minScore: '#filter-score',
    };
    for (const [key, selector] of Object.entries(fieldIds)) {
      const field = $(selector);
      if (field) field.value = filters[key] || '';
    }

    const count = C.countActiveFilters(filters);
    const badge = $('#filter-count');
    if (badge) {
      badge.textContent = String(count);
      badge.hidden = count === 0;
    }
    const toggle = $('[data-action="toggle-filters"]');
    if (toggle) toggle.classList.toggle('is-active', count > 0);
  }

  function syncModeChips() {
    const noSearch = !state.db.query.trim() && !C.hasActiveFilters(state.db.filters);
    $$('#db-modes .chip').forEach(chip => {
      chip.classList.toggle('is-active', noSearch && chip.dataset.mode === state.db.mode);
    });
  }

  function readFiltersFromUI() {
    const raw = {};
    $$('#db-filters [data-filter]').forEach(field => {
      raw[field.dataset.filter] = field.value;
    });
    return C.normalizeFilters(raw);
  }

  function resetDBFilters() {
    state.db.filters = C.normalizeFilters(C.DEFAULT_FILTERS);
    syncFilterUI();
  }

  function updateDBStatus() {
    const el = $('#db-status');
    if (!el) return;
    const s = state.db;
    if (!s.items.length) {
      el.textContent = '';
      return;
    }
    const page = Math.max(1, s.page - 1);
    const sources = s.sources.length ? ` · ${s.sources.join(' + ')}` : '';
    if (s.loading) {
      el.textContent = `Показано ${s.items.length} · загружаем страницу ${s.page}…${sources}`;
    } else if (s.hasNext) {
      el.textContent = `Показано ${s.items.length} · страница ${page}${sources}`;
    } else {
      el.textContent = `Показано ${s.items.length} · все результаты${sources}`;
    }
  }

  function renderDB() {
    const s = state.db;
    const grid = $('#db-grid');
    const more = $('#db-more');
    if (!grid) return;

    if ((s.loading || state.booting) && !s.items.length) {
      grid.innerHTML = skeletonCards(12);
      if (more) more.hidden = true;
      updateDBStatus();
      return;
    }
    if (s.error && !s.items.length) {
      grid.innerHTML = msgBlock('⚠️', 'Не удалось загрузить базу', s.error, 'retry-db');
      if (more) more.hidden = true;
      updateDBStatus();
      return;
    }
    if (!s.items.length) {
      const hasFilters = C.hasActiveFilters(s.filters);
      let text = 'Попробуйте обновить данные.';
      if (s.query) text = `По запросу «${s.query}» нет результатов. Попробуйте другое название или ослабьте фильтры.`;
      else if (hasFilters) text = 'По выбранным фильтрам ничего не нашлось. Попробуйте ослабить условия.';
      grid.innerHTML = msgBlock('🔎', 'Ничего не нашлось', text);
      if (more) more.hidden = true;
      updateDBStatus();
      return;
    }

    grid.innerHTML = s.items.map(a => cardHTML(a, 'db')).join('');
    if (more) {
      more.hidden = !s.hasNext;
      more.disabled = s.loading;
      more.textContent = s.loading ? 'Загружаем…' : 'Следующая страница';
    }
    updateDBStatus();
  }

  async function fetchDB(force = false) {
    const s = state.db;

    if (force) {
      s.revision += 1;
      s.page = 1;
      s.items = [];
      s.hasNext = true;
      s.error = null;
      s.sources = [];
      s.alt = createAltSearchState();
      anilistCache.clear();
    }

    if (s.loading) {
      if (force) {
        s.queued = true;
        renderDB();
      }
      return;
    }
    if (!s.hasNext && s.items.length) return;

    const revision = s.revision;
    const page = s.page;
    s.loading = true;
    s.error = null;
    renderDB();

    try {
      let usedAlt = false;

      if (!state.forceDemo && s.query) {
        const alt = await fillAltPage(s, revision);
        if (revision !== s.revision || alt.aborted) return;
        if (alt.ok) {
          s.items = C.dedupeById([...s.items, ...alt.items]);
          s.sources = alt.sources;
          s.hasNext = alt.hasNext;
          s.page = page + 1;
          usedAlt = true;
        }
      }

      if (state.forceDemo) {
        const all = C.filterItems(demoAnime(), { query: s.query, filters: s.filters });
        const pageData = C.slicePage(all, page, PAGE_LIMIT);
        if (revision !== s.revision) return;
        s.items.push(...pageData.items);
        s.sources = [];
        s.hasNext = pageData.hasNext;
        s.page = page + 1;
      } else if (!usedAlt) {
        const variables = C.buildAniListVariables({
          mode: s.mode,
          query: s.query,
          filters: s.filters,
          page,
          limit: PAGE_LIMIT,
        });
        const pageData = await fetchAniList(variables, { timeout: SEARCH_TIMEOUT });
        if (revision !== s.revision) return;

        const data = pageData.media.map(mapAniList);
        s.items = C.dedupeById([...s.items, ...data]);
        s.sources = ['AniList'];
        s.hasNext = Boolean(pageData.pageInfo?.hasNextPage) && data.length > 0;
        s.page = page + 1;
        if (!data.length) s.hasNext = false;
      }
    } catch (err) {
      if (revision !== s.revision) return;
      console.error(err);
      s.error = err.message || 'Ошибка сети';
      state.offline = true;
      if (!s.items.length) {
        const all = C.filterItems(demoAnime(), { query: s.query, filters: s.filters });
        const pageData = C.slicePage(all, page, PAGE_LIMIT);
        s.items = pageData.items;
        s.hasNext = pageData.hasNext;
        s.page = page + 1;
      }
      toast('База недоступна — включён демо-режим');
    } finally {
      if (revision === s.revision) {
        s.loading = false;
        renderDB();
        updateOfflineBanner();
      } else if (!s.queued) {
        s.loading = false;
        renderDB();
      }
      if (s.queued) {
        s.queued = false;
        s.loading = false;
        fetchDB();
      }
    }
  }

  /* ---------------- серии: прогресс и данные ---------------- */
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

  function releaseLine(a, stats) {
    if (stats.ongoing) {
      if (!stats.info) return 'Считаем вышедшие серии…';
      if (!stats.info.count) return 'Серии ещё не вышли';
      if (stats.total) return `Вышла ${stats.info.count}-я серия из ${stats.total}`;
      return `Вышло ${stats.info.count} ${epWord(stats.info.count)}`;
    }
    if (stats.total) {
      if (stats.total % 10 === 1 && stats.total % 100 !== 11) return `Вышла ${stats.total} серия`;
      return `Вышли все ${stats.total} ${epWord(stats.total)}`;
    }
    if (stats.available) return `Вышло ${stats.available} ${epWord(stats.available)}`;
    return 'Количество серий неизвестно';
  }

  function episodeProgressText(id, stats) {
    const total = stats.total || stats.available || 0;
    return `Просмотрено ${watchedCount(id)}${total ? ' из ' + total : ''}`;
  }

  function chipsHTML(a, stats) {
    const id = a.id;
    const set = watchedSet(id);
    const max = stats.available;
    if (!max) {
      if (stats.ongoing && !stats.info) return '<span class="ep-note">Загружаем список серий…</span>';
      return '<span class="ep-note">Серии пока недоступны</span>';
    }
    if (max > LONG_TITLE_EPS) {
      return `<div class="ep-tools">
        <button class="ep-link" data-action="ep-all" data-id="${id}" data-max="${max}">Отметить все</button>
        <span class="ep-tools-sep">·</span>
        <button class="ep-link" data-action="ep-reset" data-id="${id}">Сбросить</button>
      </div>`;
    }
    let out = '';
    for (let i = 1; i <= max; i++) {
      out += `<button class="ep-chip ${set.has(i) ? 'is-watched' : ''}" data-action="toggle-ep" data-id="${id}" data-ep="${i}" title="Серия ${i}: ${set.has(i) ? 'просмотрена' : 'не просмотрена'}">${i}</button>`;
    }
    return `<div class="ep-chips">${out}</div>
      <div class="ep-tools">
        <button class="ep-link" data-action="ep-all" data-id="${id}" data-max="${max}">Отметить все</button>
        <span class="ep-tools-sep">·</span>
        <button class="ep-link" data-action="ep-reset" data-id="${id}">Сбросить</button>
      </div>`;
  }

  function renderEpisodeBlock(a, variant = 'notif') {
    if (a.status === 'Анонс') {
      return `<div class="ep-block ep-${variant}" data-ep-block="${a.id}" data-variant="${variant}">
        <p class="ep-note">Аниме ещё не вышло — отмечать серии пока нельзя.</p>
      </div>`;
    }
    const stats = episodeStats(a);
    const total = stats.total || stats.available || 0;
    const max = stats.available || 0;
    const wc = watchedCount(a.id);
    const sliderValue = Math.min(wc, max);
    const pct = total ? Math.min(100, Math.round((wc / total) * 100)) : 0;
    const sliderPct = max ? Math.min(100, Math.round((sliderValue / max) * 100)) : 0;
    const nextLine = stats.ongoing && stats.info && stats.info.next
      ? `<span class="ep-next">Следующая: ${stats.info.next.n}-я · ${esc(dateShort(stats.info.next.date))}</span>`
      : '';
    const slider = max > LONG_TITLE_EPS
      ? `<div class="ep-slider-row">
          <span class="ep-slider-bound">0</span>
          <input class="ep-slider" type="range" min="0" max="${max}" step="1" value="${sliderValue}"
            data-action="ep-slider" data-id="${a.id}" data-max="${max}" data-total="${total || max}"
            style="--ep-fill:${sliderPct}%"
            aria-label="Просмотрено серий: ${sliderValue} из ${max}">
          <span class="ep-slider-bound">${max}</span>
        </div>`
      : '';
    return `<div class="ep-block ep-${variant}" data-ep-block="${a.id}" data-variant="${variant}">
      <div class="ep-head">
        <span class="ep-release">${esc(releaseLine(a, stats))}</span>
        <span class="ep-watched">${esc(episodeProgressText(a.id, stats))}</span>
      </div>
      <div class="ep-bar"><i data-ep-bar="${a.id}" style="width:${pct}%"></i></div>
      ${slider}
      ${nextLine}
      ${chipsHTML(a, stats)}
    </div>`;
  }

  function previewEpisodeSlider(slider) {
    const id = Number(slider.dataset.id);
    const max = Number(slider.dataset.max) || 0;
    const total = Number(slider.dataset.total) || max;
    const value = Math.max(0, Math.min(Number(slider.value) || 0, max));
    const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
    const barPct = total ? Math.min(100, Math.round((value / total) * 100)) : 0;
    const block = slider.closest('.ep-block');

    slider.style.setProperty('--ep-fill', `${pct}%`);
    slider.setAttribute('aria-label', `Просмотрено серий: ${value} из ${max}`);
    if (!block) return;

    const label = block.querySelector('.ep-watched');
    if (label) label.textContent = `Просмотрено ${value}${total ? ' из ' + total : ''}`;
    const bar = block.querySelector(`[data-ep-bar="${id}"]`);
    if (bar) bar.style.width = `${barPct}%`;
  }

  function updateEpisodeUI(id) {
    const a = getAnime(id);
    if (!a) return;
    $$(`[data-ep-block="${id}"]`).forEach(block => {
      const variant = block.dataset.variant || 'notif';
      const holder = document.createElement('div');
      holder.innerHTML = renderEpisodeBlock(a, variant);
      const fresh = holder.firstElementChild;
      if (fresh) block.replaceWith(fresh);
    });
  }

  function episodeInfoFromAnime(a) {
    const total = Number(a.episodes) || null;
    const next = a.nextEpisode || null;
    let count = 0;

    if (a.status === 'В эфире') {
      if (a.airedEpisodes != null) count = Math.max(0, Number(a.airedEpisodes) || 0);
      else if (next && next.n) count = Math.max(0, Number(next.n) - 1);
    } else if (a.status === 'Завершено') {
      count = total != null ? total : Math.max(0, Number(a.airedEpisodes) || 0);
    }

    return {
      count,
      last: count,
      lastAired: null,
      next,
      fetchedAt: Date.now(),
      total,
      source: 'api',
    };
  }

  function ensureEpisodeInfo(a) {
    if (!a) return null;
    const cached = state.epInfo[a.id];
    const fresh = cached && Date.now() - Number(cached.fetchedAt || 0) < 2 * 3600000;
    const demoCacheInLiveMode = cached && cached.source === 'demo' && !state.forceDemo && !a.demo;
    if (fresh && !demoCacheInLiveMode) return cached;

    if (state.forceDemo || a.demo) {
      if (a.demoEp) {
        state.epInfo[a.id] = {
          count: Math.min(Number(a.demoEp.aired) || 0, Number(a.episodes) || 99),
          last: Number(a.demoEp.aired) || 0,
          lastAired: a.demoEp.lastAired || null,
          next: a.demoEp.nextDate ? { n: (Number(a.demoEp.aired) || 0) + 1, date: a.demoEp.nextDate } : null,
          fetchedAt: Date.now(),
          total: Number(a.episodes) || Number(a.demoEp.total) || null,
          source: 'demo',
        };
        updateEpisodeUI(a.id);
      }
      return state.epInfo[a.id] || null;
    }

    state.epInfo[a.id] = episodeInfoFromAnime(a);
    saveState();
    updateEpisodeUI(a.id);
    return state.epInfo[a.id];
  }

  function ensureNotificationEpisodes() {
    if (state.tab !== 'notifications') return;
    const all = [...state.notifications.airing, ...state.notifications.completed];
    for (const a of all) {
      const info = state.epInfo[a.id];
      const demoCacheInLiveMode = info && info.source === 'demo' && !state.forceDemo && !a.demo;
      const fresh = info && Date.now() - Number(info.fetchedAt || 0) < 2 * 3600000;
      if (fresh && !demoCacheInLiveMode) continue;
      const needsInfo = a.status === 'В эфире' || !a.episodes;
      if (needsInfo) ensureEpisodeInfo(a);
    }
  }

  /* ---------------- отрисовка: уведомления ---------------- */
  function notifRowHTML(a, kind) {
    const baseDate = kind === 'airing' ? a.airedFrom : (a.airedTo || a.airedFrom);
    const d = parseDate(baseDate);
    const day = d ? d.getDate() : '—';
    const mon = d ? MONTHS_SHORT[d.getMonth()] : '';
    const daysAgo = d ? daysBetween(new Date(d.getFullYear(), d.getMonth(), d.getDate()), startOfToday()) : 99;
    const isNew = daysAgo <= 7;
    const inW = hasIn('watched', a.id);
    const inP = hasIn('planned', a.id);
    const meta = kind === 'airing'
      ? `<span>Старт: ${esc(dateShort(a.airedFrom))}</span>`
      : `<span>Завершено ${esc(relativePast(a.airedTo))}</span>`;

    return `<article class="notif notif-${kind}" data-action="open" data-id="${a.id}" tabindex="0" aria-label="${esc(a.title)}">
      <div class="notif-date"><b>${day}</b><span>${mon}</span></div>
      <img class="notif-poster" ${imgAttrs(a, '')}>
      <div class="notif-body">
        <h3 class="notif-title">${esc(a.title)}${isNew ? '<span class="flag-new">new</span>' : ''}</h3>
        <p class="notif-alt">${esc(a.altTitle || '')}</p>
        <div class="notif-meta">
          ${meta}
          ${a.type ? `<span>· ${esc(typeRu(a.type))}</span>` : ''}
          <span>· ${a.episodes ? a.episodes + ' эп.' : 'серий: ?'}</span>
          ${a.score ? `<span>· <b>★ ${a.score.toFixed(1)}</b></span>` : ''}
        </div>
        ${renderEpisodeBlock(a, 'notif')}
      </div>
      <div class="notif-actions">
        <button class="mini-btn ${inW ? 'is-on' : ''}" data-action="add-watched" data-id="${a.id}" title="Добавить в просмотрено" aria-label="Добавить в просмотрено">✓</button>
        <button class="mini-btn ${inP ? 'is-on' : ''}" data-action="add-planned" data-id="${a.id}" title="В планы" aria-label="Добавить в планы">◷</button>
      </div>
    </article>`;
  }

  function renderNotifications() {
    const el = $('#notif-list');
    if (!el) return;
    const n = state.notifications;
    const totalCount = n.airing.length + n.completed.length;

    if (n.loading && !totalCount) { el.innerHTML = skeletonRows(5); return; }
    if (n.error && !totalCount) { el.innerHTML = msgBlock('⚠️', 'Не удалось загрузить уведомления', n.error, 'retry-notifications'); return; }
    if (!totalCount) { el.innerHTML = msgBlock('🌙', 'Новых премьер пока нет', 'Загляните позже или обновите данные.'); return; }

    el.innerHTML = `
      <section class="notif-group">
        <h2 class="group-head"><span class="group-dot live"></span>Сейчас выходит <b>${n.airing.length}</b></h2>
        ${n.airing.length
          ? `<div class="notif-list">${n.airing.map(a => notifRowHTML(a, 'airing')).join('')}</div>`
          : '<p class="group-empty">Активных новинок сейчас нет.</p>'}
      </section>
      <section class="notif-group">
        <h2 class="group-head"><span class="group-dot done"></span>Полностью вышли <b>${n.completed.length}</b></h2>
        ${n.completed.length
          ? `<div class="notif-list">${n.completed.map(a => notifRowHTML(a, 'completed')).join('')}</div>`
          : '<p class="group-empty">Пока нет недавно завершившихся тайтлов.</p>'}
      </section>`;

    ensureNotificationEpisodes();
  }

  function invalidateNotificationEpisodes() {
    const ids = allNotifications().map(a => a.id);
    let changed = false;
    for (const id of ids) {
      if (state.epInfo[id]) {
        delete state.epInfo[id];
        changed = true;
      }
    }
    if (changed) saveState();
  }

  async function fetchNotifications(force = false) {
    const n = state.notifications;
    if (n.loading) {
      if (force) n.queued = true;
      return;
    }
    if ((n.airing.length || n.completed.length) && !force) return;
    if (force) {
      anilistCache.clear();
      invalidateNotificationEpisodes();
    }

    if (state.forceDemo) {
      const demo = demoNotifications();
      n.airing = demo.airing;
      n.completed = demo.completed;
      n.loaded = true;
      n.loading = false;
      n.error = null;
      seedDemoEpisodeInfo();
      renderNotifications();
      if (state.tab === 'notifications') markNotificationsSeen();
      updateBell();
      return;
    }

    n.loading = true;
    n.error = null;
    renderNotifications();

    try {
      const today = endOfToday();
      const todayInt = fuzzyDateInt(today);
      const cutoff = addDays(startOfToday(), -75);

      const airingPage = await fetchAniList({
        type: 'ANIME',
        status: 'RELEASING',
        sort: ['START_DATE_DESC'],
        page: 1,
        perPage: 50,
        startDateLesser: todayInt,
        isAdult: false,
      });
      const donePage = await fetchAniList({
        type: 'ANIME',
        status: 'FINISHED',
        sort: ['END_DATE_DESC'],
        page: 1,
        perPage: 50,
        endDateGreater: fuzzyDateInt(cutoff),
        endDateLesser: todayInt,
        isAdult: false,
      });

      const airing = airingPage.media
        .map(mapAniList)
        .filter(a => {
          const d = parseDate(a.airedFrom);
          return d && d <= today;
        })
        .sort((a, b) => new Date(b.airedFrom) - new Date(a.airedFrom))
        .slice(0, 12);

      const completed = donePage.media
        .map(mapAniList)
        .filter(a => {
          const end = parseDate(a.airedTo);
          return end && end <= today && end >= cutoff;
        })
        .sort((a, b) => new Date(b.airedTo) - new Date(a.airedTo))
        .slice(0, 12);

      n.airing = airing;
      n.completed = completed;
      n.loaded = true;
    } catch (err) {
      console.error(err);
      n.error = err.message || 'Ошибка сети';
      state.offline = true;
      if (!n.airing.length && !n.completed.length) {
        const demo = demoNotifications();
        n.airing = demo.airing;
        n.completed = demo.completed;
        seedDemoEpisodeInfo();
      }
      toast('Уведомления недоступны — включён демо-режим');
    } finally {
      n.loading = false;
      renderNotifications();
      if (state.tab === 'notifications') markNotificationsSeen();
      updateBell();
      updateOfflineBanner();
      if (n.queued) {
        n.queued = false;
        fetchNotifications(true);
      }
    }
  }

  function allNotifications() {
    return [...state.notifications.airing, ...state.notifications.completed];
  }

  function markNotificationsSeen() {
    let changed = false;
    for (const a of allNotifications()) {
      if (!state.seenNotifications.has(a.id)) {
        state.seenNotifications.add(a.id);
        changed = true;
      }
    }
    if (changed) saveState();
    updateBell();
  }

  function updateBell() {
    const badge = $('#bell-badge');
    if (!badge) return;
    const unread = allNotifications().filter(a => !state.seenNotifications.has(a.id)).length;
    badge.hidden = unread === 0;
    badge.textContent = unread > 9 ? '9+' : String(unread);
  }

  /* ---------------- отрисовка: скоро выйдут ---------------- */
  function renderUpcoming() {
    const grid = $('#upcoming-grid');
    if (!grid) return;
    const u = state.upcoming;

    if (u.loading && !u.items.length) { grid.innerHTML = skeletonCards(10); return; }
    if (u.error && !u.items.length) { grid.innerHTML = msgBlock('⚠️', 'Не удалось загрузить премьеры', u.error, 'retry-upcoming'); return; }
    if (!u.items.length) { grid.innerHTML = msgBlock('🌌', 'Ближайших премьер не нашлось', 'Попробуйте обновить данные позже.'); return; }

    let html = '';
    let currentMonth = '';
    for (const a of u.items) {
      const month = monthLabel(a.airedFrom);
      if (month !== currentMonth) {
        currentMonth = month;
        html += `<h2 class="month-head">${esc(month)}</h2>`;
      }
      html += cardHTML(a, 'upcoming');
    }
    grid.innerHTML = html;
  }

  async function fetchUpcoming(force = false) {
    const u = state.upcoming;
    if (u.loading) {
      if (force) u.queued = true;
      return;
    }
    if (u.items.length && !force) return;
    if (force) anilistCache.clear();

    if (state.forceDemo) {
      u.items = demoUpcoming();
      u.loaded = true;
      u.loading = false;
      u.error = null;
      u.fallback = false;
      renderUpcoming();
      return;
    }

    u.loading = true;
    u.error = null;
    u.fallback = false;
    renderUpcoming();

    try {
      const from = startOfTomorrow();
      const to = addDays(startOfToday(), 91);
      const startGreater = fuzzyDateInt(startOfToday());
      const startLesser = fuzzyDateInt(to);
      const all = [];

      for (let page = 1; page <= 2; page++) {
        const pageData = await fetchAniList({
          type: 'ANIME',
          status: 'NOT_YET_RELEASED',
          sort: ['START_DATE'],
          page,
          perPage: 50,
          startDateGreater: startGreater,
          startDateLesser: startLesser,
          isAdult: false,
        });
        all.push(...pageData.media.map(mapAniList));
        if (!pageData.pageInfo?.hasNextPage) break;
      }

      u.items = C.dedupeById(all).filter(a => {
        const d = parseDate(a.airedFrom);
        return d && d >= from && d <= to;
      }).sort((a, b) => new Date(a.airedFrom) - new Date(b.airedFrom));
      u.loaded = true;
    } catch (err) {
      console.error(err);
      u.error = err.message || 'Ошибка сети';
      state.offline = true;
      if (!u.items.length) u.items = demoUpcoming();
      toast('Календарь премьер недоступен — включён демо-режим');
    } finally {
      u.loading = false;
      renderUpcoming();
      updateOfflineBanner();
      if (u.queued) {
        u.queued = false;
        fetchUpcoming(true);
      }
    }
  }

  /* ---------------- тир-листы ---------------- */
  function renderTierList(name) {
    const root = document.getElementById(name === 'watched' ? 'tiers-watched' : 'tiers-planned');
    if (!root) return;
    const list = state.lists[name];

    root.innerHTML = TIERS.map(t => {
      const items = list[t.id] || [];
      return `<div class="tier-row">
        <div class="tier-label tier-${t.id}" title="${esc(t.name)}">
          <span>${t.label}</span>
          <small>${esc(t.id === 'N' ? 'Без оц.' : t.name)}</small>
          <em>${items.length}</em>
        </div>
        <div class="tier-drop" data-list="${name}" data-tier="${t.id}">
          ${items.length
            ? items.map(a => tierCardHTML(name, a, t.id)).join('')
            : '<span class="tier-hint">Перетащите аниме сюда</span>'}
        </div>
      </div>`;
    }).join('');

    renderStats(name);
  }

  function renderStats(name) {
    const el = document.getElementById('stats-' + name);
    if (!el) return;
    const all = allIn(name);
    const eps = all.reduce((s, a) => s + (Number(a.episodes) || 0), 0);
    const scored = all.filter(a => typeof a.score === 'number');
    const avg = scored.length ? (scored.reduce((s, a) => s + a.score, 0) / scored.length).toFixed(2) : '—';
    el.innerHTML = `
      <div class="stat"><b>${all.length}</b><span>тайтлов</span></div>
      <div class="stat"><b>${eps}</b><span>серий (известных)</span></div>
      <div class="stat"><b>${avg}</b><span>средний балл</span></div>
      <div class="stat"><b>${(state.lists[name].S || []).length}</b><span>в тире S</span></div>`;
  }

  function updateCounters() {
    const w = $('#count-watched');
    const p = $('#count-planned');
    if (w) w.textContent = allIn('watched').length;
    if (p) p.textContent = allIn('planned').length;
  }

  /* ---------------- операции со списками ---------------- */
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

  function refreshViews() {
    updateCounters();
    renderTierList('watched');
    renderTierList('planned');
    if (state.tab === 'db') renderDB();
    else if (state.tab === 'notifications') renderNotifications();
    else if (state.tab === 'upcoming') renderUpcoming();
    if (state.modalId != null) renderModal();
  }

  /* ---------------- обмен тир-листами ---------------- */
  function syncBodyScroll() {
    const locked = state.modalId != null || Boolean(state.exchange && state.exchange.open);
    document.body.classList.toggle('no-scroll', locked);
  }

  function tierShort(tier) {
    return tier === 'N' ? 'Без оц.' : tier;
  }

  function openExchange(mode, list) {
    if (state.modalId != null) closeModal();
    const exportList = list === 'planned' ? 'planned' : 'watched';
    state.exchange = {
      open: true,
      mode: mode === 'import' ? 'import' : 'export',
      list: exportList,
      code: '',
      parsed: null,
      comparison: null,
      filter: 'all',
      error: '',
    };
    if (state.exchange.mode === 'export') {
      state.exchange.code = C.encodeTierShare(C.makeTierShare(exportList, state.lists[exportList], { tierIds: TIER_IDS }));
    }
    const modal = $('#exchange-modal');
    if (modal) modal.hidden = false;
    renderExchange();
    syncBodyScroll();
    const panel = $('#exchange-panel');
    if (panel) {
      panel.scrollTop = 0;
      panel.focus({ preventScroll: true });
    }
  }

  function closeExchange() {
    state.exchange.open = false;
    const modal = $('#exchange-modal');
    if (modal) modal.hidden = true;
    syncBodyScroll();
  }

  function setExchangeMode(mode) {
    const ex = state.exchange;
    if (!ex.open) return;
    ex.mode = mode === 'import' ? 'import' : 'export';
    ex.parsed = null;
    ex.comparison = null;
    ex.error = '';
    ex.filter = 'all';
    if (ex.mode === 'export') {
      ex.code = C.encodeTierShare(C.makeTierShare(ex.list, state.lists[ex.list], { tierIds: TIER_IDS }));
    }
    renderExchange();
    const panel = $('#exchange-panel');
    if (panel) panel.scrollTop = 0;
  }

  function switchExchangeList(list) {
    const ex = state.exchange;
    if (!ex.open || ex.mode !== 'export') return;
    ex.list = list === 'planned' ? 'planned' : 'watched';
    ex.code = C.encodeTierShare(C.makeTierShare(ex.list, state.lists[ex.list], { tierIds: TIER_IDS }));
    renderExchange();
  }

  function parseImportCode() {
    const ex = state.exchange;
    if (!ex.open || ex.mode !== 'import') return;
    const field = $('#import-code');
    const code = field ? field.value : ex.code;
    ex.code = code;
    ex.parsed = null;
    ex.comparison = null;
    ex.error = '';
    ex.filter = 'all';

    if (!code.trim()) {
      ex.error = 'Вставьте код тир-листа.';
      renderExchange();
      return;
    }

    try {
      const parsed = C.parseTierShare(code, { tierIds: TIER_IDS });
      ex.parsed = parsed;
      ex.comparison = C.compareTierLists(parsed.tiers, state.lists, { tierIds: TIER_IDS });
    } catch (err) {
      ex.error = err && err.message ? err.message : 'Не удалось прочитать код тир-листа.';
    }
    renderExchange();
  }

  function clearExchangeCode() {
    const ex = state.exchange;
    ex.code = '';
    ex.parsed = null;
    ex.comparison = null;
    ex.error = '';
    ex.filter = 'all';
    renderExchange();
    const field = $('#import-code');
    if (field) field.focus();
  }

  async function copyShareCode() {
    const field = $('#share-code');
    const text = field ? field.value : state.exchange.code;
    let copied = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        copied = true;
      }
    } catch {
      copied = false;
    }
    if (!copied && field) {
      field.focus();
      field.select();
      field.setSelectionRange(0, field.value.length);
      try { copied = document.execCommand('copy'); } catch { copied = false; }
    }
    toast(copied ? 'Код тир-листа скопирован' : 'Выделите код и скопируйте вручную');
  }

  function addExchangeItem(id) {
    const ex = state.exchange;
    if (!ex.open || !ex.parsed || !ex.comparison) return;
    const row = ex.comparison.rows.find(item => item.anime.id === id);
    if (!row) return;
    if (row.match || hasIn('watched', id) || hasIn('planned', id)) {
      toast('Этот тайтл уже есть в ваших списках');
      renderExchange();
      return;
    }

    addToList('planned', row.anime, 'N', true);
    ex.comparison = C.compareTierLists(ex.parsed.tiers, state.lists, { tierIds: TIER_IDS });
    renderExchange();
    toast(`«${row.anime.title}» → Запланировано · Без оценки`);
  }

  function exchangeRowHTML(row) {
    const anime = row.anime;
    const match = row.match;
    const meta = [
      anime.year || '',
      anime.episodes ? `${anime.episodes} эп.` : '',
      anime.score ? `★ ${anime.score.toFixed(1)}` : '',
    ].filter(Boolean).join(' · ');
    const status = match
      ? `<span class="exchange-badge you ${row.sameTier ? 'same' : 'different'}">${match.list === 'watched' ? 'Просмотрено' : 'В планах'}: ${esc(tierShort(match.tier))}</span>`
      : '<span class="exchange-badge new">Нет у вас</span>';
    const diff = match && !row.sameTier ? '<span class="exchange-badge diff">Другой тир</span>' : '';
    const add = match
      ? ''
      : `<button class="btn btn-tiny btn-primary exchange-add" data-action="exchange-add" data-id="${anime.id}">+ В планы</button>`;

    return `<article class="exchange-row">
      <img class="exchange-poster" ${imgAttrs(anime, '')}>
      <div class="exchange-row-main">
        <div class="exchange-row-title">${esc(anime.title)}</div>
        <div class="exchange-row-meta">${esc(meta || 'данные неполные')}</div>
        <div class="exchange-row-badges">
          <span class="exchange-badge friend">Друг: ${esc(tierShort(row.tier))}</span>
          ${status}${diff}
        </div>
      </div>
      ${add}
    </article>`;
  }

  function renderExchangeComparison(parsed, comparison, filter) {
    const summary = comparison.summary;
    const listLabel = LIST_LABELS[parsed.list] || parsed.list;
    const filters = EXCHANGE_FILTERS.map(item => {
      const count = item.id === 'all'
        ? summary.total
        : item.id === 'new'
          ? summary.newCount
          : summary.differentTier;
      return `<button class="exchange-chip ${filter === item.id ? 'is-active' : ''}" data-action="exchange-filter" data-filter="${item.id}">${item.label}<b>${count}</b></button>`;
    }).join('');

    const rows = comparison.rows.filter(row => {
      if (filter === 'new') return !row.match;
      if (filter === 'diff') return Boolean(row.match) && !row.sameTier;
      return true;
    });
    const byTier = {};
    for (const row of rows) {
      if (!byTier[row.tier]) byTier[row.tier] = [];
      byTier[row.tier].push(row);
    }
    const groups = TIERS.filter(tier => (byTier[tier.id] || []).length).map(tier => {
      const items = byTier[tier.id];
      return `<section class="exchange-tier">
        <div class="exchange-tier-head">
          <span class="exchange-tier-badge tier-${tier.id}">${esc(tier.label)}</span>
          <b>${esc(tier.name)}</b>
          <em>${items.length}</em>
        </div>
        <div class="exchange-rows">${items.map(exchangeRowHTML).join('')}</div>
      </section>`;
    }).join('');

    const emptyText = filter === 'new'
      ? 'Новых тайтлов нет — всё из этого списка уже есть у вас.'
      : filter === 'diff'
        ? 'Расхождений по тирам нет.'
        : 'В этом тир-листе нет тайтлов.';

    return `<div class="exchange-compare">
      <div class="exchange-summary">
        <div class="exchange-summary-main">
          <span class="exchange-summary-label">Тир-лист друга</span>
          <b>${esc(listLabel)}</b>
        </div>
        <div class="exchange-stats">
          <span><b>${summary.total}</b> всего</span>
          <span><b>${summary.common}</b> общих</span>
          <span><b>${summary.newCount}</b> новых</span>
          <span><b>${summary.yoursOnly}</b> только у вас</span>
        </div>
      </div>
      <div class="exchange-filters" role="group" aria-label="Фильтр сравнения">${filters}</div>
      ${groups || `<div class="exchange-empty">${esc(emptyText)}</div>`}
    </div>`;
  }

  function renderExchange() {
    const content = $('#exchange-content');
    const ex = state.exchange;
    if (!content || !ex.open) return;
    const isExport = ex.mode === 'export';
    const listLabel = LIST_LABELS[ex.list] || LIST_LABELS.watched;
    let body = '';

    if (isExport) {
      const count = allIn(ex.list).length;
      const switchHTML = ['watched', 'planned'].map(name => (
        `<button class="exchange-tab ${ex.list === name ? 'is-active' : ''}" data-action="exchange-list" data-list="${name}">${LIST_LABELS[name]}</button>`
      )).join('');
      body = `<div class="exchange-head">
          <div>
            <div class="exchange-eyebrow">Обмен тир-листом</div>
            <h2 id="exchange-title">Экспорт</h2>
            <p class="exchange-sub">Скопируйте код и отправьте другу. Внутри — список «${esc(listLabel)}»: ${count} ${plural(count, 'тайтл', 'тайтла', 'тайтлов')}.</p>
          </div>
          <div class="exchange-switch" role="group" aria-label="Какой список экспортировать">${switchHTML}</div>
        </div>
        ${count ? `<label class="exchange-field">
          <span>Код тир-листа</span>
          <textarea class="exchange-code" id="share-code" readonly rows="7">${esc(ex.code)}</textarea>
        </label>
        <div class="exchange-actions">
          <button class="btn btn-primary" data-action="exchange-copy">Скопировать код</button>
          <button class="btn btn-ghost" data-action="exchange-mode" data-mode="import">Перейти к импорту</button>
        </div>
        <p class="exchange-note">Код начинается с <code>${esc(C.SHARE_PREFIX)}</code>. Его можно отправить в мессенджере — файл не нужен.</p>`
          : `<div class="exchange-empty">В списке «${esc(listLabel)}» пока нет тайтлов. Добавьте хотя бы один — и код появится здесь.</div>
        <div class="exchange-actions">
          <button class="btn btn-ghost" data-action="exchange-mode" data-mode="import">Перейти к импорту</button>
        </div>`}
        <div class="exchange-footer">
          <span>Ничего не меняется, пока вы не добавите тайтлы в планы.</span>
          <button class="btn btn-ghost" data-action="close-exchange">Закрыть</button>
        </div>`;
    } else {
      const parsed = ex.parsed;
      const comparison = ex.comparison;
      body = `<div class="exchange-head">
          <div>
            <div class="exchange-eyebrow">Обмен тир-листом</div>
            <h2 id="exchange-title">Импорт и сравнение</h2>
            <p class="exchange-sub">Вставьте код друга. Сначала покажем сравнение — менять ваш тир-лист можно только по одному тайтлу.</p>
          </div>
          <button class="exchange-link" data-action="exchange-mode" data-mode="export">Экспорт →</button>
        </div>
        <label class="exchange-field">
          <span>Код тир-листа</span>
          <textarea class="exchange-code" id="import-code" rows="6" placeholder="Вставьте сюда ANITIER-TIER-1:…">${esc(ex.code)}</textarea>
        </label>
        ${ex.error ? `<div class="exchange-error" role="alert">${esc(ex.error)}</div>` : ''}
        <div class="exchange-actions">
          <button class="btn btn-primary" data-action="exchange-parse">Сравнить</button>
          ${parsed ? '<button class="btn btn-ghost" data-action="exchange-clear">Очистить</button>' : ''}
        </div>
        ${parsed && comparison ? renderExchangeComparison(parsed, comparison, ex.filter) : ''}
        <div class="exchange-footer">
          <span>Импорт не перезаписывает существующие тиры и не добавляет всё сразу.</span>
          <button class="btn btn-ghost" data-action="close-exchange">Ничего не добавлять</button>
        </div>`;
    }

    content.innerHTML = body;
  }

  /* ---------------- модалка ---------------- */
  function openModal(id) {
    const a = getAnime(id);
    if (!a) { toast('Не удалось открыть карточку'); return; }
    state.modalId = id;
    renderModal();
    const modal = $('#modal');
    modal.hidden = false;
    syncBodyScroll();
    const panel = $('.modal-panel');
    if (panel) { panel.scrollTop = 0; panel.focus({ preventScroll: true }); }
  }

  function closeModal() {
    state.modalId = null;
    const modal = $('#modal');
    if (modal) modal.hidden = true;
    syncBodyScroll();
    if (state.tab === 'db') renderDB();
    else if (state.tab === 'watched' || state.tab === 'planned') renderTierList(state.tab);
  }

  function renderModal() {
    if (state.modalId == null) return;
    const a = getAnime(state.modalId);
    const content = $('#modal-content');
    const panel = $('.modal-panel');
    if (!a || !content) { closeModal(); return; }

    const scrollTop = panel ? panel.scrollTop : 0;
    const inW = hasIn('watched', a.id);
    const inP = hasIn('planned', a.id);
    const curTier = findTier('watched', a.id) || findTier('planned', a.id);
    const status = a.status || '';
    const sourceName = a.source === 'Kitsu' ? 'Kitsu' : a.source === 'AniList' ? 'AniList' : 'MyAnimeList';
    const sourceUrl = a.url || (a.malId ? `https://myanimelist.net/anime/${a.malId}` : '');
    const facts = [
      a.type ? `<span class="fact"><span>Тип:</span> ${esc(typeRu(a.type))}</span>` : '',
      a.episodes ? `<span class="fact"><span>Серии:</span> ${a.episodes}</span>` : '<span class="fact"><span>Серии:</span> ?</span>',
      a.year ? `<span class="fact"><span>Год:</span> ${a.year}</span>` : '',
      status ? `<span class="fact"><span>Статус:</span> ${esc(status)}</span>` : '',
      a.airedFrom ? `<span class="fact"><span>Старт:</span> ${esc(dateShort(a.airedFrom))}</span>` : '',
    ].filter(Boolean).join('');

    const tiers = TIERS.map(t => `<button class="tier-pick tier-${t.id} ${curTier === t.id ? 'is-active' : ''}" data-action="set-tier" data-id="${a.id}" data-tier="${t.id}" title="${esc(t.name)}" aria-label="Тир ${esc(t.name)}">${t.label}</button>`).join('');
    const genres = (a.genres || []).map(g => `<span class="tag">${esc(g)}</span>`).join('');
    const poster = a.image || makePoster(a.title, a.id);

    content.innerHTML = `
      <div class="modal-grid">
        <div class="modal-poster">
          <div class="modal-poster-wrap">
            <img src="${esc(poster)}" alt="${esc(a.title)}" data-title="${esc(a.title)}" data-id="${a.id}" onerror="posterFallback(this)">
            <div class="modal-side-score">${a.score ? `★ ${a.score.toFixed(2)}` : '★ —'}<small>рейтинг</small></div>
          </div>
        </div>
        <div class="modal-info">
          <div class="modal-eyebrow">${esc(typeRu(a.type) || 'Аниме')}${a.year ? ' · ' + a.year : ''}</div>
          <h2 id="modal-title">${esc(a.title)}</h2>
          ${a.altTitle ? `<p class="modal-alt">${esc(a.altTitle)}</p>` : ''}
          <div class="modal-facts">${facts}</div>
          <div class="modal-actions">
            <button class="btn ${inW ? 'is-on' : 'btn-primary'}" data-action="add-watched" data-id="${a.id}">${inW ? '✓ В просмотрено' : 'Отметить просмотренным'}</button>
            <button class="btn btn-ghost ${inP ? 'is-on' : ''}" data-action="add-planned" data-id="${a.id}">${inP ? '◷ В планах' : 'Запланировать'}</button>
          </div>
          <div class="modal-section">
            <div class="modal-label">Тир-лист</div>
            <div class="tier-picker">${tiers}</div>
            <p class="hint">${inW || inP
              ? 'Выберите уровень — карточка переедет в выбранный тир.'
              : 'Выберите тир, чтобы сразу добавить тайтл в «Просмотрено».'}</p>
          </div>
          <div class="modal-section modal-episodes">
            <div class="modal-label">Серии и прогресс</div>
            ${renderEpisodeBlock(a, 'modal')}
          </div>
          <p class="modal-synopsis">${esc(a.synopsis || 'Описание пока недоступно.')}</p>
          ${genres ? `<div class="tags">${genres}</div>` : ''}
          ${sourceUrl ? `<a class="mal-link" href="${esc(sourceUrl)}" target="_blank" rel="noopener">Открыть на ${esc(sourceName)} ↗</a>` : ''}
        </div>
      </div>`;

    const fresh = $('.modal-panel');
    if (fresh) fresh.scrollTop = scrollTop;

    if (!state.epInfo[a.id] || Date.now() - Number(state.epInfo[a.id].fetchedAt || 0) > 2 * 3600000) {
      if (a.status === 'В эфире' || !a.episodes) ensureEpisodeInfo(a);
    }
  }

  /* ---------------- вкладки ---------------- */
  function switchTab(tab, opts = {}) {
    if (!VIEW_TABS.includes(tab)) return;
    state.tab = tab;
    $$('.tab').forEach(t => {
      const on = t.dataset.tab === tab;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    $$('.view').forEach(v => { v.hidden = v.id !== 'view-' + tab; });

    if (tab === 'db') renderDB();
    if (tab === 'watched' || tab === 'planned') renderTierList(tab);
    if (tab === 'notifications') { markNotificationsSeen(); fetchNotifications(); ensureNotificationEpisodes(); }
    if (tab === 'upcoming') fetchUpcoming();
    updateOfflineBanner();

    if (!opts.silent) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------------- обновление / офлайн ---------------- */
  function updateOfflineBanner() {
    const el = $('#offline-banner');
    if (!el) return;
    const show = state.offline || state.forceDemo;
    el.hidden = !show;
    const text = $('#offline-text');
    if (text && show) {
      const altSearch = state.tab === 'db' && Boolean(state.db.query) && state.db.sources.length > 0;
      if (state.forceDemo) {
        text.textContent = 'Демо-режим: показана локальная подборка, запросы к API отключены.';
      } else if (altSearch) {
        text.textContent = `Основной API недоступен — поиск идёт через ${state.db.sources.join(' и ')}. Остальные данные — демо.`;
      } else {
        text.textContent = 'Нет связи с API — показаны демо-данные.';
      }
    }
  }

  async function refreshCurrent() {
    anilistCache.clear();
    if (state.tab === 'db') {
      await fetchDB(true);
    } else if (state.tab === 'notifications') {
      await fetchNotifications(true);
    } else if (state.tab === 'upcoming') {
      await fetchUpcoming(true);
    } else {
      toast('Тир-листы хранятся локально — обновлять нечего');
    }
  }

  async function retryAll() {
    state.forceDemo = false;
    anilistCache.clear();
    state.epInfo = {};
    saveState();

    state.db.revision += 1;
    state.db.items = [];
    state.db.page = 1;
    state.db.hasNext = true;
    state.db.error = null;
    state.db.queued = false;
    state.db.touched = false;

    state.notifications.airing = [];
    state.notifications.completed = [];
    state.notifications.loaded = false;
    state.notifications.queued = false;
    state.upcoming.items = [];
    state.upcoming.loaded = false;
    state.upcoming.queued = false;
    state.offline = false;
    updateOfflineBanner();

    await Promise.allSettled([fetchNotifications(), fetchUpcoming()]);
    await fetchDB(true);
  }

  /* ---------------- тосты ---------------- */
  function toast(message) {
    const box = $('#toasts');
    if (!box) return;
    while (box.children.length >= 4) box.firstElementChild.remove();
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    box.appendChild(el);
    setTimeout(() => {
      el.classList.add('is-out');
      setTimeout(() => el.remove(), 240);
    }, 3200);
  }

  /* ---------------- drag & drop ---------------- */
  let dragState = null;

  function cleanupDrag() {
    dragState = null;
    $$('.tier-card.dragging').forEach(c => c.classList.remove('dragging'));
    $$('.tier-drop.is-over').forEach(d => d.classList.remove('is-over'));
  }

  function bindDragEvents() {
    document.addEventListener('dragstart', e => {
      const card = e.target.closest && e.target.closest('.tier-card');
      if (!card) return;
      dragState = { list: card.dataset.list, id: Number(card.dataset.id) };
      card.classList.add('dragging');
      try {
        e.dataTransfer.setData('text/plain', String(card.dataset.id));
        e.dataTransfer.effectAllowed = 'move';
      } catch { /* noop */ }
    });

    document.addEventListener('dragend', cleanupDrag);

    document.addEventListener('dragover', e => {
      if (!dragState) return;
      const drop = e.target.closest && e.target.closest('.tier-drop');
      if (!drop) return;
      e.preventDefault();
      try { e.dataTransfer.dropEffect = 'move'; } catch { /* noop */ }
      if (!drop.classList.contains('is-over')) {
        $$('.tier-drop.is-over').forEach(d => d.classList.remove('is-over'));
        drop.classList.add('is-over');
      }
    });

    document.addEventListener('dragleave', e => {
      const drop = e.target.closest && e.target.closest('.tier-drop');
      if (drop && !drop.contains(e.relatedTarget)) drop.classList.remove('is-over');
    });

    document.addEventListener('drop', e => {
      if (!dragState) return;
      const drop = e.target.closest && e.target.closest('.tier-drop');
      if (!drop) return;
      e.preventDefault();
      const name = drop.dataset.list;
      const tier = drop.dataset.tier;
      const { list, id } = dragState;
      cleanupDrag();
      if (name !== list) return;
      moveToTier(name, id, tier);
    });
  }

  /* ---------------- события ---------------- */
  let searchTimer = null;

  function bindEvents() {
    document.addEventListener('click', e => {
      const el = e.target.closest && e.target.closest('[data-action]');
      if (!el) return;
      const action = el.dataset.action;
      const id = el.dataset.id != null ? Number(el.dataset.id) : null;

      switch (action) {
        case 'tab':
          e.preventDefault();
          switchTab(el.dataset.tab);
          break;

        case 'open':
          if (e.target.closest('button')) return;
          if (id != null) openModal(id);
          break;

        case 'add-watched':
          toggleList('watched', getAnime(id));
          break;

        case 'add-planned':
          toggleList('planned', getAnime(id));
          break;

        case 'remove': {
          const list = el.dataset.list || (hasIn('planned', id) ? 'planned' : 'watched');
          if (removeFromList(list, id)) toast('Тайтл убран из тир-листа');
          break;
        }

        case 'set-tier': {
          const a = getAnime(id);
          if (!a) break;
          const tier = el.dataset.tier;
          if (!hasIn('watched', id) && !hasIn('planned', id)) {
            addToList('watched', a, tier);
          } else {
            const list = hasIn('watched', id) ? 'watched' : 'planned';
            moveToTier(list, id, tier);
          }
          break;
        }

        case 'toggle-ep': {
          const ep = Number(el.dataset.ep);
          if (id != null && Number.isInteger(ep) && ep > 0) toggleEpisode(id, ep);
          break;
        }

        case 'ep-all': {
          const max = Number(el.dataset.max) || 0;
          if (id != null && max > 0) {
            setWatchedUpTo(id, max, max);
            toast(`Отмечены все ${max} ${epWord(max)}`);
          }
          break;
        }

        case 'ep-reset':
          if (id != null) {
            clearProgress(id);
            toast('Прогресс серий сброшен');
          }
          break;

        case 'mode': {
          const mode = el.dataset.mode;
          if (!mode) break;
          state.db.mode = mode;
          state.db.query = '';
          state.db.touched = true;
          resetDBFilters();
          const input = $('#search-input');
          if (input) input.value = '';
          syncModeChips();
          fetchDB(true);
          break;
        }

        case 'toggle-filters': {
          const panel = $('#db-filters');
          if (!panel) break;
          panel.hidden = !panel.hidden;
          el.setAttribute('aria-expanded', panel.hidden ? 'false' : 'true');
          break;
        }

        case 'reset-filters':
          resetDBFilters();
          state.db.mode = 'popular';
          state.db.touched = true;
          syncModeChips();
          fetchDB(true);
          break;

        case 'load-more':
          fetchDB();
          break;

        case 'refresh':
          refreshCurrent();
          break;

        case 'refresh-notifications':
          fetchNotifications(true);
          break;

        case 'refresh-upcoming':
          fetchUpcoming(true);
          break;

        case 'retry-db':
          fetchDB(true);
          break;

        case 'retry-notifications':
          fetchNotifications(true);
          break;

        case 'retry-upcoming':
          fetchUpcoming(true);
          break;

        case 'retry-all':
          retryAll();
          break;

        case 'close-modal':
          closeModal();
          break;

        case 'exchange-export':
          openExchange('export', el.dataset.list || state.tab);
          break;

        case 'exchange-import':
          openExchange('import', state.tab);
          break;

        case 'exchange-mode':
          setExchangeMode(el.dataset.mode);
          break;

        case 'exchange-list':
          switchExchangeList(el.dataset.list);
          break;

        case 'exchange-copy':
          copyShareCode();
          break;

        case 'exchange-parse':
          parseImportCode();
          break;

        case 'exchange-clear':
          clearExchangeCode();
          break;

        case 'exchange-filter':
          state.exchange.filter = el.dataset.filter || 'all';
          renderExchange();
          break;

        case 'exchange-add':
          addExchangeItem(id);
          break;

        case 'close-exchange':
          closeExchange();
          break;

        case 'find-more':
          switchTab('db');
          setTimeout(() => {
            const input = $('#search-input');
            if (input) { input.focus(); input.select(); }
          }, 80);
          break;

        default:
          break;
      }
    });

    const search = $('#search-input');
    if (search) {
      search.addEventListener('input', () => {
        clearTimeout(searchTimer);
        const val = search.value.trim();
        searchTimer = setTimeout(() => {
          state.db.query = val;
          state.db.touched = true;
          syncModeChips();
          fetchDB(true);
        }, 500);
      });
    }

    const filters = $('#db-filters');
    if (filters) {
      filters.addEventListener('change', () => {
        state.db.filters = readFiltersFromUI();
        state.db.mode = 'popular';
        state.db.touched = true;
        syncModeChips();
        syncFilterUI();
        fetchDB(true);
      });
    }

    document.addEventListener('input', e => {
      const slider = e.target.closest && e.target.closest('input[data-action="ep-slider"]');
      if (slider) previewEpisodeSlider(slider);
      if (e.target && e.target.id === 'import-code' && state.exchange.open) {
        state.exchange.code = e.target.value;
      }
    });

    document.addEventListener('change', e => {
      const slider = e.target.closest && e.target.closest('input[data-action="ep-slider"]');
      if (!slider) return;
      const id = Number(slider.dataset.id);
      const max = Number(slider.dataset.max) || 0;
      if (id != null && max > 0) setWatchedUpTo(id, Number(slider.value), max);
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if (state.exchange.open) {
          closeExchange();
          return;
        }
        if (state.modalId != null) closeModal();
      }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.target && e.target.id === 'import-code') {
        e.preventDefault();
        parseImportCode();
        return;
      }
      if (e.key === 'Enter' && e.target && e.target.matches && e.target.matches('.card, .notif, .tier-card')) {
        e.preventDefault();
        openModal(Number(e.target.dataset.id));
      }
    });

    window.addEventListener('storage', e => {
      if (e.key !== LS_KEY) return;
      loadState();
      updateCounters();
      updateBell();
      renderTierList('watched');
      renderTierList('planned');
      if (state.tab === 'db') renderDB();
      else if (state.tab === 'notifications') renderNotifications();
      else if (state.tab === 'upcoming') renderUpcoming();
      if (state.modalId != null) renderModal();
      if (state.exchange.open) {
        if (state.exchange.mode === 'export') {
          state.exchange.code = C.encodeTierShare(C.makeTierShare(state.exchange.list, state.lists[state.exchange.list], { tierIds: TIER_IDS }));
        }
        if (state.exchange.parsed) {
          state.exchange.comparison = C.compareTierLists(state.exchange.parsed.tiers, state.lists, { tierIds: TIER_IDS });
        }
        renderExchange();
      }
    });

    bindDragEvents();
  }

  /* ---------------- бесконечная лента и старт ---------------- */
  let dbObserver = null;
  let dbUserScrolled = false;
  let dbScrollStart = 0;

  function setupInfiniteScroll() {
    const sentinel = $('#db-sentinel');
    if (!sentinel || !('IntersectionObserver' in window)) return;

    dbScrollStart = window.scrollY;
    window.addEventListener('scroll', () => {
      if (Math.abs(window.scrollY - dbScrollStart) > 30) dbUserScrolled = true;
    }, { passive: true });

    dbObserver = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      if (!dbUserScrolled) return;
      const s = state.db;
      if (state.tab !== 'db' || state.booting || s.loading || !s.hasNext) return;
      fetchDB();
    }, { rootMargin: '600px 0px' });

    dbObserver.observe(sentinel);
  }

  async function bootstrap() {
    try {
      await Promise.allSettled([fetchNotifications(), fetchUpcoming()]);
      if (!state.db.touched) await fetchDB(true);
    } finally {
      state.booting = false;
      state.bootstrapDone = true;
      renderDB();
    }
  }

  async function init() {
    state.booting = true;
    loadState();
    initFilterOptions();
    syncFilterUI();
    syncModeChips();
    bindEvents();
    setupInfiniteScroll();

    renderTierList('watched');
    renderTierList('planned');
    updateCounters();
    updateBell();
    updateOfflineBanner();
    renderDB();

    const yearEl = $('#footer-year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    const modal = $('#modal');
    if (modal) modal.hidden = true;
    const exchangeModal = $('#exchange-modal');
    if (exchangeModal) exchangeModal.hidden = true;

    return bootstrap();
  }

  if (TEST_MODE) {
    window.__anitierTest = {
      state,
      init,
      fetchDB,
      fetchNotifications,
      fetchUpcoming,
      resetDBFilters,
      syncFilterUI,
      invalidateNotificationEpisodes,
      openExchange,
      closeExchange,
      setExchangeMode,
      switchExchangeList,
      parseImportCode,
      addExchangeItem,
      renderExchange,
    };
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { init(); });
  } else {
    init();
  }
})();
