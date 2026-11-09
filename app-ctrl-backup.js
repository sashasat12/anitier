/* ============================================================
   AniTier — контроллер резервных копий, медиаархива и Google Drive (выделено из app.js)
   ============================================================ */
(function (App) {
  'use strict';
  const C = window.AniTierCore;
  const state = App.state;
  const toast = (...a) => App.toast(...a);
  const renderBackup = (...a) => App.renderBackup(...a);
  const saveState = (...a) => App.saveState(...a);
  const updateBell = (...a) => App.updateBell(...a);
  const syncLangUI = (...a) => App.syncLangUI(...a);
  const readTextFile = (...a) => App.readTextFile(...a);
  const restoreCatalogPreferences = (...a) => App.restoreCatalogPreferences(...a);
  const buildBackupPayload = (...a) => App.buildBackupPayload(...a);
  const applyBackupData = (...a) => App.applyBackupData(...a);
  const mediaEntries = (...a) => App.mediaEntries(...a);
  const mediaPutMany = (...a) => App.mediaPutMany(...a);
  const driveSaveBackup = (...a) => App.driveSaveBackup(...a);
  const driveLoadBackup = (...a) => App.driveLoadBackup(...a);


  const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

  let gisPromise = null;

  let driveToken = '';

  let driveTokenExpiresAt = 0;

  const MEDIA_ARCHIVE_MAGIC = 'ANITIER-MEDIA/1\n';

  const MEDIA_ARCHIVE_LIMIT = 500 * 1024 * 1024;

  const AUTO_BACKUP_INTERVAL = 24 * 60 * 60 * 1000;

  const AUTO_BACKUP_RETRY = 6 * 60 * 60 * 1000;

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

  function watchedList(id) {
    const p = state.progress[id];
    return p && Array.isArray(p.watched) ? p.watched.slice() : [];
  }

  function downloadText(text, fileName, mime) {
    const type = mime || 'text/plain';
    if (window.AniTierAndroid && typeof window.AniTierAndroid.saveBackup === 'function') {
      try {
        window.AniTierAndroid.saveBackup(text, fileName);
        return;
      } catch { /* ниже обычное скачивание */ }
    }
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
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

  /* APK: отправить копию в Google Drive через системное меню «Поделиться». */
  function shareBackupToDrive() {
    const bridge = window.AniTierAndroid;
    if (!bridge || typeof bridge.shareBackup !== 'function') return false;
    let text = '';
    try {
      text = JSON.stringify(buildBackupPayload(), null, 2);
    } catch (err) {
      setBackupMessage(err && err.message ? err.message : 'Не удалось собрать копию.', true);
      return false;
    }
    try {
      if (bridge.shareBackup(text, C.BACKUP_FILE)) {
        setBackupMessage('Выберите Google Drive в системном меню — копия сохранится туда.', false);
        toast('Выберите Google Drive в списке приложений');
        return true;
      }
    } catch (err) {
      console.warn('AniTier: не удалось поделиться копией', err);
    }
    setBackupMessage('Не удалось отправить копию в Drive.', true);
    return false;
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
      if (typeof App.applyAppearance === 'function') App.applyAppearance();
      if (typeof App.renderSearchHistory === 'function') App.renderSearchHistory();
      updateBell();
      if (state.tab === 'db') App.fetchDB(true);
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

  /* Объединение: файл обычной копии или выгрузка прошлой версии. */
  async function mergeBackupText(text, source) {
    const raw = String(text == null ? '' : text);
    if (!C.isBackupSizeAllowed(raw.length)) {
      setBackupMessage('Файл больше 30 МБ — это не резервная копия AniTier.', true);
      return false;
    }
    let data = null;
    let legacy = false;
    let parseError = null;
    try {
      data = C.parseBackupJson(raw).data;
    } catch (err) {
      parseError = err;
      let items = null;
      try { items = JSON.parse(raw); } catch { items = null; }
      data = items ? C.safetyItemsToBackup(items) : null;
      legacy = Boolean(data);
    }
    if (!data) {
      setBackupMessage(parseError && parseError.message ? parseError.message : 'Не удалось прочитать файл.', true);
      return false;
    }
    const where = source ? ` из «${source}»` : '';
    if (!window.confirm(`Объединить данные${where} с текущими? Списки сохранятся, недостающие карточки добавятся, настройки придут из файла.`)) {
      return false;
    }
    try {
      const result = App.mergeBackupData(data);
      restoreCatalogPreferences();
      syncLangUI();
      if (typeof App.applyAppearance === 'function') App.applyAppearance();
      if (typeof App.renderSearchHistory === 'function') App.renderSearchHistory();
      updateBell();
      if (state.tab === 'db') App.fetchDB(true);
      const extra = legacy ? ', настройки из файла прошлой версии' : '';
      setBackupMessage(`Объединено: +${result.added} карточек, +${result.addedCustom} своих${extra}.`, false);
      toast('Данные объединены');
      return true;
    } catch (err) {
      setBackupMessage(err && err.message ? err.message : 'Не удалось объединить данные.', true);
      return false;
    }
  }

  async function mergeBackupFile(file) {
    if (!file) return;
    if (!C.isBackupSizeAllowed(file.size)) {
      setBackupMessage('Файл больше 30 МБ — это не резервная копия AniTier.', true);
      return;
    }
    try {
      const text = await readTextFile(file);
      await mergeBackupText(text, file.name || 'файл');
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

  function androidSaveMedia(blob, fileName = 'anitier-media.bin', label = 'медиаархив') {
    return new Promise((resolve, reject) => {
      const bridge = window.AniTierAndroid;
      let finished = false;
      const settle = (ok, message) => {
        if (finished) return;
        finished = true;
        delete window.__anitierMediaSaveReady;
        delete window.__anitierMediaSaveFinished;
        if (ok) resolve();
        else reject(new Error(message || `Не удалось сохранить ${label} через Android.`));
      };
      window.__anitierMediaSaveReady = async ready => {
        if (!ready) { settle(false, 'Не удалось открыть файл для сохранения.'); return; }
        try {
          const chunkSize = 256 * 1024;
          for (let offset = 0; offset < blob.size; offset += chunkSize) {
            const bytes = new Uint8Array(await blob.slice(offset, offset + chunkSize).arrayBuffer());
            let binary = '';
            for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
            if (!bridge.writeMediaChunk(btoa(binary))) throw new Error(`Не удалось записать часть ${label}.`);
          }
          bridge.finishMediaSave(true);
        } catch (error) {
          bridge.finishMediaSave(false);
          settle(false, error && error.message ? error.message : `Не удалось передать ${label} в Android.`);
        }
      };
      window.__anitierMediaSaveFinished = ok => settle(Boolean(ok), `Не удалось сохранить ${label}.`);
      try { bridge.beginMediaSave(fileName); }
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

  function autoBackupDue() {
    if (!state.settings.driveAutoBackup) return false;
    if (typeof driveAvailable === 'function' && !driveAvailable()) return false;
    const now = Date.now();
    if (now - (Number(state.settings.lastDriveBackupAt) || 0) < AUTO_BACKUP_INTERVAL) return false;
    if (now - (Number(state.settings.lastDriveBackupTry) || 0) < AUTO_BACKUP_RETRY) return false;
    return true;
  }

  async function runAutoBackup() {
    if (!autoBackupDue()) return false;
    state.settings.lastDriveBackupTry = Date.now();
    saveState();
    try {
      const token = await ensureDriveToken();
      await driveSaveBackup(token, JSON.stringify(buildBackupPayload()));
      state.settings.lastDriveBackupAt = Date.now();
      state.settings.lastDriveBackupTry = 0;
      saveState();
      if (state.backup && state.backup.open) {
        const when = new Date(state.settings.lastDriveBackupAt).toLocaleString('ru-RU');
        setBackupMessage(`Авто-копия сохранена: ${when}`, false);
      }
      return true;
    } catch (err) {
      if (err && err.code === 'AUTH') driveToken = '';
      /* Тихо: при следующем открытии попробуем снова, но не чаще раза в 6 часов. */
      return false;
    }
  }

  Object.assign(App, {
    googleClientId,
    driveAvailable,
    loadGisScript,
    ensureDriveToken,
    setBackupMessage,
    watchedList,
    downloadText,
    saveBackupFile,
    shareBackupToDrive,
    restoreBackupText,
    restoreBackupFile,
    mergeBackupText,
    mergeBackupFile,
    buildMediaArchive,
    androidSaveMedia,
    exportMediaFile,
    importMediaFile,
    saveBackupToDrive,
    restoreFromDrive,
    autoBackupDue,
    runAutoBackup,
  });
})(window.AniTier);
