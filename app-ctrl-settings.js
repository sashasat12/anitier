/* ============================================================
   AniTier — контроллер настроек и обновлений (выделено из app.js)
   ============================================================ */
(function (App) {
  'use strict';
  const C = window.AniTierCore;
  const state = App.state;
  const $ = (...a) => App.$(...a);
  const toast = (...a) => App.toast(...a);
  const renderSettings = (...a) => App.renderSettings(...a);
  const renderUpdateCard = (...a) => App.renderUpdateCard(...a);
  const renderNotifications = (...a) => App.renderNotifications(...a);
  const saveState = (...a) => App.saveState(...a);
  const closeSettings = (...a) => App.closeSettings(...a);
  const syncLangUI = (...a) => App.syncLangUI(...a);
  const applyAppearance = (...a) => App.applyAppearance(...a);
  const normalizeUpdateCheck = (v) => (App.normalizeUpdateCheck ? App.normalizeUpdateCheck(v) : v);
  const clearPosterStore = (...a) => App.clearPosterStore(...a);


  const UPDATE_CHECK_INTERVAL = 12 * 3600000;

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

  function onReleaseNotificationPermissionResult(enabled) {
    if (state.tab === 'notifications') renderNotifications();
    if (state.settingsScreen && state.settingsScreen.open) renderSettings();
    toast(enabled ? 'Напоминания о сериях включены' : 'Напоминания о сериях выключены');
    if (enabled) syncReleaseNotifications();
  }

  function showUpdateAvailable(release) {
    const bridge = releaseBridge();
    const apk = Boolean(bridge && typeof bridge.openUrl === 'function');
    const base = String(C.GITHUB_URL || '').replace(/\/+$/, '');
    state.updateCard = {
      mode: 'available',
      release,
      apk,
      url: apk ? `${base}/releases/latest/download/AniTier.apk` : (release.url || base),
    };
    renderUpdateCard();
  }

  async function autoCheckUpdates(options) {
    const announce = Boolean(options && options.announce);
    const mode = normalizeUpdateCheck(state.settings.updateCheck);
    if (mode === 'ask') {
      state.updateCard = { mode: 'ask' };
      renderUpdateCard();
      return;
    }
    if (mode !== 'on') return;

    const last = Number(state.settings.lastUpdateCheck) || 0;
    if (!announce && Date.now() - last < UPDATE_CHECK_INTERVAL) return;
    state.settings.lastUpdateCheck = Date.now();
    saveState();

    try {
      if (typeof App.fetchLatestRelease !== 'function') return;
      const release = await App.fetchLatestRelease();
      if (C.compareVersions(release.version, C.APP_VERSION) > 0) showUpdateAvailable(release);
      else if (announce) toast(`У вас последняя версия ${C.APP_VERSION}.`);
    } catch (err) {
      if (announce) toast(err && err.message ? err.message : 'Не удалось проверить обновления');
      /* нет сети или GitHub недоступен — молча ждём следующего запуска */
    }
  }

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
      if (diff > 0) {
        screen.message = `Доступна версия ${release.version}, у вас ${current}.`;
        showUpdateAvailable(release);
      } else if (diff < 0) screen.message = `У вас версия ${current}, на GitHub опубликована ${release.version}.`;
      else screen.message = `У вас последняя версия ${current}.`;
    } catch (err) {
      screen.error = true;
      screen.message = err && err.message ? err.message : 'Не удалось проверить обновления';
    } finally {
      screen.checking = false;
      if (screen.open) renderSettings();
    }
  }

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

  function applySettingsChange(kind, value) {
    if (kind === 'searchLang') {
      state.settings.searchLang = C.normalizeSearchLang(value);
      syncLangUI();
    } else if (kind === 'titleLang') {
      state.settings.titleLang = value === 'original' ? 'original' : 'ru';
      if (typeof App.refreshViews === 'function') App.refreshViews();
    } else if (kind === 'synopsisLang') {
      state.settings.synopsisLang = value === 'original' ? 'original' : 'translated';
      if (state.modalId != null) renderModal();
    } else if (kind === 'theme') {
      state.settings.theme = value === 'amoled' ? 'amoled' : 'dark';
      if (typeof App.applyAppearance === 'function') App.applyAppearance();
    } else if (kind === 'density') {
      state.settings.density = value === 'compact' ? 'compact' : 'comfortable';
      if (typeof App.applyAppearance === 'function') App.applyAppearance();
      if (typeof App.refreshViews === 'function') App.refreshViews();
    } else if (kind === 'fontSize') {
      state.settings.fontSize = ['small', 'large'].includes(value) ? value : 'normal';
      if (typeof App.applyAppearance === 'function') App.applyAppearance();
    } else if (kind === 'translationProvider') {
      state.settings.translationProvider = ['mymemory', 'google'].includes(value) ? value : 'auto';
    } else {
      return;
    }
    saveState();
    if (state.settingsScreen && state.settingsScreen.open) renderSettings();
  }

  async function refreshStorageInfo() {
    const screen = state.settingsScreen;
    if (!screen || !screen.open) return;
    screen.storageBusy = true;
    renderSettings();
    try {
      let text = 'недоступно';
      if (navigator.storage && navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        const used = Number(est.usage) || 0;
        const quota = Number(est.quota) || 0;
        text = quota ? `${C.formatBytes(used)} из ${C.formatBytes(quota)}` : C.formatBytes(used);
      }
      screen.storageText = text;
    } catch {
      screen.storageText = 'не удалось определить';
    } finally {
      screen.storageBusy = false;
      if (screen.open) renderSettings();
    }
  }

  async function clearAppCache() {
    const screen = state.settingsScreen;
    if (!window.confirm('Очистить кэш API и постеров? Списки, прогресс, карточки и моменты останутся.')) return;
    if (screen) { screen.cacheBusy = true; screen.cacheMessage = ''; screen.cacheError = false; renderSettings(); }
    try {
      if (App.clearAniListCache) App.clearAniListCache();
      if (App.clearPersistentApiCache) await App.clearPersistentApiCache();
      if (clearPosterStore) await clearPosterStore();
      if (screen) { screen.cacheMessage = 'Кэш очищен. Данные списков и прогресс сохранены.'; screen.cacheError = false; }
      toast('Кэш очищен');
    } catch (err) {
      if (screen) { screen.cacheMessage = (err && err.message) ? err.message : 'Не удалось очистить кэш.'; screen.cacheError = true; }
    } finally {
      if (screen) { screen.cacheBusy = false; if (screen.open) renderSettings(); }
      refreshStorageInfo();
    }
  }

  Object.assign(App, {
    releaseBridge,
    releaseNotificationsEnabled,
    syncReleaseNotifications,
    toggleReleaseNotifications,
    onReleaseNotificationPermissionResult,
    showUpdateAvailable,
    autoCheckUpdates,
    checkForUpdates,
    openExternalLink,
    applySettingsChange,
    refreshStorageInfo,
    clearAppCache,
  });
})(window.AniTier);
