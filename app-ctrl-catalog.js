/* ============================================================
   AniTier вЂ” РєРѕРЅС‚СЂРѕР»Р»РµСЂ РєР°С‚Р°Р»РѕРіР° (РІС‹РґРµР»РµРЅРѕ РёР· app.js)
   ============================================================ */
(function (App) {
  'use strict';
  const C = window.AniTierCore;

  async function fetchDB(force = false, options = {}) {
    const reload = Boolean(options && options.reload);
    if (reload) {
      return App.withCacheReload(() => fetchDBInner(force, reload));
    }
    return fetchDBInner(force, false);
  }

  async function fetchDBInner(force = false, reload = false) {
    const s = App.state.db;

    if (force) {
      s.revision += 1;
      s.page = 1;
      s.items = [];
      s.hasNext = true;
      s.error = null;
      s.sources = [];
      s.resolvedQuery = '';
      s.resolveVia = '';
      s.alt = App.createAltSearchState();
      App.clearAniListCache();
    }

    if (s.loading) {
      if (force) {
        s.queued = true;
        s.reloadQueued = reload;
        App.renderDB();
      }
      return;
    }
    if (!s.hasNext && s.items.length) return;

    const revision = s.revision;
    const page = s.page;
    s.loading = true;
    s.error = null;
    App.renderDB();

    try {
      let usedAlt = false;
      const keepMine = anime => !s.hideMine || !(App.hasIn('watched', anime.id) || App.hasIn('planned', anime.id));

      /* Русский запрос: если обычный поиск ничего не дал, пробуем
         локальный словарь названий и забираем карточки по MAL ID. */
      const ruIds = s.query && C.hasCyrillic(s.query)
        && C.normalizeSearchLang(App.state.settings.searchLang) !== 'en'
        && C.normalizeSearchLang(App.state.settings.searchLang) !== 'ja'
        ? C.russianTitleIds(s.query, App.PAGE_LIMIT)
        : [];
      const ruAniListIds = s.query && C.hasCyrillic(s.query)
        && C.normalizeSearchLang(App.state.settings.searchLang) !== 'en'
        && C.normalizeSearchLang(App.state.settings.searchLang) !== 'ja'
        ? C.russianTitleAniListIds(s.query, App.PAGE_LIMIT)
        : [];

      if (s.mode === 'custom') {
        const all = C.filterItems(App.state.customCards, { query: s.query, filters: s.filters });
        const pageData = C.slicePage(all, page, App.PAGE_LIMIT);
        if (revision !== s.revision) return;
        s.items.push(...pageData.items.filter(keepMine));
        s.sources = ['Свои карточки'];
        s.hasNext = pageData.hasNext;
        s.page = page + 1;
      } else if (!App.state.forceDemo && s.query) {
        const alt = await App.fillAltPage(s, revision);
        if (revision !== s.revision || alt.aborted) return;
        if (alt.ok) {
          s.items = C.dedupeById([...s.items, ...alt.items.filter(keepMine)]);
          s.sources = alt.sources;
          s.hasNext = alt.hasNext;
          s.page = page + 1;
          usedAlt = true;
        }
      }

      if (s.mode === 'custom') {
        /* свои карточки не ходят в сеть */
      } else if (App.state.forceDemo) {
        const all = C.filterItems(App.demoAnime(), { query: s.query, filters: s.filters });
        const pageData = C.slicePage(all, page, App.PAGE_LIMIT);
        if (revision !== s.revision) return;
        s.items.push(...pageData.items.filter(keepMine));
        s.sources = [];
        s.hasNext = pageData.hasNext;
        s.page = page + 1;
      } else if (!usedAlt) {
        const variables = C.buildAniListVariables({
          mode: s.mode,
          query: s.query,
          filters: s.filters,
          page,
          limit: App.PAGE_LIMIT,
          sort: s.sort,
        });
        const pageData = await App.fetchAniList(variables, { timeout: App.SEARCH_TIMEOUT });
        if (revision !== s.revision) return;

        const media = pageData.media.map(App.mapAniList);
        /* Сервер получает диапазон лет и списки, но точные годы (когда их
           несколько) и прочие условия проверяем повторно на клиенте. */
        const data = media.filter(anime => C.matchesFilters(anime, s.filters)).filter(keepMine);
        s.items = C.dedupeById([...s.items, ...data]);
        s.sources = ['AniList'];
        s.hasNext = Boolean(pageData.pageInfo?.hasNextPage) && media.length > 0;
        s.page = page + 1;
        if (!media.length) s.hasNext = false;
      }

      const fallbackIds = ruIds.length ? ruIds : ruAniListIds;
      const fallbackKey = ruIds.length ? 'idMal_in' : 'id_in';
      if (!s.items.length && page === 1 && fallbackIds.length && s.mode !== 'custom' && !App.state.forceDemo) {
        const variables = C.buildAniListVariables({
          mode: s.mode,
          query: '',
          filters: s.filters,
          page: 1,
          limit: fallbackIds.length,
        });
        variables[fallbackKey] = fallbackIds;
        const pageData = await App.fetchAniList(variables, { timeout: App.SEARCH_TIMEOUT });
        if (revision !== s.revision) return;
        const data = pageData.media.map(App.mapAniList).filter(anime => C.matchesFilters(anime, s.filters)).filter(keepMine);
        s.items = C.dedupeById(data);
        s.sources = ['AniList'];
        s.resolvedQuery = s.query;
        s.resolveVia = 'dictionary';
        s.hasNext = false;
        s.page = page + 1;
      }
    } catch (err) {
      if (revision !== s.revision) return;
      console.error(err);
      s.error = err.message || 'Ошибка сети';
      App.state.offline = true;
      if (!s.items.length) {
        const all = C.filterItems(App.demoAnime(), { query: s.query, filters: s.filters });
        const pageData = C.slicePage(all, page, App.PAGE_LIMIT);
        s.items = pageData.items;
        s.hasNext = pageData.hasNext;
        s.page = page + 1;
      }
      App.toast('База недоступна — включён демо-режим');
    } finally {
      if (revision === s.revision) {
        s.loading = false;
        App.renderDB();
        App.updateOfflineBanner();
      } else if (!s.queued) {
        s.loading = false;
        App.renderDB();
      }
      if (s.queued) {
        const queuedReload = Boolean(s.reloadQueued);
        s.queued = false;
        s.reloadQueued = false;
        s.loading = false;
        App.fetchDB(false, { reload: queuedReload });
      }
      App.enrichRussianTitles();
    }
  }

  /* ---------------- русские названия: догрузка и кэш ---------------- */
  const ruEnrichAttempted = new Set();
  let ruEnrichBusy = false;

  function collectKnownAnime() {
    const out = [];
    const push = value => { if (value && typeof value === 'object') out.push(value); };
    const addPool = pool => { if (Array.isArray(pool)) pool.forEach(push); };
    addPool(App.allIn('watched'));
    addPool(App.allIn('planned'));
    addPool(App.state.db.items);
    addPool(App.state.upcoming.items);
    const n = App.state.notifications;
    addPool((n.tracked.episodes || []).map(group => group.anime));
    addPool((n.tracked.seasons || []).flatMap(item => [item.anime, item.sequel]));
    addPool((n.recent.episodes || []).map(group => group.anime));
    addPool(n.recent.films);
    addPool(n.completed);
    if (App.state.byId) for (const anime of App.state.byId.values()) push(anime);
    return out;
  }

  async function enrichRussianTitles() {
    if (ruEnrichBusy || typeof App.fetchRussianTitles !== 'function') return;
    const targets = collectKnownAnime().filter(anime => (
      anime
      && anime.malId
      && !anime.titleRu
      && !ruEnrichAttempted.has(Number(anime.malId))
    ));
    const ids = [...new Set(targets.map(anime => Number(anime.malId)))].slice(0, 120);
    if (!ids.length) return;

    ids.forEach(id => ruEnrichAttempted.add(id));
    ruEnrichBusy = true;
    try {
      const titles = await App.fetchRussianTitles(ids);
      const byMal = new Map();
      for (const [id, title] of Object.entries(titles)) {
        if (title) byMal.set(Number(id), title);
      }
      if (!byMal.size) return;
      let changed = false;
      for (const anime of collectKnownAnime()) {
        if (!anime || !anime.malId || anime.titleRu) continue;
        const title = byMal.get(Number(anime.malId));
        if (!title) continue;
        anime.titleRu = title;
        changed = true;
      }
      if (changed) {
        App.saveState();
        /* Сетка базы кэширует сигнатуру и иначе не заметит новые названия. */
        const grid = document.getElementById('db-grid');
        if (grid) grid.dataset.cardSignature = '';
        if (App.state.tab === 'db' || App.state.tab === 'watched' || App.state.tab === 'planned'
          || App.state.tab === 'notifications' || App.state.tab === 'upcoming') {
          App.refreshViews();
        }
      }
    } catch {
      /* названия не критичны: молча ждём следующего раза */
    } finally {
      ruEnrichBusy = false;
    }
  }

  Object.assign(App, { fetchDB, enrichRussianTitles });
})(window.AniTier);