/* ============================================================
   AniTier — контроллер, события и запуск
   Загружается последним, после app-store.js, app-api.js и app-render.js.
   ============================================================ */
(function (App) {
  'use strict';

  const C = window.AniTierCore;
  const {
    state,
    LS_KEY,
    MOMENTS_KEY,
    CUSTOM_IMAGE_MAX,
    MOMENT_VIDEO_MAX,
    MOMENT_GIF_MAX,
    PAGE_LIMIT,
    SEARCH_TIMEOUT,
    TIER_IDS,
    TEST_MODE,
    createAltSearchState,
    saveState,
    loadState,
    loadMoments,
    hasIn,
    addToList,
    removeFromList,
    moveToTier,
    toggleList,
    getAnime,
    watchedSet,
    allIn,
    getCustomCard,
    nextCustomId,
    newUid,
    upsertCustomCard,
    deleteCustomCard,
    addMoment,
    removeMoment,
    findMoment,
    momentsFor,
    buildBackupPayload,
    applyBackupData,
    mediaPut,
    mediaGet,
    mediaDelete,
    mediaEntries,
    mediaPutMany,
    toggleEpisode,
    setWatchedUpTo,
    clearProgress,
    epWord,
    $,
    $$,
    startOfToday,
    endOfToday,
    startOfTomorrow,
    addDays,
    fuzzyDateInt,
    parseDate,
  } = App;

  const {
    clearAniListCache,
    setDailySyncMode,
    clearPersistentApiCache,
    fillAltPage,
    demoAnime,
    fetchAniList,
    mapAniList,
    fetchTrackedAnime,
    fetchRecentScheduleEvents,
    fetchRecentFilms,
    fetchFinishedAnime,
    demoNotifications,
    seedDemoEpisodeInfo,
    demoUpcoming,
    translateText,
    cachedTranslation,
    resolveSearchQuery,
    searchQueryForAlt,
    fetchTikTokMeta,
    driveSaveBackup,
    driveLoadBackup,
  } = App;

  const DAILY_SYNC_KEY = 'anitier.daily-sync.v1';
  const MEDIA_ARCHIVE_MAGIC = 'ANITIER-MEDIA/1\n';
  const MEDIA_ARCHIVE_LIMIT = 500 * 1024 * 1024;

  const {
    renderDB,
    renderNotifications,
    renderUpcoming,
    renderTierList,
    layoutTierCards,
    updateCounters,
    updateBell,
    updateOfflineBanner,
    markNotificationsSeen,
    invalidateNotificationEpisodes,
    toast,
    renderModal,
    renderExchange,
    openModal,
    closeModal,
    openCustomForm,
    closeCustomForm,
    renderCustomForm,
    openMomentForm,
    closeMomentForm,
    renderMomentForm,
    renderBackup,
    openBackup,
    closeBackup,
    renderSettings,
    openSettings,
    closeSettings,
    openExchange,
    closeExchange,
    setExchangeMode,
    switchExchangeList,
    parseImportCode,
    clearExchangeCode,
    copyShareCode,
    addExchangeItem,
    initFilterOptions,
    syncFilterUI,
    syncModeChips,
    syncLangUI,
    readFiltersFromUI,
    resetDBFilters,
    previewEpisodeSlider,
    switchTab,
    ensureNotificationEpisodes,
  } = App;

  async function fetchDB(force = false) {
    const s = state.db;

    if (force) {
      s.revision += 1;
      s.page = 1;
      s.items = [];
      s.hasNext = true;
      s.error = null;
      s.sources = [];
      s.resolvedQuery = '';
      s.resolveVia = '';
      s.alt = createAltSearchState();
      clearAniListCache();
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

      if (s.mode === 'custom') {
        const all = C.filterItems(state.customCards, { query: s.query, filters: s.filters });
        const pageData = C.slicePage(all, page, PAGE_LIMIT);
        if (revision !== s.revision) return;
        s.items.push(...pageData.items);
        s.sources = ['Свои карточки'];
        s.hasNext = pageData.hasNext;
        s.page = page + 1;
      } else if (!state.forceDemo && s.query) {
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

      if (s.mode === 'custom') {
        /* свои карточки не ходят в сеть */
      } else if (state.forceDemo) {
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

  function hasNotificationData() {
    const n = state.notifications;
    return Boolean(
      (n.tracked.episodes && n.tracked.episodes.length)
      || (n.tracked.seasons && n.tracked.seasons.length)
      || (n.recent.episodes && n.recent.episodes.length)
      || (n.recent.films && n.recent.films.length)
      || (n.completed && n.completed.length),
    );
  }

  function trackedMalIds() {
    const ids = [];
    for (const name of ['watched', 'planned']) {
      for (const anime of allIn(name)) {
        const id = Number(anime && anime.malId);
        if (Number.isInteger(id) && id > 0) ids.push(id);
      }
    }
    return [...new Set(ids)];
  }

  function trackedEpisodeGroups(mediaList, scheduleEvents) {
    const byAnime = new Map();
    for (const event of scheduleEvents) {
      const anime = event && event.anime;
      if (!anime || anime.id == null) continue;
      const key = String(anime.id);
      if (!byAnime.has(key)) byAnime.set(key, []);
      byAnime.get(key).push(event);
    }

    const now = Date.now();
    const cutoff = now - C.TRACKED_EPISODE_DAYS * 86400000;
    const groups = [];
    for (const anime of mediaList) {
      if (!anime || anime.id == null) continue;
      const watched = watchedSet(anime.id);
      const events = (byAnime.get(String(anime.id)) || []).filter(event => {
        const at = parseDate(event.date);
        return at && at.getTime() >= cutoff && at.getTime() <= now && !watched.has(event.episode);
      });

      if (!events.length && anime.status === 'В эфире' && anime.nextEpisode) {
        const nextN = Number(anime.nextEpisode.n);
        const nextDate = parseDate(anime.nextEpisode.date);
        if (nextN > 1 && nextDate) {
          const episode = nextN - 1;
          const estimated = new Date(nextDate.getTime() - 7 * 86400000);
          if (estimated.getTime() >= cutoff && estimated.getTime() <= now && !watched.has(episode)) {
            events.push({ anime, episode, date: estimated.toISOString() });
          }
        }
      }

      if (!events.length) continue;
      const group = C.groupEpisodesByAnime(events)[0];
      if (group) groups.push(group);
    }

    return groups.sort((a, b) => {
      const at = a.latestAt ? new Date(a.latestAt).getTime() : 0;
      const bt = b.latestAt ? new Date(b.latestAt).getTime() : 0;
      return bt - at;
    });
  }

  function applyDemoNotifications() {
    const n = state.notifications;
    const demo = demoNotifications();
    n.tracked = demo.tracked;
    n.recent = demo.recent;
    n.completed = demo.completed;
    n.loaded = true;
    n.loading = false;
    n.error = null;
    seedDemoEpisodeInfo();
    if (!n.tabTouched) n.tab = C.defaultNotificationTab(n);
    renderNotifications();
    if (state.tab === 'notifications') markNotificationsSeen();
    updateBell();
  }

  async function fetchNotifications(force = false) {
    const n = state.notifications;
    if (n.loading) {
      if (force) n.queued = true;
      return;
    }
    if (hasNotificationData() && !force) return;
    if (force) {
      clearAniListCache();
      invalidateNotificationEpisodes();
    }

    if (state.forceDemo) {
      applyDemoNotifications();
      syncReleaseNotifications();
      return;
    }

    n.loading = true;
    n.error = null;
    renderNotifications();

    try {
      const malIds = trackedMalIds();
      const results = await Promise.allSettled([
        malIds.length ? fetchTrackedAnime(malIds) : Promise.resolve([]),
        fetchRecentScheduleEvents(C.RECENT_EPISODE_DAYS, 4),
        fetchRecentFilms(),
        fetchFinishedAnime(),
      ]);

      const [trackedResult, scheduleResult, filmsResult, completedResult] = results;
      const okCount = results.filter(result => result.status === 'fulfilled').length;
      if (!okCount) {
        const reason = results.find(result => result.status === 'rejected');
        throw (reason && reason.reason) || new Error('Ошибка сети');
      }

      const trackedMedia = trackedResult.status === 'fulfilled' ? trackedResult.value : [];
      const scheduleEvents = scheduleResult.status === 'fulfilled' ? scheduleResult.value : [];
      const films = filmsResult.status === 'fulfilled' ? filmsResult.value : [];
      const completed = completedResult.status === 'fulfilled' ? completedResult.value : [];

      n.tracked = {
        episodes: trackedEpisodeGroups(trackedMedia, scheduleEvents),
        seasons: C.collectSeasons(trackedMedia, { releaseDays: C.SEASON_RELEASE_DAYS }),
      };
      n.recent = {
        episodes: C.groupEpisodesByAnime(scheduleEvents).slice(0, 40),
        films,
      };
      n.completed = completed;
      n.loaded = true;
      if (!n.tabTouched) n.tab = C.defaultNotificationTab(n);
    } catch (err) {
      console.error(err);
      n.error = err.message || 'Ошибка сети';
      state.offline = true;
      if (!hasNotificationData()) applyDemoNotifications();
      toast('Уведомления недоступны — включён демо-режим');
    } finally {
      n.loading = false;
      renderNotifications();
      if (state.tab === 'notifications') markNotificationsSeen();
      updateBell();
      updateOfflineBanner();
      syncReleaseNotifications();
      if (n.queued) {
        n.queued = false;
        fetchNotifications(true);
      }
    }
  }

  async function fetchUpcoming(force = false) {
    const u = state.upcoming;
    if (u.loading) {
      if (force) u.queued = true;
      return;
    }
    if (u.items.length && !force) return;
    if (force) clearAniListCache();

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

  async function refreshCurrent() {
    clearAniListCache();
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
    clearAniListCache();
    state.epInfo = {};
    saveState();

    state.db.revision += 1;
    state.db.items = [];
    state.db.page = 1;
    state.db.hasNext = true;
    state.db.error = null;
    state.db.queued = false;
    state.db.touched = false;

    state.notifications.tracked = { episodes: [], seasons: [] };
    state.notifications.recent = { episodes: [], films: [] };
    state.notifications.completed = [];
    state.notifications.tab = null;
    state.notifications.loaded = false;
    state.notifications.error = null;
    state.notifications.queued = false;
    state.upcoming.items = [];
    state.upcoming.loaded = false;
    state.upcoming.queued = false;
    state.offline = false;
    updateOfflineBanner();

    await Promise.allSettled([fetchNotifications(), fetchUpcoming()]);
    await fetchDB(true);
  }

  /* ---------------- drag & drop ---------------- */
  let dragState = null;
  let dragPointerY = null;
  let dragAutoScrollFrame = 0;
  let dragGesture = null;
  let dragGhost = null;
  let suppressTierClickUntil = 0;
  /* Время, до которого повторное «назад» на вкладке «База аниме» закрывает приложение. */
  let exitBackArmedUntil = 0;
  const EXIT_BACK_WINDOW = 2500;

  /* Пока тащим карточку, прокрутка должна быть мгновенной: со smooth
     каждый кадр отменяет предыдущую анимацию и страница почти не едет. */
  function setInstantScroll(on) {
    const scroller = document.scrollingElement || document.documentElement;
    if (!scroller || !scroller.style) return;
    if (on) {
      if (scroller.dataset.dragSmooth != null) return;
      scroller.dataset.dragSmooth = scroller.style.scrollBehavior || '';
      scroller.style.scrollBehavior = 'auto';
    } else if (scroller.dataset.dragSmooth != null) {
      scroller.style.scrollBehavior = scroller.dataset.dragSmooth;
      delete scroller.dataset.dragSmooth;
    }
  }

  function scrollPageBy(delta) {
    const scroller = document.scrollingElement || document.documentElement;
    if (!scroller) return;
    const max = Math.max(0, (scroller.scrollHeight || 0) - (scroller.clientHeight || 0));
    const next = Math.max(0, Math.min(max, (scroller.scrollTop || 0) + delta));
    if (next !== scroller.scrollTop) scroller.scrollTop = next;
  }

  /* «Призрак» карточки, который едет за пальцем или курсором. */
  function createDragGhost(card) {
    removeDragGhost();
    const rect = card.getBoundingClientRect();
    const ghost = card.cloneNode(true);
    ghost.classList.add('tier-drag-ghost');
    ghost.classList.remove('dragging');
    ghost.removeAttribute('tabindex');
    ghost.removeAttribute('data-action');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.style.width = `${rect.width}px`;
    document.body.appendChild(ghost);
    dragGhost = ghost;
    return ghost;
  }

  function moveDragGhost(x, y) {
    if (!dragGhost) return;
    dragGhost.style.left = `${x}px`;
    dragGhost.style.top = `${y}px`;
  }

  function removeDragGhost() {
    if (dragGhost && dragGhost.parentNode) dragGhost.parentNode.removeChild(dragGhost);
    dragGhost = null;
  }

  /* Подсветка тира под пальцем или курсором. */
  function updateDragTarget(x, y) {
    if (!dragGesture) return;
    const hit = document.elementFromPoint(x, y);
    const drop = hit && hit.closest ? hit.closest('.tier-drop') : null;
    $$('.tier-drop.is-over').forEach(item => { if (item !== drop) item.classList.remove('is-over'); });
    if (drop && drop.dataset.list === dragGesture.list) drop.classList.add('is-over');
    dragGesture.drop = drop;
  }

  function activateDrag(gesture) {
    if (dragGesture !== gesture || gesture.active) return;
    clearTimeout(gesture.timer);
    gesture.active = true;
    dragState = { list: gesture.list, id: gesture.id };
    gesture.card.classList.add('dragging');
    try { gesture.card.setPointerCapture(gesture.pointerId); } catch { /* старые WebView */ }
    createDragGhost(gesture.card);
    moveDragGhost(gesture.clientX, gesture.clientY);
    if (gesture.pointerType === 'touch' && navigator.vibrate) navigator.vibrate(18);
  }

  function runDragAutoScroll() {
    if (dragAutoScrollFrame || !dragState) return;
    setInstantScroll(true);
    const step = () => {
      dragAutoScrollFrame = 0;
      if (!dragState || dragPointerY == null) return;
      const height = window.innerHeight || document.documentElement.clientHeight;
      const delta = C.dragScrollDelta(dragPointerY, height);
      if (!delta) return;
      App.scrollPageBy(delta);
      if (dragGesture && dragGesture.active) updateDragTarget(dragGesture.clientX, dragGesture.clientY);
      dragAutoScrollFrame = window.requestAnimationFrame(step);
    };
    dragAutoScrollFrame = window.requestAnimationFrame(step);
  }

  function cleanupDrag() {
    dragState = null;
    dragPointerY = null;
    if (dragGesture && dragGesture.timer) clearTimeout(dragGesture.timer);
    dragGesture = null;
    if (dragAutoScrollFrame) window.cancelAnimationFrame(dragAutoScrollFrame);
    dragAutoScrollFrame = 0;
    removeDragGhost();
    setInstantScroll(false);
    $$('.tier-card.dragging').forEach(c => c.classList.remove('dragging'));
    $$('.tier-drop.is-over').forEach(d => d.classList.remove('is-over'));
  }

  function bindDragEvents() {
    document.addEventListener('pointerdown', e => {
      if (dragGesture || !e.isPrimary) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const card = e.target.closest && e.target.closest('.tier-card');
      if (!card || e.target.closest('button')) return;
      const pointerType = e.pointerType || 'mouse';
      const gesture = {
        card,
        list: card.dataset.list,
        id: Number(card.dataset.id),
        pointerType,
        startX: e.clientX,
        startY: e.clientY,
        clientX: e.clientX,
        clientY: e.clientY,
        pointerId: e.pointerId,
        active: false,
        timer: 0,
        drop: null,
      };
      /* Пальцем — после долгого нажатия, мышью — сразу после сдвига:
         обычный клик должен открывать тайтл. */
      if (pointerType === 'touch') {
        gesture.timer = setTimeout(() => activateDrag(gesture), 360);
      }
      dragGesture = gesture;
    }, { passive: true });

    /* Пока карточка тащится, отдаём прокрутку автопрокрутке:
       без этого браузер забирает жест себе и присылает pointercancel. */
    document.addEventListener('touchmove', e => {
      if (!dragGesture || !dragGesture.active) return;
      e.preventDefault();
    }, { passive: false });

    /* Долгое нажатие в Android-WebView тянет за собой выделение текста и
       contextmenu, а Chrome вместе с ними присылает pointercancel — жест
       обрывается, и автопрокрутка не запускается. Гасим их, пока палец на карточке. */
    document.addEventListener('contextmenu', e => {
      const card = e.target && e.target.closest && e.target.closest('.tier-card');
      if (card && (dragGesture || dragState)) e.preventDefault();
    });

    document.addEventListener('selectstart', e => {
      const card = e.target && e.target.closest && e.target.closest('.tier-card');
      if (card && (dragGesture || dragState)) e.preventDefault();
    });

    document.addEventListener('pointermove', e => {
      const gesture = dragGesture;
      if (!gesture) return;
      gesture.clientX = e.clientX;
      gesture.clientY = e.clientY;
      if (!gesture.active) {
        const moved = Math.hypot(e.clientX - gesture.startX, e.clientY - gesture.startY);
        if (gesture.pointerType === 'touch') {
          if (moved > 12) {
            clearTimeout(gesture.timer);
            dragGesture = null;
          }
          return;
        }
        if (moved < 6) return;
        activateDrag(gesture);
      }
      e.preventDefault();
      dragPointerY = e.clientY;
      moveDragGhost(e.clientX, e.clientY);
      updateDragTarget(e.clientX, e.clientY);
      runDragAutoScroll();
    }, { passive: false });

    document.addEventListener('pointerup', e => {
      const gesture = dragGesture;
      if (!gesture) return;
      clearTimeout(gesture.timer);
      dragGesture = null;
      if (!gesture.active) return;
      const hit = document.elementFromPoint(e.clientX, e.clientY);
      const drop = hit && hit.closest ? hit.closest('.tier-drop') : gesture.drop;
      suppressTierClickUntil = Date.now() + 500;
      cleanupDrag();
      if (drop && drop.dataset.list === gesture.list) moveToTier(gesture.list, gesture.id, drop.dataset.tier);
    }, { passive: true });

    document.addEventListener('pointercancel', cleanupDrag, { passive: true });
  }

  /* ---------------- события ---------------- */
  let searchTimer = null;

  function persistCatalogPreferences() {
    state.settings.catalog = {
      tab: state.tab,
      mode: state.db.mode,
      query: state.db.query,
      filters: state.db.filters,
    };
    saveState();
  }

  function restoreCatalogPreferences() {
    const catalog = state.settings.catalog || {};
    state.tab = catalog.tab || 'db';
    state.db.mode = catalog.mode || 'popular';
    state.db.query = catalog.query || '';
    state.db.filters = C.normalizeFilters(catalog.filters);
    const input = $('#search-input');
    if (input) input.value = state.db.query;
    syncFilterUI();
    syncModeChips();
    switchTab(state.tab, { silent: true, deferActions: true, deferPersistence: true });
  }

  async function translateModalSynopsis(id) {
    const a = getAnime(id);
    if (!a || !a.synopsis || C.hasCyrillic(a.synopsis)) return '';
    const provider = state.settings.translationProvider || 'auto';
    const cached = cachedTranslation(a.synopsis, provider);
    if (cached) return cached;
    const requestKey = `${id}:${provider}`;
    if (state.synopsisTranslating.has(requestKey)) return '';
    state.synopsisTranslating.add(requestKey);
    const status = $('#modal-content .synopsis-translation-status');
    if (status) status.textContent = 'Переводим…';
    let translated = '';
    try { translated = await translateText(a.synopsis, provider); }
    catch { translated = ''; }
    finally { state.synopsisTranslating.delete(requestKey); }
    if (state.modalId !== id) return translated;
    if (App.renderModal) App.renderModal();
    const currentProvider = state.settings.translationProvider || 'auto';
    if (currentProvider !== provider && !cachedTranslation(a.synopsis, currentProvider)) translateModalSynopsis(id);
    return translated;
  }

  /* ---------------- свои карточки: сохранение ---------------- */
  function readImageFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('Не удалось прочитать файл'));
      reader.readAsDataURL(file);
    });
  }

  function loadImageElement(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Не удалось открыть изображение'));
      img.src = src;
    });
  }

  async function makeImageThumbnail(file, max = 480, quality = 0.78) {
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImageElement(url);
      const width = img.naturalWidth || img.width || 1;
      const height = img.naturalHeight || img.height || 1;
      const scale = Math.min(1, max / Math.max(width, height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas недоступен');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      let data = canvas.toDataURL('image/jpeg', quality);
      if (data.length > 450000) data = canvas.toDataURL('image/jpeg', 0.55);
      return data;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function makeVideoThumbnail(file) {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    try {
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve;
        video.onerror = () => reject(new Error('Не удалось прочитать видео'));
        video.src = url;
      });
      if (Number.isFinite(video.duration) && video.duration > 0) {
        await new Promise(resolve => {
          const timer = setTimeout(resolve, 2500);
          video.onseeked = () => { clearTimeout(timer); resolve(); };
          try { video.currentTime = Math.min(1, video.duration / 3); } catch { clearTimeout(timer); resolve(); }
        });
      }
      const width = video.videoWidth || 640;
      const height = video.videoHeight || 360;
      const scale = Math.min(1, 480 / Math.max(width, height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas недоступен');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      let data = canvas.toDataURL('image/jpeg', 0.72);
      if (data.length > 450000) data = canvas.toDataURL('image/jpeg', 0.55);
      return data;
    } finally {
      URL.revokeObjectURL(url);
      video.removeAttribute('src');
      try { video.load(); } catch { /* noop */ }
    }
  }

  async function makeFileThumbnail(file) {
    if (file.type === 'image/gif' || file.type.startsWith('image/')) return makeImageThumbnail(file);
    if (file.type.startsWith('video/')) return makeVideoThumbnail(file);
    return '';
  }

  async function saveCustomForm(form) {
    if (state.customForm.busy) return;
    const data = new FormData(form);
    const title = String(data.get('title') || '').trim();
    if (!title) {
      state.customForm.error = 'Укажите название.';
      renderCustomForm();
      return;
    }

    const posterInput = form.querySelector('input[name="poster"]');
    const file = posterInput && posterInput.files && posterInput.files[0] ? posterInput.files[0] : null;
    if (file) {
      if (!file.type.startsWith('image/')) {
        state.customForm.error = 'Постер должен быть изображением.';
        renderCustomForm();
        return;
      }
      if (file.size > CUSTOM_IMAGE_MAX) {
        state.customForm.error = `Постер больше ${C.formatBytes(CUSTOM_IMAGE_MAX)}.`;
        renderCustomForm();
        return;
      }
    }

    state.customForm.busy = true;
    state.customForm.error = '';
    renderCustomForm();

    try {
      const editingId = state.customForm.editingId;
      const existing = editingId != null ? getCustomCard(editingId) : null;
      const id = existing ? existing.id : nextCustomId();
      const customId = existing ? existing.customId : newUid();
      let image = existing ? existing.image : '';

      if (file) {
        try { image = await makeImageThumbnail(file); } catch { image = existing ? existing.image : ''; }
        const stored = await mediaPut('images', customId, file);
        if (!stored) toast('Полный постер не сохранился — останется миниатюра');
      }

      const genres = String(data.get('genres') || '')
        .split(/[,;]+/)
        .map(value => value.trim())
        .filter(Boolean)
        .slice(0, 12);
      const card = {
        id,
        customId,
        custom: true,
        title,
        altTitle: String(data.get('altTitle') || '').trim(),
        originalTitle: String(data.get('altTitle') || '').trim(),
        image,
        year: Number(data.get('year')) || null,
        episodes: Number(data.get('episodes')) || null,
        type: String(data.get('type') || ''),
        status: '',
        score: null,
        synopsis: String(data.get('synopsis') || '').trim(),
        genres,
        createdAt: existing ? existing.createdAt : Date.now(),
        updatedAt: Date.now(),
      };
      const saved = upsertCustomCard(card);
      if (!saved) throw new Error('Не удалось сохранить карточку.');

      state.customForm = { open: false, editingId: null, error: '', busy: false };
      closeCustomForm(false);
      state.db.mode = 'custom';
      state.db.query = '';
      const input = $('#search-input');
      if (input) input.value = '';
      syncModeChips();
      persistCatalogPreferences();
      fetchDB(true);
      toast(existing ? 'Карточка обновлена' : 'Своя карточка создана');
    } catch (err) {
      state.customForm.busy = false;
      state.customForm.error = err && err.message ? err.message : 'Не удалось сохранить карточку.';
      renderCustomForm();
    }
  }

  async function removeCustomCard(id) {
    const card = getCustomCard(id);
    if (!card) return;
    if (!window.confirm(`Удалить «${card.title}» из своих карточек и списков?`)) return;
    for (const moment of momentsFor(id)) {
      if (moment.mediaKey) await mediaDelete('media', moment.mediaKey);
    }
    await mediaDelete('images', card.customId);
    deleteCustomCard(id);
    closeModal();
    toast('Карточка удалена');
  }

  async function hydrateCustomImage(id) {
    const card = getCustomCard(id);
    if (!card || !card.customId || !card.image) return;
    const blob = await mediaGet('images', card.customId);
    if (!blob || state.modalId !== id) return;
    const img = $('#modal-content .modal-poster img');
    if (!img) return;
    const url = URL.createObjectURL(blob);
    img.onload = () => URL.revokeObjectURL(url);
    img.src = url;
  }

  /* ---------------- моменты ---------------- */
  function openTikTokUrl(url) {
    const target = String(url || '');
    if (!C.isTikTokUrl(target)) { toast('Ссылка TikTok недействительна'); return false; }
    try {
      if (window.AniTierAndroid && typeof window.AniTierAndroid.openTikTok === 'function') {
        return window.AniTierAndroid.openTikTok(target);
      }
      const opened = window.open(target, '_blank', 'noopener');
      if (!opened) window.location.href = target;
      return true;
    } catch {
      window.location.href = target;
      return true;
    }
  }

  /* Поиск: в APK сначала открываем приложение TikTok, если его нет — браузер. */
  function openTikTokSearch(query) {
    const text = String(query == null ? '' : query).trim();
    if (!text) return false;
    const bridge = typeof window !== 'undefined' ? window.AniTierAndroid : null;
    if (bridge && typeof bridge.openTikTokSearch === 'function') {
      try {
        return bridge.openTikTokSearch(text);
      } catch { /* ниже обычный путь через ссылку */ }
    }
    const url = C.tiktokSearchUrl(text);
    return url ? openTikTokUrl(url) : false;
  }

  function closeTikTokImport() {
    state.tiktokImport = { open: false, url: '', title: '', thumb: '', query: '', loading: false };
    const modal = $('#tiktok-import-modal');
    if (modal) modal.hidden = true;
    App.syncBodyScroll();
  }

  function openTikTokImport(url) {
    const target = String(url || '').trim();
    if (!C.isTikTokUrl(target)) { toast('Не удалось прочитать ссылку TikTok'); return false; }
    if (state.modalId != null) closeModal();
    state.tiktokImport = { open: true, url: target, title: '', thumb: '', videoId: '', query: '', loading: true };
    App.renderTikTokImport();
    App.syncBodyScroll();
    const panel = $('#tiktok-import-modal .modal-panel');
    if (panel) { panel.scrollTop = 0; panel.focus({ preventScroll: true }); }
    fetchTikTokMeta(target).then(meta => {
      if (!state.tiktokImport.open || state.tiktokImport.url !== target) return;
      state.tiktokImport.title = meta.title || '';
      state.tiktokImport.thumb = meta.thumb || '';
      state.tiktokImport.videoId = meta.videoId || C.extractTikTokId(target) || '';
      state.tiktokImport.loading = false;
      App.renderTikTokImport();
    });
    return true;
  }

  function receiveSharedTikTok(text) {
    const links = String(text || '').match(/https?:\/\/[^\s<>"']+/gi) || [String(text || '').trim()];
    const url = links.map(link => link.replace(/[),.;!?\]}]+$/g, '')).find(C.isTikTokUrl);
    if (!url) { toast('В полученном сообщении нет ссылки TikTok'); return false; }
    return openTikTokImport(url);
  }

  function saveSharedTikTok(animeId) {
    const anime = getAnime(animeId);
    const imported = state.tiktokImport;
    if (!anime || !imported || !imported.url) return;
    const existing = momentsFor(animeId).find(moment => moment.kind === 'tiktok' && moment.url === imported.url);
    if (existing) {
      closeTikTokImport();
      toast(`Это видео уже есть в карточке «${anime.title}»`);
      return;
    }
    addMoment(animeId, {
      id: C.extractTikTokId(imported.url) || newUid(),
      kind: 'tiktok',
      url: imported.url,
      title: imported.title || anime.title,
      thumb: imported.thumb,
      videoId: imported.videoId || C.extractTikTokId(imported.url) || '',
      createdAt: Date.now(),
    });
    closeTikTokImport();
    openModal(animeId);
    toast(`Видео TikTok добавлено к «${anime.title}»`);
  }

  function captureMomentDraft() {
    const form = $('#moment-form');
    if (!form) return;
    const url = form.querySelector('input[name="url"]');
    const title = form.querySelector('input[name="title"]');
    if (url) state.momentForm.url = url.value;
    if (title) state.momentForm.title = title.value;
  }

  async function saveMomentForm(form) {
    const f = state.momentForm;
    if (!f.open || f.busy) return;
    const animeId = f.animeId;
    const a = getAnime(animeId);
    if (!a) return;
    const data = new FormData(form);
    const title = String(data.get('title') || '').trim();

    if (f.mode === 'tiktok') {
      const url = String(data.get('url') || '').trim();
      if (!C.isTikTokUrl(url)) {
        f.error = 'Нужна ссылка на TikTok.';
        renderMomentForm();
        return;
      }
      f.busy = true;
      f.error = '';
      renderMomentForm();
      try {
        const meta = await fetchTikTokMeta(url);
        const videoId = meta.videoId || C.extractTikTokId(url);
        if (!videoId) {
          throw new Error('Не удалось найти видео в ссылке. Скопируйте полную ссылку на ролик из TikTok.');
        }
        addMoment(animeId, {
          id: newUid(),
          kind: 'tiktok',
          title: title || meta.title || '',
          url,
          videoId,
          thumb: meta.thumb || '',
          createdAt: Date.now(),
        });
        closeMomentForm(true);
        toast('Момент добавлен');
      } catch (err) {
        f.busy = false;
        f.error = err && err.message ? err.message : 'Не удалось добавить момент.';
        renderMomentForm();
      }
      return;
    }

    const fileInput = form.querySelector('input[name="file"]');
    const file = fileInput && fileInput.files ? fileInput.files[0] : null;
    if (!file) {
      f.error = 'Выберите видео или GIF.';
      renderMomentForm();
      return;
    }
    const isGif = file.type === 'image/gif' || /\.gif$/i.test(file.name || '');
    const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/i.test(file.name || '');
    if (!isGif && !isVideo) {
      f.error = 'Подойдёт MP4, WebM или GIF.';
      renderMomentForm();
      return;
    }
    const limit = isGif ? MOMENT_GIF_MAX : MOMENT_VIDEO_MAX;
    if (file.size > limit) {
      f.error = `Файл больше ${C.formatBytes(limit)}.`;
      renderMomentForm();
      return;
    }

    f.busy = true;
    f.error = '';
    renderMomentForm();
    try {
      const mediaKey = newUid();
      const stored = await mediaPut('media', mediaKey, file);
      if (!stored) throw new Error('Браузер не смог сохранить файл. Попробуйте файл меньше.');
      let thumb = '';
      try { thumb = await makeFileThumbnail(file); } catch { thumb = ''; }
      addMoment(animeId, {
        id: mediaKey,
        kind: isGif ? 'gif' : 'video',
        title,
        mediaKey,
        thumb,
        mime: file.type || '',
        size: file.size,
        createdAt: Date.now(),
      });
      closeMomentForm(true);
      toast('Момент добавлен');
    } catch (err) {
      f.busy = false;
      f.error = err && err.message ? err.message : 'Не удалось добавить момент.';
      renderMomentForm();
    }
  }

  const momentObjectUrls = new Set();

  function revokeMomentUrls() {
    for (const url of momentObjectUrls) URL.revokeObjectURL(url);
    momentObjectUrls.clear();
  }

  async function playMoment(animeId, momentId, button) {
    if (!button || button.dataset.loaded === '1') return;
    const moment = findMoment(animeId, momentId);
    if (!moment) return;

    if (moment.kind === 'tiktok') {
      const videoId = moment.videoId || C.extractTikTokId(moment.url);
      if (!videoId) { toast('Не удалось открыть TikTok'); return; }
      button.innerHTML = `<iframe class="moment-frame" src="${C.tiktokPlayerUrl(videoId)}" title="TikTok" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
      button.dataset.loaded = '1';
      button.classList.add('is-playing');
      return;
    }

    const blob = await mediaGet('media', moment.mediaKey);
    if (!blob) { toast('Файл не найден в этом браузере'); return; }
    revokeMomentUrls();
    const url = URL.createObjectURL(blob);
    momentObjectUrls.add(url);
    if (moment.kind === 'gif') {
      button.innerHTML = `<img class="moment-gif" src="${url}" alt="">`;
    } else {
      button.innerHTML = `<video class="moment-video" src="${url}" controls autoplay playsinline></video>`;
    }
    button.dataset.loaded = '1';
    button.classList.add('is-playing');
  }

  function safeFileName(value) {
    return String(value || 'moment')
      .replace(/[\\/:*?"<>|]+/g, ' ')
      .trim()
      .slice(0, 80) || 'moment';
  }

  async function shareMoment(animeId, momentId) {
    const moment = findMoment(animeId, momentId);
    if (!moment) return;
    const anime = getAnime(animeId);
    const title = moment.title || (anime ? anime.title : 'Момент AniTier');

    if (moment.kind === 'tiktok') {
      if (navigator.share) {
        try { await navigator.share({ title, url: moment.url }); return; }
        catch (err) { if (err && err.name === 'AbortError') return; }
      }
      try {
        await navigator.clipboard.writeText(moment.url);
        toast('Ссылка на TikTok скопирована');
      } catch {
        toast('Не удалось поделиться ссылкой');
      }
      return;
    }

    const blob = await mediaGet('media', moment.mediaKey);
    if (!blob) { toast('Файл не найден в этом браузере'); return; }
    const ext = moment.kind === 'gif' ? 'gif' : (moment.mime && moment.mime.includes('webm') ? 'webm' : 'mp4');
    const mime = moment.mime || blob.type || 'application/octet-stream';
    let file = null;
    try { file = new File([blob], `${safeFileName(title)}.${ext}`, { type: mime }); } catch { file = null; }

    if (file && navigator.canShare) {
      try {
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title });
          return;
        }
      } catch (err) {
        if (err && err.name === 'AbortError') return;
      }
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file ? file.name : `${safeFileName(title)}.${ext}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Файл сохранён — отправьте его через мессенджер');
  }

  async function removeMomentAction(animeId, momentId) {
    const moment = findMoment(animeId, momentId);
    if (!moment) return;
    if (!window.confirm('Удалить этот момент?')) return;
    if (moment.mediaKey) await mediaDelete('media', moment.mediaKey);
    removeMoment(animeId, momentId);
    renderModal();
    toast('Момент удалён');
  }

  /* ---------------- резервные копии и Google Drive ---------------- */
  const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
  let gisPromise = null;
  let driveToken = '';
  let driveTokenExpiresAt = 0;

  function googleClientId() {
    const meta = document.querySelector('meta[name="anitier-google-client-id"]');
    return meta ? String(meta.content || '').trim() : '';
  }

  function driveAvailable() {
    return location.protocol !== 'file:' && Boolean(googleClientId());
  }

  function loadGisScript() {
    if (window.google && window.google.accounts && window.google.accounts.oauth2) return Promise.resolve();
    if (gisPromise) return gisPromise;
    gisPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => {
        gisPromise = null;
        reject(new Error('Не удалось загрузить Google Sign-In. Проверьте сеть.'));
      };
      document.head.appendChild(script);
    });
    return gisPromise;
  }

  async function ensureDriveToken() {
    if (driveToken && Date.now() < driveTokenExpiresAt - 60000) return driveToken;
    const clientId = googleClientId();
    if (!clientId) throw new Error('Google Drive не настроен: укажите client ID в meta-теге.');
    if (location.protocol === 'file:') throw new Error('Google Drive недоступен в APK. Используйте файл.');
    await loadGisScript();
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        fn(value);
      };
      try {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: DRIVE_SCOPE,
          callback: response => {
            if (response && response.access_token) {
              driveToken = response.access_token;
              driveTokenExpiresAt = Date.now() + (Number(response.expires_in) || 3600) * 1000;
              finish(resolve, driveToken);
            } else {
              finish(reject, new Error(response && response.error
                ? `Google Drive: ${response.error}`
                : 'Не удалось получить доступ к Google Drive.'));
            }
          },
          error_callback: error => {
            finish(reject, new Error(error && error.message ? error.message : 'Окно Google закрыто.'));
          },
        });
        client.requestAccessToken({ prompt: '' });
      } catch (err) {
        finish(reject, err);
      }
    });
  }

  function setBackupMessage(message, error) {
    state.backup.busy = false;
    state.backup.message = message || '';
    state.backup.error = Boolean(error);
    renderBackup();
  }

  function saveBackupFile() {
    if (state.backup.busy) return;
    let text = '';
    try {
      text = JSON.stringify(buildBackupPayload(), null, 2);
    } catch (err) {
      setBackupMessage(err && err.message ? err.message : 'Не удалось собрать копию.', true);
      return;
    }

    if (window.AniTierAndroid && typeof window.AniTierAndroid.saveBackup === 'function') {
      try {
        window.AniTierAndroid.saveBackup(text, C.BACKUP_FILE);
        setBackupMessage('Выберите папку в системном окне — файл сохранится туда.', false);
        return;
      } catch {
        /* ниже обычное скачивание */
      }
    }

    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = C.BACKUP_FILE;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    setBackupMessage('Файл сохранён. Проверьте папку загрузок.', false);
    toast('Резервная копия скачана');
  }

  function readTextFile(file) {
    if (file && typeof file.text === 'function') return file.text();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('Не удалось прочитать файл'));
      reader.readAsText(file);
    });
  }

  async function restoreBackupText(text, source) {
    if (!C.isBackupSizeAllowed(String(text == null ? '' : text).length)) {
      setBackupMessage('Файл больше 30 МБ — это не резервная копия AniTier.', true);
      return false;
    }
    let parsed = null;
    try {
      parsed = C.parseBackupJson(text);
    } catch (err) {
      setBackupMessage(err && err.message ? err.message : 'Не удалось прочитать копию.', true);
      return false;
    }
    const where = source ? ` из «${source}»` : '';
    if (!window.confirm(`Восстановить копию${where}? Текущие списки, прогресс и настройки будут заменены.`)) {
      return false;
    }
    try {
      const result = applyBackupData(parsed.data);
      restoreCatalogPreferences();
      syncLangUI();
      updateBell();
      if (state.tab === 'db') fetchDB(true);
      setBackupMessage(`Копия восстановлена: карточек — ${result.cards}, тайтлов с моментами — ${result.moments}.`, false);
      toast('Резервная копия восстановлена');
      return true;
    } catch (err) {
      setBackupMessage(err && err.message ? err.message : 'Не удалось восстановить копию.', true);
      return false;
    }
  }

  async function restoreBackupFile(file) {
    if (!file) return;
    if (!C.isBackupSizeAllowed(file.size)) {
      setBackupMessage('Файл больше 30 МБ — это не резервная копия AniTier.', true);
      return;
    }
    try {
      const text = await readTextFile(file);
      await restoreBackupText(text, file.name || 'файл');
    } catch (err) {
      setBackupMessage(err && err.message ? err.message : 'Не удалось прочитать файл.', true);
    }
  }

  async function buildMediaArchive() {
    const entries = await mediaEntries();
    const totalBytes = entries.reduce((sum, entry) => sum + entry.blob.size, 0);
    if (totalBytes > MEDIA_ARCHIVE_LIMIT) throw new Error('Медиаархив больше 500 МБ. Удалите часть медиа и повторите экспорт.');
    const manifest = entries.map(entry => ({
      store: entry.store,
      key: entry.key,
      type: entry.blob.type || 'application/octet-stream',
      size: entry.blob.size,
    }));
    const manifestBytes = new TextEncoder().encode(JSON.stringify({ kind: 'anitier.media', version: 1, entries: manifest }));
    const header = new Uint8Array(20);
    header.set(new TextEncoder().encode(MEDIA_ARCHIVE_MAGIC), 0);
    new DataView(header.buffer).setUint32(16, manifestBytes.length, false);
    return {
      blob: new Blob([header, manifestBytes, ...entries.map(entry => entry.blob)], { type: 'application/octet-stream' }),
      count: entries.length,
      size: totalBytes,
    };
  }

  function androidSaveMedia(blob) {
    return new Promise((resolve, reject) => {
      const bridge = window.AniTierAndroid;
      let finished = false;
      const settle = (ok, message) => {
        if (finished) return;
        finished = true;
        delete window.__anitierMediaSaveReady;
        delete window.__anitierMediaSaveFinished;
        if (ok) resolve();
        else reject(new Error(message || 'Не удалось сохранить медиаархив через Android.'));
      };
      window.__anitierMediaSaveReady = async ready => {
        if (!ready) { settle(false, 'Не удалось открыть файл для сохранения.'); return; }
        try {
          const chunkSize = 256 * 1024;
          for (let offset = 0; offset < blob.size; offset += chunkSize) {
            const bytes = new Uint8Array(await blob.slice(offset, offset + chunkSize).arrayBuffer());
            let binary = '';
            for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
            if (!bridge.writeMediaChunk(btoa(binary))) throw new Error('Не удалось записать часть медиаархива.');
          }
          bridge.finishMediaSave(true);
        } catch (error) {
          bridge.finishMediaSave(false);
          settle(false, error && error.message ? error.message : 'Не удалось передать медиаархив в Android.');
        }
      };
      window.__anitierMediaSaveFinished = ok => settle(Boolean(ok), 'Не удалось сохранить медиаархив.');
      try { bridge.beginMediaSave('anitier-media.bin'); }
      catch (error) { settle(false, error && error.message); }
    });
  }

  async function exportMediaFile() {
    if (state.backup.busy) return;
    state.backup.busy = true;
    state.backup.message = '';
    state.backup.error = false;
    renderBackup();
    try {
      const archive = await buildMediaArchive();
      if (window.AniTierAndroid && typeof window.AniTierAndroid.beginMediaSave === 'function') {
        await androidSaveMedia(archive.blob);
        setBackupMessage(`Медиаархив сохранён: ${archive.count} файлов, ${C.formatBytes(archive.size)}.`, false);
        return;
      }
      const url = URL.createObjectURL(archive.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'anitier-media.bin';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      setBackupMessage(`Медиаархив скачан: ${archive.count} файлов, ${C.formatBytes(archive.size)}.`, false);
    } catch (error) {
      setBackupMessage(error && error.message ? error.message : 'Не удалось экспортировать медиа.', true);
    }
  }

  async function importMediaFile(file) {
    if (!file) return;
    if (state.backup.busy) return;
    if (file.size > MEDIA_ARCHIVE_LIMIT) {
      setBackupMessage('Файл больше 500 МБ — импорт медиа остановлен.', true);
      return;
    }
    state.backup.busy = true;
    state.backup.message = '';
    state.backup.error = false;
    renderBackup();
    try {
      if (file.size < 20) throw new Error('Файл слишком короткий и не похож на медиаархив AniTier.');
      const header = new Uint8Array(await file.slice(0, 20).arrayBuffer());
      const magic = new TextDecoder().decode(header.slice(0, 16));
      if (magic !== MEDIA_ARCHIVE_MAGIC) throw new Error('Это не медиаархив AniTier.');
      const manifestSize = new DataView(header.buffer, header.byteOffset, header.byteLength).getUint32(16, false);
      if (!manifestSize || manifestSize > 10 * 1024 * 1024 || 20 + manifestSize > file.size) throw new Error('Повреждён заголовок медиаархива.');
      let manifest;
      try { manifest = JSON.parse(await file.slice(20, 20 + manifestSize).text()); }
      catch { throw new Error('Манифест медиаархива повреждён.'); }
      if (!manifest || manifest.kind !== 'anitier.media' || manifest.version !== 1 || !Array.isArray(manifest.entries) || manifest.entries.length > 10000) {
        throw new Error('Формат медиаархива не поддерживается.');
      }
      let offset = 20 + manifestSize;
      const entries = [];
      for (const item of manifest.entries) {
        const size = Number(item && item.size);
        if (!item || !['images', 'media'].includes(item.store) || typeof item.key !== 'string' || !item.key || item.key.length > 120
          || !Number.isSafeInteger(size) || size < 0 || offset + size > file.size) {
          throw new Error('В медиаархиве есть некорректная запись.');
        }
        entries.push({ store: item.store, key: item.key, blob: file.slice(offset, offset + size, String(item.type || '').slice(0, 100)) });
        offset += size;
      }
      if (offset !== file.size) throw new Error('Размер медиаархива не совпадает с его содержимым.');
      const totalBytes = entries.reduce((sum, entry) => sum + entry.blob.size, 0);
      const replace = entries.length ? ' Одноимённые медиафайлы будут заменены.' : '';
      if (!window.confirm(`Импортировать ${entries.length} файлов (${C.formatBytes(totalBytes)})?${replace}`)) {
        state.backup.busy = false;
        renderBackup();
        return false;
      }
      await mediaPutMany(entries);
      setBackupMessage(`Импортировано файлов: ${entries.length} · ${C.formatBytes(totalBytes)}.`, false);
      return true;
    } catch (error) {
      setBackupMessage(error && error.message ? error.message : 'Не удалось импортировать медиа.', true);
      return false;
    }
  }

  async function saveBackupToDrive() {
    if (state.backup.busy) return;
    state.backup.busy = true;
    state.backup.message = '';
    state.backup.error = false;
    renderBackup();
    try {
      const token = await ensureDriveToken();
      const file = await driveSaveBackup(token, JSON.stringify(buildBackupPayload()));
      const when = file && file.modifiedTime
        ? new Date(file.modifiedTime).toLocaleString('ru-RU')
        : new Date().toLocaleString('ru-RU');
      setBackupMessage(`Сохранено в Google Drive · ${when}`, false);
      toast('Копия сохранена в Google Drive');
    } catch (err) {
      if (err && err.code === 'AUTH') driveToken = '';
      setBackupMessage(err && err.message ? err.message : 'Не удалось сохранить копию в Google Drive.', true);
    }
  }

  async function restoreFromDrive() {
    if (state.backup.busy) return;
    state.backup.busy = true;
    state.backup.message = '';
    state.backup.error = false;
    renderBackup();
    try {
      const token = await ensureDriveToken();
      const loaded = await driveLoadBackup(token);
      const when = loaded.file && loaded.file.modifiedTime
        ? new Date(loaded.file.modifiedTime).toLocaleString('ru-RU')
        : '';
      state.backup.busy = false;
      renderBackup();
      await restoreBackupText(loaded.text, when ? `Google Drive, ${when}` : 'Google Drive');
    } catch (err) {
      if (err && err.code === 'AUTH') driveToken = '';
      setBackupMessage(err && err.message ? err.message : 'Не удалось восстановить копию из Google Drive.', true);
    }
  }

  function bindEvents() {
    let tierLayoutTimer = 0;
    window.addEventListener('resize', () => {
      clearTimeout(tierLayoutTimer);
      tierLayoutTimer = setTimeout(() => {
        layoutTierCards(document.getElementById('tiers-watched'));
        layoutTierCards(document.getElementById('tiers-planned'));
      }, 120);
    });

    document.addEventListener('click', e => {
      if (Date.now() < suppressTierClickUntil && e.target.closest && e.target.closest('.tier-card')) {
        e.preventDefault();
        return;
      }
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
          if (id != null) {
            openModal(id);
            translateModalSynopsis(id);
          }
          break;

        case 'synopsis-mode': {
          if (id == null || !['translated', 'original'].includes(el.dataset.mode)) break;
          const anime = getAnime(id);
          if (!anime) break;
          if (el.dataset.mode === 'translated' && !cachedTranslation(anime.synopsis, state.settings.translationProvider || 'auto')) break;
          state.synopsisModes.set(id, el.dataset.mode);
          renderModal();
          break;
        }

        case 'tiktok-search': {
          const anime = getAnime(id);
          const query = anime ? [anime.title, anime.altTitle].filter(Boolean).join(' ') : '';
          if (query) openTikTokSearch(query);
          break;
        }

        case 'moment-open-tiktok': {
          const moment = findMoment(id, el.dataset.moment);
          if (moment) openTikTokUrl(moment.url);
          break;
        }

        case 'tiktok-import-open-video':
          openTikTokUrl(state.tiktokImport.url);
          break;

        case 'tiktok-import-save':
          saveSharedTikTok(id);
          break;

        case 'close-tiktok-import':
          closeTikTokImport();
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

        case 'retry-franchise':
          state.franchiseById.delete(id);
          state.franchiseErrors.delete(id);
          renderModal();
          break;

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
          const input = $('#search-input');
          if (input) input.value = '';
          syncModeChips();
          persistCatalogPreferences();
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
          state.db.touched = true;
          syncModeChips();
          persistCatalogPreferences();
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

        case 'release-notifications':
          toggleReleaseNotifications();
          break;

        case 'notif-tab':
          if (C.NOTIF_TABS.includes(el.dataset.notifTab)) {
            state.notifications.tab = el.dataset.notifTab;
            state.notifications.tabTouched = true;
            renderNotifications();
          }
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

        case 'reset-upcoming':
          state.upcoming.view = {
            query: '',
            filters: C.normalizeFilters(C.DEFAULT_FILTERS),
            month: '',
            sort: 'date',
          };
          App.renderUpcoming();
          break;

        case 'reset-list': {
          const name = el.dataset.list === 'planned' ? 'planned' : 'watched';
          state.listViews[name] = { query: '', filters: C.normalizeFilters(C.DEFAULT_FILTERS) };
          renderTierList(name);
          break;
        }

        case 'retry-all':
          retryAll();
          break;

        case 'close-modal':
          closeModal();
          break;

        case 'open-backup':
          closeSettings();
          openBackup();
          break;

        case 'open-settings':
          openSettings();
          break;

        case 'close-settings':
          closeSettings();
          break;

        case 'check-updates':
          checkForUpdates();
          break;

        case 'open-changelog':
          state.settingsScreen.view = 'changelog';
          renderSettings();
          {
            const panel = $('#settings-panel');
            if (panel) panel.scrollTop = 0;
          }
          break;

        case 'settings-back':
          state.settingsScreen.view = 'main';
          renderSettings();
          {
            const panel = $('#settings-panel');
            if (panel) panel.scrollTop = 0;
          }
          break;

        case 'open-link':
          openExternalLink(el.dataset.url);
          break;
        case 'open-exchange':
          closeSettings();
          openExchange('export', state.tab === 'planned' ? 'planned' : 'watched');
          break;

        case 'close-backup':
          closeBackup();
          break;

        case 'backup-download':
          saveBackupFile();
          break;

        case 'media-export':
          exportMediaFile();
          break;

        case 'backup-drive-save':
          saveBackupToDrive();
          break;

        case 'backup-drive-load':
          restoreFromDrive();
          break;

        case 'new-custom':
          openCustomForm();
          break;

        case 'edit-custom':
          openCustomForm(id);
          break;

        case 'delete-custom':
          removeCustomCard(id);
          break;

        case 'close-custom':
          closeCustomForm();
          break;

        case 'moment-add':
          openMomentForm(id);
          break;

        case 'close-moment':
          closeMomentForm();
          break;

        case 'moment-mode':
          captureMomentDraft();
          state.momentForm.mode = el.dataset.mode === 'file' ? 'file' : 'tiktok';
          state.momentForm.error = '';
          renderMomentForm();
          break;

        case 'moment-play':
          playMoment(id, el.dataset.moment, el);
          break;

        case 'moment-share':
          shareMoment(id, el.dataset.moment);
          break;

        case 'moment-delete':
          removeMomentAction(id, el.dataset.moment);
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

    document.addEventListener('submit', e => {
      const form = e.target;
      if (!form || !form.id) return;
      if (form.id === 'custom-form') {
        e.preventDefault();
        saveCustomForm(form);
      } else if (form.id === 'moment-form') {
        e.preventDefault();
        saveMomentForm(form);
      }
    });

    document.addEventListener('change', e => {
      const input = e.target;
      if (!input || input.name !== 'poster' || !input.closest || !input.closest('#custom-form')) return;
      const file = input.files && input.files[0];
      const preview = $('#custom-poster-preview');
      if (!preview || !file || !file.type.startsWith('image/')) return;
      const url = URL.createObjectURL(file);
      preview.innerHTML = `<img src="${url}" alt="Постер">`;
      const img = preview.querySelector('img');
      if (img) img.onload = () => URL.revokeObjectURL(url);
    });

    document.addEventListener('change', e => {
      const input = e.target;
      if (!input || input.dataset.action !== 'backup-file') return;
      const file = input.files && input.files[0];
      input.value = '';
      restoreBackupFile(file);
    });

    document.addEventListener('change', e => {
      const input = e.target;
      if (!input || input.dataset.action !== 'media-file') return;
      const file = input.files && input.files[0];
      input.value = '';
      importMediaFile(file);
    });

    const search = $('#search-input');
    if (search) {
      search.addEventListener('input', () => {
        clearTimeout(searchTimer);
        const val = search.value.trim();
        searchTimer = setTimeout(() => {
          state.db.query = val;
          state.db.touched = true;
          persistCatalogPreferences();
          syncModeChips();
          fetchDB(true);
        }, 500);
      });
    }

    const langSelect = $('#search-lang');
    if (langSelect) {
      langSelect.addEventListener('change', () => {
        state.settings.searchLang = C.normalizeSearchLang(langSelect.value);
        saveState();
        syncLangUI();
        if (state.db.query.trim()) fetchDB(true);
      });
    }

    const filters = $('#db-filters');
    if (filters) {
      filters.addEventListener('change', () => {
        state.db.filters = readFiltersFromUI();
        state.db.touched = true;
        persistCatalogPreferences();
        syncModeChips();
        syncFilterUI();
        fetchDB(true);
      });
    }

    const upcomingSearch = $('#upcoming-search');
    if (upcomingSearch) {
      upcomingSearch.addEventListener('input', () => {
        state.upcoming.view.query = upcomingSearch.value;
        App.renderUpcoming();
      });
    }

    const upcomingTools = $('#upcoming-tools');
    if (upcomingTools) {
      upcomingTools.addEventListener('change', e => {
        const field = e.target.closest && e.target.closest('[data-upcoming]');
        if (!field) return;
        const view = state.upcoming.view;
        if (field.dataset.upcoming === 'month') view.month = field.value;
        else if (field.dataset.upcoming === 'sort') view.sort = field.value === 'title' ? 'title' : 'date';
        else view.filters = C.normalizeFilters({ ...view.filters, [field.dataset.upcoming]: field.value });
        App.renderUpcoming();
      });
    }

    document.addEventListener('input', e => {
      const listSearch = e.target.closest && e.target.closest('[data-list-search]');
      if (listSearch) {
        const name = listSearch.dataset.listSearch === 'planned' ? 'planned' : 'watched';
        if (!state.listViews[name]) {
          state.listViews[name] = { query: '', filters: C.normalizeFilters(C.DEFAULT_FILTERS) };
        }
        state.listViews[name].query = listSearch.value;
        renderTierList(name);
        return;
      }
      const tiktokQuery = e.target.closest && e.target.closest('#tiktok-import-search');
      if (tiktokQuery && state.tiktokImport.open) {
        state.tiktokImport.query = tiktokQuery.value;
        App.renderTikTokImport();
        return;
      }
      const slider = e.target.closest && e.target.closest('input[data-action="ep-slider"]');
      if (slider) previewEpisodeSlider(slider);
      if (e.target && e.target.id === 'import-code' && state.exchange.open) {
        state.exchange.code = e.target.value;
      }
    });

    document.addEventListener('change', e => {
      const settingsLang = e.target.closest && e.target.closest('select[data-action="settings-search-lang"]');
      if (settingsLang) applySettingsChange('searchLang', settingsLang.value);
      const settingsProvider = e.target.closest && e.target.closest('select[data-action="settings-translation"]');
      if (settingsProvider) applySettingsChange('translationProvider', settingsProvider.value);
      const provider = e.target.closest && e.target.closest('select[data-action="synopsis-provider"]');
      if (provider) {
        state.settings.translationProvider = ['mymemory', 'google'].includes(provider.value) ? provider.value : 'auto';
        saveState();
        if (state.modalId != null) {
          const animeId = state.modalId;
          renderModal();
          if (state.synopsisModes.get(animeId) !== 'original') translateModalSynopsis(animeId);
        }
      }
      const listField = e.target.closest && e.target.closest('select[data-list-filter]');
      if (listField) {
        const tools = listField.closest('[data-list-tools]');
        const name = tools && tools.dataset.listTools === 'planned' ? 'planned' : 'watched';
        if (!state.listViews[name]) {
          state.listViews[name] = { query: '', filters: C.normalizeFilters(C.DEFAULT_FILTERS) };
        }
        const view = state.listViews[name];
        view.filters = C.normalizeFilters({
          ...view.filters,
          [listField.dataset.listFilter]: listField.value,
        });
        renderTierList(name);
        return;
      }
      const slider = e.target.closest && e.target.closest('input[data-action="ep-slider"]');
      if (!slider) return;
      const id = Number(slider.dataset.id);
      const max = Number(slider.dataset.max) || 0;
      if (id != null && max > 0) setWatchedUpTo(id, Number(slider.value), max);
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if (state.tiktokImport.open) {
          closeTikTokImport();
          return;
        }
        if (state.settingsScreen && state.settingsScreen.open) {
          closeSettings();
          return;
        }
        if (state.backup.open) {
          closeBackup();
          return;
        }
        if (state.momentForm.open) {
          closeMomentForm();
          return;
        }
        if (state.customForm.open) {
          closeCustomForm();
          return;
        }
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
      if (e.key === 'Enter' && e.target && e.target.matches && e.target.matches('.card, .notif, .tier-card, .franchise-link')) {
        e.preventDefault();
        const id = Number(e.target.dataset.id);
        openModal(id);
        translateModalSynopsis(id);
      }
    });

    window.addEventListener('storage', e => {
      if (e.key === MOMENTS_KEY) {
        loadMoments();
        if (state.modalId != null) renderModal();
        return;
      }
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

  function localDayKey(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function dailySyncIsDue(now = new Date()) {
    return now.getHours() >= 3 && localStorage.getItem(DAILY_SYNC_KEY) !== localDayKey(now);
  }

  function nextDailySyncAt(now = new Date()) {
    const next = new Date(now);
    next.setHours(3, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next.getTime();
  }

  let dailySyncTimer = null;
  function scheduleDailySync() {
    clearTimeout(dailySyncTimer);
    dailySyncTimer = setTimeout(() => {
      if (dailySyncIsDue()) runDailySync();
      else scheduleDailySync();
    }, Math.min(nextDailySyncAt() - Date.now(), 2147480000));
  }

  let dailySyncRunning = false;
  async function runDailySync() {
    if (dailySyncRunning || state.forceDemo || !navigator.onLine) return;
    dailySyncRunning = true;
    setDailySyncMode(true);
    clearAniListCache();
    try {
      await Promise.allSettled([fetchNotifications(true), fetchUpcoming(true)]);
      await fetchDB(true);
      if (state.notifications.error || state.upcoming.error || state.db.error) {
        throw new Error('Ежедневная синхронизация завершилась не полностью');
      }
      localStorage.setItem(DAILY_SYNC_KEY, localDayKey());
    } catch (err) {
      console.warn('AniTier: ежедневная синхронизация не завершилась', err);
    } finally {
      setDailySyncMode(false);
      dailySyncRunning = false;
      scheduleDailySync();
    }
  }

  async function bootstrap() {
    try {
      await Promise.allSettled([fetchNotifications(), fetchUpcoming()]);
      if (!state.db.touched) await fetchDB(true);
    } finally {
      state.booting = false;
      state.bootstrapDone = true;
      renderDB();
      scheduleDailySync();
      if (dailySyncIsDue()) runDailySync();
    }
  }

  async function init() {
    state.booting = true;
    if (!localStorage.getItem(DAILY_SYNC_KEY)) {
      const now = new Date();
      const initialMark = now.getHours() >= 3 ? localDayKey(now) : localDayKey(new Date(now.getTime() - 86400000));
      localStorage.setItem(DAILY_SYNC_KEY, initialMark);
    }
    loadState();
    loadMoments();
    initFilterOptions();
    restoreCatalogPreferences();
    syncLangUI();
    bindEvents();
    setupInfiniteScroll();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && dailySyncIsDue()) runDailySync();
    });

    renderTierList('watched');
    renderTierList('planned');
    updateCounters();
    updateBell();
    updateOfflineBanner();
    renderDB();

    const versionEl = $('#footer-version');
    if (versionEl) versionEl.textContent = C.APP_VERSION || '';

    const modal = $('#modal');
    if (modal) modal.hidden = true;
    const exchangeModal = $('#exchange-modal');
    if (exchangeModal) exchangeModal.hidden = true;
    const customModal = $('#custom-modal');
    if (customModal) customModal.hidden = true;
    const momentModal = $('#moment-modal');
    if (momentModal) momentModal.hidden = true;
    const backupModal = $('#backup-modal');
    if (backupModal) backupModal.hidden = true;

    return bootstrap();
  }

  /* ---------------- напоминания на телефоне ---------------- */
  function releaseBridge() {
    return typeof window !== 'undefined' ? window.AniTierAndroid : null;
  }

  function releaseNotificationsEnabled() {
    const bridge = releaseBridge();
    if (!bridge || typeof bridge.areReleaseNotificationsEnabled !== 'function') return false;
    try {
      return Boolean(bridge.areReleaseNotificationsEnabled());
    } catch (_) {
      return false;
    }
  }

  function syncReleaseNotifications() {
    const bridge = releaseBridge();
    if (!bridge || typeof bridge.scheduleReleaseNotifications !== 'function') return;
    const items = C.buildReleaseNotificationItems(state.notifications, state.epInfo);
    try {
      bridge.scheduleReleaseNotifications(JSON.stringify(items));
    } catch (err) {
      console.warn('AniTier: не удалось запланировать напоминания', err);
    }
  }

  function toggleReleaseNotifications() {
    const bridge = releaseBridge();
    if (!bridge || typeof bridge.setReleaseNotificationsEnabled !== 'function') {
      toast('Напоминания работают только в приложении для Android');
      return;
    }
    bridge.setReleaseNotificationsEnabled(!releaseNotificationsEnabled());
    if (state.settingsScreen && state.settingsScreen.open) renderSettings();
  }

  /* Вызывается из MainActivity после ответа на запрос разрешений. */
  function onReleaseNotificationPermissionResult(enabled) {
    if (state.tab === 'notifications') renderNotifications();
    if (state.settingsScreen && state.settingsScreen.open) renderSettings();
    toast(enabled ? 'Напоминания о сериях включены' : 'Напоминания о сериях выключены');
    if (enabled) syncReleaseNotifications();
  }

  /* ---------------- проверка обновлений ---------------- */
  async function checkForUpdates() {
    const screen = state.settingsScreen;
    if (!screen || screen.checking) return;
    screen.checking = true;
    screen.message = '';
    screen.error = false;
    screen.latest = null;
    if (screen.open) renderSettings();

    try {
      if (typeof App.fetchLatestRelease !== 'function') throw new Error('Проверка обновлений недоступна');
      const release = await App.fetchLatestRelease();
      const current = C.APP_VERSION;
      screen.latest = release;
      const diff = C.compareVersions(release.version, current);
      if (diff > 0) screen.message = `Доступна версия ${release.version}, у вас ${current}.`;
      else if (diff < 0) screen.message = `У вас версия ${current}, на GitHub опубликована ${release.version}.`;
      else screen.message = `У вас последняя версия ${current}.`;
    } catch (err) {
      screen.error = true;
      screen.message = err && err.message ? err.message : 'Не удалось проверить обновления';
    } finally {
      screen.checking = false;
      if (screen.open) renderSettings();
    }
  }

  /* Ссылки: в APK открываем системным браузером через мост, в браузере — новой вкладкой. */
  function openExternalLink(url) {
    if (!/^https?:\/\//i.test(String(url || ''))) return;
    const bridge = releaseBridge();
    if (bridge && typeof bridge.openUrl === 'function') {
      try {
        bridge.openUrl(url);
        return;
      } catch (_) { /* падаем в обычное окно */ }
    }
    if (typeof window !== 'undefined' && typeof window.open === 'function') {
      window.open(url, '_blank', 'noopener');
    }
  }

  function applySettingsChange(kind, value) {    if (kind === 'searchLang') {
      state.settings.searchLang = C.normalizeSearchLang(value);
      syncLangUI();
    } else if (kind === 'translationProvider') {
      state.settings.translationProvider = ['mymemory', 'google'].includes(value) ? value : 'auto';
    } else {
      return;
    }
    saveState();
    if (state.settingsScreen && state.settingsScreen.open) renderSettings();
  }

  /* Системная кнопка «назад» в Android: сначала закрываем слои интерфейса. */
  function handleAndroidBack() {
    if (state.tiktokImport.open) { closeTikTokImport(); return true; }
    if (state.settingsScreen && state.settingsScreen.open) {
      if (state.settingsScreen.view === 'changelog') {
        state.settingsScreen.view = 'main';
        renderSettings();
        const panel = $('#settings-panel');
        if (panel) panel.scrollTop = 0;
        return true;
      }
      closeSettings();
      return true;
    }
    if (state.backup.open) { closeBackup(); return true; }
    if (state.momentForm.open) { closeMomentForm(); return true; }
    if (state.customForm.open) { closeCustomForm(); return true; }
    if (state.exchange.open) { closeExchange(); return true; }
    if (state.modalId != null) { closeModal(); return true; }
    if (state.tab !== 'db') { switchTab('db'); return true; }

    /* Выход из приложения подтверждается вторым нажатием: первый раз
       показываем подсказку, второе нажатие в течение пары секунд закрывает
       APK. Случайное нажатие больше не выкидывает из приложения. */
    const now = Date.now();
    if (now < exitBackArmedUntil) {
      exitBackArmedUntil = 0;
      return false;
    }
    exitBackArmedUntil = now + EXIT_BACK_WINDOW;
    toast('Нажмите «Назад» ещё раз, чтобы выйти');
    return true;
  }

  Object.assign(App, {
    fetchDB,
    fetchNotifications,
    fetchUpcoming,
    refreshCurrent,
    retryAll,
    saveCustomForm,
    removeCustomCard,
    hydrateCustomImage,
    saveMomentForm,
    receiveSharedTikTok,
    openTikTokSearch,
    playMoment,
    shareMoment,
    removeMomentAction,
    openCustomForm,
    closeCustomForm,
    openMomentForm,
    closeMomentForm,
    captureMomentDraft,
    revokeMomentUrls,
    openBackup,
    closeBackup,
    saveBackupFile,
    restoreBackupText,
    restoreBackupFile,
    exportMediaFile,
    buildMediaArchive,
    androidSaveMedia,
    importMediaFile,
    saveBackupToDrive,
    restoreFromDrive,
    persistCatalogPreferences,
    driveAvailable,
    buildBackupPayload,
    applyBackupData,
    handleAndroidBack,
    onReleaseNotificationPermissionResult,
    syncReleaseNotifications,
    toggleReleaseNotifications,
    releaseNotificationsEnabled,
    checkForUpdates,
    openSettings,
    closeSettings,
    renderSettings,
    scrollPageBy,
    openExternalLink,
    init,
  });

  if (TEST_MODE) {
    window.__anitierTest = {
      state,
      init,
      fetchAniList,
      fetchAnimeRelations: App.fetchAnimeRelations,
      clearPersistentApiCache,
      clearMemoryApiCache: clearAniListCache,
      dailySyncIsDue,
      runDailySync,
      persistCatalogPreferences,
      fetchAniList,
      clearPersistentApiCache,
      clearMemoryApiCache: clearAniListCache,
      dailySyncIsDue,
      runDailySync,
      fetchDB,
      fetchNotifications,
      fetchUpcoming,
      resetDBFilters,
      syncFilterUI,
      syncLangUI,
      resolveSearchQuery,
      searchQueryForAlt,
      translateText,
      translateModalSynopsis,
      receiveSharedTikTok,
      openTikTokSearch,
      invalidateNotificationEpisodes,
      openExchange,
      closeExchange,
      setExchangeMode,
      switchExchangeList,
      parseImportCode,
      addExchangeItem,
      renderExchange,
      saveCustomForm,
      removeCustomCard,
      saveMomentForm,
      removeMomentAction,
      openCustomForm,
      closeCustomForm,
      openMomentForm,
      closeMomentForm,
      openBackup,
      closeBackup,
      restoreBackupText,
      exportMediaFile,
      buildMediaArchive,
      androidSaveMedia,
      importMediaFile,
      buildBackupPayload,
      applyBackupData,
      driveAvailable,
    };
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { init(); });
  } else {
    init();
  }
})(window.AniTier);
