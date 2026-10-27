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
    { id: 9, label: 'Этти', names: ['Этти', 'Ecchi'] },
    { id: 10, label: 'Фэнтези', names: ['Фэнтези', 'Fantasy'] },
    { id: 14, label: 'Ужасы', names: ['Ужасы', 'Horror'] },
    { id: 16, label: 'Махо-сёдзё', names: ['Махо-сёдзё', 'Mahou Shoujo'] },
    { id: 18, label: 'Меха', names: ['Меха', 'Mecha'] },
    { id: 19, label: 'Музыка', names: ['Музыка', 'Music'] },
    { id: 22, label: 'Романтика', names: ['Романтика', 'Romance'] },
    { id: 24, label: 'Фантастика', names: ['Фантастика', 'Sci-Fi'] },
    { id: 30, label: 'Спорт', names: ['Спорт', 'Sports'] },
    { id: 36, label: 'Повседневность', names: ['Повседневность', 'Slice of Life'] },
    { id: 37, label: 'Сверхъестественное', names: ['Сверхъестественное', 'Supernatural'] },
    { id: 40, label: 'Психологическое', names: ['Психологическое', 'Psychological'] },
    { id: 41, label: 'Триллер', names: ['Триллер', 'Thriller'] },
  ];

  /* Теги (демография, сеттинг, темы) лежат отдельно в tags.js. */
  const TAGS = (typeof window !== 'undefined' && Array.isArray(window.AniTierTags)) ? window.AniTierTags : [];

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
    const tag = TAGS.find(item => String(item.name).toLowerCase() === raw.toLowerCase());
    if (tag && tag.ru && tag.ru !== tag.name) return tag.ru;
    return GENRE_RU[raw.toLowerCase()] || EXTRA_GENRE_RU[raw.toLowerCase()] || raw;
  }

  const DB_SORTS = [
    { value: 'default', label: 'Как в режиме' },
    { value: 'popular', label: 'По популярности' },
    { value: 'score', label: 'По оценке' },
    { value: 'newest', label: 'Сначала новые' },
    { value: 'title', label: 'По названию' },
  ];

  function normalizeDBSort(value) {
    const sort = String(value == null ? '' : value).trim();
    return DB_SORTS.some(item => item.value === sort) ? sort : 'default';
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

  /* Порядок карточек внутри тира. «Как в тирах» — ручной порядок перетаскивания. */
  const LIST_SORTS = [
    { value: 'default', label: 'Как в тирах' },
    { value: 'title', label: 'По названию' },
    { value: 'score', label: 'По оценке' },
    { value: 'added', label: 'По дате добавления' },
    { value: 'progress', label: 'По прогрессу' },
  ];

  function normalizeListSort(value) {
    const key = String(value == null ? '' : value).trim().toLowerCase();
    return LIST_SORTS.some(item => item.value === key) ? key : 'default';
  }

  function progressWatchedCount(progress, id) {
    const entry = progress && progress[id];
    return entry && Array.isArray(entry.watched) ? entry.watched.length : 0;
  }

  /* Сортирует копию массива, чтобы не менять ручной порядок тира. */
  function sortListItems(items, sort, progress) {
    const key = normalizeListSort(sort);
    const list = (Array.isArray(items) ? items : []).filter(Boolean).slice();
    if (key === 'default') return list;

    const byTitle = (a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'ru');
    if (key === 'title') {
      list.sort(byTitle);
    } else if (key === 'score') {
      list.sort((a, b) => {
        const sa = typeof a.score === 'number' ? a.score : -Infinity;
        const sb = typeof b.score === 'number' ? b.score : -Infinity;
        return (sb - sa) || byTitle(a, b);
      });
    } else if (key === 'added') {
      list.sort((a, b) => (Number(b.addedAt) || 0) - (Number(a.addedAt) || 0) || byTitle(a, b));
    } else if (key === 'progress') {
      list.sort((a, b) => {
        const pa = progressWatchedCount(progress, a.id);
        const pb = progressWatchedCount(progress, b.id);
        return (pb - pa) || byTitle(a, b);
      });
    }
    return list;
  }

  /* Случайный элемент для кнопки «Что посмотреть». */
  function randomItem(items, rng = Math.random) {
    const list = Array.isArray(items) ? items.filter(Boolean) : [];
    if (!list.length) return null;
    const value = typeof rng === 'function' ? Number(rng()) : Math.random();
    const safe = Number.isFinite(value) ? Math.min(Math.max(value, 0), 0.999999999) : 0;
    return list[Math.floor(safe * list.length)] || null;
  }

  const STATUS_NAMES = {
    airing: 'В эфире',
    complete: 'Завершено',
    upcoming: 'Анонс',
  };

  const DEFAULT_FILTERS = Object.freeze({
    type: Object.freeze([]),
    status: Object.freeze([]),
    year: Object.freeze([]),
    genre: Object.freeze([]),
    tags: Object.freeze([]),
    minScore: '',
  });

  /**
   * Приводит значение фильтра к массиву. Старые сохранения хранили одну
   * строку, поэтому читаем и её: одна и та же схема работает после обновления.
   */
  function filterList(value) {
    if (Array.isArray(value)) return value;
    if (value == null || value === '') return [];
    return [value];
  }

  function uniqueList(list, normalize) {
    const seen = new Set();
    const out = [];
    for (const item of list) {
      const value = normalize(item);
      if (!value || seen.has(value)) continue;
      seen.add(value);
      out.push(value);
    }
    return out;
  }

  function normalizeFilters(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const string = value => String(value == null ? '' : value).trim();
    const minScore = string(source.minScore);

    const typeValues = TYPES.map(item => item.value);
    const statusValues = STATUSES.map(item => item.value);
    const genreValues = GENRES.map(item => String(item.id));
    const tagNames = new Set(TAGS.map(item => item.name));

    return {
      type: uniqueList(filterList(source.type), value => {
        const item = string(value);
        return typeValues.includes(item) ? item : '';
      }),
      status: uniqueList(filterList(source.status), value => {
        const item = string(value);
        return statusValues.includes(item) ? item : '';
      }),
      year: uniqueList(filterList(source.year), value => {
        const item = string(value);
        return /^\d{4}$/.test(item) ? item : '';
      }),
      genre: uniqueList(filterList(source.genre), value => {
        const item = string(value);
        return genreValues.includes(item) ? item : '';
      }),
      tags: uniqueList(filterList(source.tags), value => {
        const item = string(value);
        return tagNames.has(item) ? item : '';
      }),
      minScore: /^(?:[1-9]|10)$/.test(minScore) ? minScore : '',
    };
  }

  function hasActiveFilters(filters) {
    const normalized = normalizeFilters(filters);
    return Boolean(
      normalized.type.length
      || normalized.status.length
      || normalized.year.length
      || normalized.genre.length
      || normalized.tags.length
      || normalized.minScore,
    );
  }

  function countActiveFilters(filters) {
    const normalized = normalizeFilters(filters);
    return ['type', 'status', 'year', 'genre', 'tags'].filter(key => normalized[key].length).length
      + (normalized.minScore ? 1 : 0);
  }

  function genreById(id) {
    return GENRES.find(item => String(item.id) === String(id)) || null;
  }

  function matchesFilters(anime, filters) {
    const normalized = normalizeFilters(filters);

    if (normalized.type.length && !normalized.type.includes(String(anime.type || '').toLowerCase())) return false;
    if (normalized.status.length) {
      const names = normalized.status.map(value => STATUS_NAMES[value]);
      if (!names.includes(String(anime.status || ''))) return false;
    }
    if (normalized.year.length && !normalized.year.map(Number).includes(Number(anime.year))) return false;
    if (normalized.minScore) {
      if (typeof anime.score !== 'number' || anime.score < Number(normalized.minScore)) return false;
    }
    if (normalized.genre.length) {
      const names = Array.isArray(anime.genres) ? anime.genres : [];
      const hit = normalized.genre.some(value => {
        const genre = genreById(value);
        return genre ? names.some(name => genre.names.includes(name)) : false;
      });
      if (!hit) return false;
    }
    if (normalized.tags.length) {
      const tags = Array.isArray(anime.tags) ? anime.tags : [];
      if (!normalized.tags.some(name => tags.includes(name))) return false;
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
    const parts = [anime.title, anime.titleRu, anime.altTitle, anime.originalTitle];
    if (Array.isArray(anime.aliases)) parts.push(...anime.aliases);
    if (Array.isArray(anime.genres)) {
      parts.push(...anime.genres);
      parts.push(...anime.genres.map(genreRu));
    }
    if (Array.isArray(anime.tags)) {
      parts.push(...anime.tags);
      parts.push(...anime.tags.map(genreRu));
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
    if (filters.type.length) {
      delete variables.format;
      variables.format_in = filters.type.map(value => ANILIST_FORMATS[value]).filter(Boolean);
    }
    if (filters.status.length) {
      delete variables.status;
      variables.status_in = filters.status.map(value => ANILIST_STATUSES[value]).filter(Boolean);
    }
    if (filters.year.length === 1) {
      variables.seasonYear = Number(filters.year[0]);
    } else if (filters.year.length > 1) {
      /* AniList не умеет список лет: берём общий диапазон, а точные годы
         отсекаем на клиенте вместе с остальными фильтрами. */
      const years = filters.year.map(Number).sort((a, b) => a - b);
      variables.startDateGreater = years[0] * 10000 + 101;
      variables.startDateLesser = years[years.length - 1] * 10000 + 1231;
    }
    if (filters.genre.length) {
      variables.genre_in = filters.genre.map(value => aniListGenre(value)).filter(Boolean);
    }
    if (filters.tags.length) {
      variables.tag_in = filters.tags.slice();
    }
    if (filters.minScore) variables.averageScoreGreater = Number(filters.minScore) * 10;

    if (mode === 'score') variables.sort = ['SCORE_DESC'];
    else if (!query || active) variables.sort = ['POPULARITY_DESC'];

    const sortKey = normalizeDBSort(options.sort);
    const sortMap = {
      popularity: 'POPULARITY_DESC',
      score: 'SCORE_DESC',
      newest: 'START_DATE_DESC',
      title: 'TITLE_ROMAJI',
    };
    if (sortKey !== 'default' && sortMap[sortKey]) variables.sort = [sortMap[sortKey]];

    return variables;
  }

  /** Ищет MAL ID по русскому названию в локальном словаре titles-ru.js. */
  function russianTitleIds(query, limit = 30) {
    const q = normalizeTitleKey(query);
    if (!q) return [];
    const map = (typeof window !== 'undefined' && window.AniTierTitlesRu) || {};
    const exact = [];
    const starts = [];
    const contains = [];
    for (const [mal, title] of Object.entries(map)) {
      if (!/^\d+$/.test(mal)) continue;
      const key = normalizeTitleKey(title);
      if (!key) continue;
      if (key === q) exact.push(Number(mal));
      else if (key.startsWith(q)) starts.push(Number(mal));
      else if (key.includes(q)) contains.push(Number(mal));
    }
    return [...exact, ...starts, ...contains].slice(0, Math.max(1, Number(limit) || 30));
  }

  /** Ищет ID AniList по русскому названию во втором словаре. */
  function russianTitleAniListIds(query, limit = 30) {
    const q = normalizeTitleKey(query);
    if (!q) return [];
    const map = (typeof window !== 'undefined' && window.AniTierTitlesRuAniList) || {};
    const exact = [];
    const starts = [];
    const contains = [];
    for (const [id, title] of Object.entries(map)) {
      if (!/^\d+$/.test(id)) continue;
      const key = normalizeTitleKey(title);
      if (!key) continue;
      if (key === q) exact.push(Number(id));
      else if (key.startsWith(q)) starts.push(Number(id));
      else if (key.includes(q)) contains.push(Number(id));
    }
    return [...exact, ...starts, ...contains].slice(0, Math.max(1, Number(limit) || 30));
  }

  /** Сортирует копию выдачи базы: сервер уже сортирует AniList, но демо,
      Kitsu и текстовый поиск приходят в своём порядке. */
  function sortCatalogItems(items, sort) {
    const key = normalizeDBSort(sort);
    const list = Array.isArray(items) ? items.slice() : [];
    if (key === 'default') return list;
    const score = item => (typeof item.score === 'number' ? item.score : -1);
    const popularity = item => (typeof item.popularity === 'number' ? item.popularity : 0);
    const year = item => Number(item.year) || 0;
    const title = item => String(item.title || '');
    return list.sort((a, b) => {
      if (key === 'popular') return popularity(b) - popularity(a) || title(a).localeCompare(title(b), 'ru');
      if (key === 'score') return score(b) - score(a) || title(a).localeCompare(title(b), 'ru');
      if (key === 'newest') return year(b) - year(a) || title(a).localeCompare(title(b), 'ru');
      return title(a).localeCompare(title(b), 'ru');
    });
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

  /**
   * Ищет тайтлы по названию во всех списках, своих карточках и загруженной
   * базе. Одинаковые записи не дублируются: список важнее базы.
   */
  function searchGlobal(sources, query, options = {}) {
    const limit = Math.max(1, Math.trunc(Number(options.limit) || 8));
    const q = normalizeTitleKey(query);
    if (!q) return [];
    const words = q.split(' ').filter(Boolean);
    const input = sources && typeof sources === 'object' ? sources : {};
    const lists = input.lists && typeof input.lists === 'object' ? input.lists : {};
    const customCards = Array.isArray(input.customCards) ? input.customCards : [];
    const dbItems = Array.isArray(input.dbItems) ? input.dbItems : [];
    const order = { watched: 0, planned: 1, custom: 2, db: 3 };
    const seen = new Set();
    const results = [];

    const add = (item, where, tier) => {
      if (!item || typeof item !== 'object') return;
      const key = item.id != null
        ? `id:${item.id}`
        : `t:${normalizeTitleKey(item.title)}:${item.year || ''}`;
      if (seen.has(key)) return;
      const titles = [item.title, item.titleRu, item.altTitle, item.originalTitle]
        .map(normalizeTitleKey)
        .filter(Boolean);
      if (!titles.length) return;
      const haystack = titles.join(' ');
      if (!words.every(word => haystack.includes(word))) return;

      let rank = 3;
      for (const title of titles) {
        if (title === q) { rank = 0; break; }
        if (title.startsWith(q)) rank = Math.min(rank, 1);
        else if (title.split(' ').some(word => word.startsWith(q))) rank = Math.min(rank, 2);
      }
      seen.add(key);
      results.push({
        anime: item,
        where,
        tier: tier || null,
        rank,
        order: order[where] ?? 9,
      });
    };

    for (const listName of ['watched', 'planned']) {
      const tiers = lists[listName] && typeof lists[listName] === 'object' ? lists[listName] : {};
      for (const tier of TIER_IDS) {
        const items = Array.isArray(tiers[tier]) ? tiers[tier] : [];
        for (const item of items) add(item, listName, tier);
      }
    }
    for (const item of customCards) add(item, 'custom');
    for (const item of dbItems) add(item, 'db');

    return results
      .sort((a, b) => a.rank - b.rank
        || a.order - b.order
        || String(a.anime.title || '').localeCompare(String(b.anime.title || ''), 'ru'))
      .slice(0, limit);
  }

  function animeIdentityKeys(item) {
    if (!item || typeof item !== 'object') return [];
    const keys = [];
    if (item.id != null) keys.push(`id:${item.id}`);
    if (item.malId != null) keys.push(`mal:${item.malId}`);
    if (item.source && item.sourceId != null) keys.push(`src:${item.source}:${item.sourceId}`);

    const year = Number(item.year) || 0;
    const titles = [item.title, item.titleRu, item.altTitle, ...(Array.isArray(item.aliases) ? item.aliases : [])];
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
    const moves = new Map();
    for (const row of common) {
      if (row.sameTier) continue;
      const key = `${row.tier}|${row.match.tier}`;
      moves.set(key, (moves.get(key) || 0) + 1);
    }
    const tierMoves = [...moves.entries()]
      .map(([key, count]) => {
        const [friend, yours] = key.split('|');
        return { friend, yours, count };
      })
      .sort((a, b) => b.count - a.count || a.friend.localeCompare(b.friend) || a.yours.localeCompare(b.yours))
      .slice(0, 4);
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
        tasteMatch: common.length ? Math.round((sameTier / common.length) * 100) : 0,
        tierMoves,
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

  /* ---------------- «Мои серии»: календарь и .ics ---------------- */

  /**
   * Будущие серии отслеживаемых тайтлов для календаря.
   * Учитывает следующую серию из epInfo и уже известные даты серий.
   */
  function buildCalendarItems(data, epInfo, options = {}) {
    const now = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now();
    const from = Number.isFinite(Number(options.from)) ? Number(options.from) : localDayBounds(now).start;
    const max = Number(options.max) || 500;
    const tracked = (data && data.tracked) || {};
    const info = epInfo || {};
    const items = [];
    const seen = new Set();

    const push = (anime, episode, rawDate) => {
      if (!anime || anime.id == null) return;
      const n = Number(episode);
      if (!Number.isInteger(n) || n <= 0) return;
      const at = releaseTime(rawDate);
      if (!at || at < from) return;
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
      if (next && next.date) push(anime, next.n, next.date);
      for (const episode of group.episodes || []) {
        if (episode && episode.date) push(anime, episode.n, episode.date);
      }
    }

    for (const item of tracked.seasons || []) {
      const sequel = item && (item.sequel || item.anime);
      if (!sequel) continue;
      const next = (info[sequel.id] && info[sequel.id].next) || sequel.nextEpisode;
      if (next && next.date) push(sequel, next.n || 1, next.date);
    }

    return items
      .sort((a, b) => releaseTime(a.date) - releaseTime(b.date))
      .slice(0, max);
  }

  function icsDate(value) {
    const time = releaseTime(value);
    if (!time) return '';
    return new Date(time).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  }

  function icsEscape(value) {
    return String(value == null ? '' : value)
      .replace(/\\/g, '\\\\')
      .replace(/\r?\n/g, '\\n')
      .replace(/,/g, '\\,')
      .replace(/;/g, '\\;');
  }

  /** Возвращает текст календаря RFC 5545: по событию на каждую серию. */
  function buildIcs(items, options = {}) {
    const now = icsDate(Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now());
    const calendarName = String(options.calendarName || 'AniTier — мои серии');
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//AniTier//Episodes//RU',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${icsEscape(calendarName)}`,
    ];

    for (const item of Array.isArray(items) ? items : []) {
      if (!item) continue;
      const start = icsDate(item.date);
      if (!start) continue;
      const n = Number(item.n) || 0;
      const title = n > 0 ? `${item.title || 'Аниме'} — серия ${n}` : String(item.title || 'Аниме');
      lines.push(
        'BEGIN:VEVENT',
        `UID:anitier-${item.id}-${n}@anitier`,
        `DTSTAMP:${now}`,
        `DTSTART:${start}`,
        `SUMMARY:${icsEscape(title)}`,
        `DESCRIPTION:${icsEscape('Напоминание из AniTier')}`,
        'END:VEVENT',
      );
    }

    lines.push('END:VCALENDAR');
    return `${lines.join('\r\n')}\r\n`;
  }

  /* ---------------- версия, GitHub и обновления ---------------- */
  const APP_VERSION = '1.35.0';
  const GITHUB_URL = 'https://github.com/sashasat12/anitier';

  /* Данные истории лежат в changelog.js: core.js не растёт с каждой версией. */
  const CHANGELOG = (typeof window !== 'undefined' && Array.isArray(window.AniTierChangelog))
    ? window.AniTierChangelog
    : [];

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

  /* ---------------- импорт из MyAnimeList и Shikimori ---------------- */
  const IMPORT_MAX_ROWS = 20000;
  const IMPORT_MAX_BYTES = 12 * 1024 * 1024;

  /** Оценка из списка превращается в тир: 9–10 → S, 8 → A, 7 → B, 6 → C, 5 → D, 1–4 → F. */
  function tierFromScore(score) {
    const value = Number(score);
    if (!Number.isFinite(value) || value <= 0) return 'N';
    if (value >= 9) return 'S';
    if (value >= 8) return 'A';
    if (value >= 7) return 'B';
    if (value >= 6) return 'C';
    if (value >= 5) return 'D';
    return 'F';
  }

  /** Статус из файла: «просмотрено» или «запланировано». Неизвестный статус — пустая строка. */
  function importStatusList(source, status) {
    const value = String(status == null ? '' : status)
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, ' ');
    if (!value) return '';
    if (value === 'plan to watch' || value === 'planned') return 'planned';
    if (['completed', 'watching', 'rewatching', 'on hold', 'dropped'].includes(value)) return 'watched';
    return '';
  }

  function importYear(value) {
    const match = String(value == null ? '' : value).match(/^(\d{4})/);
    return match ? Number(match[1]) : null;
  }

  /** Приводит строку из любого источника к общему виду. */
  function normalizeImportedRow(raw, source = '') {
    if (!raw || typeof raw !== 'object') return null;
    const malIdNumber = Number(raw.malId);
    const malId = Number.isInteger(malIdNumber) && malIdNumber > 0 ? malIdNumber : null;
    const title = String(raw.title == null ? '' : raw.title).trim().slice(0, 300);
    if (!malId && !title) return null;

    const episodes = Math.max(0, Math.trunc(Number(raw.episodes) || 0));
    let watched = Math.max(0, Math.trunc(Number(raw.watched) || 0));
    if (episodes > 0) watched = Math.min(watched, episodes);
    const score = Math.max(0, Math.min(10, Number(raw.score) || 0));
    const origin = String(source || raw.source || '').toLowerCase();
    const status = importStatusList(origin, raw.status);
    const list = status || (watched > 0 || score > 0 ? 'watched' : 'planned');

    return {
      malId,
      title,
      altTitle: String(raw.altTitle == null ? '' : raw.altTitle).trim().slice(0, 300),
      episodes: episodes || null,
      watched,
      score,
      status: String(raw.status == null ? '' : raw.status).trim().slice(0, 40),
      list,
      tier: list === 'watched' ? tierFromScore(score) : 'N',
      image: /^https?:\/\//i.test(String(raw.image || '')) ? String(raw.image).slice(0, 1000) : '',
      type: String(raw.type == null ? '' : raw.type).trim().slice(0, 40),
      year: importYear(raw.year),
      source: origin,
    };
  }

  /** Убирает повторы и строки без опознавательных данных, сохраняя порядок файла. */
  function normalizeImportRows(rows, source = '') {
    const result = [];
    const seen = new Set();
    for (const raw of Array.isArray(rows) ? rows : []) {
      const row = normalizeImportedRow(raw, source);
      if (!row) continue;
      const key = row.malId
        ? `mal:${row.malId}`
        : `title:${normalizeTitleKey(row.title)}:${row.year || '?'}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(row);
      if (result.length >= IMPORT_MAX_ROWS) break;
    }
    return result;
  }

  function malNodeText(node, tag) {
    if (!node || typeof node.getElementsByTagName !== 'function') return '';
    const nodes = node.getElementsByTagName(tag);
    return nodes && nodes.length ? String(nodes[0].textContent || '').trim() : '';
  }

  /**
   * Разбирает XML-экспорт MyAnimeList. Парсер передаётся снаружи,
   * чтобы core.js не зависел от DOM.
   */
  function parseMalXml(text, parser) {
    const xml = String(text == null ? '' : text);
    if (!xml.trim()) throw new Error('Файл пустой.');
    if (!parser || typeof parser.parseFromString !== 'function') {
      throw new Error('Браузер не умеет читать XML.');
    }
    let doc = null;
    try { doc = parser.parseFromString(xml, 'text/xml'); } catch { doc = null; }
    if (!doc || (doc.getElementsByTagName && doc.getElementsByTagName('parsererror').length)) {
      throw new Error('Не удалось прочитать XML. Выберите файл экспорта MyAnimeList.');
    }
    const nodes = doc.getElementsByTagName ? doc.getElementsByTagName('anime') : [];
    if (!nodes.length) throw new Error('В файле нет списка аниме MyAnimeList.');

    const rows = [];
    for (const node of Array.from(nodes)) {
      rows.push({
        malId: malNodeText(node, 'series_animedb_id'),
        title: malNodeText(node, 'series_title'),
        episodes: malNodeText(node, 'series_episodes'),
        watched: malNodeText(node, 'my_watched_episodes'),
        score: malNodeText(node, 'my_score'),
        status: malNodeText(node, 'my_status'),
        type: malNodeText(node, 'series_type'),
        year: malNodeText(node, 'series_start'),
        image: malNodeText(node, 'series_image'),
      });
    }
    return normalizeImportRows(rows, 'mal');
  }

  function shikimoriRows(payload) {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== 'object') return [];
    for (const key of ['anime_rates', 'rates', 'anime', 'data', 'list']) {
      if (Array.isArray(payload[key])) return payload[key];
    }
    return [];
  }

  /** Разбирает JSON с оценками Shikimori (ответ API anime_rates или сохранённый файл). */
  function parseShikimoriJson(text) {
    const raw = String(text == null ? '' : text);
    if (!raw.trim()) throw new Error('Файл пустой.');
    let payload = null;
    try { payload = JSON.parse(raw); } catch {
      throw new Error('Не удалось прочитать JSON. Выберите файл оценок Shikimori.');
    }
    const rates = shikimoriRows(payload);
    if (!rates.length) throw new Error('В файле нет оценок Shikimori.');

    const rows = rates.map(item => {
      const anime = item && item.anime && typeof item.anime === 'object' ? item.anime : item;
      const image = anime && anime.image && typeof anime.image === 'object'
        ? (anime.image.original || anime.image.preview || anime.image.x96 || '')
        : (anime && anime.image) || '';
      return {
        malId: anime && (anime.id ?? item.anime_id ?? item.target_id),
        title: (anime && (anime.russian || anime.name)) || item.russian || item.name,
        altTitle: (anime && anime.name) || item.name,
        episodes: anime && anime.episodes,
        watched: item && (item.episodes ?? item.watched_episodes),
        score: item && item.score,
        status: item && item.status,
        type: anime && anime.kind,
        year: anime && anime.aired_on,
        image,
      };
    });
    return normalizeImportRows(rows, 'shikimori');
  }

  /**
   * Сопоставляет строки файла с тайтлами AniList и решает, что добавлять.
   * Возвращает новые записи, уже имеющиеся тайтлы и то, что не нашлось.
   */
  function planImport(rows, resolved, lists) {    const sourceRows = Array.isArray(rows) ? rows : [];
    const byMal = new Map();
    for (const anime of Array.isArray(resolved) ? resolved : []) {
      if (!anime || anime.malId == null) continue;
      const malId = Number(anime.malId);
      if (Number.isInteger(malId) && malId > 0) byMal.set(malId, anime);
    }

    const existing = new Set();
    for (const name of ['watched', 'planned']) {
      for (const tier of TIER_IDS) {
        for (const item of (lists && lists[name] && lists[name][tier]) || []) {
          if (item && item.id != null) existing.add(item.id);
        }
      }
    }

    const entries = [];
    const already = [];
    const unmatched = [];
    const seen = new Set();
    const tierCounts = {};
    for (const tier of TIER_IDS) tierCounts[tier] = 0;

    for (const row of sourceRows) {
      if (!row) continue;
      const anime = row.malId != null ? byMal.get(Number(row.malId)) : null;
      if (!anime) {
        unmatched.push(row);
        continue;
      }
      if (existing.has(anime.id) || seen.has(anime.id)) {
        already.push({ row, anime });
        continue;
      }
      seen.add(anime.id);
      const list = row.list === 'planned' ? 'planned' : 'watched';
      const tier = list === 'planned' ? 'N' : (TIER_IDS.includes(row.tier) ? row.tier : tierFromScore(row.score));
      tierCounts[tier] += 1;
      entries.push({
        row,
        anime,
        list,
        tier,
        watched: Math.max(0, Math.min(Number(row.watched) || 0, Number(row.episodes) || Number(row.watched) || 0)),
      });
    }

    const watched = entries.filter(entry => entry.list === 'watched').length;
    return {
      entries,
      unmatched,
      already,
      summary: {
        total: sourceRows.length,
        matched: entries.length + already.length,
        newCount: entries.length,
        already: already.length,
        unmatched: unmatched.length,
        watched,
        planned: entries.length - watched,
        tierCounts,
      },
    };
  }

  /* ---------------- статистика профиля ---------------- */
  function pluralRu(value, one, few, many) {
    const abs = Math.abs(Number(value) || 0) % 100;
    const last = abs % 10;
    if (abs > 10 && abs < 20) return many;
    if (last > 1 && last < 5) return few;
    if (last === 1) return one;
    return many;
  }

  /** Минуты просмотра в человеческий вид: «3 дня 4 ч», «12 ч 30 мин», «45 мин». */
  function formatWatchTime(minutes) {
    const total = Math.max(0, Math.round(Number(minutes) || 0));
    const days = Math.floor(total / 1440);
    const hours = Math.floor((total % 1440) / 60);
    const mins = total % 60;
    const parts = [];
    if (days) parts.push(`${days} ${pluralRu(days, 'день', 'дня', 'дней')}`);
    if (hours) parts.push(`${hours} ч`);
    if (!days && mins) parts.push(`${mins} мин`);
    return parts.length ? parts.join(' ') : '0 мин';
  }

  /**
   * Собирает статистику профиля из списков и прогресса серий.
   * Возвращает числа, распределение по тирам, жанры, студии и годы.
   */
  function buildProfileStats(lists, progress, options = {}) {
    const minutesPerEpisode = Math.max(1, Math.trunc(Number(options.minutesPerEpisode) || 24));
    const topLimit = Math.max(1, Math.trunc(Number(options.topLimit) || 5));
    const tierCounts = {};
    for (const tier of TIER_IDS) tierCounts[tier] = 0;

    const genreCounts = new Map();
    const tagCounts = new Map();
    const studioCounts = new Map();
    const yearCounts = new Map();
    let watched = 0;
    let planned = 0;
    let episodesWatched = 0;
    let knownEpisodes = 0;
    let completed = 0;
    let inProgress = 0;
    let notStarted = 0;
    let scored = 0;
    let scoreSum = 0;

    for (const tier of TIER_IDS) {
      const items = (lists && lists.watched && lists.watched[tier]) || [];
      for (const item of items) {
        if (!item) continue;
        watched += 1;
        tierCounts[tier] += 1;

        const episodes = Math.max(0, Math.trunc(Number(item.episodes) || 0));
        knownEpisodes += episodes;
        const entry = progress && progress[item.id];
        const seen = entry && Array.isArray(entry.watched) ? entry.watched.length : 0;
        episodesWatched += seen;
        if (episodes > 0 && seen >= episodes) completed += 1;
        else if (seen > 0) inProgress += 1;
        else notStarted += 1;

        if (Number.isFinite(item.score) && item.score > 0) {
          scored += 1;
          scoreSum += item.score;
        }

        for (const genre of Array.isArray(item.genres) ? item.genres : []) {
          if (!genre) continue;
          genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
        }
        for (const tag of Array.isArray(item.tags) ? item.tags : []) {
          if (!tag) continue;
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        }
        for (const studio of Array.isArray(item.studios) ? item.studios : []) {
          if (!studio) continue;
          studioCounts.set(studio, (studioCounts.get(studio) || 0) + 1);
        }
        const year = Number(item.year);
        if (Number.isInteger(year) && year > 1900 && year <= 2100) {
          yearCounts.set(year, (yearCounts.get(year) || 0) + 1);
        }
      }

      const plans = (lists && lists.planned && lists.planned[tier]) || [];
      planned += plans.filter(Boolean).length;
    }

    const top = map => [...map.entries()]
      .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), 'ru'))
      .slice(0, topLimit)
      .map(([name, count]) => ({ name, count }));

    const minutes = episodesWatched * minutesPerEpisode;
    return {
      watched,
      planned,
      episodesWatched,
      knownEpisodes,
      minutes,
      hours: Math.round((minutes / 60) * 10) / 10,
      completed,
      inProgress,
      notStarted,
      completion: watched ? Math.round((completed / watched) * 100) : 0,
      averageScore: scored ? Math.round((scoreSum / scored) * 10) / 10 : null,
      scored,
      tierCounts,
      topGenres: top(genreCounts),
      topTags: top((() => {
        const localized = new Map();
        for (const [name, count] of tagCounts.entries()) {
          const label = genreRu(name);
          localized.set(label, (localized.get(label) || 0) + count);
        }
        return localized;
      })()),
      topStudios: top(studioCounts),
      years: [...yearCounts.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([year, count]) => ({ year, count })),
    };
  }

  /* ---------------- PNG тир-листа ---------------- */
  const TIER_IMAGE_DEFAULTS = {
    width: 1400,
    padding: 48,
    labelWidth: 168,
    labelGap: 22,
    posterWidth: 108,
    posterHeight: 152,
    posterGap: 14,
    captionHeight: 36,
    tierPadding: 16,
    tierGap: 20,
    headerHeight: 150,
    footerHeight: 96,
    maxItems: 400,
  };

  /**
   * Раскладка PNG-тир-листа: размеры холста и координаты каждого постера.
   * groups: [{ tier, label, name, items: [...] }]
   */
  function buildTierImageLayout(groups, options = {}) {
    const opts = { ...TIER_IMAGE_DEFAULTS, ...(options || {}) };
    const contentX = opts.padding + opts.labelWidth + opts.labelGap;
    const available = Math.max(opts.posterWidth, opts.width - contentX - opts.padding);
    const columns = Math.max(1, Math.floor((available + opts.posterGap) / (opts.posterWidth + opts.posterGap)));
    const rowHeight = opts.posterHeight + opts.captionHeight + opts.posterGap;
    const maxItems = Math.max(0, Math.trunc(Number(opts.maxItems) || 0));
    let remaining = maxItems;
    let omitted = 0;
    let y = opts.headerHeight;
    const tiers = [];

    for (const group of Array.isArray(groups) ? groups : []) {
      const items = Array.isArray(group && group.items) ? group.items : [];
      if (!items.length) continue;
      const allowed = items.slice(0, Math.max(0, remaining));
      omitted += items.length - allowed.length;
      if (!allowed.length) continue;
      remaining -= allowed.length;
      const rows = Math.ceil(allowed.length / columns);
      const height = opts.tierPadding * 2 + rows * rowHeight - opts.posterGap;
      tiers.push({
        tier: group.tier,
        label: group.label || group.tier,
        name: group.name || '',
        count: items.length,
        y,
        height,
        rows,
        items: allowed.map((anime, index) => ({
          anime,
          x: contentX + (index % columns) * (opts.posterWidth + opts.posterGap),
          y: y + opts.tierPadding + Math.floor(index / columns) * rowHeight,
        })),
      });
      y += height + opts.tierGap;
    }

    const height = Math.max(
      opts.headerHeight + opts.footerHeight + 40,
      y - opts.tierGap + opts.footerHeight,
    );
    return { ...opts, contentX, columns, rowHeight, height, omitted, tiers };
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
    buildCalendarItems,
    buildIcs,
    LIST_SORTS,
    normalizeListSort,
    sortListItems,
    randomItem,
    IMPORT_MAX_BYTES,
    IMPORT_MAX_ROWS,
    tierFromScore,
    importStatusList,
    normalizeImportedRow,
    normalizeImportRows,
    parseMalXml,
    parseShikimoriJson,
    planImport,
    TIER_IMAGE_DEFAULTS,
    buildTierImageLayout,
    formatWatchTime,
    buildProfileStats,
    APP_VERSION,
    GITHUB_URL,
    CHANGELOG,
    compareVersions,
    parseLatestRelease,
    dragScrollDelta,
    GENRES,
    TAGS,
    DB_SORTS,
    normalizeDBSort,
    sortCatalogItems,
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
    russianTitleIds,
    russianTitleAniListIds,
    dedupeById,
    normalizeTitleKey,
    animeIdentityKeys,
    searchGlobal,
    mergeUniqueAnime,
    slicePage,
  };
});
