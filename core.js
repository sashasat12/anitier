/* Чистые функции AniTier: фильтры, параметры AniList, страницы.
   Модуль не зависит от DOM и используется приложением и тестами. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AniTierCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const PAGE_LIMIT = 20;
  const TIER_IDS = ['S', 'A', 'B', 'C', 'D', 'F', 'N'];
  const SHARE_PREFIX = 'ANITIER-TIER-1:';
  const SHARE_KIND = 'anitier.tierlist';
  const SHARE_VERSION = 1;
  const SHARE_MAX_LENGTH = 2000000;

  const GENRES = [
    { id: 1, label: 'Экшен', names: ['Боевик', 'Action'] },
    { id: 2, label: 'Приключения', names: ['Приключения', 'Adventure'] },
    { id: 4, label: 'Комедия', names: ['Комедия', 'Comedy'] },
    { id: 7, label: 'Детектив', names: ['Детектив', 'Mystery'] },
    { id: 8, label: 'Драма', names: ['Драма', 'Drama'] },
    { id: 10, label: 'Фэнтези', names: ['Фэнтези', 'Fantasy'] },
    { id: 13, label: 'Историческое', names: ['Историческое', 'Historical'] },
    { id: 14, label: 'Ужасы', names: ['Ужасы', 'Horror'] },
    { id: 16, label: 'Махо-сёдзё', names: ['Махо-сёдзё', 'Mahou Shoujo'] },
    { id: 18, label: 'Меха', names: ['Меха', 'Mecha'] },
    { id: 19, label: 'Музыка', names: ['Музыка', 'Music'] },
    { id: 20, label: 'Пародия', names: ['Пародия', 'Parody'] },
    { id: 21, label: 'Самураи', names: ['Самураи', 'Samurai'] },
    { id: 22, label: 'Романтика', names: ['Романтика', 'Romance'] },
    { id: 23, label: 'Школа', names: ['Школа', 'School'] },
    { id: 24, label: 'Фантастика', names: ['Фантастика', 'Sci-Fi'] },
    { id: 27, label: 'Сёнен', names: ['Сёнен', 'Shounen'] },
    { id: 29, label: 'Космос', names: ['Космос', 'Space'] },
    { id: 30, label: 'Спорт', names: ['Спорт', 'Sports'] },
    { id: 31, label: 'Суперсила', names: ['Супергерои', 'Super Power'] },
    { id: 32, label: 'Вампиры', names: ['Вампиры', 'Vampire'] },
    { id: 35, label: 'Гарем', names: ['Гарем', 'Harem'] },
    { id: 36, label: 'Повседневность', names: ['Повседневность', 'Slice of Life'] },
    { id: 37, label: 'Сверхъестественное', names: ['Сверхъестественное', 'Supernatural'] },
    { id: 38, label: 'Военное', names: ['Военное', 'Military'] },
    { id: 39, label: 'Детектив', names: ['Детектив', 'Detective'] },
    { id: 40, label: 'Психологическое', names: ['Психологическое', 'Psychological'] },
    { id: 41, label: 'Триллер', names: ['Триллер', 'Thriller'] },
    { id: 42, label: 'Сэйнэн', names: ['Сэйнэн', 'Seinen'] },
    { id: 43, label: 'Дзёсэй', names: ['Дзёсэй', 'Josei'] },
    { id: 62, label: 'Исекай', names: ['Исекай', 'Isekai'] },
  ];

  const SEARCH_LANGS = [
    { value: 'auto', label: 'Авто' },
    { value: 'ru', label: 'Русский' },
    { value: 'en', label: 'English' },
    { value: 'ja', label: '日本語' },
  ];

  const EXTRA_GENRE_RU = {
    ecchi: 'Этти',
    'boys love': 'BL',
    'girls love': 'GL',
    hentai: 'Хентай',
    'adult cast': 'Взрослые герои',
    elf: 'Эльфы',
    elves: 'Эльфы',
    magic: 'Магия',
    demons: 'Демоны',
    monster: 'Монстры',
    monsters: 'Монстры',
    ghost: 'Призраки',
    ghosts: 'Призраки',
    'martial arts': 'Боевые искусства',
    friendship: 'Дружба',
    'coming of age': 'Взросление',
    tragedy: 'Трагедия',
    'time travel': 'Путешествия во времени',
    'post-apocalyptic': 'Постапокалипсис',
    cyberpunk: 'Киберпанк',
    game: 'Игры',
    games: 'Игры',
    harem: 'Гарем',
    isekai: 'Исекай',
    villainess: 'Злодейка',
    reincarnation: 'Перерождение',
    ninja: 'Ниндзя',
    pirate: 'Пираты',
    pirates: 'Пираты',
    robot: 'Роботы',
    robots: 'Роботы',
    idol: 'Идолы',
    police: 'Полиция',
    crime: 'Криминал',
    'school life': 'Школа',
    'high school': 'Школа',
  };

  const GENRE_RU = (() => {
    const map = {};
    for (const genre of GENRES) {
      for (const name of genre.names) {
        if (/[a-z]/i.test(name)) map[name.toLowerCase()] = genre.label;
      }
    }
    return map;
  })();

  function hasCyrillic(value) {
    return /[\u0400-\u04ff]/.test(String(value == null ? '' : value));
  }

  function hasJapanese(value) {
    return /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(String(value == null ? '' : value));
  }

  function firstCyrillic(values) {
    for (const value of Array.isArray(values) ? values : []) {
      const text = String(value == null ? '' : value).trim();
      if (text && hasCyrillic(text)) return text;
    }
    return '';
  }

  function normalizeSearchLang(value) {
    const key = String(value == null ? '' : value).trim().toLowerCase();
    return SEARCH_LANGS.some(lang => lang.value === key) ? key : 'auto';
  }

  function detectQueryLang(query) {
    const text = String(query == null ? '' : query).trim();
    if (hasJapanese(text)) return 'ja';
    if (hasCyrillic(text)) return 'ru';
    return 'en';
  }

  function genreRu(name) {
    const raw = String(name == null ? '' : name).trim();
    if (!raw || hasCyrillic(raw)) return raw;
    return GENRE_RU[raw.toLowerCase()] || EXTRA_GENRE_RU[raw.toLowerCase()] || raw;
  }

  const TYPES = [
    { value: 'tv', label: 'ТВ-сериал' },
    { value: 'movie', label: 'Фильм' },
    { value: 'ova', label: 'OVA' },
    { value: 'ona', label: 'ONA' },
    { value: 'special', label: 'Спешл' },
  ];

  const STATUSES = [
    { value: 'airing', label: 'В эфире' },
    { value: 'complete', label: 'Завершено' },
    { value: 'upcoming', label: 'Анонс' },
  ];

  const SCORES = [
    { value: '6', label: 'от 6' },
    { value: '7', label: 'от 7' },
    { value: '8', label: 'от 8' },
    { value: '9', label: 'от 9' },
  ];

  const STATUS_NAMES = {
    airing: 'В эфире',
    complete: 'Завершено',
    upcoming: 'Анонс',
  };

  const DEFAULT_FILTERS = Object.freeze({
    type: '',
    status: '',
    year: '',
    genre: '',
    minScore: '',
  });

  function normalizeFilters(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const string = value => String(value == null ? '' : value).trim();
    const year = string(source.year);
    const minScore = string(source.minScore);

    return {
      type: TYPES.some(item => item.value === string(source.type)) ? string(source.type) : '',
      status: STATUSES.some(item => item.value === string(source.status)) ? string(source.status) : '',
      year: /^\d{4}$/.test(year) ? year : '',
      genre: GENRES.some(item => String(item.id) === string(source.genre)) ? string(source.genre) : '',
      minScore: SCORES.some(item => item.value === minScore) ? minScore : '',
    };
  }

  function hasActiveFilters(filters) {
    const normalized = normalizeFilters(filters);
    return Boolean(normalized.type || normalized.status || normalized.year || normalized.genre || normalized.minScore);
  }

  function countActiveFilters(filters) {
    const normalized = normalizeFilters(filters);
    return ['type', 'status', 'year', 'genre', 'minScore'].filter(key => normalized[key]).length;
  }

  function genreById(id) {
    return GENRES.find(item => String(item.id) === String(id)) || null;
  }

  function matchesFilters(anime, filters) {
    const normalized = normalizeFilters(filters);

    if (normalized.type && String(anime.type || '').toLowerCase() !== normalized.type) return false;
    if (normalized.status && String(anime.status || '') !== STATUS_NAMES[normalized.status]) return false;
    if (normalized.year && Number(anime.year) !== Number(normalized.year)) return false;
    if (normalized.minScore) {
      if (typeof anime.score !== 'number' || anime.score < Number(normalized.minScore)) return false;
    }
    if (normalized.genre) {
      const genre = genreById(normalized.genre);
      if (!genre) return false;
      const names = Array.isArray(anime.genres) ? anime.genres : [];
      if (!names.some(name => genre.names.includes(name))) return false;
    }

    return true;
  }

  function filterItems(items, options = {}) {
    const query = normalizeTitleKey(options.query);
    const filters = normalizeFilters(options.filters);

    return (Array.isArray(items) ? items : []).filter(anime => {
      if (!anime) return false;
      if (query && !searchHaystack(anime).includes(query)) return false;
      return matchesFilters(anime, filters);
    });
  }

  /**
   * Что реально есть в списке: годы и жанры для выпадающих фильтров.
   * Пустых вариантов не показываем, поэтому в списке остаются только нужные.
   */
  function listFilterOptions(items) {
    const years = new Set();
    const genres = new Set();

    for (const anime of Array.isArray(items) ? items : []) {
      if (!anime) continue;
      const year = Number(anime.year);
      if (Number.isFinite(year) && year > 0) years.add(year);
      const names = Array.isArray(anime.genres) ? anime.genres : [];
      for (const genre of GENRES) {
        if (names.some(name => genre.names.includes(name))) genres.add(String(genre.id));
      }
    }

    return {
      years: [...years].sort((a, b) => b - a),
      genres: GENRES.filter(genre => genres.has(String(genre.id)))
        .map(genre => ({ id: genre.id, label: genre.label })),
    };
  }

  /* ---------------- «Скоро выйдут»: свои списки и фильтры ---------------- */

  /** Ключ месяца премьеры: 'YYYY-MM' или '' для неизвестной даты. */
  function upcomingMonthKey(value) {
    const text = String(value == null ? '' : value).trim();
    const match = text.match(/^(\d{4})-(\d{2})/);
    return match ? `${match[1]}-${match[2]}` : '';
  }

  /** Убирает из премьер то, что уже лежит в «Просмотрено» или «Запланировано». */
  function excludeListed(items, listed) {
    const seen = new Set();
    for (const item of Array.isArray(listed) ? listed : []) {
      for (const key of animeIdentityKeys(item)) seen.add(key);
    }
    const list = Array.isArray(items) ? items : [];
    if (!seen.size) return list.slice();
    return list.filter(anime => anime && !animeIdentityKeys(anime).some(key => seen.has(key)));
  }

  /** Строка для поиска по тайтлу: названия, альтернативы, жанры, студии. */
  function searchHaystack(anime) {
    if (!anime) return '';
    const parts = [anime.title, anime.altTitle, anime.originalTitle];
    if (Array.isArray(anime.aliases)) parts.push(...anime.aliases);
    if (Array.isArray(anime.genres)) {
      parts.push(...anime.genres);
      parts.push(...anime.genres.map(genreRu));
    }
    if (Array.isArray(anime.studios)) parts.push(...anime.studios);
    return normalizeTitleKey(parts.filter(Boolean).join(' '));
  }

  function upcomingTime(anime) {
    const date = new Date(anime && anime.airedFrom ? anime.airedFrom : '');
    return Number.isNaN(date.getTime()) ? Infinity : date.getTime();
  }

  /** Фильтры и сортировка премьер: месяц, тип, жанр, поиск, порядок. */
  function filterUpcoming(items, options = {}) {
    const query = normalizeTitleKey(options.query);
    const filters = normalizeFilters(options.filters);
    const month = upcomingMonthKey(options.month);
    const sort = options.sort === 'title' ? 'title' : 'date';

    const result = (Array.isArray(items) ? items : []).filter(anime => {
      if (!anime) return false;
      if (month && upcomingMonthKey(anime.airedFrom) !== month) return false;
      if (query && !searchHaystack(anime).includes(query)) return false;
      return matchesFilters(anime, filters);
    });

    if (sort === 'title') {
      result.sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'ru'));
    } else {
      result.sort((a, b) => upcomingTime(a) - upcomingTime(b));
    }
    return result;
  }

  const ANILIST_FORMATS = {
    tv: 'TV',
    movie: 'MOVIE',
    ova: 'OVA',
    ona: 'ONA',
    special: 'SPECIAL',
  };

  const ANILIST_STATUSES = {
    airing: 'RELEASING',
    complete: 'FINISHED',
    upcoming: 'NOT_YET_RELEASED',
  };

  function aniListGenre(id) {
    const genre = genreById(id);
    return genre ? genre.names[genre.names.length - 1] : '';
  }

  function buildAniListVariables(options = {}) {
    const mode = options.mode || 'popular';
    const query = String(options.query || '').trim();
    const filters = normalizeFilters(options.filters);
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.max(1, Number(options.limit) || PAGE_LIMIT);
    const variables = { page, perPage: limit, type: 'ANIME', isAdult: false };
    const active = hasActiveFilters(filters);

    if (mode === 'airing') variables.status = 'RELEASING';
    if (mode === 'movie') variables.format = 'MOVIE';
    if (query) variables.search = query;
    if (filters.type) variables.format = ANILIST_FORMATS[filters.type];
    if (filters.status) variables.status = ANILIST_STATUSES[filters.status];
    if (filters.year) variables.seasonYear = Number(filters.year);
    if (filters.genre) {
      const genre = aniListGenre(filters.genre);
      if (genre) variables.genre = genre;
    }
    if (filters.minScore) variables.averageScoreGreater = Number(filters.minScore) * 10 - 1;

    if (mode === 'score') variables.sort = ['SCORE_DESC'];
    else if (!query || active) variables.sort = ['POPULARITY_DESC'];

    return variables;
  }

  function dedupeById(items) {
    const seen = new Set();
    return (Array.isArray(items) ? items : []).filter(item => {
      if (!item || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }

  function normalizeTitleKey(value) {
    return String(value == null ? '' : value)
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9\u0400-\u04ff]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  function animeIdentityKeys(item) {
    if (!item || typeof item !== 'object') return [];
    const keys = [];
    if (item.id != null) keys.push(`id:${item.id}`);
    if (item.malId != null) keys.push(`mal:${item.malId}`);
    if (item.source && item.sourceId != null) keys.push(`src:${item.source}:${item.sourceId}`);

    const year = Number(item.year) || 0;
    const titles = [item.title, item.altTitle, ...(Array.isArray(item.aliases) ? item.aliases : [])];
    const normalized = new Set(titles.map(normalizeTitleKey).filter(Boolean));
    for (const title of normalized) keys.push(`title:${title}:${year || '?'}`);
    return keys;
  }

  function mergeUniqueAnime(groups, seen = new Set()) {
    const lists = (Array.isArray(groups) ? groups : []).map(group => (
      Array.isArray(group) ? group : []
    ));
    const merged = [];
    let index = 0;
    let hasMore = true;

    while (hasMore) {
      hasMore = false;
      for (const list of lists) {
        if (index >= list.length) continue;
        hasMore = true;
        const item = list[index];
        const keys = animeIdentityKeys(item);
        if (!keys.length || keys.some(key => seen.has(key))) continue;
        keys.forEach(key => seen.add(key));
        merged.push(item);
      }
      index += 1;
    }

    return merged;
  }

  function slicePage(items, page, limit = PAGE_LIMIT) {
    const list = Array.isArray(items) ? items : [];
    const current = Math.max(1, Number(page) || 1);
    const size = Math.max(1, Number(limit) || PAGE_LIMIT);
    const start = (current - 1) * size;
    return {
      items: list.slice(start, start + size),
      hasNext: start + size < list.length,
    };
  }

  /* ---------------- обмен тир-листами ---------------- */

  function shareNumber(value) {
    if (value == null || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function shareString(value, max) {
    return String(value == null ? '' : value).trim().slice(0, max);
  }

  function shareUrl(value) {
    const url = shareString(value, 1000);
    return /^https?:\/\//i.test(url) ? url : '';
  }

  function compactShareAnime(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const id = shareNumber(raw.id);
    if (id == null) return null;
    const title = shareString(raw.title, 300) || shareString(raw.altTitle, 300);
    if (!title) return null;
    const altTitle = shareString(raw.altTitle, 300);
    const sourceId = raw.sourceId == null
      ? null
      : (Number.isFinite(Number(raw.sourceId)) ? Number(raw.sourceId) : shareString(raw.sourceId, 80));

    return {
      id,
      malId: shareNumber(raw.malId),
      title,
      altTitle: altTitle === title ? '' : altTitle,
      image: shareUrl(raw.image),
      episodes: shareNumber(raw.episodes),
      type: shareString(raw.type, 40),
      status: shareString(raw.status, 40),
      score: shareNumber(raw.score),
      year: shareNumber(raw.year),
      airedFrom: shareString(raw.airedFrom, 40),
      airedTo: shareString(raw.airedTo, 40),
      synopsis: shareString(raw.synopsis, 300),
      genres: Array.isArray(raw.genres)
        ? raw.genres.map(genre => shareString(genre, 60)).filter(Boolean).slice(0, 12)
        : [],
      url: shareUrl(raw.url),
      source: shareString(raw.source, 40),
      sourceId,
      demo: Boolean(raw.demo),
    };
  }

  function normalizeSharedAnime(raw) {
    const anime = compactShareAnime(raw);
    if (!anime) return null;
    return {
      ...anime,
      episodes: anime.episodes == null ? null : Math.max(0, Math.floor(anime.episodes)),
      score: anime.score == null ? null : Math.max(0, Math.min(10, anime.score)),
      year: anime.year == null ? null : Math.floor(anime.year),
    };
  }

  function utf8ToBinary(value) {
    const text = String(value == null ? '' : value);
    if (typeof TextEncoder !== 'undefined') {
      const bytes = new TextEncoder().encode(text);
      let binary = '';
      const chunk = 0x8000;
      for (let index = 0; index < bytes.length; index += chunk) {
        binary += String.fromCharCode.apply(null, bytes.subarray(index, index + chunk));
      }
      return binary;
    }
    return unescape(encodeURIComponent(text));
  }

  function binaryToUtf8(value) {
    const binary = String(value == null ? '' : value);
    if (typeof TextDecoder !== 'undefined') {
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      return new TextDecoder().decode(bytes);
    }
    return decodeURIComponent(escape(binary));
  }

  function encodeShareBase64(value) {
    return btoa(utf8ToBinary(value))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }

  function decodeShareBase64(value) {
    let base64 = String(value == null ? '' : value).replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    return binaryToUtf8(atob(base64));
  }

  function makeTierShare(listName, tiers, options = {}) {
    const tierIds = Array.isArray(options.tierIds) ? options.tierIds : TIER_IDS;
    const list = listName === 'planned' ? 'planned' : 'watched';
    const source = tiers && typeof tiers === 'object' ? tiers : {};
    const now = options.now == null ? new Date() : new Date(options.now);
    const payload = {
      app: 'AniTier',
      kind: SHARE_KIND,
      version: SHARE_VERSION,
      list,
      exportedAt: Number.isNaN(now.getTime()) ? new Date().toISOString() : now.toISOString(),
      tiers: {},
    };

    for (const tier of tierIds) {
      const items = Array.isArray(source[tier]) ? source[tier] : [];
      payload.tiers[tier] = items.map(compactShareAnime).filter(Boolean);
    }
    return payload;
  }

  function encodeTierShare(payload) {
    return SHARE_PREFIX + encodeShareBase64(JSON.stringify(payload));
  }

  function parseTierShare(code, options = {}) {
    const tierIds = Array.isArray(options.tierIds) ? options.tierIds : TIER_IDS;
    let text = String(code == null ? '' : code).trim();
    if (!text) throw new Error('Вставьте код тир-листа.');
    if (text.length > SHARE_MAX_LENGTH) throw new Error('Код слишком длинный. Проверьте, что скопирован весь текст.');

    let jsonText = '';
    if (text.charAt(0) === '{') {
      jsonText = text;
    } else {
      if (text.startsWith(SHARE_PREFIX)) text = text.slice(SHARE_PREFIX.length);
      const base64 = text.replace(/\s+/g, '');
      if (!base64) throw new Error('В коде нет данных.');
      try {
        jsonText = decodeShareBase64(base64);
      } catch {
        throw new Error('Не удалось прочитать код. Скопируйте его полностью и попробуйте снова.');
      }
    }

    let payload = null;
    try {
      payload = JSON.parse(jsonText);
    } catch {
      throw new Error('Код повреждён: внутри не JSON.');
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error('Это не код тир-листа AniTier.');
    }
    if (payload.kind !== SHARE_KIND || Number(payload.version) !== SHARE_VERSION) {
      if (payload.kind === SHARE_KIND && Number(payload.version) > SHARE_VERSION) {
        throw new Error('Код создан в более новой версии AniTier. Обновите приложение.');
      }
      throw new Error('Это не код тир-листа AniTier.');
    }
    if (!payload.tiers || typeof payload.tiers !== 'object' || Array.isArray(payload.tiers)) {
      throw new Error('В коде нет тир-листа.');
    }

    const list = payload.list === 'planned' ? 'planned' : payload.list === 'watched' ? 'watched' : null;
    if (!list) throw new Error('В коде не указано, какой это список.');

    const tiers = {};
    for (const tier of tierIds) tiers[tier] = [];
    const seen = new Set();
    const limit = Math.max(1, Number(options.maxItems) || 2000);
    let total = 0;

    for (const tier of tierIds) {
      const source = Array.isArray(payload.tiers[tier]) ? payload.tiers[tier] : [];
      for (const raw of source) {
        if (total >= limit) break;
        const anime = normalizeSharedAnime(raw);
        if (!anime) continue;
        const keys = animeIdentityKeys(anime);
        if (keys.some(key => seen.has(key))) continue;
        keys.forEach(key => seen.add(key));
        tiers[tier].push(anime);
        total += 1;
      }
      if (total >= limit) break;
    }

    return {
      app: 'AniTier',
      kind: SHARE_KIND,
      version: SHARE_VERSION,
      list,
      exportedAt: typeof payload.exportedAt === 'string' ? payload.exportedAt.slice(0, 60) : '',
      tiers,
      total,
    };
  }

  function compareTierLists(sharedTiers, yourLists, options = {}) {
    const tierIds = Array.isArray(options.tierIds) ? options.tierIds : TIER_IDS;
    const shared = sharedTiers && typeof sharedTiers === 'object' ? sharedTiers : {};
    const lists = yourLists && typeof yourLists === 'object' ? yourLists : {};
    const index = new Map();
    const yourItems = [];

    for (const listName of ['watched', 'planned']) {
      const tierMap = lists[listName] && typeof lists[listName] === 'object' ? lists[listName] : {};
      for (const tier of tierIds) {
        const items = Array.isArray(tierMap[tier]) ? tierMap[tier] : [];
        for (const anime of items) {
          const keys = animeIdentityKeys(anime);
          if (!keys.length) continue;
          const entry = { anime, list: listName, tier, keys };
          yourItems.push(entry);
          for (const key of keys) {
            if (!index.has(key)) index.set(key, entry);
          }
        }
      }
    }

    const rows = [];
    const sharedKeys = new Set();
    const seen = new Set();
    for (const tier of tierIds) {
      const items = Array.isArray(shared[tier]) ? shared[tier] : [];
      for (const anime of items) {
        const keys = animeIdentityKeys(anime);
        if (!keys.length) continue;
        if (keys.some(key => seen.has(key))) continue;
        keys.forEach(key => seen.add(key));
        keys.forEach(key => sharedKeys.add(key));

        let match = null;
        for (const key of keys) {
          if (index.has(key)) {
            match = index.get(key);
            break;
          }
        }
        rows.push({
          anime,
          tier,
          match: match ? { anime: match.anime, list: match.list, tier: match.tier } : null,
          sameTier: Boolean(match && match.tier === tier),
        });
      }
    }

    let yoursOnly = 0;
    const counted = new Set();
    for (const item of yourItems) {
      const key = item.keys[0];
      if (!key || counted.has(key)) continue;
      counted.add(key);
      if (!item.keys.some(candidate => sharedKeys.has(candidate))) yoursOnly += 1;
    }

    const common = rows.filter(row => row.match);
    const sameTier = common.filter(row => row.sameTier).length;
    return {
      rows,
      summary: {
        total: rows.length,
        common: common.length,
        newCount: rows.length - common.length,
        watched: common.filter(row => row.match.list === 'watched').length,
        planned: common.filter(row => row.match.list === 'planned').length,
        sameTier,
        differentTier: common.length - sameTier,
        yoursOnly,
      },
    };
  }

  /* ---------------- резервные копии и моменты ---------------- */
  const BACKUP_KIND = 'anitier.backup';
  const BACKUP_VERSION = 2;
  const BACKUP_FILE = 'anitier-backup.json';
  const BACKUP_MAX_BYTES = 30 * 1024 * 1024;

  function isBackupSizeAllowed(size) {
    const value = Number(size);
    return Number.isFinite(value) && value >= 0 && value <= BACKUP_MAX_BYTES;
  }

  function parseBackupJson(text) {
    let payload = null;
    try {
      payload = JSON.parse(String(text == null ? '' : text));
    } catch {
      throw new Error('Файл повреждён: внутри не JSON.');
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error('Это не резервная копия AniTier.');
    }
    if (payload.kind !== BACKUP_KIND) throw new Error('Это не резервная копия AniTier.');
    const version = Number(payload.version);
    if (!Number.isFinite(version) || version < 1) {
      throw new Error('В файле не указана версия резервной копии.');
    }
    if (version > BACKUP_VERSION) {
      throw new Error('Копия создана в более новой версии AniTier. Обновите приложение.');
    }
    if (!payload.data || typeof payload.data !== 'object' || Array.isArray(payload.data)) {
      throw new Error('В копии нет данных приложения.');
    }
    return {
      kind: BACKUP_KIND,
      version,
      createdAt: typeof payload.createdAt === 'string' ? payload.createdAt.slice(0, 60) : '',
      data: payload.data,
    };
  }

  function isTikTokUrl(value) {
    try {
      const url = new URL(String(value == null ? '' : value).trim());
      const host = url.hostname.toLowerCase();
      return url.protocol === 'https:' && (host === 'tiktok.com' || host.endsWith('.tiktok.com'));
    } catch {
      return false;
    }
  }

  function tiktokSearchUrl(title) {
    const query = String(title == null ? '' : title).trim();
    return query ? `https://www.tiktok.com/search?q=${encodeURIComponent(query)}` : '';
  }

  function extractTikTokId(value) {
    const text = String(value == null ? '' : value).trim();
    const patterns = [
      /\/video\/(\d{6,})/i,
      /\/embed\/v2\/(\d{6,})/i,
      /\/player\/v1\/(\d{6,})/i,
      /\/v\/(\d{6,})\.html/i,
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1];
    }
    return '';
  }

  function tiktokPlayerUrl(videoId) {
    const id = String(videoId == null ? '' : videoId).replace(/\D/g, '');
    if (!id) return '';
    return `https://www.tiktok.com/player/v1/${id}?autoplay=1&music_info=0&description=0&rel=0`;
  }

  /* ---------------- уведомления: события и группировка ---------------- */
  const NOTIF_TABS = ['tracked', 'recent', 'completed'];
  const NOTIF_TAB_LABELS = {
    tracked: 'Отслеживаемое',
    recent: 'Недавно вышло',
    completed: 'Завершилось',
  };
  const TRACKED_EPISODE_DAYS = 7;
  const RECENT_EPISODE_DAYS = 7;
  const RECENT_FILM_DAYS = 180;
  const COMPLETED_DAYS = 30;
  const SEASON_RELEASE_DAYS = 180;

  function episodeEventKey(animeId, episode) {
    return `ep:${Number(animeId)}:${Number(episode)}`;
  }

  function seasonEventKey(animeId, sequelId) {
    return `season:${Number(animeId)}:${Number(sequelId)}`;
  }

  function filmEventKey(id) {
    return `film:${Number(id)}`;
  }

  function completedEventKey(id) {
    return `completed:${Number(id)}`;
  }

  function groupEpisodesByAnime(items) {
    const groups = new Map();
    for (const item of Array.isArray(items) ? items : []) {
      const anime = item && item.anime;
      const episode = Number(item && (item.episode != null ? item.episode : item.n));
      if (!anime || anime.id == null || !Number.isInteger(episode) || episode <= 0) continue;
      const date = item.date || item.airingAt || null;
      const key = String(anime.id);
      if (!groups.has(key)) {
        groups.set(key, { anime, episodes: [], latestAt: null, count: 0 });
      }
      const group = groups.get(key);
      if (group.episodes.some(ep => ep.n === episode)) continue;
      group.episodes.push({ n: episode, date });
      group.count += 1;
      if (date && (!group.latestAt || new Date(date) > new Date(group.latestAt))) group.latestAt = date;
    }

    return [...groups.values()]
      .map(group => ({
        ...group,
        episodes: group.episodes.sort((a, b) => a.n - b.n),
      }))
      .sort((a, b) => {
        const at = a.latestAt ? new Date(a.latestAt).getTime() : 0;
        const bt = b.latestAt ? new Date(b.latestAt).getTime() : 0;
        if (bt !== at) return bt - at;
        return String(a.anime.title || '').localeCompare(String(b.anime.title || ''), 'ru');
      });
  }

  function episodeRangeLabel(numbers) {
    const list = [...new Set((Array.isArray(numbers) ? numbers : [])
      .map(Number)
      .filter(n => Number.isInteger(n) && n > 0))].sort((a, b) => a - b);
    if (!list.length) return '';

    const parts = [];
    let start = list[0];
    let prev = list[0];
    const flush = () => {
      parts.push(start === prev ? String(start) : `${start}–${prev}`);
    };
    for (let i = 1; i < list.length; i += 1) {
      const value = list[i];
      if (value === prev + 1) {
        prev = value;
        continue;
      }
      flush();
      start = value;
      prev = value;
    }
    flush();
    return parts.join(', ');
  }

  function collectSeasons(mediaList, options = {}) {
    const now = options.now == null ? Date.now() : Number(options.now);
    const releaseDays = Number(options.releaseDays) || SEASON_RELEASE_DAYS;
    const cutoff = now - releaseDays * 86400000;
    const found = new Map();

    for (const media of Array.isArray(mediaList) ? mediaList : []) {
      if (!media) continue;
      const relations = Array.isArray(media.relations) ? media.relations : [];
      for (const relation of relations) {
        const sequel = relation && relation.anime;
        const type = relation && relation.relationType;
        if (!sequel || sequel.id == null || sequel.id === media.id) continue;
        const isSequel = type === 'SEQUEL';
        const isFilmSideStory = type === 'SIDE_STORY' && sequel.type === 'Movie';
        if (!isSequel && !isFilmSideStory) continue;
        if (!['В эфире', 'Анонс', 'Завершено'].includes(sequel.status)) continue;

        const date = sequel.airedTo || sequel.airedFrom || null;
        const timestamp = date ? new Date(date).getTime() : 0;
        if (sequel.status === 'Завершено' && (!timestamp || timestamp < cutoff || timestamp > now)) continue;

        const key = String(sequel.id);
        if (found.has(key)) continue;
        found.set(key, {
          anime: media,
          sequel,
          relationType: type,
          status: sequel.status,
          date,
        });
      }
    }

    const priority = { 'В эфире': 0, 'Анонс': 1, 'Завершено': 2 };
    return [...found.values()].sort((a, b) => {
      const pa = priority[a.status] == null ? 9 : priority[a.status];
      const pb = priority[b.status] == null ? 9 : priority[b.status];
      if (pa !== pb) return pa - pb;
      const at = a.date ? new Date(a.date).getTime() : 0;
      const bt = b.date ? new Date(b.date).getTime() : 0;
      return bt - at;
    });
  }

  function collectNotificationKeys(data) {
    const keys = new Set();
    const addGroup = (group) => {
      if (!group || !group.anime) return;
      for (const episode of group.episodes || []) {
        if (episode && episode.n) keys.add(episodeEventKey(group.anime.id, episode.n));
      }
    };
    const tracked = data && data.tracked ? data.tracked : {};
    const recent = data && data.recent ? data.recent : {};
    for (const group of tracked.episodes || []) addGroup(group);
    for (const item of tracked.seasons || []) {
      if (item && item.anime && item.sequel) keys.add(seasonEventKey(item.anime.id, item.sequel.id));
    }
    for (const group of recent.episodes || []) addGroup(group);
    for (const film of recent.films || []) {
      if (film && film.id != null) keys.add(filmEventKey(film.id));
    }
    for (const anime of (data && data.completed) || []) {
      if (anime && anime.id != null) keys.add(completedEventKey(anime.id));
    }
    return [...keys];
  }

  /* ---------------- напоминания на телефоне ---------------- */
  const RELEASE_NOTIFICATION_HORIZON_DAYS = 14;
  const RELEASE_NOTIFICATION_SOON_MS = 60000;

  function releaseTime(value) {
    if (value == null || value === '') return 0;
    if (typeof value === 'number') return value < 1e11 ? value * 1000 : value;
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function localDayBounds(now) {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { start: start.getTime(), end: end.getTime() };
  }

  /**
   * Серии отслеживаемых тайтлов, о которых стоит напомнить на телефоне.
   * Будущие серии берём как есть, уже вышедшие сегодня — сдвигаем на ближайшую минуту.
   */
  function buildReleaseNotificationItems(data, epInfo, options = {}) {
    const now = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now();
    const horizonDays = Number(options.horizonDays) || RELEASE_NOTIFICATION_HORIZON_DAYS;
    const soonMs = Number(options.soonMs) || RELEASE_NOTIFICATION_SOON_MS;
    const max = Number(options.max) || 20;
    const tracked = (data && data.tracked) || {};
    const info = epInfo || {};
    const day = localDayBounds(now);
    const items = [];
    const seen = new Set();

    const push = (anime, episode, rawDate) => {
      if (!anime || anime.id == null) return;
      const n = Number(episode);
      if (!Number.isInteger(n) || n <= 0) return;
      let at = releaseTime(rawDate);
      if (!at) return;
      if (at <= now) {
        if (at < day.start || at > day.end) return;
        at = now + soonMs;
      }
      if (at > now + horizonDays * 86400000) return;
      const key = `${anime.id}:${n}`;
      if (seen.has(key)) return;
      seen.add(key);
      items.push({
        id: anime.id,
        title: String(anime.title || 'Аниме'),
        n,
        date: new Date(at).toISOString(),
      });
    };

    for (const group of tracked.episodes || []) {
      const anime = group && group.anime;
      if (!anime) continue;
      const next = info[anime.id] && info[anime.id].next;
      if (next && next.date) {
        push(anime, next.n, next.date);
        continue;
      }
      const episodes = Array.isArray(group.episodes) ? group.episodes : [];
      const latest = episodes[episodes.length - 1];
      if (latest) push(anime, latest.n, latest.date);
    }

    for (const item of tracked.seasons || []) {
      const sequel = item && (item.sequel || item.anime);
      if (!sequel) continue;
      const next = (info[sequel.id] && info[sequel.id].next) || sequel.nextEpisode;
      if (next && next.date) push(sequel, next.n, next.date);
    }

    return items
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, max);
  }

  /* ---------------- версия, GitHub и обновления ---------------- */
  const APP_VERSION = '1.12.0';
  const GITHUB_URL = 'https://github.com/sashasat12/anitier';

  /* История изменений для экрана «Что нового». Новые версии — сверху.
     Пункты пишем для пользователя: что теперь можно сделать, а не как это сделано. */
  const CHANGELOG = [
    {
      version: '1.12.0',
      date: '26 октября 2026',
      title: 'Проверка обновлений и карточки уведомлений',
      items: [
        'При запуске AniTier предлагает проверять обновления: можно разрешить, отказаться или выбрать режим в настройках.',
        'Если на GitHub вышла новая версия, внизу экрана появляется карточка с кнопкой «Скачать APK» или «Открыть релиз».',
        'Уведомления о сериях теперь показываются карточками: постер, дата и быстрые кнопки на видном месте.',
      ],
    },
    {
      version: '1.11.0',
      date: '25 октября 2026',
      title: 'Поиск и фильтры в тир-листах',
      items: [
        'В «Просмотрено» и «Запланировано» появился поиск по названию, жанру и студии.',
        'Фильтры по типу, жанру, году и рейтингу: можно показать друзьям только нужные тайтлы.',
        'Над тир-листом видно, сколько тайтлов показано из всего списка; сброс возвращает полный список.',
        'В мобильной версии вкладка «Смотрю» теперь называется «Просмотрено».',
      ],
    },
    {
      version: '1.10.1',
      date: '25 октября 2026',
      title: 'Случайный выход из приложения',
      items: [
        'В APK выход из приложения подтверждается вторым нажатием «Назад» на вкладке «База аниме».',
        'Первый раз приложение показывает подсказку и остаётся открытым — случайное нажатие больше не выкидывает из AniTier.',
      ],
    },
    {
      version: '1.10.0',
      date: '25 октября 2026',
      title: 'История изменений и карточки на всю ширину',
      items: [
        'В настройках появился экран «История изменений»: что нового было в каждой версии.',
        'Карточки в «Просмотрено» и «Запланировано» растягиваются по ширине экрана — справа больше нет пустой полосы.',
      ],
    },
    {
      version: '1.9.1',
      date: '25 октября 2026',
      title: 'Подвал без лишнего',
      items: [
        'Подвал сайта стал одной тихой строкой: версия, источники данных и напоминание, что списки хранятся в браузере.',
        'В мобильной версии и APK подвал убран совсем — он только занимал место над нижней панелью.',
      ],
    },
    {
      version: '1.9.0',
      date: '25 октября 2026',
      title: 'Премьеры без повторов',
      items: [
        '«Скоро выйдут» больше не показывает тайтлы из «Просмотрено» и «Запланировано».',
        'В календаре премьер появились поиск по названию, жанру и студии, фильтры по типу и месяцу, порядок по дате или названию.',
        'Статус над сеткой показывает, сколько премьер скрыто из ваших списков.',
      ],
    },
    {
      version: '1.8.1',
      date: '25 октября 2026',
      title: 'Настройки и перетаскивание',
      items: [
        'Экран настроек: язык поиска, переводчик описаний, резервная копия, обмен тир-листами, проверка обновлений.',
        'Напоминания о выходе серий в APK.',
        'Перетаскивание карточек переписано: карточка идёт за пальцем после долгого нажатия и за мышью, страница прокручивается у краёв.',
        'Поиск аниме в TikTok открывается прямо в приложении TikTok.',
      ],
    },
    {
      version: '1.6.0',
      date: '24 октября 2026',
      title: 'Перевод и TikTok',
      items: [
        'Выбор переводчика описаний и автоматический резервный перевод.',
        'Поиск аниме в TikTok и добавление видео в карточку.',
        'Крупнее постеры в уведомлениях, автопрокрутка при переносе карточек, горизонтальный выбор сезонов.',
      ],
    },
    {
      version: '1.5.0',
      date: '24 октября 2026',
      title: 'Каталог и карточки',
      items: [
        'Карточки сезонов и порядок просмотра.',
        'Перевод описаний с переключением между оригиналом и переводом.',
        'Улучшения поиска, фильтров и объединения данных AniList и Kitsu.',
      ],
    },
    {
      version: '1.0.0',
      date: '22 октября 2026',
      title: 'Первый релиз',
      items: [
        'База аниме через AniList и Kitsu, тир-листы, экспорт и импорт.',
        'Уведомления, календарь премьер, прогресс серий.',
        'Мобильная PWA и Android APK.',
      ],
    },
  ];

  function versionParts(value) {
    return String(value == null ? '' : value)
      .replace(/^v/i, '')
      .split(/[.\-+\s]/)
      .map(part => {
        const n = Number.parseInt(part, 10);
        return Number.isFinite(n) && n > 0 ? n : 0;
      });
  }

  /** Сравнение версий: 1 — слева новее, -1 — справа новее, 0 — совпадают. */
  function compareVersions(left, right) {
    const a = versionParts(left);
    const b = versionParts(right);
    const length = Math.max(a.length, b.length, 3);
    for (let i = 0; i < length; i += 1) {
      const diff = (a[i] || 0) - (b[i] || 0);
      if (diff) return diff > 0 ? 1 : -1;
    }
    return 0;
  }

  /** Разбирает ответ GitHub «latest release» в короткое описание версии. */
  function parseLatestRelease(payload) {
    if (!payload || typeof payload !== 'object') return null;
    const tag = payload.tag_name || payload.name;
    if (!tag) return null;
    const version = String(tag).replace(/^v/i, '').trim();
    if (!version) return null;
    return {
      version,
      name: String(payload.name || tag),
      url: String(payload.html_url || ''),
      notes: String(payload.body || '').slice(0, 600),
    };
  }

  /* ---------------- автопрокрутка при перетаскивании ---------------- */
  const DRAG_SCROLL_EDGE_MIN = 56;
  const DRAG_SCROLL_EDGE_MAX = 120;
  const DRAG_SCROLL_MAX_STEP = 30;

  /**
   * Насколько прокрутить страницу за кадр, если палец или курсор у края экрана.
   * Возвращает 0 в спокойной зоне, положительное число — вниз, отрицательное — вверх.
   */
  function dragScrollDelta(pointerY, viewportHeight) {
    const y = Number(pointerY);
    const height = Number(viewportHeight);
    if (!Number.isFinite(y) || !Number.isFinite(height) || height <= 0) return 0;
    const edge = Math.max(DRAG_SCROLL_EDGE_MIN, Math.min(DRAG_SCROLL_EDGE_MAX, height * .15));
    if (y > height - edge) {
      const depth = Math.min(1, (y - (height - edge)) / edge);
      return Math.max(1, Math.ceil(DRAG_SCROLL_MAX_STEP * depth));
    }
    if (y < edge) {
      const depth = Math.min(1, (edge - y) / edge);
      return -Math.max(1, Math.ceil(DRAG_SCROLL_MAX_STEP * depth));
    }
    return 0;
  }

  function defaultNotificationTab(data) {
    const tracked = data && data.tracked ? data.tracked : {};
    const hasTracked = Boolean((tracked.episodes || []).length || (tracked.seasons || []).length);
    return hasTracked ? 'tracked' : 'recent';
  }

  function formatBytes(value) {
    const bytes = Number(value) || 0;
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
    return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} МБ`;
  }

  return {
    PAGE_LIMIT,
    TIER_IDS,
    SHARE_PREFIX,
    SHARE_KIND,
    SHARE_VERSION,
    BACKUP_KIND,
    BACKUP_VERSION,
    BACKUP_FILE,
    BACKUP_MAX_BYTES,
    isBackupSizeAllowed,
    makeTierShare,
    encodeTierShare,
    parseTierShare,
    compareTierLists,
    compactShareAnime,
    parseBackupJson,
    isTikTokUrl,
    tiktokSearchUrl,
    extractTikTokId,
    tiktokPlayerUrl,
    formatBytes,
    NOTIF_TABS,
    NOTIF_TAB_LABELS,
    TRACKED_EPISODE_DAYS,
    RECENT_EPISODE_DAYS,
    RECENT_FILM_DAYS,
    COMPLETED_DAYS,
    SEASON_RELEASE_DAYS,
    episodeEventKey,
    seasonEventKey,
    filmEventKey,
    completedEventKey,
    groupEpisodesByAnime,
    episodeRangeLabel,
    collectSeasons,
    collectNotificationKeys,
    defaultNotificationTab,
    buildReleaseNotificationItems,
    RELEASE_NOTIFICATION_HORIZON_DAYS,
    APP_VERSION,
    GITHUB_URL,
    CHANGELOG,
    compareVersions,
    parseLatestRelease,
    dragScrollDelta,
    GENRES,
    SEARCH_LANGS,
    TYPES,
    STATUSES,
    SCORES,
    DEFAULT_FILTERS,
    normalizeFilters,
    hasActiveFilters,
    countActiveFilters,
    genreById,
    genreRu,
    hasCyrillic,
    hasJapanese,
    firstCyrillic,
    normalizeSearchLang,
    detectQueryLang,
    matchesFilters,
    filterItems,
    listFilterOptions,
    searchHaystack,
    upcomingMonthKey,
    excludeListed,
    filterUpcoming,
    buildAniListVariables,
    dedupeById,
    normalizeTitleKey,
    animeIdentityKeys,
    mergeUniqueAnime,
    slicePage,
  };
});
