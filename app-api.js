/* ============================================================
   AniTier — AniList, Kitsu, поиск и демо-данные
   Загружается после app-store.js и до app-render.js.
   ============================================================ */
(function (App) {
  'use strict';

  const C = window.AniTierCore;
  const {
    state,
    PAGE_LIMIT,
    ANILIST_TIMEOUT,
    SEARCH_TIMEOUT,
    ANILIST_ENDPOINT,
    KITSU_ENDPOINT,
    ANILIST_QUERY,
    ANILIST_TRACKED_QUERY,
    ANILIST_SCHEDULE_QUERY,
    RU_TITLES,
    DEMO_BASE,
    makePoster,
    addDays,
    startOfToday,
    endOfToday,
    fuzzyDateInt,
  } = App;

  /* ---------------- AniList API ---------------- */
  const anilistCache = new Map();
  const API_CACHE_DB = 'anitier-api-cache-v1';
  const API_CACHE_STORE = 'responses';
  const API_CACHE_TTL = 24 * 60 * 60 * 1000;
  let apiCacheDbPromise = null;
  let dailySyncMode = false;

  function openApiCacheDb() {
    if (!('indexedDB' in window)) return Promise.resolve(null);
    if (!apiCacheDbPromise) {
      apiCacheDbPromise = new Promise(resolve => {
        const request = indexedDB.open(API_CACHE_DB, 1);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(API_CACHE_STORE)) request.result.createObjectStore(API_CACHE_STORE, { keyPath: 'key' });
        };
        request.onsuccess = () => {
          request.result.onversionchange = () => {
            request.result.close();
            apiCacheDbPromise = null;
          };
          resolve(request.result);
        };
        request.onerror = request.onblocked = () => resolve(null);
      });
    }
    return apiCacheDbPromise;
  }

  async function readApiCache(key) {
    try {
      const db = await openApiCacheDb();
      if (!db) return null;
      return await new Promise(resolve => {
        const request = db.transaction(API_CACHE_STORE, 'readonly').objectStore(API_CACHE_STORE).get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
      });
    } catch { return null; }
  }

  async function writeApiCache(key, value) {
    try {
      const db = await openApiCacheDb();
      if (!db) return;
      await new Promise(resolve => {
        const tx = db.transaction(API_CACHE_STORE, 'readwrite');
        const store = tx.objectStore(API_CACHE_STORE);
        store.put({ key, value, savedAt: Date.now() });
        const all = store.getAll();
        all.onsuccess = () => {
          const cutoff = Date.now() - 180 * 86400000;
          const entries = (all.result || []).sort((a, b) => b.savedAt - a.savedAt);
          entries.forEach((entry, index) => {
            if (index >= 500 || entry.savedAt < cutoff) store.delete(entry.key);
          });
        };
        tx.oncomplete = tx.onerror = tx.onabort = () => resolve();
      });
    } catch { /* API results remain usable if browser storage is unavailable. */ }
  }

  async function clearPersistentApiCache() {
    if (!('indexedDB' in window)) return;
    if (apiCacheDbPromise) {
      const db = await apiCacheDbPromise;
      if (db) db.close();
      apiCacheDbPromise = null;
    }
    await new Promise(resolve => {
      const request = indexedDB.deleteDatabase(API_CACHE_DB);
      request.onsuccess = request.onerror = request.onblocked = () => resolve();
    });
  }

  function setDailySyncMode(enabled) { dailySyncMode = Boolean(enabled); }

  function anilistCacheKey(variables, query = ANILIST_QUERY) {
    return JSON.stringify([query, variables]);
  }

  async function fetchAniList(variables, options = {}) {
    const useCache = options.cache !== false;
    const query = options.query || ANILIST_QUERY;
    const key = anilistCacheKey(variables, query);
    let stale = null;
    if (useCache && !dailySyncMode && anilistCache.has(key)) return anilistCache.get(key);
    if (useCache && !dailySyncMode) {
      const cached = await readApiCache(`anilist:${key}`);
      if (cached) {
        stale = cached.value;
        if (Date.now() - cached.savedAt < API_CACHE_TTL) {
          anilistCache.set(key, stale);
          return stale;
        }
      }
    }
    if (!navigator.onLine) {
      if (stale) return stale;
      throw new Error('Нет подключения к интернету');
    }

    const body = JSON.stringify({ query, variables });
    let json;
    try { json = await fetchWithTimeout(ANILIST_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body,
    }, options.timeout || ANILIST_TIMEOUT); }
    catch (err) { if (stale) return stale; throw err; }

    const pageData = json?.data?.Page;
    if (!pageData || !Array.isArray(pageData.media)) throw new Error('AniList: неверный ответ');
    if (useCache) {
      anilistCache.set(key, pageData);
      await writeApiCache(`anilist:${key}`, pageData);
    }
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
    const titles = raw.title || {};
    const ruSynonym = C.firstCyrillic(raw.synonyms || []);
    const ru = (malId && RU_TITLES[malId]) || ruSynonym || '';
    const title = ru || titles.english || titles.romaji || titles.native || 'Без названия';
    const originalTitle = titles.romaji || titles.english || titles.native || '';
    let altTitle = '';
    if (ru) {
      altTitle = originalTitle && originalTitle !== title ? originalTitle : '';
    } else if (titles.english && titles.romaji && titles.english !== titles.romaji) altTitle = titles.romaji;
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
      titleRu: ru,
      altTitle,
      originalTitle,
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
      tags: (Array.isArray(raw.tags) ? raw.tags : [])
        .filter(tag => tag && tag.name && !tag.isMediaSpoiler)
        .map(tag => tag.name),
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

  function mapTrackedAniList(raw) {
    const anime = mapAniList(raw);
    const relations = [];
    for (const edge of raw?.relations?.edges || []) {
      if (!edge || !edge.node) continue;
      relations.push({
        relationType: edge.relationType,
        anime: mapAniList(edge.node),
      });
    }
    anime.relations = relations;
    return anime;
  }

  const ANILIST_FRANCHISE_QUERY = `query AnimeFranchise($id: Int, $idMal: Int) {
    Page(page: 1, perPage: 1) {
      media(id: $id, idMal: $idMal, type: ANIME) {
        id idMal title { romaji english native } synonyms format episodes status seasonYear
        startDate { year month day } endDate { year month day } averageScore
        description(asHtml: false) genres studios(isMain: true) { nodes { name } }
        coverImage { extraLarge large } siteUrl nextAiringEpisode { episode airingAt }
        relations { edges { relationType node {
          id idMal title { romaji english native } synonyms format episodes status seasonYear
          startDate { year month day } endDate { year month day } averageScore
          description(asHtml: false) genres studios(isMain: true) { nodes { name } }
          coverImage { extraLarge large } siteUrl nextAiringEpisode { episode airingAt }
        } } }
      }
    }
  }`;

  async function fetchAnimeRelations(anime) {
    if (!anime || anime.custom) return [];
    if (Array.isArray(anime.relations)) return anime.relations;
    if (!anime.sourceId && !anime.malId) return [];
    const page = await fetchAniList({
      id: anime.source === 'AniList' && anime.sourceId ? Number(anime.sourceId) : null,
      idMal: anime.malId || null,
      page: 1,
      perPage: 1,
    }, { query: ANILIST_FRANCHISE_QUERY, timeout: SEARCH_TIMEOUT });
    const raw = (page.media || [])[0];
    if (!raw) return [];
    const mapped = mapTrackedAniList(raw);
    anime.relations = mapped.relations;
    return anime.relations;
  }

  function scheduleDate(airingAt) {
    const seconds = Number(airingAt);
    if (!Number.isFinite(seconds) || seconds <= 0) return null;
    return new Date(seconds * 1000).toISOString();
  }

  async function fetchTrackedAnime(malIds) {
    const ids = [...new Set((Array.isArray(malIds) ? malIds : [])
      .map(Number)
      .filter(id => Number.isInteger(id) && id > 0))];
    if (!ids.length) return [];

    const chunks = [];
    for (let i = 0; i < ids.length; i += 50) chunks.push(ids.slice(i, i + 50));

    const all = [];
    for (const chunk of chunks) {
      const pageData = await fetchAniList({
        idMal_in: chunk,
        page: 1,
        perPage: 50,
      }, { query: ANILIST_TRACKED_QUERY, timeout: SEARCH_TIMEOUT });
      all.push(...(pageData.media || []).map(mapTrackedAniList));
    }
    return C.dedupeById(all);
  }

  async function fetchRecentScheduleEvents(days = 7, maxPages = 4) {
    const now = Math.floor(Date.now() / 1000);
    const from = now - Math.max(1, Number(days) || 7) * 86400;
    const events = [];
    const seen = new Set();
    const animeCache = new Map();

    for (let page = 1; page <= maxPages; page += 1) {
      const pageData = await fetchAniList({
        page,
        perPage: 50,
        airingAtGreater: from,
        airingAtLesser: now,
      }, { query: ANILIST_SCHEDULE_QUERY, timeout: SEARCH_TIMEOUT });

      const schedules = pageData.airingSchedules || [];
      for (const node of schedules) {
        const raw = node && node.media;
        const episode = Number(node && node.episode);
        const date = scheduleDate(node && node.airingAt);
        if (!raw || !Number.isInteger(episode) || episode <= 0 || !date) continue;
        let anime = animeCache.get(raw.id);
        if (!anime) {
          anime = mapAniList(raw);
          animeCache.set(raw.id, anime);
        }
        const key = `${anime.id}:${episode}`;
        if (seen.has(key)) continue;
        seen.add(key);
        events.push({ anime, episode, date });
      }

      if (!pageData.pageInfo?.hasNextPage || !schedules.length) break;
    }
    return events;
  }

  async function fetchRecentFilms() {
    const today = endOfToday();
    const cutoff = addDays(startOfToday(), -C.RECENT_FILM_DAYS);
    const pageData = await fetchAniList({
      type: 'ANIME',
      format: 'MOVIE',
      status: 'FINISHED',
      sort: ['END_DATE_DESC'],
      page: 1,
      perPage: 50,
      endDateGreater: fuzzyDateInt(cutoff),
      endDateLesser: fuzzyDateInt(today),
      isAdult: false,
    }, { timeout: SEARCH_TIMEOUT });

    const from = cutoff.getTime();
    const to = today.getTime();
    return C.dedupeById((pageData.media || [])
      .map(mapAniList)
      .filter(a => {
        if (a.type !== 'Movie') return false;
        const end = a.airedTo ? new Date(a.airedTo).getTime() : 0;
        return end >= from && end <= to;
      })
      .sort((a, b) => new Date(b.airedTo) - new Date(a.airedTo)))
      .slice(0, 24);
  }

  async function fetchFinishedAnime() {
    const today = endOfToday();
    const cutoff = addDays(startOfToday(), -C.COMPLETED_DAYS);
    const pageData = await fetchAniList({
      type: 'ANIME',
      status: 'FINISHED',
      sort: ['END_DATE_DESC'],
      page: 1,
      perPage: 50,
      endDateGreater: fuzzyDateInt(cutoff),
      endDateLesser: fuzzyDateInt(today),
      isAdult: false,
    }, { timeout: SEARCH_TIMEOUT });

    const from = cutoff.getTime();
    const to = today.getTime();
    return C.dedupeById((pageData.media || [])
      .map(mapAniList)
      .filter(a => {
        if (a.type === 'Movie') return false;
        const end = a.airedTo ? new Date(a.airedTo).getTime() : 0;
        return end >= from && end <= to;
      })
      .sort((a, b) => new Date(b.airedTo) - new Date(a.airedTo)))
      .slice(0, 24);
  }

  function mapKitsu(raw, categories = new Map(), mappings = new Map()) {
    const attrs = raw.attributes || {};
    const titles = attrs.titles || {};
    const mappingIds = (raw.relationships?.mappings?.data || []).map(ref => ref.id);
    const malMapping = mappingIds
      .map(id => mappings.get(id))
      .find(mapping => mapping && mapping.externalSite === 'myanimelist/anime' && /^\d+$/.test(String(mapping.externalId)));
    const malId = malMapping ? Number(malMapping.externalId) : null;
    const ruTitle = C.firstCyrillic([attrs.canonicalTitle, ...Object.values(titles)]);
    const ru = (malId && RU_TITLES[malId]) || ruTitle || '';
    const originalTitle = titles.en_jp || titles.ja_jp || attrs.canonicalTitle || titles.en || '';
    const title = ru || attrs.canonicalTitle || titles.en || titles.en_jp || titles.ja_jp || 'Без названия';
    let altTitle = '';
    if (ru) {
      altTitle = originalTitle && originalTitle !== title ? originalTitle : '';
    } else if (titles.en && titles.en !== title) altTitle = titles.en;
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
      titleRu: ru,
      altTitle,
      originalTitle,
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
      tags: genres.slice(),
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

  /* Последний релиз на GitHub: версия, ссылка и заметки. */
  async function fetchLatestRelease() {
    const repo = String(C.GITHUB_URL || '').replace(/\/+$/, '').replace(/^https?:\/\/github\.com\//i, '');
    if (!repo) throw new Error('Ссылка на GitHub не указана');
    const url = `https://api.github.com/repos/${repo}/releases/latest`;
    let payload;
    try {
      payload = await fetchWithTimeout(url, {
        headers: { Accept: 'application/vnd.github+json' },
      }, 12000);
    } catch (err) {
      if (err && /404/.test(err.message)) throw new Error('На GitHub пока нет релизов');
      throw err;
    }
    const release = C.parseLatestRelease(payload);
    if (!release) throw new Error('Не удалось разобрать ответ GitHub');
    return release;
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
    const cacheKey = `kitsu:${url}`;
    let stale = null;
    if (!dailySyncMode) {
      const cached = await readApiCache(cacheKey);
      if (cached) {
        stale = cached.value;
        if (Date.now() - cached.savedAt < API_CACHE_TTL) {
          for (const anime of stale.items || []) state.byId.set(anime.id, anime);
          return stale;
        }
      }
    }
    if (!navigator.onLine && stale) {
      for (const anime of stale.items || []) state.byId.set(anime.id, anime);
      return stale;
    }
    let json;
    try { json = await fetchWithTimeout(url, { headers: { Accept: 'application/vnd.api+json' } }); }
    catch (err) {
      if (stale) {
        for (const anime of stale.items || []) state.byId.set(anime.id, anime);
        return stale;
      }
      throw err;
    }
    if (!Array.isArray(json?.data)) throw new Error('Kitsu: неверный ответ');
    if (json.data.length && !json.data.some(item => item?.attributes)) throw new Error('Kitsu: неверный ответ');
    state.offline = false;

    const categories = new Map();
    const mappings = new Map();
    for (const item of json.included || []) {
      if (item?.type === 'categories') categories.set(item.id, item.attributes?.title);
      if (item?.type === 'mappings') mappings.set(item.id, item.attributes);
    }

    const result = {
      source: 'Kitsu',
      ok: true,
      items: json.data.map(item => mapKitsu(item, categories, mappings)),
      hasNext: Boolean(json.links?.next),
    };
    await writeApiCache(cacheKey, result);
    return result;
  }

  /* ---------------- русский поиск ---------------- */
  const RU_QUERY_EXTRA = {
    'монстр': 'Monster',
    'код гиас восставший лелуш': 'Code Geass: Hangyaku no Lelouch',
    'ангельские ритмы': 'Angel Beats!',
    'мастера меча онлайн': 'Sword Art Online',
    'нет игры нет жизни': 'No Game No Life',
    'наруто': 'Naruto',
    'наруто ураганные хроники': 'Naruto: Shippuuden',
    'боруто': 'Boruto: Naruto Next Generations',
    'джо джо': 'JoJo no Kimyou na Bouken',
    'невероятные приключения джо джо': 'JoJo no Kimyou na Bouken',
    'доктор стоун': 'Dr. Stone',
    'токийские мстители': 'Tokyo Revengers',
    'класс убийц': 'Ansatsu Kyoushitsu',
    'класс превосходства': 'Youkoso Jitsuryoku Shijou Shugi no Kyoushitsu e',
    'обещанный неверленд': 'Yakusoku no Neverland',
    'паразит учение о жизни': 'Kiseijuu: Sei no Kakuritsu',
    'паразит': 'Kiseijuu: Sei no Kakuritsu',
    'тетрадь смерти': 'Death Note',
    'психопаспорт': 'Psycho-Pass',
    'самурай чамплу': 'Samurai Champloo',
    'созданный в бездне': 'Made in Abyss',
    'дитя погоды': 'Tenki no Ko',
    'унесённые призраками': 'Sen to Chihiro no Kamikakushi',
    'унесенные призраками': 'Sen to Chihiro no Kamikakushi',
    'принцесса мононоке': 'Mononoke Hime',
    'мой сосед тоторо': 'Tonari no Totoro',
    'ходячий замок': 'Howl no Ugoku Shiro',
    'киберпанк': 'Cyberpunk: Edgerunners',
    'киберпанк бегущие по краю': 'Cyberpunk: Edgerunners',
    'синяя тюрьма': 'Blue Lock',
    'голубой экзорцист': 'Ao no Exorcist',
    'чёрный клевер': 'Black Clover',
    'черный клевер': 'Black Clover',
    'семья шпиона': 'Spy x Family',
    'семья шпиона код белый': 'Spy x Family Code: White',
    'поднятие уровня в одиночку': 'Ore dake Level Up na Ken',
    'соло левелинг': 'Ore dake Level Up na Ken',
    'дандадан': 'Dandadan',
    'подземелье вкусностей': 'Dungeon Meshi',
    'фрирен': 'Sousou no Frieren',
    'провожающая в последний путь фрирен': 'Sousou no Frieren',
    'магическая битва': 'Jujutsu Kaisen',
    'человек бензопила': 'Chainsaw Man',
    'человек-бензопила': 'Chainsaw Man',
    'клинок рассекающий демонов': 'Kimetsu no Yaiba',
    'клинок, рассекающий демонов': 'Kimetsu no Yaiba',
    'атака титанов': 'Shingeki no Kyojin',
    'атака на титанов': 'Shingeki no Kyojin',
    'стальной алхимик': 'Fullmetal Alchemist',
    'стальной алхимик братство': 'Fullmetal Alchemist: Brotherhood',
    'хантер хантер': 'Hunter x Hunter',
    'охотник х охотник': 'Hunter x Hunter',
    'повелитель': 'Overlord',
    'восхождение героя щита': 'Tate no Yuusha no Nariagari',
    'эта прекрасная жизнь': 'Kono Subarashii Sekai ni Shukufuku wo!',
    'коносуба': 'Kono Subarashii Sekai ni Shukufuku wo!',
    'ре зеро': 'Re:Zero kara Hajimeru Isekai Seikatsu',
    'ре зеро жизнь с нуля': 'Re:Zero kara Hajimeru Isekai Seikatsu',
    'врата штейна': 'Steins;Gate',
    'волейбол': 'Haikyuu!!',
    'токийский гуль': 'Tokyo Ghoul',
    'ангельские ритмы': 'Angel Beats!',
    'ангельские ритмы!': 'Angel Beats!',
    'форма голоса': 'Koe no Katachi',
    'твоё имя': 'Kimi no Na wa',
    'твое имя': 'Kimi no Na wa',
    'ванпанчмен': 'One Punch Man',
    'ван панч мен': 'One Punch Man',
    'восемьдесят шесть': '86',
    'эрго прокси': 'Ergo Proxy',
    'моногатари': 'Bakemonogatari',
    'триган': 'Trigun',
    'крутой учитель онидзука': 'Great Teacher Onizuka',
    'гуррен лаганн': 'Tengen Toppa Gurren Lagann',
    'код гиас': 'Code Geass: Hangyaku no Lelouch',
    'сад изящных слов': 'Kotonoha no Niwa',
    'девочка покорившая время': 'Toki wo Kakeru Shoujo',
    'девочка, покорившая время': 'Toki wo Kakeru Shoujo',
  };

  let ruAliasIndex = null;

  function buildRuAliasIndex() {
    if (ruAliasIndex) return ruAliasIndex;
    ruAliasIndex = new Map();
    for (const [, ru, alt] of DEMO_BASE) {
      const key = C.normalizeTitleKey(ru);
      if (key && alt) ruAliasIndex.set(key, alt);
    }
    for (const [ru, alt] of Object.entries(RU_QUERY_EXTRA)) {
      const key = C.normalizeTitleKey(ru);
      if (key && alt && !ruAliasIndex.has(key)) ruAliasIndex.set(key, alt);
    }
    return ruAliasIndex;
  }

  function searchQueryForAlt(query) {
    const raw = String(query || '').trim();
    if (!raw || !C.hasCyrillic(raw)) return raw;
    const needle = C.normalizeTitleKey(raw);
    if (!needle) return raw;

    const index = buildRuAliasIndex();
    if (index.has(needle)) return index.get(needle);

    return raw;
  }

  const resolveCache = new Map();
  const translationCache = new Map();
  const translationInFlight = new Map();
  let translationLoaded = false;
  const TRANSLATION_LS_KEY = 'anitier.translations.v1';
  const TRANSLATION_LIMIT = 200;

  function decodeEntities(value) {
    return String(value == null ? '' : value)
      .replace(/&quot;/g, '"')
      .replace(/&#0?39;|&apos;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
  }

  async function resolveViaAniList(query) {
    const page = await fetchAniList({
      search: query,
      page: 1,
      perPage: 5,
      type: 'ANIME',
      isAdult: false,
    }, { timeout: SEARCH_TIMEOUT, cache: false });
    for (const raw of page.media || []) {
      const titles = raw && raw.title ? raw.title : {};
      const title = String(titles.romaji || titles.english || '').trim();
      if (title) return title;
    }
    return '';
  }

  async function resolveViaMyMemory(query) {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(query)}&langpair=ru|en`;
    const json = await fetchWithTimeout(url, {}, 6000);
    const status = Number(json?.responseStatus);
    if (status && status !== 200) return '';
    const text = decodeEntities(json?.responseData?.translatedText || '').trim();
    if (!text || text === query || /MYMEMORY WARNING/i.test(text)) return '';
    if (!/[a-z]/i.test(text)) return '';
    return text;
  }

  /* ---------------- русские названия: Wikidata + кэш ---------------- */
  const RU_TITLE_TTL = 30 * 24 * 60 * 60 * 1000;
  const RU_TITLE_MISS_TTL = 7 * 24 * 60 * 60 * 1000;
  const ruTitleSession = new Map();

  function cleanRuTitle(value) {
    let label = String(value || '').trim();
    label = label.replace(/\s*\([^)]*\)\s*$/, '').trim();
    if (label.length < 2 || label.length > 90) return '';
    let hasCyrillic = false;
    for (const ch of label) {
      const code = ch.codePointAt(0);
      if (code >= 0x0400 && code <= 0x04ff) { hasCyrillic = true; break; }
    }
    return hasCyrillic ? label : '';
  }

  async function cachedRussianTitle(id) {
    if (ruTitleSession.has(id)) {
      const title = ruTitleSession.get(id);
      if (title) return title;
      const savedAt = Number(ruTitleSession.get(`${id}:at`)) || 0;
      return Date.now() - savedAt < RU_TITLE_MISS_TTL ? '' : null;
    }
    const cached = await App.mediaGet('titles', String(id));
    if (!cached || typeof cached !== 'object') return null;
    const title = cleanRuTitle(cached.title);
    const savedAt = Number(cached.savedAt) || 0;
    const ttl = title ? RU_TITLE_TTL : RU_TITLE_MISS_TTL;
    if (!savedAt || Date.now() - savedAt > ttl) return null;
    ruTitleSession.set(id, title);
    if (!title) ruTitleSession.set(`${id}:at`, savedAt);
    return title;
  }

  /**
   * Догружает русские названия из Wikidata по MAL ID и кладёт их в IndexedDB.
   * Возвращает объект MAL ID → название; пустая строка означает «не нашлось».
   */
  async function fetchRussianTitles(ids) {
    const list = [...new Set((Array.isArray(ids) ? ids : []).map(Number)
      .filter(id => Number.isFinite(id) && id > 0))];
    const out = {};
    const need = [];

    for (const id of list) {
      if (RU_TITLES[id]) { out[id] = RU_TITLES[id]; continue; }
      const cached = await cachedRussianTitle(id);
      if (cached === null) need.push(id);
      else if (cached) out[id] = cached;
    }

    for (let start = 0; start < need.length; start += 40) {
      const chunk = need.slice(start, start + 40);
      const values = chunk.map(id => `"${id}"`).join(' ');
      const query = `SELECT ?mal ?label WHERE { VALUES ?mal { ${values} } ?item wdt:P4086 ?mal . ?item rdfs:label ?label . FILTER(LANG(?label) = "ru") }`;
      let rows = [];
      try {
        const controller = typeof AbortController === 'function' ? new AbortController() : null;
        const timer = controller ? setTimeout(() => controller.abort(), 8000) : 0;
        const response = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`, {
          headers: { Accept: 'application/sparql-results+json' },
          signal: controller ? controller.signal : undefined,
        });
        if (timer) clearTimeout(timer);
        if (response && response.ok) {
          const json = await response.json();
          rows = Array.isArray(json?.results?.bindings) ? json.results.bindings : [];
        }
      } catch {
        rows = [];
      }

      const found = new Map();
      for (const row of rows) {
        const id = Number(row.mal?.value);
        const title = cleanRuTitle(row.label?.value);
        if (!Number.isFinite(id) || !title) continue;
        if (!found.has(id) || title.length < found.get(id).length) found.set(id, title);
      }

      for (const id of chunk) {
        const title = found.get(id) || '';
        if (title) out[id] = title;
        ruTitleSession.set(id, title);
        if (!title) ruTitleSession.set(`${id}:at`, Date.now());
        if (App.mediaPut) {
          App.mediaPut('titles', String(id), { title, savedAt: Date.now() }).catch(() => {});
        }
      }
    }

    return out;
  }

  async function resolveSearchQuery(query, lang) {
    const raw = String(query || '').trim();
    const requested = C.normalizeSearchLang(lang);
    const effective = requested === 'auto' ? C.detectQueryLang(raw) : requested;
    if (!raw) return { query: '', lang: effective, via: 'empty' };
    if (effective !== 'ru') return { query: raw, lang: effective, via: 'raw' };

    const local = searchQueryForAlt(raw);
    if (local !== raw) return { query: local, lang: 'ru', via: 'dictionary' };

    const cacheKey = 'ru|' + C.normalizeTitleKey(raw);
    if (resolveCache.has(cacheKey)) return resolveCache.get(cacheKey);

    let result = null;
    try {
      const title = await resolveViaAniList(raw);
      if (title) result = { query: title, lang: 'ru', via: 'anilist' };
    } catch {
      /* пробуем следующий источник */
    }
    if (!result) {
      try {
        const title = await resolveViaMyMemory(raw);
        if (title) result = { query: title, lang: 'ru', via: 'mymemory' };
      } catch {
        /* остаётся исходный запрос */
      }
    }
    if (!result) result = { query: raw, lang: 'ru', via: 'raw' };
    resolveCache.set(cacheKey, result);
    return result;
  }

  function translationKey(text, provider = 'mymemory') {
    const value = String(text || '');
    const key = `t${App.hash(value)}-${value.length}`;
    return provider === 'mymemory' ? key : `${provider}:${key}`;
  }

  function loadTranslationCache() {
    if (translationLoaded) return translationCache;
    translationLoaded = true;
    try {
      const raw = JSON.parse(localStorage.getItem(TRANSLATION_LS_KEY) || 'null');
      if (raw && typeof raw === 'object') {
        for (const [key, value] of Object.entries(raw)) {
          if (typeof value === 'string' && value) translationCache.set(key, value);
        }
      }
    } catch {
      /* кэш необязателен */
    }
    return translationCache;
  }

  function saveTranslationCache() {
    try {
      const entries = [...translationCache.entries()].slice(-TRANSLATION_LIMIT);
      translationCache.clear();
      for (const [key, value] of entries) translationCache.set(key, value);
      localStorage.setItem(TRANSLATION_LS_KEY, JSON.stringify(Object.fromEntries(entries)));
    } catch {
      /* при переполнении localStorage перевод остаётся в памяти */
    }
  }

  function cachedTranslation(text, provider = 'auto') {
    const value = String(text || '').trim();
    if (!value) return '';
    const cache = loadTranslationCache();
    if (provider === 'auto') return cache.get(translationKey(value, 'mymemory')) || cache.get(translationKey(value, 'google')) || '';
    return cache.get(translationKey(value, provider)) || '';
  }

  function cachedTranslationProvider(text, provider = 'auto') {
    const value = String(text || '').trim();
    if (!value) return '';
    if (provider !== 'auto') return cachedTranslation(value, provider) ? provider : '';
    if (cachedTranslation(value, 'mymemory')) return 'mymemory';
    if (cachedTranslation(value, 'google')) return 'google';
    return '';
  }

  function splitTranslationChunks(text, maxLength = 450) {
    const chunks = [];
    let remaining = String(text || '');
    while (remaining.length > maxLength) {
      let cut = Math.max(remaining.lastIndexOf(' ', maxLength), remaining.lastIndexOf('\n', maxLength));
      if (cut < maxLength * 0.55) cut = maxLength;
      if (cut > 0 && /[\uD800-\uDBFF]/.test(remaining[cut - 1]) && /[\uDC00-\uDFFF]/.test(remaining[cut] || '')) cut -= 1;
      const chunk = remaining.slice(0, cut).trim();
      if (chunk) chunks.push(chunk);
      remaining = remaining.slice(cut).trimStart();
    }
    if (remaining.trim()) chunks.push(remaining.trim());
    return chunks;
  }

  async function translateText(text, provider = 'auto') {
    const source = String(text || '').trim();
    if (!source) return '';
    if (C.hasCyrillic(source)) return source;

    const cache = loadTranslationCache();
    const requestedProvider = ['mymemory', 'google'].includes(provider) ? provider : 'auto';
    const cached = cachedTranslation(source, requestedProvider);
    if (cached) return cached;
    const inFlightKey = `${requestedProvider}:${translationKey(source, 'mymemory')}`;
    if (translationInFlight.has(inFlightKey)) return translationInFlight.get(inFlightKey);

    const pair = C.hasJapanese(source) ? 'ja|ru' : 'en|ru';
    const promise = (async () => {
      try {
        const chunks = splitTranslationChunks(source);
        const providers = requestedProvider === 'auto' ? ['mymemory', 'google'] : [requestedProvider];
        for (const currentProvider of providers) {
          const translatedChunks = [];
          let complete = true;
          for (const chunk of chunks) {
            try {
              let translatedChunk = '';
              if (currentProvider === 'mymemory') {
                const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=${pair}`;
                const json = await fetchWithTimeout(url, {}, 8000);
                if (Number(json?.responseStatus) !== 200) { complete = false; break; }
                translatedChunk = decodeEntities(json?.responseData?.translatedText || '').trim();
                if (/MYMEMORY WARNING/i.test(translatedChunk)) translatedChunk = '';
              } else {
                const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ru&dt=t&q=${encodeURIComponent(chunk)}`;
                const json = await fetchWithTimeout(url, {}, 8000);
                translatedChunk = Array.isArray(json?.[0])
                  ? json[0].map(segment => Array.isArray(segment) ? String(segment[0] || '') : '').join('').trim()
                  : '';
              }
              if (!translatedChunk || translatedChunk === chunk || !C.hasCyrillic(translatedChunk)) { complete = false; break; }
              translatedChunks.push(translatedChunk);
            } catch {
              complete = false;
              break;
            }
          }
          if (complete && translatedChunks.length === chunks.length) {
            const translated = translatedChunks.join(' ');
            const key = translationKey(source, currentProvider);
            cache.set(key, translated);
            saveTranslationCache();
            return translated;
          }
        }
        return '';
      } catch {
        return '';
      } finally {
        translationInFlight.delete(inFlightKey);
      }
    })();

    translationInFlight.set(inFlightKey, promise);
    return promise;
  }

  function clearTranslationCache() {
    translationCache.clear();
    translationInFlight.clear();
    translationLoaded = false;
    try { localStorage.removeItem(TRANSLATION_LS_KEY); } catch { /* ignore */ }
  }

  function reloadTranslationCache() {
    translationCache.clear();
    translationLoaded = false;
    loadTranslationCache();
  }

  /* ---------------- Google Drive ---------------- */
  const DRIVE_FILE_NAME = 'anitier-backup.json';

  async function driveRequest(url, token, options = {}) {
    const headers = { ...(options.headers || {}), Authorization: `Bearer ${token}` };
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      const err = new Error('Доступ к Google Drive истёк. Подключитесь заново.');
      err.code = 'AUTH';
      throw err;
    }
    if (!res.ok) {
      let detail = '';
      try {
        const json = await res.json();
        detail = json && json.error && json.error.message ? json.error.message : '';
      } catch {
        /* тело ошибки необязательно */
      }
      throw new Error(detail || `Google Drive ответил ${res.status}`);
    }
    return res;
  }

  async function driveFindBackup(token) {
    const query = encodeURIComponent(`name = '${DRIVE_FILE_NAME}' and trashed = false`);
    const fields = encodeURIComponent('files(id,name,modifiedTime,size)');
    const url = `https://www.googleapis.com/drive/v3/files?spaces=drive&q=${query}&fields=${fields}&orderBy=modifiedTime desc&pageSize=1`;
    const res = await driveRequest(url, token);
    const json = await res.json();
    return json && Array.isArray(json.files) && json.files.length ? json.files[0] : null;
  }

  async function driveSaveBackup(token, text) {
    const existing = await driveFindBackup(token);
    const metadata = { name: DRIVE_FILE_NAME, mimeType: 'application/json' };
    const boundary = `anitier-${Date.now().toString(36)}`;
    const body = new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
      JSON.stringify(metadata),
      `\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
      text,
      `\r\n--${boundary}--`,
    ], { type: `multipart/related; boundary=${boundary}` });
    const base = existing
      ? `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(existing.id)}?uploadType=multipart&fields=id,name,modifiedTime`
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime';
    const res = await driveRequest(base, token, {
      method: existing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });
    return res.json();
  }

  async function driveLoadBackup(token) {
    const file = await driveFindBackup(token);
    if (!file) throw new Error('В Google Drive нет резервной копии AniTier.');
    const res = await driveRequest(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`,
      token,
    );
    return { text: await res.text(), file };
  }

  async function fillAltPage(s, revision) {
    const alt = s.alt;
    const resolved = await resolveSearchQuery(s.query, state.settings && state.settings.searchLang);
    if (revision !== s.revision) {
      return { aborted: true, ok: false, items: [], hasNext: false, sources: [] };
    }
    const query = resolved.query || s.query;
    s.resolvedQuery = query;
    s.resolveVia = resolved.via;
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
          if (!alt.failedSources.includes(result.source)) alt.failedSources.push(result.source);
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

  function demoEpisodeGroup(anime, numbers, latestDaysAgo) {
    const episodes = numbers.map((n, i) => ({
      n,
      date: new Date(Date.now() - (latestDaysAgo + (numbers.length - 1 - i)) * 86400000).toISOString(),
    }));
    return {
      anime,
      episodes,
      latestAt: episodes.length ? episodes[episodes.length - 1].date : null,
      count: episodes.length,
    };
  }

  function demoNotifications() {
    const base = demoAll();
    const trackedAiring = [
      {
        anime: {
          ...base[0],
          status: 'В эфире',
          episodes: 28,
          airedFrom: new Date(Date.now() - 90 * 86400000).toISOString(),
          airedTo: null,
          demoEp: {
            aired: 7,
            total: 28,
            lastAired: new Date(Date.now() - 86400000).toISOString(),
            nextDate: new Date(Date.now() + 3 * 86400000).toISOString(),
          },
        },
        episodes: [5, 6, 7],
        latestDaysAgo: 1,
      },
      {
        anime: {
          ...base[1],
          status: 'В эфире',
          episodes: 64,
          airedFrom: new Date(Date.now() - 120 * 86400000).toISOString(),
          airedTo: null,
          demoEp: {
            aired: 5,
            total: 64,
            lastAired: new Date(Date.now() - 2 * 86400000).toISOString(),
            nextDate: new Date(Date.now() + 5 * 86400000).toISOString(),
          },
        },
        episodes: [3, 4, 5],
        latestDaysAgo: 2,
      },
      {
        anime: {
          ...base[6],
          status: 'В эфире',
          episodes: 12,
          airedFrom: new Date(Date.now() - 70 * 86400000).toISOString(),
          airedTo: null,
          demoEp: {
            aired: 9,
            total: 12,
            lastAired: new Date(Date.now() - 3 * 86400000).toISOString(),
            nextDate: new Date(Date.now() + 4 * 86400000).toISOString(),
          },
        },
        episodes: [8, 9],
        latestDaysAgo: 3,
      },
    ];
    const trackedEpisodes = trackedAiring.map(item => demoEpisodeGroup(item.anime, item.episodes, item.latestDaysAgo));

    const sequelFrieren = {
      ...base[0],
      id: 9001,
      malId: null,
      title: 'Фрирен: сезон 2',
      altTitle: 'Sousou no Frieren 2nd Season',
      status: 'Анонс',
      episodes: 12,
      year: 2027,
      airedFrom: new Date(Date.now() + 120 * 86400000).toISOString(),
      airedTo: null,
      image: makePoster('Фрирен: сезон 2', 9001),
      nextEpisode: null,
    };
    const sequelBocchi = {
      ...base[6],
      id: 9002,
      malId: null,
      title: 'Боччи на рок-концерте! Сезон 2',
      altTitle: 'Bocchi the Rock! 2nd Season',
      status: 'В эфире',
      episodes: 12,
      year: 2026,
      airedFrom: new Date(Date.now() - 20 * 86400000).toISOString(),
      airedTo: null,
      image: makePoster('Боччи: сезон 2', 9002),
      nextEpisode: { n: 4, date: new Date(Date.now() + 2 * 86400000).toISOString() },
    };
    const filmJujutsu = {
      ...base[11],
      id: 9003,
      malId: null,
      title: 'Магическая битва: фильм',
      altTitle: 'Jujutsu Kaisen: Movie',
      status: 'Завершено',
      type: 'Movie',
      episodes: 1,
      year: 2026,
      airedFrom: new Date(Date.now() - 40 * 86400000).toISOString(),
      airedTo: new Date(Date.now() - 20 * 86400000).toISOString(),
      image: makePoster('Магическая битва: фильм', 9003),
      nextEpisode: null,
    };

    const trackedSeasons = [
      { anime: base[0], sequel: sequelFrieren, relationType: 'SEQUEL', status: 'Анонс', date: sequelFrieren.airedFrom },
      { anime: base[6], sequel: sequelBocchi, relationType: 'SEQUEL', status: 'В эфире', date: sequelBocchi.airedFrom },
      { anime: base[11], sequel: filmJujutsu, relationType: 'SIDE_STORY', status: 'Завершено', date: filmJujutsu.airedTo },
    ];

    const recentEpisodes = [
      demoEpisodeGroup(base[2], [23, 24], 1),
      demoEpisodeGroup(base[9], [12, 13], 2),
      demoEpisodeGroup(base[11], [23, 24], 4),
      demoEpisodeGroup({ ...base[10], episodes: 1200 }, [1100, 1101], 6),
      demoEpisodeGroup(base[17], [11, 12], 5),
    ];

    const recentFilms = [
      { ...base[4], status: 'Завершено', airedTo: new Date(Date.now() - 20 * 86400000).toISOString() },
      { ...base[5], status: 'Завершено', airedTo: new Date(Date.now() - 60 * 86400000).toISOString() },
      {
        ...base[0],
        id: 9004,
        malId: null,
        title: 'Фрирен: фильм',
        altTitle: 'Sousou no Frieren Movie',
        status: 'Завершено',
        type: 'Movie',
        episodes: 1,
        year: 2026,
        airedFrom: new Date(Date.now() - 150 * 86400000).toISOString(),
        airedTo: new Date(Date.now() - 120 * 86400000).toISOString(),
        image: makePoster('Фрирен: фильм', 9004),
      },
    ];

    const completed = [
      { ...base[3], status: 'Завершено', airedTo: new Date(Date.now() - 2 * 86400000).toISOString() },
      { ...base[8], status: 'Завершено', airedTo: new Date(Date.now() - 9 * 86400000).toISOString() },
      { ...base[12], status: 'Завершено', airedTo: new Date(Date.now() - 20 * 86400000).toISOString() },
      { ...base[14], status: 'Завершено', airedTo: new Date(Date.now() - 27 * 86400000).toISOString() },
    ];

    const all = [
      ...trackedEpisodes.map(group => group.anime),
      ...trackedSeasons.flatMap(item => [item.anime, item.sequel]),
      ...recentEpisodes.map(group => group.anime),
      ...recentFilms,
      ...completed,
    ];
    for (const a of all) state.byId.set(a.id, a);

    return {
      tracked: { episodes: trackedEpisodes, seasons: trackedSeasons },
      recent: { episodes: recentEpisodes, films: recentFilms },
      completed,
    };
  }

  function seedDemoEpisodeInfo() {
    const n = state.notifications;
    const setInfo = (anime, count, latestDate, nextDate) => {
      if (!anime || state.epInfo[anime.id]) return;
      const total = Number(anime.episodes) || null;
      const aired = Math.max(0, Math.min(Number(count) || 0, total || 9999));
      state.epInfo[anime.id] = {
        count: aired,
        last: aired,
        lastAired: latestDate || null,
        next: nextDate ? { n: aired + 1, date: nextDate } : null,
        fetchedAt: Date.now(),
        total,
        source: 'demo',
      };
    };

    for (const group of n.tracked.episodes || []) {
      const latest = group.episodes[group.episodes.length - 1];
      setInfo(group.anime, latest ? latest.n : 0, latest ? latest.date : null, group.anime.demoEp?.nextDate || null);
    }
    for (const group of n.recent.episodes || []) {
      const latest = group.episodes[group.episodes.length - 1];
      setInfo(group.anime, latest ? latest.n : 0, latest ? latest.date : null, null);
    }
    for (const item of n.tracked.seasons || []) {
      if (item.sequel && item.sequel.status === 'В эфире') {
        setInfo(item.sequel, Number(item.sequel.nextEpisode?.n || 1) - 1, null, item.sequel.nextEpisode?.date || null);
      }
    }
    for (const film of n.recent.films || []) setInfo(film, 1, film.airedTo || null, null);
    for (const anime of n.completed || []) setInfo(anime, anime.episodes || 1, anime.airedTo || null, null);
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

  async function fetchTikTokMeta(url) {
    const target = String(url == null ? '' : url).trim();
    if (!C.isTikTokUrl(target)) throw new Error('Нужна ссылка на TikTok.');
    try {
      const json = await fetchWithTimeout(
        `https://www.tiktok.com/oembed?url=${encodeURIComponent(target)}`,
        {},
        8000,
      );
      let videoId = C.extractTikTokId(target);
      if (!videoId) videoId = C.extractTikTokId(String(json?.html || ''));
      return {
        title: String(json?.title || '').trim().slice(0, 200),
        thumb: String(json?.thumbnail_url || '').trim().slice(0, 500000),
        videoId,
      };
    } catch {
      return { title: '', thumb: '', videoId: C.extractTikTokId(target) };
    }
  }

  function clearAniListCache() {
    anilistCache.clear();
    resolveCache.clear();
  }

  Object.assign(App, {
    anilistCacheKey,
    fetchAniList,
    fetchRussianTitles,
    cleanRuTitle,
    altType,
    altStatus,
    stripHtml,
    altDate,
    altYear,
    mapAniList,
    mapTrackedAniList,
    fetchAnimeRelations,
    mapKitsu,
    fetchWithTimeout,
    fetchLatestRelease,
    fetchTikTokMeta,
    fetchTrackedAnime,
    fetchRecentScheduleEvents,
    fetchRecentFilms,
    fetchFinishedAnime,
    fetchAniListPage,
    fetchKitsuPage,
    searchQueryForAlt,
    resolveSearchQuery,
    translateText,
    cachedTranslation,
    cachedTranslationProvider,
    clearTranslationCache,
    reloadTranslationCache,
    driveFindBackup,
    driveSaveBackup,
    driveLoadBackup,
    fillAltPage,
    demoAll,
    demoAnime,
    demoNotifications,
    seedDemoEpisodeInfo,
    demoUpcoming,
    clearAniListCache,
    setDailySyncMode,
    clearPersistentApiCache,
  });
})(window.AniTier);
