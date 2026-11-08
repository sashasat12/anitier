/* ============================================================
   AniTier — контроллер, события и запуск
   Загружается последним, после app-store.js, app-api.js и app-render.js.
   ============================================================ */
(function (App) {
  'use strict';
  try {

  const C = window.AniTierCore;

// Ленивая привязка к функциям, перенесённым в app-ctrl-backup
const googleClientId = (...a) => App.googleClientId(...a);
const driveAvailable = (...a) => App.driveAvailable(...a);
const loadGisScript = (...a) => App.loadGisScript(...a);
const ensureDriveToken = (...a) => App.ensureDriveToken(...a);
const setBackupMessage = (...a) => App.setBackupMessage(...a);
const watchedList = (...a) => App.watchedList(...a);
const downloadText = (...a) => App.downloadText(...a);
const saveBackupFile = (...a) => App.saveBackupFile(...a);
const restoreBackupText = (...a) => App.restoreBackupText(...a);
const restoreBackupFile = (...a) => App.restoreBackupFile(...a);
const buildMediaArchive = (...a) => App.buildMediaArchive(...a);
const androidSaveMedia = (...a) => App.androidSaveMedia(...a);
const exportMediaFile = (...a) => App.exportMediaFile(...a);
const importMediaFile = (...a) => App.importMediaFile(...a);
const saveBackupToDrive = (...a) => App.saveBackupToDrive(...a);
const restoreFromDrive = (...a) => App.restoreFromDrive(...a);
const autoBackupDue = (...a) => App.autoBackupDue(...a);
const runAutoBackup = (...a) => App.runAutoBackup(...a);

// Ленивая привязка к функциям, перенесённым в app-ctrl-moments/settings (п.35)
const readImageFile = (...a) => App.readImageFile(...a);
const loadImageElement = (...a) => App.loadImageElement(...a);
const makeImageThumbnail = (...a) => App.makeImageThumbnail(...a);
const makeVideoThumbnail = (...a) => App.makeVideoThumbnail(...a);
const makeFileThumbnail = (...a) => App.makeFileThumbnail(...a);
const openTikTokUrl = (...a) => App.openTikTokUrl(...a);
const openTikTokSearch = (...a) => App.openTikTokSearch(...a);
const closeTikTokImport = (...a) => App.closeTikTokImport(...a);
const openTikTokImport = (...a) => App.openTikTokImport(...a);
const consumeSharedLink = (...a) => App.consumeSharedLink(...a);
const receiveSharedTikTok = (...a) => App.receiveSharedTikTok(...a);
const saveSharedTikTok = (...a) => App.saveSharedTikTok(...a);
const captureMomentDraft = (...a) => App.captureMomentDraft(...a);
const saveMomentForm = (...a) => App.saveMomentForm(...a);
const revokeMomentUrls = (...a) => App.revokeMomentUrls(...a);
const playMoment = (...a) => App.playMoment(...a);
const safeFileName = (...a) => App.safeFileName(...a);
const shareMoment = (...a) => App.shareMoment(...a);
const removeMomentAction = (...a) => App.removeMomentAction(...a);
const releaseBridge = (...a) => App.releaseBridge(...a);
const releaseNotificationsEnabled = (...a) => App.releaseNotificationsEnabled(...a);
const syncReleaseNotifications = (...a) => App.syncReleaseNotifications(...a);
const toggleReleaseNotifications = (...a) => App.toggleReleaseNotifications(...a);
const onReleaseNotificationPermissionResult = (...a) => App.onReleaseNotificationPermissionResult(...a);
const showUpdateAvailable = (...a) => App.showUpdateAvailable(...a);
const autoCheckUpdates = (...a) => App.autoCheckUpdates(...a);
const checkForUpdates = (...a) => App.checkForUpdates(...a);
const openExternalLink = (...a) => App.openExternalLink(...a);
const applySettingsChange = (...a) => App.applySettingsChange(...a);
const refreshStorageInfo = (...a) => App.refreshStorageInfo(...a);
const clearAppCache = (...a) => App.clearAppCache(...a);
try { window.onReleaseNotificationPermissionResult = onReleaseNotificationPermissionResult; } catch (_) {}
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
    TIERS,
    LIST_LABELS,
    VIEW_TABS,
    TEST_MODE,
    createAltSearchState,
    saveState,
    loadState,
    loadMoments,
    hasIn,
    addToList,
    importTrackedItems,
    removeFromList,
    moveToTier,
    toggleList,
    findTier,
    getAnime,
    watchedSet,
    watchedCount,
    episodeStats,
    restoreProgress,
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
    migrateLocalThumbnails,
    customThumbKey,
    momentThumbKey,
    dataUrlToBlob,
    setLocalImageUrl,
    isDataImageUrl,
    mediaPut,
    mediaGet,
    mediaDelete,
    mediaEntries,
    mediaPutMany,
    posterCachedUrl,
    markPosterCached,
    prunePosters,
    clearPosterStore,
    POSTER_CACHE_LIMIT,
    POSTER_CACHE_WIDTH,
    POSTER_CACHE_HEIGHT,
    toggleEpisode,
    setWatchedUpTo,
    clearProgress,
    epWord,
    plural,
    makePoster,
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
    withCacheReload,
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

  const {
    renderDB,
    renderNotifications,
    renderUpcoming,
    renderTierList,
    listVisibleItems,
    applyLocationHash,
    applyPendingHashModal,
    layoutTierCards,
    updateCounters,
    updateBell,
    updateOfflineBanner,
    markNotificationsSeen,
    invalidateNotificationEpisodes,
    toast,
    renderModal,
    switchModalTab,
    closeDBMoreMenu,
    toggleDBMoreMenu,
    syncContinueToggle,
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
    renderUpdateCard,
    normalizeUpdateCheck,
    openSettings,
    closeSettings,
    openStats,
    closeStats,
    openCommand,
    closeCommand,
    setCommandQuery,
    moveCommand,
    jumpCommand,
    openCommandResult,
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
    closeFilterMenus,
    previewEpisodeSlider,
    switchTab,
    ensureNotificationEpisodes,
  } = App;

  async function refreshCurrent() {
    clearAniListCache();
    if (state.tab === 'db') {
      await App.fetchDB(true, { reload: true });
    } else if (state.tab === 'notifications') {
      await App.fetchNotifications(true, { reload: true });
    } else if (state.tab === 'upcoming') {
      await App.fetchUpcoming(true, { reload: true });
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

    await Promise.allSettled([
      App.fetchNotifications(true, { reload: true }),
      App.fetchUpcoming(true, { reload: true }),
    ]);
    await App.fetchDB(true, { reload: true });
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

  /* ---------------- история поиска ---------------- */
  function renderSearchHistory() {
    const list = document.getElementById('search-history');
    if (!list) return;
    const history = Array.isArray(state.settings.searchHistory) ? state.settings.searchHistory : [];
    list.innerHTML = history.map(query => `<option value="${App.esc(query)}"></option>`).join('');
  }

  function rememberSearch(query) {
    const value = String(query || '').trim();
    if (value.length < 2) return;
    const history = (Array.isArray(state.settings.searchHistory) ? state.settings.searchHistory : [])
      .filter(item => item.toLowerCase() !== value.toLowerCase());
    history.unshift(value);
    state.settings.searchHistory = history.slice(0, 8);
    saveState();
    renderSearchHistory();
  }

  function persistCatalogPreferences() {
    state.settings.catalog = {
      tab: state.tab,
      mode: state.db.mode,
      sort: state.db.sort,
      hideMine: Boolean(state.db.hideMine),
      query: state.db.query,
      filters: state.db.filters,
    };
    saveState();
  }

  /* Панели фильтров списков и «Скоро выйдут» закрываются по Esc, клику мимо
     и повороту экрана — как меню «⋯». */
  function closeListFilterPanels() {
    for (const name of ['watched', 'planned']) {
      const panel = document.getElementById('list-filters-' + name);
      if (!panel || panel.hidden) continue;
      panel.hidden = true;
      const btn = document.querySelector(`[data-action="toggle-list-filters"][data-list="${name}"]`);
      if (btn) btn.setAttribute('aria-expanded', 'false');
    }
    const upcoming = document.getElementById('upcoming-filters');
    if (upcoming && !upcoming.hidden) {
      upcoming.hidden = true;
      const btn = document.querySelector('[data-action="toggle-upcoming-filters"]');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    }
  }

  function restoreCatalogPreferences() {
    const catalog = state.settings.catalog || {};
    state.tab = catalog.tab || 'db';
    state.db.mode = catalog.mode || 'popular';
    state.db.sort = C.normalizeDBSort(catalog.sort);
    state.db.hideMine = Boolean(catalog.hideMine);
    state.db.query = catalog.query || '';
    state.db.filters = C.normalizeFilters(catalog.filters);
    const input = $('#search-input');
    if (input) input.value = state.db.query;
    const sortSelect = $('#db-sort');
    if (sortSelect) sortSelect.value = state.db.sort;
    const hideToggle = $('#db-hide-mine');
    if (hideToggle) {
      hideToggle.classList.toggle('is-active', state.db.hideMine);
      hideToggle.setAttribute('aria-pressed', state.db.hideMine ? 'true' : 'false');
    }
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
      let imageKey = existing ? String(existing.imageKey || '') : '';

      if (file) {
        try { image = await makeImageThumbnail(file); } catch { image = existing ? existing.image : ''; }
        const stored = await mediaPut('images', customId, file);
        if (!stored) toast('Полный постер не сохранился — останется миниатюра');
        if (image && isDataImageUrl(image)) {
          imageKey = customThumbKey({ customId, id }) || `custom:${customId}:thumb`;
          try {
            const thumbBlob = await dataUrlToBlob(image);
            await mediaPut('images', imageKey, thumbBlob);
            setLocalImageUrl(imageKey, image);
          } catch { /* миниатюра останется в памяти до перезагрузки */ }
        }
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
        imageKey,
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
      App.fetchDB(true);
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
      if (moment.thumbKey) await mediaDelete('images', moment.thumbKey);
    }
    await mediaDelete('images', card.customId);
    if (card.imageKey) await mediaDelete('images', card.imageKey);
    await mediaDelete('images', customThumbKey(card));
    deleteCustomCard(id);
    closeModal();
    toast('Карточка удалена');
  }

  async function hydrateCustomImage(id) {
    const card = getCustomCard(id);
    if (!card || !card.customId) return;
    const blob = await mediaGet('images', card.customId);
    if (!blob || state.modalId !== id) return;
    const img = $('#modal-content .modal-poster img');
    if (!img) return;
    const url = URL.createObjectURL(blob);
    img.onload = () => URL.revokeObjectURL(url);
    img.src = url;
  }

  /* ---------------- моменты ---------------- */

  /* Поиск: в APK сначала открываем приложение TikTok, если его нет — браузер. */

  /* ---------------- PNG тир-листа ---------------- */
  const TIER_IMAGE_GRADIENTS = {
    S: ['#ff5c8a', '#ff2d6f'],
    A: ['#ffb15c', '#ff8a2b'],
    B: ['#ffe066', '#ffcc00'],
    C: ['#6ee7a8', '#22c55e'],
    D: ['#7dd3fc', '#38bdf8'],
    F: ['#cbd5e1', '#94a3b8'],
    N: ['#3a4258', '#232838'],
  };

  function canvasRoundRect(ctx, x, y, width, height, radius) {
    const r = Math.max(0, Math.min(radius, width / 2, height / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function loadCanvasImage(src) {
    return new Promise(resolve => {
      const url = String(src || '');
      if (!url) { resolve(null); return; }
      const img = new Image();
      let settled = false;
      const finish = value => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      if (/^https?:/i.test(url)) img.crossOrigin = 'anonymous';
      img.onload = () => finish(img);
      img.onerror = () => finish(null);
      setTimeout(() => finish(null), 8000);
      img.src = url;
    });
  }

  function drawPosterCover(ctx, img, x, y, width, height) {
    if (!img || !img.width || !img.height) return;
    const scale = Math.max(width / img.width, height / img.height);
    const drawWidth = img.width * scale;
    const drawHeight = img.height * scale;
    ctx.save();
    canvasRoundRect(ctx, x, y, width, height, 9);
    ctx.clip();
    ctx.drawImage(img, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
    ctx.restore();
  }

  /* ---------------- кэш постеров ----------------
     Постер скачивается один раз, уменьшается до 240×360 и кладётся в
     IndexedDB. Дальше при ошибке загрузки картинки берётся из кэша,
     поэтому список открывается и без сети. */
  const POSTER_FETCH_CONCURRENCY = 2;
  const POSTER_QUEUE_LIMIT = 160;
  const posterQueue = [];
  const posterQueued = new Set();
  let posterActive = 0;

  function canCachePoster(url) {
    return /^https?:\/\//i.test(String(url || ''));
  }

  async function shrinkPoster(blob) {
    if (!blob || !blob.size) return null;
    const objectUrl = URL.createObjectURL(blob);
    try {
      const img = await loadCanvasImage(objectUrl);
      if (!img || !img.width || !img.height) return null;
      const canvas = document.createElement('canvas');
      canvas.width = POSTER_CACHE_WIDTH;
      canvas.height = POSTER_CACHE_HEIGHT;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.fillStyle = '#0b0f19';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
      const drawWidth = img.width * scale;
      const drawHeight = img.height * scale;
      ctx.drawImage(img, (canvas.width - drawWidth) / 2, (canvas.height - drawHeight) / 2, drawWidth, drawHeight);
      const jpeg = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.82));
      return jpeg || null;
    } catch {
      return null;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  async function cachePosterImage(url) {
    const src = String(url || '');
    if (!canCachePoster(src)) return false;
    if (await posterCachedUrl(src)) return false;
    try {
      const response = await fetch(src, { mode: 'cors', credentials: 'omit' });
      if (!response || !response.ok) return false;
      const raw = await response.blob();
      if (!raw || !raw.size) return false;
      const blob = await shrinkPoster(raw);
      if (!blob) return false;
      const saved = await mediaPut('posters', src, blob);
      if (!saved) return false;
      markPosterCached(src);
      await prunePosters(POSTER_CACHE_LIMIT);
      return true;
    } catch {
      return false;
    }
  }

  function pumpPosterQueue() {
    while (posterActive < POSTER_FETCH_CONCURRENCY && posterQueue.length) {
      const src = posterQueue.shift();
      posterActive += 1;
      cachePosterImage(src).finally(() => {
        posterActive -= 1;
        posterQueued.delete(src);
        pumpPosterQueue();
      });
    }
  }

  function queuePosterCache(url) {
    const src = String(url || '');
    if (!canCachePoster(src) || posterQueued.has(src)) return false;
    /* Длинная лента не должна забивать очередь: лишние постеры догрузятся
       при следующем появлении карточки на экране. */
    if (posterQueue.length >= POSTER_QUEUE_LIMIT) return false;
    posterQueued.add(src);
    posterQueue.push(src);
    pumpPosterQueue();
    return true;
  }

  function posterQueueStats() {
    return {
      queued: posterQueue.length,
      active: posterActive,
      limit: POSTER_QUEUE_LIMIT,
      concurrency: POSTER_FETCH_CONCURRENCY,
    };
  }

  window.cachePoster = function (img) {
    const url = img && img.dataset ? img.dataset.posterSrc : '';
    if (url) queuePosterCache(url);
  };

  function drawWrappedText(ctx, text, x, y, maxWidth, maxLines, lineHeight) {
    const words = String(text || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return;
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(test).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    if (lines.length > maxLines) {
      lines.length = maxLines;
      let last = lines[maxLines - 1].replace(/[\s,.:;—–-]+$/, '');
      while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
      lines[maxLines - 1] = `${last}…`;
    }
    lines.forEach((value, index) => ctx.fillText(value, x, y + index * lineHeight));
  }

  function tierPngFileName(listName) {
    const date = new Date();
    const stamp = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
    return `AniTier-${listName === 'planned' ? 'planned' : 'watched'}-${stamp}.png`;
  }

  async function mapWithLimit(items, limit, fn) {
    const list = Array.isArray(items) ? items : [];
    const max = Math.max(1, Number(limit) || 1);
    const out = new Array(list.length);
    let next = 0;
    async function worker() {
      while (next < list.length) {
        const i = next++;
        out[i] = await fn(list[i], i);
      }
    }
    await Promise.all(Array.from({ length: Math.min(max, list.length) }, () => worker()));
    return out;
  }

  function tierPngTitle(anime) {
    if (App.displayTitle) return App.displayTitle(anime) || anime.altTitle || anime.title || '';
    return anime.titleRu || anime.title || anime.altTitle || anime.originalTitle || '';
  }

  async function buildTierListPngBlob(listName) {
    const name = listName === 'planned' ? 'planned' : 'watched';
    const groups = TIERS.map(tier => ({
      tier: tier.id,
      label: tier.id === 'N' ? 'N' : tier.label,
      name: tier.name,
      items: state.lists[name][tier.id] || [],
    })).filter(group => group.items.length);
    const total = groups.reduce((sum, group) => sum + group.items.length, 0);
    if (!total) throw new Error('В списке пока нет тайтлов.');

    const layout = C.buildTierImageLayout(groups, { maxItems: 400 });
    const canvas = document.createElement('canvas');
    canvas.width = layout.width;
    canvas.height = layout.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Браузер не умеет рисовать PNG.');

    const background = ctx.createLinearGradient(0, 0, layout.width, layout.height);
    background.addColorStop(0, '#0b0f19');
    background.addColorStop(.55, '#0a0d15');
    background.addColorStop(1, '#14101c');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, layout.width, layout.height);

    const heading = LIST_LABELS[name] || name;
    const dateText = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ff9dbc';
    ctx.font = '800 12px "Segoe UI", Arial, sans-serif';
    ctx.fillText('ТИР-ЛИСТ ANITIER', layout.padding, 42);
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 46px "Segoe UI", Arial, sans-serif';
    ctx.fillText(heading, layout.padding, 94);
    ctx.fillStyle = '#8b93ac';
    ctx.font = '600 15px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`${total} ${plural(total, 'тайтл', 'тайтла', 'тайтлов')} · ${dateText}`, layout.padding, 122);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#ff4d8d';
    ctx.font = '800 30px "Segoe UI", Arial, sans-serif';
    ctx.fillText('AniTier', layout.width - layout.padding, 70);
    ctx.fillStyle = '#626b84';
    ctx.font = '700 10px "Segoe UI", Arial, sans-serif';
    ctx.fillText('ANIME TIER LIST', layout.width - layout.padding, 88);
    ctx.textAlign = 'left';

    const tiles = layout.tiers.flatMap(tier => tier.items);
    await mapWithLimit(tiles, 8, async tile => {
      const src = String(tile.anime.image || '');
      let image = null;
      if (/^https?:\/\//i.test(src)) {
        /* Сначала кэш: не создаём лишних запросов к AniList/Kitsu. */
        const cached = await posterCachedUrl(src);
        if (cached) image = await loadCanvasImage(cached);
        if (!image) image = await loadCanvasImage(src);
      } else if (src) {
        image = await loadCanvasImage(src);
      }
      if (!image) image = await loadCanvasImage(makePoster(tierPngTitle(tile.anime), tile.anime.id));
      tile.poster = image;
    });

    for (const tier of layout.tiers) {
      ctx.fillStyle = 'rgba(255, 255, 255, .035)';
      canvasRoundRect(ctx, layout.padding, tier.y, layout.width - layout.padding * 2, tier.height, 18);
      ctx.fill();

      const panelX = layout.padding + 14;
      const panelY = tier.y + 14;
      const panelWidth = layout.labelWidth - 28;
      const panelHeight = tier.height - 28;
      const colors = TIER_IMAGE_GRADIENTS[tier.tier] || TIER_IMAGE_GRADIENTS.N;
      const panel = ctx.createLinearGradient(panelX, panelY, panelX + panelWidth, panelY + panelHeight);
      panel.addColorStop(0, colors[0]);
      panel.addColorStop(1, colors[1]);
      ctx.fillStyle = panel;
      canvasRoundRect(ctx, panelX, panelY, panelWidth, panelHeight, 14);
      ctx.fill();

      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 42px "Segoe UI", Arial, sans-serif';
      ctx.fillText(tier.label, panelX + panelWidth / 2, panelY + 58);
      ctx.font = '700 12px "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, .95)';
      ctx.fillText(tier.name, panelX + panelWidth / 2, panelY + 80);
      ctx.font = '600 11px "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, .68)';
      ctx.fillText(`${tier.count}`, panelX + panelWidth / 2, panelY + panelHeight - 12);
      ctx.textAlign = 'left';

      for (const tile of tier.items) {
        if (tile.poster) {
          drawPosterCover(ctx, tile.poster, tile.x, tile.y, layout.posterWidth, layout.posterHeight);
          ctx.strokeStyle = 'rgba(255, 255, 255, .14)';
          ctx.lineWidth = 1;
          canvasRoundRect(ctx, tile.x + .5, tile.y + .5, layout.posterWidth - 1, layout.posterHeight - 1, 9);
          ctx.stroke();
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, .06)';
          canvasRoundRect(ctx, tile.x, tile.y, layout.posterWidth, layout.posterHeight, 9);
          ctx.fill();
        }
        ctx.fillStyle = '#c8d1e5';
        ctx.font = '600 11.5px "Segoe UI", Arial, sans-serif';
        drawWrappedText(ctx, tierPngTitle(tile.anime), tile.x, tile.y + layout.posterHeight + 15, layout.posterWidth, 2, 13.5);
      }
    }

    const footerY = layout.height - 58;
    ctx.strokeStyle = 'rgba(255, 255, 255, .1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(layout.padding, footerY);
    ctx.lineTo(layout.width - layout.padding, footerY);
    ctx.stroke();
    ctx.fillStyle = '#7e879f';
    ctx.font = '600 15px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Собрано в AniTier · ${dateText}`, layout.padding, footerY + 30);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ff9dbc';
    ctx.font = '800 15px "Segoe UI", Arial, sans-serif';
    ctx.fillText(layout.omitted ? `Показаны первые ${total - layout.omitted} из ${total}` : 'github.com/sashasat12/anitier', layout.width - layout.padding, footerY + 30);
    ctx.textAlign = 'left';

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Не удалось собрать PNG.');
    return { blob, width: canvas.width, height: canvas.height, total, omitted: layout.omitted };
  }

  async function exportTierPng(listName) {
    const ex = state.exchange;
    if (ex.pngBusy) return;
    ex.pngBusy = true;
    renderExchange();
    try {
      const png = await buildTierListPngBlob(listName);
      const fileName = tierPngFileName(listName);
      if (window.AniTierAndroid && typeof window.AniTierAndroid.beginMediaSave === 'function') {
        await androidSaveMedia(png.blob, fileName, 'PNG');
      } else {
        const url = URL.createObjectURL(png.blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      }
      toast('PNG тир-листа сохранён');
    } catch (err) {
      toast(err && err.message ? err.message : 'Не удалось собрать PNG');
    } finally {
      ex.pngBusy = false;
      if (ex.open) renderExchange();
    }
  }

  /* ---------------- импорт списков ---------------- */
  function readTextFile(file) {
    if (file && typeof file.text === 'function') return file.text();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('Не удалось прочитать файл'));
      reader.readAsText(file);
    });
  }

  function importSourceForFile(file) {
    const name = String(file && file.name || '').toLowerCase();
    if (name.endsWith('.xml')) return 'mal';
    if (name.endsWith('.gz')) return 'anilist';
    const current = state.exchange.importSource;
    return ['mal', 'shikimori', 'anilist'].includes(current) ? current : 'shikimori';
  }

  /** Файл AniList обычно приходит сжатым в .json.gz — распаковываем через DecompressionStream. */
  async function readImportText(file) {
    const name = String(file && file.name || '').toLowerCase();
    if (!name.endsWith('.gz')) return readTextFile(file);
    if (typeof DecompressionStream !== 'function') {
      throw new Error('Браузер не умеет распаковывать .gz. Обновите браузер или распакуйте файл сами и выберите обычный .json.');
    }
    try {
      const stream = file.stream().pipeThrough(new DecompressionStream('gzip'));
      return await new Response(stream).text();
    } catch {
      throw new Error('Не удалось распаковать .json.gz. Выберите файл экспорта AniList без изменений.');
    }
  }

  async function importListFile(file) {
    if (!file) return;
    const ex = state.exchange;
    if (!ex.open || ex.mode !== 'import') return;

    if (file.size > C.IMPORT_MAX_BYTES) {
      ex.importError = `Файл больше ${C.formatBytes(C.IMPORT_MAX_BYTES)} — это не экспорт списка.`;
      ex.importPlan = null;
      ex.importResult = null;
      renderExchange();
      return;
    }

    const source = importSourceForFile(file);
    const token = (Number(ex.importToken) || 0) + 1;
    ex.importToken = token;
    ex.importSource = source;
    ex.importBusy = true;
    ex.importError = '';
    ex.importPlan = null;
    ex.importResult = null;
    renderExchange();

    try {
      const text = await readImportText(file);
      if (token !== ex.importToken) return;
      const rows = source === 'mal'
        ? C.parseMalXml(text, new DOMParser())
        : source === 'anilist'
          ? C.parseAniListJson(text)
          : C.parseShikimoriJson(text);
      const malIds = [...new Set(rows.map(row => row.malId).filter(Boolean))];
      let resolved = [];
      if (malIds.length) {
        try {
          resolved = await fetchTrackedAnime(malIds);
        } catch {
          throw new Error('Не удалось получить данные из AniList. Проверьте интернет и попробуйте снова.');
        }
      }
      if (token !== ex.importToken) return;
      ex.importPlan = C.planImport(rows, resolved, state.lists);
    } catch (err) {
      if (token !== ex.importToken) return;
      ex.importError = err && err.message ? err.message : 'Не удалось прочитать файл.';
    } finally {
      if (token === ex.importToken) {
        ex.importBusy = false;
        renderExchange();
      }
    }
  }

  function confirmImportList() {
    const ex = state.exchange;
    if (!ex.open || !ex.importPlan) return;
    const plan = ex.importPlan;
    if (!plan.entries.length) {
      toast('Новых тайтлов для добавления нет');
      return;
    }
    const result = importTrackedItems(plan.entries);
    ex.importPlan = null;
    ex.importResult = {
      added: result.added,
      skipped: result.skipped,
      unmatched: plan.summary.unmatched,
    };
    renderExchange();
    const skipped = result.skipped ? `, пропущено ${result.skipped}` : '';
    toast(`Импортировано ${result.added} ${plural(result.added, 'тайтл', 'тайтла', 'тайтлов')}${skipped}`);
  }

  function cancelImportList() {
    const ex = state.exchange;
    ex.importToken = (Number(ex.importToken) || 0) + 1;
    ex.importBusy = false;
    ex.importPlan = null;
    ex.importError = '';
    ex.importResult = null;
    renderExchange();
  }

  /* ---------------- авто-бэкап в Google Drive ---------------- */

  /* ---------------- быстрые жесты: меню карточки и свайпы ---------------- */
  let longPressTimer = 0;
  let touchGesture = null;
  let pullDistance = 0;
  let suppressQuickClickUntil = 0;

  function isMobileShell() {
    return document.body.classList.contains('mobile-app')
      || (typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 720px)').matches);
  }

  function quickMenuHTML(id) {
    const anime = getAnime(id);
    if (!anime) return '';
    const inW = hasIn('watched', id);
    const inP = hasIn('planned', id);
    return `<div class="quick-backdrop" data-action="quick-close"></div>
      <div class="quick-panel" role="dialog" aria-modal="true" aria-label="Быстрые действия">
        <b class="quick-title">${App.esc(App.displayTitle ? App.displayTitle(anime) : anime.title)}</b>
        <button type="button" class="quick-action" data-action="quick-open" data-id="${id}">Открыть карточку</button>
        <button type="button" class="quick-action ${inW ? 'is-on' : ''}" data-action="quick-watched" data-id="${id}">${inW ? 'Убрать из просмотрено' : 'Отметить просмотренным'}</button>
        <button type="button" class="quick-action ${inP ? 'is-on' : ''}" data-action="quick-planned" data-id="${id}">${inP ? 'Убрать из планов' : 'Добавить в планы'}</button>
        <button type="button" class="quick-action quick-cancel" data-action="quick-close">Отмена</button>
      </div>`;
  }

  function openQuickMenu(id) {
    if (!getAnime(id)) return;
    let box = document.getElementById('quick-menu');
    if (!box) {
      box = document.createElement('div');
      box.id = 'quick-menu';
      box.className = 'quick-menu';
      box.hidden = true;
      document.body.appendChild(box);
    }
    state.quickMenu = { id };
    box.innerHTML = quickMenuHTML(id);
    box.hidden = false;
    App.syncBodyScroll();
    const first = box.querySelector('.quick-action');
    if (first) first.focus({ preventScroll: true });
  }

  function closeQuickMenu() {
    state.quickMenu = null;
    const box = document.getElementById('quick-menu');
    if (box) { box.hidden = true; box.innerHTML = ''; }
    App.syncBodyScroll();
  }

  function pullIndicator() {
    let el = document.getElementById('pull-refresh');
    if (!el) {
      el = document.createElement('div');
      el.id = 'pull-refresh';
      el.className = 'pull-refresh';
      el.setAttribute('aria-hidden', 'true');
      document.body.appendChild(el);
    }
    return el;
  }

  function resetPullIndicator() {
    const el = document.getElementById('pull-refresh');
    if (el) { el.style.transform = ''; el.textContent = ''; el.classList.remove('is-ready', 'is-busy'); }
    pullDistance = 0;
  }

  function bindGestures() {
    document.addEventListener('touchstart', event => {
      if (!isMobileShell() || event.touches.length !== 1) return;
      if (document.body.classList.contains('no-scroll') || state.quickMenu || state.modalId != null) return;
      const target = event.target;
      if (!target || !target.closest) return;
      if (target.closest('input, textarea, select, button, a, [role="dialog"], .modal, .custom-modal, .moment-modal, .exchange-modal, .backup-modal, .settings-modal, .stats-modal, .command-modal, .tiktok-modal, .quick-menu, .ep-chips, .notif-tabs, .continue-row, .chips, .bottom-sheet')) return;

      const touch = event.touches[0];
      touchGesture = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
        pull: window.scrollY <= 0 && !target.closest('.tier-card'),
      };
      pullDistance = 0;

      const card = target.closest('.card[data-id], .notif[data-id]');
      if (card && !target.closest('.card-actions, .notif-actions, .mini-btn, .ep-chip')) {
        const id = Number(card.dataset.id);
        clearTimeout(longPressTimer);
        longPressTimer = setTimeout(() => {
          longPressTimer = 0;
          suppressQuickClickUntil = Date.now() + 700;
          openQuickMenu(id);
          if (navigator.vibrate) { try { navigator.vibrate(12); } catch { /* не критично */ } }
          touchGesture = null;
          resetPullIndicator();
        }, 520);
      }
    }, { passive: true });

    document.addEventListener('touchmove', event => {
      if (!touchGesture || event.touches.length !== 1) return;
      const touch = event.touches[0];
      const dx = touch.clientX - touchGesture.x;
      const dy = touch.clientY - touchGesture.y;

      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) clearTimeout(longPressTimer);
      if (Math.abs(dx) > Math.abs(dy) * 1.2) {
        resetPullIndicator();
        return;
      }
      if (!touchGesture.pull || dy <= 0) return;
      pullDistance = Math.min(120, dy * 0.6);
      const el = pullIndicator();
      el.textContent = pullDistance >= 48 ? 'Отпустите, чтобы обновить' : 'Потяните вниз';
      el.classList.toggle('is-ready', pullDistance >= 48);
      el.style.transform = `translate(-50%, ${pullDistance}px)`;
    }, { passive: true });

    document.addEventListener('touchend', event => {
      clearTimeout(longPressTimer);
      if (!touchGesture) { resetPullIndicator(); return; }
      const touch = event.changedTouches && event.changedTouches[0];
      const dx = touch ? touch.clientX - touchGesture.x : 0;
      const dy = touch ? touch.clientY - touchGesture.y : 0;
      const elapsed = Date.now() - touchGesture.time;
      const gesture = touchGesture;
      touchGesture = null;

      if (gesture.pull && pullDistance >= 48 && dy > 0) {
        const el = pullIndicator();
        el.textContent = 'Обновляем…';
        el.classList.add('is-busy');
        el.style.transform = 'translate(-50%, 18px)';
        Promise.resolve(refreshCurrent()).finally(() => {
          setTimeout(() => { el.classList.remove('is-busy'); resetPullIndicator(); }, 600);
        });
        return;
      }
      resetPullIndicator();

      if (elapsed < 900 && Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        const index = VIEW_TABS.indexOf(state.tab);
        if (index < 0) return;
        const next = dx < 0 ? index + 1 : index - 1;
        if (next >= 0 && next < VIEW_TABS.length) switchTab(VIEW_TABS[next]);
      }
    }, { passive: true });

    document.addEventListener('touchcancel', () => {
      clearTimeout(longPressTimer);
      touchGesture = null;
      resetPullIndicator();
    }, { passive: true });
  }

  /* ---------------- похожие по жанрам и тегам ---------------- */

  /* Переход из карточки в базу: ставим фильтр и чистим текстовый поиск,
     иначе выдача сузится до названия, с которого пользователь пришёл. */
  function focusDBWithFilters(patch, message) {
    if (state.modalId != null) closeModal();
    state.db.filters = C.normalizeFilters({ ...state.db.filters, ...patch });
    state.db.query = '';
    state.db.touched = true;
    const input = $('#search-input');
    if (input) input.value = '';
    switchTab('db');
    syncFilterUI();
    persistCatalogPreferences();
    App.fetchDB(true);
    if (message) toast(message);
  }

  function findSimilarByTags(tags) {
    const list = Array.isArray(tags) ? tags : [];
    const clean = [...new Set(list
      .map(tag => String(tag || '').trim())
      .filter(Boolean))].slice(0, 3);
    if (!clean.length) {
      toast('У этого тайтла пока нет тегов');
      return;
    }
    focusDBWithFilters(
      { tags: clean },
      clean.length === 1 ? 'Показаны тайтлы с этим тегом' : 'Показаны тайтлы с этими тегами',
    );
  }

  function findSimilarByGenre(genre) {
    const raw = String(genre || '').trim();
    if (!raw) return;
    const id = C.genreIdByName(raw);
    if (!id) {
      /* Жанра нет в фильтре AniList — пробуем одноимённый тег. */
      if (C.TAGS.some(tag => tag.name === raw)) {
        findSimilarByTags([raw]);
        return;
      }
      toast(`Жанр «${C.genreRu(raw)}» пока недоступен для поиска`);
      return;
    }
    focusDBWithFilters(
      { genre: [id] },
      `Показаны тайтлы в жанре «${C.genreRu(raw)}»`,
    );
  }

  let eventsBound = false;
  let modalTouch = null;

  function bindModalSwipe() {
    const modal = document.getElementById('modal');
    const panel = document.querySelector('.modal-panel');
    if (!modal || !panel) return;
    if (modal.dataset.swipeBound) return;
    modal.dataset.swipeBound = '1';

    panel.addEventListener('touchstart', (e) => {
      if (window.innerWidth > 720) return;
      if (panel.scrollTop > 0) return;
      const t = e.changedTouches[0];
      modalTouch = { y: t.clientY, time: Date.now() };
    }, { passive: true });

    panel.addEventListener('touchmove', (e) => {
      if (!modalTouch) return;
      if (window.innerWidth > 720) return;
      const t = e.changedTouches[0];
      const dy = t.clientY - modalTouch.y;
      if (dy > 0 && panel.scrollTop <= 0) {
        panel.style.transform = `translateY(${Math.min(dy * 0.4, 80)}px)`;
        panel.style.opacity = String(Math.max(0.7, 1 - dy / 400));
      }
    }, { passive: true });

    panel.addEventListener('touchend', (e) => {
      if (!modalTouch) return;
      if (window.innerWidth > 720) { modalTouch = null; return; }
      const t = e.changedTouches[0];
      const dy = t.clientY - modalTouch.y;
      const dt = Date.now() - modalTouch.time;
      panel.style.transform = '';
      panel.style.opacity = '';
      if (dy > 80 && dt < 400 && panel.scrollTop <= 0) {
        if (typeof closeModal === 'function') closeModal();
      }
      modalTouch = null;
    }, { passive: true });
  }
  window.bindModalSwipe = bindModalSwipe;

  /* Реестр действий: data-action → обработчик. Новое действие — одна строка. */

  /* ---------------- локальная диагностика (без отправки наружу) ---------------- */
  const DIAG_LIMIT = 50;
  const diagState = {
    errors: [],
    requestFailures: 0,
    requestTotal: 0,
    byOrigin: Object.create(null),
  };

  function sanitizeDiagText(value, max = 220) {
    let text = String(value == null ? '' : value).replace(/[\r\n\t]+/g, ' ').trim();
    /* Убираем URL с параметрами и длинные пути: в них могут быть поисковые запросы. */
    text = text.replace(/https?:\/\/[^\s)]+/gi, (url) => {
      try {
        const u = new URL(url);
        return u.origin + '/…';
      } catch {
        return '[url]';
      }
    });
    text = text.replace(/([?#]).{1,200}/g, '$1…');
    if (text.length > max) text = text.slice(0, max - 1) + '…';
    return text;
  }

  function diagOriginCategory(input) {
    try {
      const host = new URL(String(input || ''), location.href).hostname;
      if (host.includes('anilist')) return 'AniList';
      if (host.includes('kitsu')) return 'Kitsu';
      if (host.includes('translate') || host.includes('mymemory') || host.includes('wikidata')) return 'Перевод';
      if (host.includes('googleapis') || host.includes('google') || host.includes('gstatic')) return 'Google';
      if (host === location.hostname) return 'Локально';
      return 'Другое';
    } catch {
      return 'Другое';
    }
  }

  function recordDiagError(source, error, extra) {
    try {
      const message = sanitizeDiagText(
        extra && extra.message ? extra.message
          : error && error.message ? error.message
          : typeof error === 'string' ? error
          : String(error || 'Ошибка')
      );
      diagState.errors.push({
        at: new Date().toISOString(),
        source: sanitizeDiagText(source || 'app', 40),
        message: message || 'Ошибка',
        status: extra && Number.isFinite(Number(extra.status)) ? Number(extra.status) : undefined,
      });
      if (diagState.errors.length > DIAG_LIMIT) diagState.errors.splice(0, diagState.errors.length - DIAG_LIMIT);
    } catch { /* диагностика не должна ломать приложение */ }
  }

  function recordRequestResult(input, ok, status) {
    try {
      diagState.requestTotal += 1;
      const origin = diagOriginCategory(input);
      if (!diagState.byOrigin[origin]) diagState.byOrigin[origin] = { total: 0, failed: 0 };
      diagState.byOrigin[origin].total += 1;
      if (!ok) {
        diagState.requestFailures += 1;
        diagState.byOrigin[origin].failed += 1;
        recordDiagError('network', null, {
          message: origin + ': запрос не выполнен',
          status,
        });
      }
    } catch { /* диагностика не должна ломать приложение */ }
  }

  function buildDiagnosticsReport(now = new Date(), env = {}) {
    const version = (C && C.APP_VERSION) || '—';
    const nav = typeof navigator !== 'undefined' ? navigator : {};
    const lines = [
      'AniTier — диагностика',
      'Время: ' + (now instanceof Date ? now.toISOString() : String(now)),
      'Версия: ' + version,
      'Платформа: ' + String(env.platform || nav.platform || '—'),
      'User-Agent: ' + sanitizeDiagText(nav.userAgent || '—', 160),
      'Онлайн: ' + String(typeof nav.onLine === 'boolean' ? nav.onLine : '—'),
      'Режим: ' + String(env.mode || 'web'),
      'Запросы: всего ' + diagState.requestTotal + ', ошибок ' + diagState.requestFailures,
    ];
    const origins = Object.keys(diagState.byOrigin || {}).sort();
    if (origins.length) {
      lines.push('Источники: ' + origins.map(k => k + ' ' + diagState.byOrigin[k].failed + '/' + diagState.byOrigin[k].total).join(', '));
    }
    lines.push('Ошибки (последние ' + diagState.errors.length + ', без названий и прогресса):');
    if (!diagState.errors.length) {
      lines.push('- нет записей');
    } else {
      for (const e of diagState.errors.slice(-20)) {
        lines.push('- [' + e.at + '] ' + e.source + (e.status ? ' HTTP ' + e.status : '') + ': ' + e.message);
      }
    }
    return lines.join('\n');
  }

  async function copyDiagnostics() {
    const text = buildDiagnosticsReport();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      toast('Диагностика скопирована');
    } catch (err) {
      recordDiagError('diag', err);
      toast('Не удалось скопировать диагностику');
    }
  }

  function installDiagnostics() {
    if (typeof window === 'undefined' || window.__anitierDiagInstalled) return;
    window.__anitierDiagInstalled = true;
    window.addEventListener('error', (event) => {
      recordDiagError('runtime', event && event.error ? event.error : event && event.message);
    });
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event ? event.reason : null;
      recordDiagError('promise', reason);
    });
    if (typeof window.fetch === 'function') {
      const orig = window.fetch.bind(window);
      window.fetch = async function diagFetch(input, init) {
        try {
          const res = await orig(input, init);
          recordRequestResult(input, res && res.ok !== false, res && res.status);
          return res;
        } catch (err) {
          recordRequestResult(input, false);
          throw err;
        }
      };
    }
  }

  const ACTION_HANDLERS = {
    tab({ e, el }) {
      e.preventDefault();
      switchTab(el.dataset.tab);
    },

    open({ e, id }) {
      if (e.target.closest('button')) return;
      if (id != null) {
        openModal(id);
        translateModalSynopsis(id);
      }
    },

    'synopsis-mode'({ el, id }) {
      if (id == null || !['translated', 'original'].includes(el.dataset.mode)) return;
      const anime = getAnime(id);
      if (!anime) return;
      if (el.dataset.mode === 'translated' && !cachedTranslation(anime.synopsis, state.settings.translationProvider || 'auto')) return;
      state.synopsisModes.set(id, el.dataset.mode);
      renderModal();
    },

    'translate-synopsis'({ id }) {
      if (id != null) translateModalSynopsis(id);
    },

    'tiktok-search'({ id }) {
      const anime = getAnime(id);
      const query = anime ? [anime.title, anime.altTitle].filter(Boolean).join(' ') : '';
      if (query) openTikTokSearch(query);
    },

    'moment-open-tiktok'({ el, id }) {
      const moment = findMoment(id, el.dataset.moment);
      if (moment) openTikTokUrl(moment.url);
    },

    'tiktok-import-open-video'() {
      openTikTokUrl(state.tiktokImport.url);
    },

    'tiktok-import-save'({ id }) {
      saveSharedTikTok(id);
    },

    'close-tiktok-import'() {
      closeTikTokImport();
    },

    'add-watched'({ id }) {
      toggleList('watched', getAnime(id));
    },

    'quick-close'() {
      closeQuickMenu();
    },

    'quick-open'({ id }) {
      closeQuickMenu();
      openModal(id);
    },

    'quick-watched'({ id }) {
      toggleList('watched', getAnime(id));
      closeQuickMenu();
    },

    'quick-planned'({ id }) {
      toggleList('planned', getAnime(id));
      closeQuickMenu();
    },

    'add-planned'({ id }) {
      toggleList('planned', getAnime(id));
    },

    remove({ el, id }) {
      const list = el.dataset.list || (hasIn('planned', id) ? 'planned' : 'watched');
      const anime = getAnime(id);
      const tier = findTier(list, id) || 'N';
      if (removeFromList(list, id)) {
        toast('Тайтл убран из тир-листа', {
          actionLabel: 'Отменить',
          duration: 5000,
          onAction: () => { if (anime) addToList(list, anime, tier, true); },
        });
      }
    },

    'set-tier'({ el, id }) {
      const a = getAnime(id);
      if (!a) return;
      const tier = el.dataset.tier;
      if (!hasIn('watched', id) && !hasIn('planned', id)) {
        addToList('watched', a, tier);
      } else {
        const list = hasIn('watched', id) ? 'watched' : 'planned';
        moveToTier(list, id, tier);
      }
    },

    'retry-franchise'({ id }) {
      state.franchiseById.delete(id);
      state.franchiseErrors.delete(id);
      if (state.franchiseFullById) state.franchiseFullById.delete(id);
      if (state.franchiseFullLoading) state.franchiseFullLoading.delete(id);
      renderModal();
    },

    'franchise-full'({ id }) {
      const anime = getAnime(id);
      if (!anime) return;
      if (!state.franchiseFullLoading) state.franchiseFullLoading = new Set();
      if (state.franchiseFullLoading.has(id)) return;
      state.franchiseFullLoading.add(id);
      renderModal();
      Promise.resolve((App.fetchAnimeFranchise || App.fetchAnimeRelations)(anime, { depth: 2 }))
        .then(relations => {
          const allowed = new Set(['PREQUEL', 'SEQUEL', 'PARENT', 'SIDE_STORY', 'SPIN_OFF', 'SUMMARY', 'ALTERNATIVE', 'ALTERNATIVE_SETTING', 'ADAPTATION', 'CHARACTER', 'OTHER']);
          const seen = new Set();
          const links = [];
          for (const relation of Array.isArray(relations) ? relations : []) {
            if (!relation || !relation.anime) continue;
            if (relation.anime.id === anime.id) continue;
            if (seen.has(relation.anime.id)) continue;
            seen.add(relation.anime.id);
            links.push({ relationType: relation.relationType, anime: relation.anime });
          }
          if (!state.franchiseFullById) state.franchiseFullById = new Map();
          state.franchiseFullById.set(id, links);
        })
        .catch(() => {})
        .finally(() => {
          if (state.franchiseFullLoading) state.franchiseFullLoading.delete(id);
          if (state.modalId === id) renderModal();
        });
    },

    'modal-tab'({ el }) {
      switchModalTab(el.dataset.tab, { focus: true });
    },

    'franchise-more'({ id }) {
      if (!state.franchiseExpanded) state.franchiseExpanded = new Set();
      if (state.franchiseExpanded.has(id)) state.franchiseExpanded.delete(id);
      else state.franchiseExpanded.add(id);
      renderModal();
    },

    'toggle-ep'({ el, id }) {
      const ep = Number(el.dataset.ep);
      if (id != null && Number.isInteger(ep) && ep > 0) toggleEpisode(id, ep);
    },

    'ep-all'({ el, id }) {
      const max = Number(el.dataset.max) || 0;
      if (id != null && max > 0) {
        const before = watchedList(id);
        setWatchedUpTo(id, max, max);
        toast(`Отмечены все ${max} ${epWord(max)}`, {
          actionLabel: 'Отменить',
          duration: 5000,
          onAction: () => { restoreProgress(id, before); App.renderContinue(); },
        });
      }
    },

    'ep-reset'({ id }) {
      if (id != null) {
        const before = watchedList(id);
        clearProgress(id);
        toast('Прогресс серий сброшен', {
          actionLabel: 'Отменить',
          duration: 5000,
          onAction: () => { restoreProgress(id, before); App.renderContinue(); },
        });
      }
    },

    'quick-watch'({ id }) {
      if (id == null) return;
      const anime = getAnime(id);
      if (!anime) return;
      const before = watchedList(id);
      const stats = episodeStats(anime);
      const max = stats.available || stats.total || 0;
      const count = watchedCount(id);
      if (!max) { toast('Не знаем, сколько серий у этого тайтла'); return; }
      if (count >= max) { toast('Все известные серии уже отмечены'); return; }
      setWatchedUpTo(id, count + 1, max);
      App.renderContinue();
      toast(`Отмечена ${count + 1}-я серия`, {
        actionLabel: 'Отменить',
        duration: 5000,
        onAction: () => { restoreProgress(id, before); App.renderContinue(); },
      });
    },

    'random-planned'() {
      const items = listVisibleItems('planned');
      const pick = C.randomItem(items);
      if (!pick) { toast('В «Запланировано» нет тайтлов под текущие фильтры'); return; }
      toast(`Выпало: «${pick.title}»`);
      openModal(pick.id);
    },

    mode({ el }) {
      const mode = el.dataset.mode;
      if (!mode) return;
      state.db.mode = mode;
      state.db.query = '';
      state.db.touched = true;
      const input = $('#search-input');
      if (input) input.value = '';
      syncModeChips();
      persistCatalogPreferences();
      App.fetchDB(true);
    },

    'toggle-hide-mine'({ el }) {
      state.db.hideMine = !state.db.hideMine;
      el.classList.toggle('is-active', state.db.hideMine);
      el.setAttribute('aria-pressed', state.db.hideMine ? 'true' : 'false');
      persistCatalogPreferences();
      App.fetchDB(true);
    },

    'toggle-filters'({ el }) {
      const panel = $('#db-filters');
      if (!panel) return;
      panel.hidden = !panel.hidden;
      el.setAttribute('aria-expanded', panel.hidden ? 'false' : 'true');
      if (panel.hidden) closeFilterMenus();
    },

    'db-more-menu'() {
      toggleDBMoreMenu();
    },

    'toggle-upcoming-filters'({ el }) {
      if (state.upcoming.view && state.upcoming.view.mine) return;
      const panel = $('#upcoming-filters');
      if (!panel) return;
      panel.hidden = !panel.hidden;
      el.setAttribute('aria-expanded', panel.hidden ? 'false' : 'true');
    },

    'upcoming-more-menu'({ el }) {
      const menu = $('#upcoming-more-menu');
      if (!menu) return;
      const willOpen = menu.hidden;
      menu.hidden = !willOpen;
      el.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    },

    'list-more-menu'({ el }) {
      const listKey = el.dataset.list;
      if (!listKey) return;
      $$('.list-more-menu').forEach(menu => { if (menu.dataset.listMenu !== listKey) menu.hidden = true; });
      const menu = document.querySelector(`.list-more-menu[data-list-menu="${listKey}"]`);
      const willOpen = menu ? menu.hidden : false;
      if (menu) {
        menu.hidden = !willOpen;
        el.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      }
    },

    'toggle-continue'() {
      state.continueCollapsed = !state.continueCollapsed;
      syncContinueToggle();
    },

    'filter-menu'({ el }) {
      const key = el.dataset.filterMenu;
      const menu = document.querySelector(`[data-filter-panel="${key}"]`);
      const willOpen = menu ? menu.hidden : false;
      closeFilterMenus();
      if (menu && willOpen) {
        menu.hidden = false;
        el.setAttribute('aria-expanded', 'true');
        if (key === 'tags') {
          /* Поиск и скрытые пункты — состояние прошлого открытия,
             поэтому меню каждый раз начинается с полного списка. */
          const search = menu.querySelector('.filter-menu-search input');
          if (search) search.value = '';
          menu.querySelectorAll('.filter-option, .filter-menu-group').forEach(item => { item.hidden = false; });
          const scroll = menu.querySelector('.filter-menu-scroll');
          if (scroll) scroll.scrollTop = 0;

          const field = el.closest('.filter-field');
          if (field && !document.body.classList.contains('mobile-app')) {
            const rect = field.getBoundingClientRect();
            const width = Math.min(320, window.innerWidth - 24);
            const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
            menu.style.width = `${width}px`;
            menu.style.left = `${left - rect.left}px`;
            menu.style.right = 'auto';
          } else {
            /* На телефоне меню — шторка над навигацией: размеры задаёт CSS. */
            menu.style.removeProperty('width');
            menu.style.removeProperty('left');
            menu.style.removeProperty('right');
          }
        }
        if (key !== 'tags') {
          const first = menu.querySelector('input:not([type="hidden"])');
          if (first) first.focus({ preventScroll: true });
        }
      }
    },

    'reset-filters'() {
      resetDBFilters();
      state.db.touched = true;
      syncModeChips();
      persistCatalogPreferences();
      App.fetchDB(true);
    },

    'load-more'() {
      App.fetchDB();
    },

    refresh() {
      refreshCurrent();
    },

    'refresh-notifications'() {
      App.fetchNotifications(true, { reload: true });
    },

    'release-notifications'() {
      toggleReleaseNotifications();
    },

    'notif-tab'({ el }) {
      if (C.NOTIF_TABS.includes(el.dataset.notifTab)) {
        state.notifications.tab = el.dataset.notifTab;
        state.notifications.tabTouched = true;
        renderNotifications();
      }
    },

    'refresh-upcoming'() {
      App.fetchUpcoming(true, { reload: true });
    },

    'retry-db'() {
      App.fetchDB(true, { reload: true });
    },

    'retry-notifications'() {
      App.fetchNotifications(true, { reload: true });
    },

    'retry-upcoming'() {
      App.fetchUpcoming(true, { reload: true });
    },

    'reset-upcoming'() {
      const view = state.upcoming.view || (state.upcoming.view = {});
      const mine = Boolean(view.mine);
      view.query = '';
      if (!mine) {
        view.filters = C.normalizeFilters(C.DEFAULT_FILTERS);
        view.month = '';
        view.sort = 'date';
      }
      view.mine = mine;
      const search = $('#upcoming-search');
      if (search) search.value = '';
      App.renderUpcoming();
    },

    'toggle-upcoming-mine'() {
      if (!state.upcoming.view) state.upcoming.view = {};
      state.upcoming.view.mine = !state.upcoming.view.mine;
      const upPanel = $('#upcoming-filters');
      if (upPanel && state.upcoming.view.mine) upPanel.hidden = true;
      App.renderUpcoming();
    },

    'export-ics'() {
      const items = C.buildCalendarItems(state.notifications, state.epInfo);
      if (!items.length) { toast('Ближайших серий нет — нечего сохранять'); return; }
      const text = C.buildIcs(items);
      downloadText(text, 'anitier-episodes.ics', 'text/calendar');
      toast(`Календарь сохранён: ${items.length} ${plural(items.length, 'серия', 'серии', 'серий')}`);
    },

    'toggle-list-filters'({ el }) {
      const name = el.dataset.list === 'planned' ? 'planned' : 'watched';
      const panel = document.getElementById('list-filters-' + name);
      if (!panel) return;
      panel.hidden = !panel.hidden;
      el.setAttribute('aria-expanded', panel.hidden ? 'false' : 'true');
      el.classList.toggle('is-active', !panel.hidden || C.countActiveFilters(C.normalizeFilters((state.listViews[name] || {}).filters)) > 0);
    },

    'reset-list'({ el }) {
      const name = el.dataset.list === 'planned' ? 'planned' : 'watched';
      const previous = state.listViews[name] || {};
      state.listViews[name] = {
        query: '',
        filters: C.normalizeFilters(C.DEFAULT_FILTERS),
        sort: C.normalizeListSort(previous.sort),
      };
      saveState();
      renderTierList(name);
    },

    'retry-all'() {
      retryAll();
    },

    'close-modal'() {
      closeModal();
    },

    'open-backup'() {
      closeSettings();
      openBackup();
    },

    'open-settings'() {
      openSettings();
    },

    'open-stats'() {
      openStats();
    },

    'close-stats'() {
      closeStats();
    },

    'open-command'() {
      openCommand();
    },

    'close-command'() {
      closeCommand();
    },

    'command-open'({ el }) {
      openCommandResult(Number(el.dataset.index));
    },

    'close-settings'() {
      closeSettings();
    },

    'check-updates'() {
      checkForUpdates();
    },

    'update-allow'() {
      state.settings.updateCheck = 'on';
      state.settings.lastUpdateCheck = 0;
      state.updateCard = null;
      saveState();
      renderUpdateCard();
      toast('Проверяем обновления…');
      autoCheckUpdates({ announce: true });
    },

    'update-deny'() {
      state.settings.updateCheck = 'off';
      state.updateCard = null;
      saveState();
      renderUpdateCard();
    },

    'dismiss-update'() {
      if (state.updateCard && state.updateCard.mode === 'ask') {
        state.settings.updateCheck = 'off';
        saveState();
      }
      state.updateCard = null;
      renderUpdateCard();
    },

    'open-update'() {
      if (state.updateCard && state.updateCard.url) openExternalLink(state.updateCard.url);
      state.updateCard = null;
      renderUpdateCard();
    },

    'open-changelog'() {
      state.settingsScreen.view = 'changelog';
      renderSettings();
      const panel = $('#settings-panel');
      if (panel) panel.scrollTop = 0;
    },

    'settings-refresh-storage'() {
      refreshStorageInfo();
    },

    'copy-diagnostics'() {
      copyDiagnostics();
    },

    'settings-clear-cache'() {
      clearAppCache();
    },

    'settings-back'() {
      state.settingsScreen.view = 'main';
      renderSettings();
      const panel = $('#settings-panel');
      if (panel) panel.scrollTop = 0;
    },

    'open-link'({ el }) {
      openExternalLink(el.dataset.url);
    },

    'open-exchange'() {
      closeSettings();
      openExchange('export', state.tab === 'planned' ? 'planned' : 'watched');
    },

    'close-backup'() {
      closeBackup();
    },

    'backup-download'() {
      saveBackupFile();
    },

    'media-export'() {
      exportMediaFile();
    },

    'backup-drive-save'() {
      saveBackupToDrive();
    },

    'backup-drive-load'() {
      restoreFromDrive();
    },

    'new-custom'() {
      openCustomForm();
    },

    'edit-custom'({ id }) {
      openCustomForm(id);
    },

    'delete-custom'({ id }) {
      removeCustomCard(id);
    },

    'close-custom'() {
      closeCustomForm();
    },

    'moment-add'({ id }) {
      openMomentForm(id);
    },

    'close-moment'() {
      closeMomentForm();
    },

    'moment-mode'({ el }) {
      captureMomentDraft();
      state.momentForm.mode = el.dataset.mode === 'file' ? 'file' : 'tiktok';
      state.momentForm.error = '';
      renderMomentForm();
    },

    'moment-play'({ el, id }) {
      playMoment(id, el.dataset.moment, el);
    },

    'moment-share'({ el, id }) {
      shareMoment(id, el.dataset.moment);
    },

    'moment-delete'({ el, id }) {
      removeMomentAction(id, el.dataset.moment);
    },

    'exchange-export'({ el }) {
      openExchange('export', el.dataset.list || state.tab);
    },

    'exchange-import'() {
      openExchange('import', state.tab);
    },

    'exchange-mode'({ el }) {
      setExchangeMode(el.dataset.mode);
    },

    'exchange-import-pick'({ el }) {
      const input = $('#import-list-file');
      if (!input) return;
      state.exchange.importSource = ['mal', 'shikimori', 'anilist'].includes(el.dataset.source) ? el.dataset.source : 'shikimori';
      input.value = '';
      input.click();
    },

    'exchange-import-confirm'() {
      confirmImportList();
    },

    'exchange-import-cancel'() {
      cancelImportList();
    },

    'exchange-list'({ el }) {
      switchExchangeList(el.dataset.list);
    },

    'exchange-copy'() {
      copyShareCode();
    },

    'tier-png'({ el }) {
      exportTierPng(el.dataset.list || state.exchange.list);
    },

    'exchange-parse'() {
      parseImportCode();
    },

    'exchange-clear'() {
      clearExchangeCode();
    },

    'exchange-filter'({ el }) {
      state.exchange.filter = el.dataset.filter || 'all';
      renderExchange();
    },

    'exchange-add'({ id }) {
      addExchangeItem(id);
    },

    'close-exchange'() {
      closeExchange();
    },

    'random-db'() {
      const pool = state.db.items.filter(Boolean);
      if (!pool.length) {
        toast('Сначала загрузите базу');
        return;
      }
      openModal(pool[Math.floor(Math.random() * pool.length)].id);
    },

    'find-tag'({ el }) {
      findSimilarByTags([el.dataset.tag]);
    },

    'find-genre'({ el }) {
      findSimilarByGenre(el.dataset.genre);
    },

    'clear-tag-filter'() {
      state.db.filters = C.normalizeFilters({ ...state.db.filters, tags: [] });
      state.db.touched = true;
      syncFilterUI();
      persistCatalogPreferences();
      App.fetchDB(true);
      closeFilterMenus();
    },

    'stats-find-genre'({ el }) {
      if (typeof closeStats === 'function') closeStats();
      findSimilarByGenre(el.dataset.genre);
    },

    'stats-find-tag'({ el }) {
      if (typeof closeStats === 'function') closeStats();
      findSimilarByTags([el.dataset.tag]);
    },

    'find-similar'({ id }) {
      const anime = getAnime(id);
      findSimilarByTags(anime && Array.isArray(anime.tags) ? anime.tags.slice(0, 2) : []);
    },

    'find-more'() {
      switchTab('db');
      setTimeout(() => {
        const input = $('#search-input');
        if (input) { input.focus(); input.select(); }
      }, 80);
    },
  };
  function bindEvents() {
    if (eventsBound) return;
    eventsBound = true;

    document.addEventListener('error', (e) => {
      const img = e.target;
      if (!img || img.tagName !== 'IMG') return;
      if (typeof window.posterFallback === 'function') window.posterFallback(img);
    }, true);
    document.addEventListener('load', (e) => {
      const img = e.target;
      if (!img || img.tagName !== 'IMG' || !img.dataset || !img.dataset.posterSrc) return;
      if (typeof window.cachePoster === 'function') window.cachePoster(img);
    }, true);

    const scrollTopBtn = document.getElementById('scroll-top');
    if (scrollTopBtn && !scrollTopBtn.dataset.bound) {
      scrollTopBtn.dataset.bound = '1';
      scrollTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      window.addEventListener('scroll', () => {
        if (window.scrollY > 400) scrollTopBtn.classList.add('is-visible');
        else scrollTopBtn.classList.remove('is-visible');
      }, { passive: true });
    }
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
      if (Date.now() < suppressQuickClickUntil && e.target.closest && e.target.closest('.card, .notif')) {
        e.preventDefault();
        return;
      }
      const el = e.target.closest && e.target.closest('[data-action]');
      if (!el) return;
      const action = el.dataset.action;
      const id = el.dataset.id != null ? Number(el.dataset.id) : null;

      const handler = ACTION_HANDLERS[action];
      if (handler) handler({ e, el, id, action });
      else if (TEST_MODE) console.warn('AniTier: неизвестное действие', action);
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

    document.addEventListener('change', e => {
      const input = e.target;
      if (!input || input.dataset.action !== 'import-list-file') return;
      const file = input.files && input.files[0];
      input.value = '';
      importListFile(file);
    });

    const search = $('#search-input');
    if (search) {
      search.addEventListener('input', () => {
        clearTimeout(searchTimer);
        const val = search.value.trim();
        searchTimer = setTimeout(() => {
          state.db.query = val;
          state.db.touched = true;
          rememberSearch(val);
          persistCatalogPreferences();
          syncModeChips();
          App.fetchDB(true);
        }, 500);
      });
    }

    const langSelect = $('#search-lang');
    if (langSelect) {
      langSelect.addEventListener('change', () => {
        state.settings.searchLang = C.normalizeSearchLang(langSelect.value);
        saveState();
        syncLangUI();
        if (state.db.query.trim()) App.fetchDB(true);
      });
    }

    const filters = $('#db-filters');
    if (filters) {
      let filterTimer = 0;
      filters.addEventListener('change', () => {
        state.db.filters = readFiltersFromUI();
        state.db.touched = true;
        persistCatalogPreferences();
        syncModeChips();
        syncFilterUI();
        clearTimeout(filterTimer);
        filterTimer = setTimeout(() => App.fetchDB(true), 260);
      });
      filters.addEventListener('input', event => {
        if (event.target && event.target.matches && event.target.matches('.filter-menu-search input')) {
          const query = event.target.value.trim().toLowerCase();
          const panel = event.target.closest('[data-filter-panel]');
          if (!panel) return;
          panel.querySelectorAll('.filter-option').forEach(option => {
            const haystack = option.dataset.search || option.textContent.toLowerCase();
            option.hidden = Boolean(query) && !haystack.includes(query);
          });
          /* Пустые заголовки категорий не должны висеть над отфильтрованным списком. */
          panel.querySelectorAll('.filter-menu-group').forEach(group => {
            let node = group.nextElementSibling;
            let visible = false;
            while (node && !node.classList.contains('filter-menu-group')) {
              if (node.classList.contains('filter-option') && !node.hidden) { visible = true; break; }
              node = node.nextElementSibling;
            }
            group.hidden = !visible;
          });
          const scroll = panel.querySelector('.filter-menu-scroll');
          if (scroll) scroll.scrollTop = 0;
          return;
        }
        if (!event.target || event.target.id !== 'filter-score') return;
        const label = $('#filter-score-value');
        if (label) label.textContent = Number(event.target.value) > 0 ? `от ${event.target.value}` : 'Любой';
      });
    }

    document.addEventListener('click', event => {
      if (!event.target || !event.target.closest) return;
      if (event.target.closest('.filter-multi')) return;
      closeFilterMenus();
      /* Меню «⋯» закрывается по клику мимо, как и панели фильтров. */
      const more = document.querySelector('.db-more');
      if (more && !more.contains(event.target)) closeDBMoreMenu();
      /* Меню «⋯» в списках закрывается по клику мимо. */
      if (!event.target.closest('.list-more')) {
        $$('.list-more-menu').forEach(menu => { menu.hidden = true; });
        $$('.list-more-btn').forEach(btn => btn.setAttribute('aria-expanded', 'false'));
      }
      /* Меню «⋯» на «Скоро выйдут». */
      if (!event.target.closest('.upcoming-more')) {
        const menu = document.getElementById('upcoming-more-menu');
        if (menu && !menu.hidden) {
          menu.hidden = true;
          const btn = document.querySelector('[data-action="upcoming-more-menu"]');
          if (btn) btn.setAttribute('aria-expanded', 'false');
        }
      }
      /* Панели фильтров закрываются кликом мимо своей панели инструментов. */
      for (const name of ['watched', 'planned']) {
        const panel = document.getElementById('list-filters-' + name);
        if (!panel || panel.hidden) continue;
        const tools = panel.parentElement;
        if (tools && tools.contains(event.target)) continue;
        panel.hidden = true;
        const btn = document.querySelector(`[data-action="toggle-list-filters"][data-list="${name}"]`);
        if (btn) btn.setAttribute('aria-expanded', 'false');
      }
      const upcomingFilters = document.getElementById('upcoming-filters');
      if (upcomingFilters && !upcomingFilters.hidden
        && !(upcomingFilters.parentElement && upcomingFilters.parentElement.contains(event.target))) {
        upcomingFilters.hidden = true;
        const btn = document.querySelector('[data-action="toggle-upcoming-filters"]');
        if (btn) btn.setAttribute('aria-expanded', 'false');
      }
    });

    /* На телефоне клавиатура тоже присылает resize (высота), но меню
       с выбранными фильтрами из-за этого закрываться не должно.
       Закрываем только при смене ширины — это поворот экрана. */
    let filterMenusWidth = window.innerWidth;
    window.addEventListener('resize', () => {
      if (window.innerWidth === filterMenusWidth) return;
      filterMenusWidth = window.innerWidth;
      closeFilterMenus();
      closeDBMoreMenu();
      closeListFilterPanels();
      $$('.list-more-menu').forEach(menu => { menu.hidden = true; });
      $$('.list-more-btn').forEach(btn => btn.setAttribute('aria-expanded', 'false'));
    }, { passive: true });

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
      if (e.target && e.target.id === 'command-input' && state.command.open) {
        setCommandQuery(e.target.value);
        return;
      }
      if (e.target && e.target.id === 'changelog-search') {
        const query = e.target.value.trim().toLowerCase();
        document.querySelectorAll('.changelog-release').forEach(release => {
          release.hidden = Boolean(query) && !(release.dataset.search || '').includes(query);
        });
        return;
      }
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
      const settingsTitleLang = e.target.closest && e.target.closest('select[data-action="settings-title-lang"]');
      if (settingsTitleLang) applySettingsChange('titleLang', settingsTitleLang.value);
      const settingsSynopsisLang = e.target.closest && e.target.closest('select[data-action="settings-synopsis-lang"]');
      if (settingsSynopsisLang) applySettingsChange('synopsisLang', settingsSynopsisLang.value);
      const settingsProvider = e.target.closest && e.target.closest('select[data-action="settings-translation"]');
      if (settingsProvider) applySettingsChange('translationProvider', settingsProvider.value);
      const settingsTheme = e.target.closest && e.target.closest('select[data-action="settings-theme"]');
      if (settingsTheme) applySettingsChange('theme', settingsTheme.value);
      const settingsDensity = e.target.closest && e.target.closest('select[data-action="settings-density"]');
      if (settingsDensity) applySettingsChange('density', settingsDensity.value);
      const settingsFont = e.target.closest && e.target.closest('select[data-action="settings-font"]');
      if (settingsFont) applySettingsChange('fontSize', settingsFont.value);
      const driveAuto = e.target.closest && e.target.closest('select[data-action="settings-drive-auto"]');
      if (driveAuto) {
        state.settings.driveAutoBackup = driveAuto.value === 'on';
        if (state.settings.driveAutoBackup) state.settings.lastDriveBackupTry = 0;
        saveState();
        if (state.backup && state.backup.open) renderBackup();
        if (state.settings.driveAutoBackup) runAutoBackup();
        return;
      }
      const settingsUpdate = e.target.closest && e.target.closest('select[data-action="settings-update-check"]');
      if (settingsUpdate) {
        state.settings.updateCheck = normalizeUpdateCheck(settingsUpdate.value);
        state.settings.lastUpdateCheck = 0;
        state.updateCard = null;
        saveState();
        renderUpdateCard();
        if (state.settings.updateCheck === 'on') autoCheckUpdates({ announce: true });
        return;
      }
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
      const dbSort = e.target.closest && e.target.closest('select[data-db-sort]');
      if (dbSort) {
        state.db.sort = C.normalizeDBSort(dbSort.value);
        persistCatalogPreferences();
        App.fetchDB(true);
        return;
      }
      const listField = e.target.closest && e.target.closest('select[data-list-filter]');
      if (listField) {
        const tools = listField.closest('[data-list-tools]');
        const name = tools && tools.dataset.listTools === 'planned' ? 'planned' : 'watched';
        if (!state.listViews[name]) {
          state.listViews[name] = { query: '', filters: C.normalizeFilters(C.DEFAULT_FILTERS), sort: 'default' };
        }
        const view = state.listViews[name];
        view.filters = C.normalizeFilters({
          ...view.filters,
          [listField.dataset.listFilter]: listField.value,
        });
        saveState();
        renderTierList(name);
        return;
      }
      const listSort = e.target.closest && e.target.closest('select[data-list-sort]');
      if (listSort) {
        const tools = listSort.closest('[data-list-tools]');
        const name = tools && tools.dataset.listTools === 'planned' ? 'planned' : 'watched';
        if (!state.listViews[name]) {
          state.listViews[name] = { query: '', filters: C.normalizeFilters(C.DEFAULT_FILTERS), sort: 'default' };
        }
        state.listViews[name].sort = C.normalizeListSort(listSort.value);
        saveState();
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
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        if (state.command.open) closeCommand();
        else openCommand();
        return;
      }
      if (state.command.open) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          moveCommand(1);
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          moveCommand(-1);
          return;
        }
        if (e.key === 'Home') {
          e.preventDefault();
          jumpCommand('first');
          return;
        }
        if (e.key === 'End') {
          e.preventDefault();
          jumpCommand('last');
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          openCommandResult(state.command.index);
          return;
        }
      }
      /* Стрелки внутри полосы вкладок переключают разделы, как в ARIA Tabs. */
      const tablist = e.target && e.target.closest ? e.target.closest('.tabs') : null;
      if (tablist && (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'Home' || e.key === 'End')) {
        const tabs = [...tablist.querySelectorAll('.tab')];
        const current = tabs.findIndex(tab => tab === e.target.closest('.tab'));
        if (current >= 0) {
          e.preventDefault();
          let next = current;
          if (e.key === 'Home') next = 0;
          else if (e.key === 'End') next = tabs.length - 1;
          else {
            const step = e.key === 'ArrowRight' ? 1 : -1;
            next = (current + step + tabs.length) % tabs.length;
          }
          tabs[next].focus();
          switchTab(tabs[next].dataset.tab);
          return;
        }
      }
      /* Стрелки в табах карточки тайтла — как в ARIA Tabs. */
      const modalTabsRow = e.target && e.target.closest ? e.target.closest('.modal-tabs') : null;
      if (modalTabsRow && (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'Home' || e.key === 'End')) {
        const modalTabs = [...modalTabsRow.querySelectorAll('.modal-tab')];
        const current = modalTabs.findIndex(node => node === e.target.closest('.modal-tab'));
        if (current >= 0) {
          e.preventDefault();
          let next = current;
          if (e.key === 'Home') next = 0;
          else if (e.key === 'End') next = modalTabs.length - 1;
          else {
            const step = e.key === 'ArrowRight' ? 1 : -1;
            next = (current + step + modalTabs.length) % modalTabs.length;
          }
          switchModalTab(modalTabs[next].dataset.tab, { focus: true });
          return;
        }
      }
      /* Фокус не уходит за пределы открытого диалога: Tab по кругу внутри шторки. */
      if (e.key === 'Tab') {
        const dialogs = [...document.querySelectorAll('[role="dialog"]')];
        const dialog = dialogs.reverse().find(node => {
          const host = node.closest('.modal');
          return host ? !host.hidden : node.getClientRects().length > 0;
        });
        if (dialog) {
          const focusables = [...dialog.querySelectorAll(
            'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          )].filter(node => node.getClientRects().length > 0);
          if (focusables.length) {
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            const active = document.activeElement;
            const inside = dialog.contains(active);
            if (e.shiftKey && (!inside || active === first)) {
              e.preventDefault();
              last.focus();
              return;
            }
            if (!e.shiftKey && (!inside || active === last)) {
              e.preventDefault();
              first.focus();
              return;
            }
          }
        }
      }

      if (e.key === 'Escape') {
        if (document.querySelector('#db-filters [data-filter-panel]:not([hidden])')) {
          closeFilterMenus();
          return;
        }
        if (['list-filters-watched', 'list-filters-planned', 'upcoming-filters']
          .some(id => { const node = document.getElementById(id); return node && !node.hidden; })) {
          closeListFilterPanels();
          return;
        }
        if ($('.db-more-menu:not([hidden])')) {
          closeDBMoreMenu();
          return;
        }
        if ($('.list-more-menu:not([hidden])')) {
          $$('.list-more-menu').forEach(menu => { menu.hidden = true; });
          $$('.list-more-btn').forEach(btn => btn.setAttribute('aria-expanded', 'false'));
          return;
        }
        if ($('.upcoming-more-menu:not([hidden])')) {
          $$('.upcoming-more-menu').forEach(menu => { menu.hidden = true; });
          const btn = document.querySelector('[data-action="upcoming-more-menu"]');
          if (btn) btn.setAttribute('aria-expanded', 'false');
          return;
        }
        if (state.quickMenu) {
          closeQuickMenu();
          return;
        }
        if (state.command.open) {
          closeCommand();
          return;
        }
        if (state.tiktokImport.open) {
          closeTikTokImport();
          return;
        }
        if (state.statsScreen && state.statsScreen.open) {
          closeStats();
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
      /* Alt+↑/↓ переносит карточку тир-листа в соседний тир — правка без мыши. */
      if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && e.altKey && !e.ctrlKey && !e.metaKey) {
        const tierCard = e.target && e.target.closest ? e.target.closest('.tier-card') : null;
        if (tierCard) {
          e.preventDefault();
          const list = tierCard.dataset.list;
          const id = Number(tierCard.dataset.id);
          const from = TIER_IDS.indexOf(tierCard.dataset.tier);
          const step = e.key === 'ArrowUp' ? -1 : 1;
          const to = Math.max(0, Math.min(TIER_IDS.length - 1, from + step));
          if (from < 0 || to === from) return;
          moveToTier(list, id, TIER_IDS[to]);
          const target = TIERS[to];
          toast(`Перенесено: ${target.label === '?' ? 'без оценки' : `тир ${target.label}`} · ${target.name}`);
          const moved = document.querySelector(`.tier-card[data-list="${list}"][data-id="${id}"]`);
          if (moved) moved.focus({ preventScroll: true });
          return;
        }
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

    window.addEventListener('hashchange', () => {
      applyLocationHash();
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
      App.fetchDB();
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
      await Promise.allSettled([App.fetchNotifications(true), App.fetchUpcoming(true)]);
      await App.fetchDB(true);
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
      await Promise.allSettled([App.fetchNotifications(), App.fetchUpcoming()]);
      if (!state.db.touched) await App.fetchDB(true);
    } finally {
      state.booting = false;
      state.bootstrapDone = true;
      renderDB();
      applyPendingHashModal();
      scheduleDailySync();
      if (dailySyncIsDue()) runDailySync();
      if (!TEST_MODE) setTimeout(() => { autoCheckUpdates(); }, 1500);
      if (!TEST_MODE) setTimeout(() => { runAutoBackup(); }, 3000);
    }
  }

  async function init() {
    installDiagnostics();
    state.booting = true;
    if (!localStorage.getItem(DAILY_SYNC_KEY)) {
      const now = new Date();
      const initialMark = now.getHours() >= 3 ? localDayKey(now) : localDayKey(new Date(now.getTime() - 86400000));
      localStorage.setItem(DAILY_SYNC_KEY, initialMark);
    }
    loadState();
    loadMoments();
    migrateLocalThumbnails().then((res) => {
      if (res && (res.migratedCards || res.migratedMoments)) refreshViews();
    }).catch((err) => console.warn('migrateLocalThumbnails', err));
    renderSearchHistory();
    if (typeof App.applyAppearance === 'function') App.applyAppearance();
    initFilterOptions();
    restoreCatalogPreferences();
    syncLangUI();
    bindEvents();
    bindGestures();
    setupInfiniteScroll();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && dailySyncIsDue()) runDailySync();
      if (document.visibilityState === 'visible') runAutoBackup();
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
    const commandModal = $('#command-modal');
    if (commandModal) commandModal.hidden = true;

    applyLocationHash();

    consumeSharedLink();
    App.enrichRussianTitles();
    return bootstrap();
  }

  /* ---------------- напоминания на телефоне ---------------- */

  /* Вызывается из MainActivity после ответа на запрос разрешений. */

  /* ---------------- проверка обновлений ---------------- */

  /* Карточка «доступно обновление»: в APK ведём сразу на APK, в браузере — на релиз. */

  /* При запуске: спросить разрешение один раз или проверить молча. */

  /* Ссылки: в APK открываем системным браузером через мост, в браузере — новой вкладкой. */

  /* Системная кнопка «назад» в Android: сначала закрываем слои интерфейса. */
  function handleAndroidBack() {
    if (state.quickMenu) { closeQuickMenu(); return true; }
    if (state.command.open) { closeCommand(); return true; }
    if (state.tiktokImport.open) { closeTikTokImport(); return true; }
    if (state.statsScreen && state.statsScreen.open) { closeStats(); return true; }
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
    if (state.updateCard) {
      if (state.updateCard.mode === 'ask') {
        state.settings.updateCheck = 'off';
        saveState();
      }
      state.updateCard = null;
      renderUpdateCard();
      return true;
    }
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
    buildDiagnosticsReport,
    readTextFile,
    restoreCatalogPreferences,
    copyDiagnostics,
    sanitizeDiagText,
    diagState,
    fetchDB: App.fetchDB,
    fetchNotifications: App.fetchNotifications,
    fetchUpcoming: App.fetchUpcoming,
    enrichRussianTitles: App.enrichRussianTitles,
    refreshCurrent,
    retryAll,
    saveCustomForm,
    removeCustomCard,
    hydrateCustomImage,

    openCustomForm,
    closeCustomForm,
    openMomentForm,
    closeMomentForm,

    openBackup,
    closeBackup,
    buildTierListPngBlob,
    exportTierPng,
    persistCatalogPreferences,
    buildBackupPayload,
    applyBackupData,
    handleAndroidBack,

    renderUpdateCard,

    openSettings,
    closeSettings,
    openStats,
    closeStats,
    openCommand,
    closeCommand,
    setCommandQuery,
    moveCommand,
    jumpCommand,
    openCommandResult,
    renderSettings,
    scrollPageBy,

    renderSearchHistory,
    translateModalSynopsis,
    init,
  });

  if (TEST_MODE) {
    const call = (name, local) => (...a) => (local || App[name] || (() => {}))(...a);
    window.__anitierTest = {
      state, init,
      actionHandlers: ACTION_HANDLERS,
      fetchAniList: call('fetchAniList', typeof fetchAniList !== 'undefined' ? fetchAniList : undefined),
      fetchRussianTitles: call('fetchRussianTitles', App.fetchRussianTitles),
      enrichRussianTitles: call('enrichRussianTitles'),
      autoBackupDue: call('autoBackupDue', typeof autoBackupDue !== 'undefined' ? autoBackupDue : undefined),
      runAutoBackup: call('runAutoBackup', typeof runAutoBackup !== 'undefined' ? runAutoBackup : undefined),
      openQuickMenu: call('openQuickMenu', typeof openQuickMenu !== 'undefined' ? openQuickMenu : undefined),
      closeQuickMenu: call('closeQuickMenu', typeof closeQuickMenu !== 'undefined' ? closeQuickMenu : undefined),
      fetchAnimeRelations: call('fetchAnimeRelations', App.fetchAnimeRelations),
      clearPersistentApiCache: call('clearPersistentApiCache', typeof clearPersistentApiCache !== 'undefined' ? clearPersistentApiCache : undefined),
      clearMemoryApiCache: (...a) => (App.clearAniListCache || (typeof clearAniListCache !== 'undefined' ? clearAniListCache : null) || (() => {}))(...a),
      withCacheReload: call('withCacheReload', typeof withCacheReload !== 'undefined' ? withCacheReload : undefined),
      dailySyncIsDue: call('dailySyncIsDue', typeof dailySyncIsDue !== 'undefined' ? dailySyncIsDue : undefined),
      runDailySync: call('runDailySync', typeof runDailySync !== 'undefined' ? runDailySync : undefined),
      persistCatalogPreferences: call('persistCatalogPreferences', typeof persistCatalogPreferences !== 'undefined' ? persistCatalogPreferences : undefined),
      fetchDB: call('fetchDB'), fetchNotifications: call('fetchNotifications'), fetchUpcoming: call('fetchUpcoming'),
      fetchRecentScheduleEvents: call('fetchRecentScheduleEvents', typeof fetchRecentScheduleEvents !== 'undefined' ? fetchRecentScheduleEvents : undefined),
      resetDBFilters: call('resetDBFilters', typeof resetDBFilters !== 'undefined' ? resetDBFilters : undefined),
      syncFilterUI: call('syncFilterUI', typeof syncFilterUI !== 'undefined' ? syncFilterUI : undefined),
      syncLangUI: call('syncLangUI', typeof syncLangUI !== 'undefined' ? syncLangUI : undefined),
      resolveSearchQuery: call('resolveSearchQuery', typeof resolveSearchQuery !== 'undefined' ? resolveSearchQuery : undefined),
      searchQueryForAlt: call('searchQueryForAlt', typeof searchQueryForAlt !== 'undefined' ? searchQueryForAlt : undefined),
      translateText: call('translateText', typeof translateText !== 'undefined' ? translateText : undefined),
      translateModalSynopsis: call('translateModalSynopsis', typeof translateModalSynopsis !== 'undefined' ? translateModalSynopsis : undefined),
      receiveSharedTikTok: call('receiveSharedTikTok', typeof receiveSharedTikTok !== 'undefined' ? receiveSharedTikTok : undefined),
      openTikTokSearch: call('openTikTokSearch', typeof openTikTokSearch !== 'undefined' ? openTikTokSearch : undefined),
      invalidateNotificationEpisodes: call('invalidateNotificationEpisodes', typeof invalidateNotificationEpisodes !== 'undefined' ? invalidateNotificationEpisodes : undefined),
      openStats: call('openStats', typeof openStats !== 'undefined' ? openStats : undefined),
      closeStats: call('closeStats', typeof closeStats !== 'undefined' ? closeStats : undefined),
      openCommand: call('openCommand', typeof openCommand !== 'undefined' ? openCommand : undefined),
      closeCommand: call('closeCommand', typeof closeCommand !== 'undefined' ? closeCommand : undefined),
      setCommandQuery: call('setCommandQuery', typeof setCommandQuery !== 'undefined' ? setCommandQuery : undefined),
      moveCommand: call('moveCommand', typeof moveCommand !== 'undefined' ? moveCommand : undefined),
      openCommandResult: call('openCommandResult', typeof openCommandResult !== 'undefined' ? openCommandResult : undefined),
      openExchange: call('openExchange', typeof openExchange !== 'undefined' ? openExchange : undefined),
      closeExchange: call('closeExchange', typeof closeExchange !== 'undefined' ? closeExchange : undefined),
      setExchangeMode: call('setExchangeMode', typeof setExchangeMode !== 'undefined' ? setExchangeMode : undefined),
      switchExchangeList: call('switchExchangeList', typeof switchExchangeList !== 'undefined' ? switchExchangeList : undefined),
      parseImportCode: call('parseImportCode', typeof parseImportCode !== 'undefined' ? parseImportCode : undefined),
      addExchangeItem: call('addExchangeItem', typeof addExchangeItem !== 'undefined' ? addExchangeItem : undefined),
      importListFile: call('importListFile', typeof importListFile !== 'undefined' ? importListFile : undefined),
      confirmImportList: call('confirmImportList', typeof confirmImportList !== 'undefined' ? confirmImportList : undefined),
      cancelImportList: call('cancelImportList', typeof cancelImportList !== 'undefined' ? cancelImportList : undefined),
      renderExchange: call('renderExchange', typeof renderExchange !== 'undefined' ? renderExchange : undefined),
      saveCustomForm: call('saveCustomForm', typeof saveCustomForm !== 'undefined' ? saveCustomForm : undefined),
      removeCustomCard: call('removeCustomCard', typeof removeCustomCard !== 'undefined' ? removeCustomCard : undefined),
      saveMomentForm: call('saveMomentForm', typeof saveMomentForm !== 'undefined' ? saveMomentForm : undefined),
      removeMomentAction: call('removeMomentAction', typeof removeMomentAction !== 'undefined' ? removeMomentAction : undefined),
      openCustomForm: call('openCustomForm', typeof openCustomForm !== 'undefined' ? openCustomForm : undefined),
      closeCustomForm: call('closeCustomForm', typeof closeCustomForm !== 'undefined' ? closeCustomForm : undefined),
      openMomentForm: call('openMomentForm', typeof openMomentForm !== 'undefined' ? openMomentForm : undefined),
      closeMomentForm: call('closeMomentForm', typeof closeMomentForm !== 'undefined' ? closeMomentForm : undefined),
      openBackup: call('openBackup', typeof openBackup !== 'undefined' ? openBackup : undefined),
      closeBackup: call('closeBackup', typeof closeBackup !== 'undefined' ? closeBackup : undefined),
      restoreBackupText: call('restoreBackupText', typeof restoreBackupText !== 'undefined' ? restoreBackupText : undefined),
      exportMediaFile: call('exportMediaFile', typeof exportMediaFile !== 'undefined' ? exportMediaFile : undefined),
      buildMediaArchive: call('buildMediaArchive', typeof buildMediaArchive !== 'undefined' ? buildMediaArchive : undefined),
      androidSaveMedia: call('androidSaveMedia', typeof androidSaveMedia !== 'undefined' ? androidSaveMedia : undefined),
      buildTierListPngBlob: call('buildTierListPngBlob', typeof buildTierListPngBlob !== 'undefined' ? buildTierListPngBlob : undefined),
      exportTierPng: call('exportTierPng', typeof exportTierPng !== 'undefined' ? exportTierPng : undefined),
      tierPngTitle: call('tierPngTitle', typeof tierPngTitle !== 'undefined' ? tierPngTitle : undefined),
      mapWithLimit: call('mapWithLimit', typeof mapWithLimit !== 'undefined' ? mapWithLimit : undefined),
      cachePosterImage: call('cachePosterImage', typeof cachePosterImage !== 'undefined' ? cachePosterImage : undefined),
      shrinkPoster: call('shrinkPoster', typeof shrinkPoster !== 'undefined' ? shrinkPoster : undefined),
      queuePosterCache: call('queuePosterCache', typeof queuePosterCache !== 'undefined' ? queuePosterCache : undefined),
      posterQueueStats: call('posterQueueStats', typeof posterQueueStats !== 'undefined' ? posterQueueStats : undefined),
      importMediaFile: call('importMediaFile', typeof importMediaFile !== 'undefined' ? importMediaFile : undefined),
      buildBackupPayload: call('buildBackupPayload', typeof buildBackupPayload !== 'undefined' ? buildBackupPayload : undefined),
      applyBackupData: call('applyBackupData', typeof applyBackupData !== 'undefined' ? applyBackupData : undefined),
      driveAvailable: call('driveAvailable', typeof driveAvailable !== 'undefined' ? driveAvailable : undefined),
    };
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { init(); });
  } else {
    init();
  }
  } catch (e) {
    App.__bootError = (e && e.message ? e.message : String(e)) + '\n' + (e && e.stack ? e.stack : '');
    try { console.error('AniTier boot', e); } catch {}
  }
})(window.AniTier);
