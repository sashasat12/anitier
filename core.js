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
    const query = String(options.query || '').trim().toLowerCase();
    const filters = normalizeFilters(options.filters);

    return (Array.isArray(items) ? items : []).filter(anime => {
      if (query) {
        const haystack = `${anime.title || ''} ${anime.altTitle || ''}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return matchesFilters(anime, filters);
    });
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

    if (query) variables.search = query;
    if (filters.type) variables.format = ANILIST_FORMATS[filters.type];
    if (filters.status) variables.status = ANILIST_STATUSES[filters.status];
    if (filters.year) variables.seasonYear = Number(filters.year);
    if (filters.genre) {
      const genre = aniListGenre(filters.genre);
      if (genre) variables.genre = genre;
    }
    if (filters.minScore) variables.averageScoreGreater = Number(filters.minScore) * 10 - 1;

    if (query) {
      if (active) variables.sort = [mode === 'score' ? 'SCORE_DESC' : 'POPULARITY_DESC'];
      return variables;
    }

    if (active) {
      variables.sort = [mode === 'score' ? 'SCORE_DESC' : 'POPULARITY_DESC'];
      return variables;
    }

    if (mode === 'score') {
      variables.sort = ['SCORE_DESC'];
    } else if (mode === 'airing') {
      variables.status = 'RELEASING';
      variables.sort = ['POPULARITY_DESC'];
    } else if (mode === 'movie') {
      variables.format = 'MOVIE';
      variables.sort = ['POPULARITY_DESC'];
    } else {
      variables.sort = ['POPULARITY_DESC'];
    }

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

  return {
    PAGE_LIMIT,
    TIER_IDS,
    SHARE_PREFIX,
    SHARE_KIND,
    SHARE_VERSION,
    makeTierShare,
    encodeTierShare,
    parseTierShare,
    compareTierLists,
    compactShareAnime,
    GENRES,
    TYPES,
    STATUSES,
    SCORES,
    DEFAULT_FILTERS,
    normalizeFilters,
    hasActiveFilters,
    countActiveFilters,
    genreById,
    matchesFilters,
    filterItems,
    buildAniListVariables,
    dedupeById,
    normalizeTitleKey,
    animeIdentityKeys,
    mergeUniqueAnime,
    slicePage,
  };
});
