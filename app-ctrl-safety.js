/* ============================================================
   AniTier — страховочная копия в памяти приложения и перенос данных
   из прошлых сборок. Работает только в APK: в браузере моста нет.
   ============================================================ */
(function (App) {
  'use strict';
  const C = window.AniTierCore;
  const LS_KEY = 'anitier.v1';
  const RESTORED_KEY = 'anitier.restored.v1';
  const SAVE_GAP_MS = 4000;

  let bridgeRef = null;
  let saveTimer = 0;
  let lastSavedAt = 0;
  let infoCache = null;
  let legacyInfoCache;

  function bridge() {
    if (bridgeRef) return bridgeRef;
    const candidate = window.AniTierAndroid;
    if (!candidate
      || typeof candidate.saveSnapshot !== 'function'
      || typeof candidate.loadSnapshot !== 'function') return null;
    bridgeRef = candidate;
    return bridgeRef;
  }

  function safetyAvailable() {
    return Boolean(bridge());
  }

  function collectItems() {
    const items = {};
    for (const key of C.SAFETY_KEYS) {
      const value = localStorage.getItem(key);
      if (value) items[key] = value;
    }
    return items;
  }

  function snapshotCards(items) {
    return C.countSnapshotCards(items && items[LS_KEY] ? items[LS_KEY] : '');
  }

  function saveSnapshotNow() {
    const api = bridge();
    if (!api) return false;
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = 0; }
    try {
      const snapshot = C.makeSafetySnapshot(collectItems(), Date.now());
      if (!Object.keys(snapshot.items).length) return false;
      if (!api.saveSnapshot(JSON.stringify(snapshot))) return false;
      lastSavedAt = snapshot.savedAt;
      infoCache = { savedAt: lastSavedAt, cards: snapshotCards(snapshot.items), bytes: 0 };
      return true;
    } catch (err) {
      console.warn('saveSnapshot', err);
      return false;
    }
  }

  function saveSnapshotSoon() {
    if (!bridge()) return;
    if (saveTimer) return;
    const wait = Math.max(0, SAVE_GAP_MS - (Date.now() - lastSavedAt));
    saveTimer = setTimeout(() => {
      saveTimer = 0;
      saveSnapshotNow();
    }, wait);
  }

  function readSnapshot() {
    const api = bridge();
    if (!api) return null;
    try {
      const text = api.loadSnapshot();
      if (!text) return null;
      return C.parseSafetySnapshot(text);
    } catch (err) {
      console.warn('loadSnapshot', err);
      return null;
    }
  }

  /* Дата и число карточек для карточки в настройках. */
  function safetySnapshotInfo() {
    if (!bridge()) return null;
    if (infoCache) return infoCache;
    const snapshot = readSnapshot();
    infoCache = snapshot
      ? { savedAt: snapshot.savedAt, cards: snapshot.cards, bytes: 0 }
      : { savedAt: 0, cards: 0, bytes: 0 };
    return infoCache;
  }

  function writeItems(items) {
    let written = 0;
    const failed = [];
    for (const key of C.SAFETY_KEYS) {
      const value = items && items[key];
      if (typeof value !== 'string' || !value) continue;
      try {
        localStorage.setItem(key, value);
        written++;
      } catch (err) {
        failed.push(key);
        console.warn('restore', err);
      }
    }
    /* Главное — состояние списков: без него восстановление не считается. */
    let stateOk = false;
    try {
      stateOk = Boolean(items[LS_KEY]) && localStorage.getItem(LS_KEY) === items[LS_KEY];
    } catch {
      stateOk = false;
    }
    return { ok: stateOk, written, failed };
  }

  function markRestored(kind) {
    try { localStorage.setItem(RESTORED_KEY, kind); } catch { /* не критично */ }
    infoCache = null;
    /* Запись из памяти при выгрузке страницы перезаписала бы
       восстановленные данные старым состоянием. */
    App._suppressStateSave = true;
    if (!App._testNoReload) location.reload();
    return true;
  }

  /* До загрузки состояния: сохранения нет, а копия есть — возвращаем копию. */
  function recoverOnBoot() {
    if (!bridge()) return false;
    try {
      if (localStorage.getItem(LS_KEY)) return false;
    } catch {
      return false;
    }
    const snapshot = readSnapshot();
    if (!snapshot || !snapshot.cards) return false;
    if (!writeItems(snapshot.items).ok) return false;
    return markRestored('snapshot');
  }

  /* Данные из старой сборки (адрес file://) присылает MainActivity. */
  function receiveLegacyData(json) {
    if (!json) return false;
    let items = null;
    try { items = JSON.parse(json); } catch { return false; }
    if (!items || typeof items !== 'object' || !snapshotCards(items)) return false;
    let empty = false;
    try { empty = !localStorage.getItem(LS_KEY); } catch { empty = false; }
    if (!empty) {
      /* В текущем хранилище уже есть данные — предлагаем вернуть старые вручную. */
      if (typeof App.toast === 'function') {
        App.toast('Нашли данные прошлой версии — их можно вернуть в «Резервной копии»');
      }
      return false;
    }
    if (!writeItems(items).ok) return false;
    clearLegacyFile();
    legacyInfoCache = null;
    return markRestored('legacy');
  }

  function readLegacyItems() {
    const api = bridge();
    if (!api || typeof api.loadLegacyData !== 'function') return null;
    try {
      const text = api.loadLegacyData();
      if (!text) return null;
      const items = JSON.parse(text);
      if (!items || typeof items !== 'object') return null;
      return snapshotCards(items) ? items : null;
    } catch {
      return null;
    }
  }

  function clearLegacyFile() {
    const api = bridge();
    if (!api || typeof api.clearLegacyData !== 'function') return;
    try { api.clearLegacyData(); } catch { /* не критично */ }
  }

  /* Сырые данные прошлой сборки: нужны для ручного разбора и отладки. */
  function legacyRawText() {
    const api = bridge();
    if (!api || typeof api.loadLegacyData !== 'function') return '';
    try { return api.loadLegacyData() || ''; } catch { return ''; }
  }

  /* Для карточки в резервной копии: есть ли что возвращать из прошлой сборки. */
  function legacyBackupInfo() {
    if (!bridge()) return null;
    if (legacyInfoCache !== undefined) return legacyInfoCache;
    const items = readLegacyItems();
    legacyInfoCache = items ? { cards: snapshotCards(items) } : null;
    return legacyInfoCache;
  }

  function restoreLegacyManually() {
    const items = readLegacyItems();
    if (!items) {
      if (typeof App.setBackupMessage === 'function') App.setBackupMessage('Данных прошлой версии больше нет.', true);
      return false;
    }
    if (!window.confirm('Вернуть списки из прошлой версии приложения? Текущие списки, прогресс и настройки будут заменены.')) {
      return false;
    }
    const result = writeItems(items);
    if (!result.ok) {
      if (typeof App.setBackupMessage === 'function') {
        App.setBackupMessage('Не удалось записать списки: в хранилище не хватило места. Копия прошлой версии сохранена — попробуйте ещё раз.', true);
      }
      return false;
    }
    clearLegacyFile();
    legacyInfoCache = null;
    return markRestored('legacy');
  }

  /* Сообщение после перезагрузки: откуда вернулись данные. */
  function announceRestore() {
    let kind = '';
    try { kind = localStorage.getItem(RESTORED_KEY) || ''; } catch { return; }
    if (!kind) return;
    try { localStorage.removeItem(RESTORED_KEY); } catch { /* не критично */ }
    if (typeof App.toast !== 'function') return;
    App.toast(kind === 'legacy'
      ? 'Вернули списки из прошлой версии приложения'
      : 'Восстановили данные из страховочной копии');
  }

  function saveSnapshotManually() {
    const ok = saveSnapshotNow();
    if (typeof App.setBackupMessage === 'function') {
      App.setBackupMessage(ok ? 'Страховочная копия обновлена.' : 'Не удалось сохранить страховочную копию.', !ok);
    }
    return ok;
  }

  function restoreSnapshotManually() {
    const snapshot = readSnapshot();
    if (!snapshot || !snapshot.cards) {
      if (typeof App.setBackupMessage === 'function') App.setBackupMessage('Страховочная копия пуста.', true);
      return false;
    }
    if (!window.confirm('Восстановить страховочную копию? Текущие списки, прогресс и настройки будут заменены.')) {
      return false;
    }
    if (!writeItems(snapshot.items).ok) {
      if (typeof App.setBackupMessage === 'function') {
        App.setBackupMessage('Не удалось записать страховочную копию: в хранилище не хватило места.', true);
      }
      return false;
    }
    return markRestored('snapshot');
  }

  function bindSafetyLifecycle() {
    if (!bridge()) return;
    saveSnapshotSoon();
    window.addEventListener('pagehide', () => { saveSnapshotNow(); });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') saveSnapshotNow();
    });
  }

  /* Вызывается после каждой записи состояния в localStorage. */
  function onStatePersisted() {
    saveSnapshotSoon();
  }

  Object.assign(App, {
    safetyAvailable,
    safetySnapshotInfo,
    saveSnapshotNow,
    saveSnapshotSoon,
    saveSnapshotManually,
    restoreSnapshotManually,
    recoverOnBoot,
    receiveLegacyData,
    legacyBackupInfo,
    legacyRawText,
    restoreLegacyManually,
    announceRestore,
    bindSafetyLifecycle,
    onStatePersisted,
  });
})(window.AniTier);
