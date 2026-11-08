/* ============================================================
   AniTier — контроллер моментов и медиа (выделено из app.js)
   ============================================================ */
(function (App) {
  'use strict';
  const C = window.AniTierCore;
  const $ = (...a) => App.$(...a);
  const state = App.state;
  const toast = (...a) => App.toast(...a);
  const renderModal = (...a) => App.renderModal(...a);
  const renderMomentForm = (...a) => App.renderMomentForm(...a);
  const renderTikTokImport = (...a) => App.renderTikTokImport(...a);
  const closeModal = (...a) => App.closeModal(...a);
  const openModal = (...a) => App.openModal(...a);
  const syncBodyScroll = (...a) => App.syncBodyScroll(...a);
  const createMoment = (...a) => App.createMoment(...a);
  const updateMoment = (...a) => App.updateMoment(...a);
  const removeMoment = (...a) => App.removeMoment(...a);
  const findMoment = (...a) => App.findMoment(...a);
  const momentsFor = (...a) => App.momentsFor(...a);
  const mediaPut = (...a) => App.mediaPut(...a);
  const mediaGet = (...a) => App.mediaGet(...a);
  const mediaDelete = (...a) => App.mediaDelete(...a);
  const getAnime = (...a) => App.getAnime(...a);
  const hasIn = (...a) => App.hasIn(...a);
  const addToList = (...a) => App.addToList(...a);
  const fetchTikTokMeta = (...a) => App.fetchTikTokMeta(...a);
  const addMoment = (...a) => App.addMoment(...a);
  const isDataImageUrl = (...a) => App.isDataImageUrl(...a);
  const dataUrlToBlob = (...a) => App.dataUrlToBlob(...a);
  const setLocalImageUrl = (...a) => App.setLocalImageUrl(...a);
  const momentThumbKey = (...a) => App.momentThumbKey(...a);
  const newUid = (...a) => App.newUid ? App.newUid(...a) : (Date.now().toString(36) + Math.random().toString(36).slice(2));
  const MOMENT_GIF_MAX = App.MOMENT_GIF_MAX || 8 * 1024 * 1024;
  const MOMENT_VIDEO_MAX = App.MOMENT_VIDEO_MAX || 40 * 1024 * 1024;
  const pruneAnimeCache = (...a) => App.pruneAnimeCache && App.pruneAnimeCache(...a);
  const normalizeMediaError = (err, fallback) => App.normalizeMediaError ? App.normalizeMediaError(err, fallback) : (err && err.message ? err.message : fallback);

  const momentObjectUrls = new Set();

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

  function consumeSharedLink() {
    if (typeof location === 'undefined') return false;
    let params = null;
    try { params = new URLSearchParams(location.search); } catch { return false; }
    const text = [params.get('text'), params.get('url'), params.get('title')]
      .filter(Boolean)
      .join(' ');
    if (!text || !/tiktok\.com/i.test(text)) return false;
    try {
      history.replaceState(null, '', location.pathname + location.hash);
    } catch { /* не критично */ }
    return receiveSharedTikTok(text);
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
      let thumbKey = '';
      try { thumb = await makeFileThumbnail(file); } catch { thumb = ''; }
      if (thumb && isDataImageUrl(thumb)) {
        thumbKey = momentThumbKey({ id: mediaKey }) || `moment:${mediaKey}:thumb`;
        try {
          const thumbBlob = await dataUrlToBlob(thumb);
          await mediaPut('images', thumbKey, thumbBlob);
          setLocalImageUrl(thumbKey, thumb);
        } catch { thumbKey = ''; }
      }
      addMoment(animeId, {
        id: mediaKey,
        kind: isGif ? 'gif' : 'video',
        title,
        mediaKey,
        thumb,
        thumbKey,
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
    if (moment.thumbKey) await mediaDelete('images', moment.thumbKey);
    removeMoment(animeId, momentId);
    renderModal();
    toast('Момент удалён');
  }

  Object.assign(App, {
    readImageFile,
    loadImageElement,
    makeImageThumbnail,
    makeVideoThumbnail,
    makeFileThumbnail,
    openTikTokUrl,
    openTikTokSearch,
    closeTikTokImport,
    openTikTokImport,
    consumeSharedLink,
    receiveSharedTikTok,
    saveSharedTikTok,
    captureMomentDraft,
    saveMomentForm,
    revokeMomentUrls,
    playMoment,
    safeFileName,
    shareMoment,
    removeMomentAction,
  });
})(window.AniTier);
