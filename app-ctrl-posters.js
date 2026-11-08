/* ============================================================
   AniTier — кэш постеров (выделено из app.js)
   ============================================================ */
(function (App) {
  'use strict';

  const C = window.AniTierCore;
  const loadCanvasImage = (...a) => App.loadCanvasImage(...a);
  const posterCachedUrl = (...a) => App.posterCachedUrl(...a);
  const markPosterCached = (...a) => App.markPosterCached(...a);
  const prunePosters = (...a) => App.prunePosters(...a);
  const mediaPut = (...a) => App.mediaPut(...a);
  const POSTER_CACHE_WIDTH = App.POSTER_CACHE_WIDTH;
  const POSTER_CACHE_HEIGHT = App.POSTER_CACHE_HEIGHT;
  const POSTER_CACHE_LIMIT = App.POSTER_CACHE_LIMIT;

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

  Object.assign(App, {
    canCachePoster,
    shrinkPoster,
    cachePosterImage,
    pumpPosterQueue,
    queuePosterCache,
    posterQueueStats,
  });
})(window.AniTier);
