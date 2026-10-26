/* Кэш постеров: IndexedDB, уменьшенные копии и запасная картинка. */
(() => {
  'use strict';
  const T = window.AniTierTests;

  function makePng(win, width = 300, height = 450) {
    return new Promise((resolve, reject) => {
      const canvas = win.document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Нет canvas')); return; }
      ctx.fillStyle = '#ff4d8d';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(20, 20, width - 40, height - 40);
      canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Пустой PNG'))), 'image/png');
    });
  }

  T.test('poster: база медиа обновлена до версии 2 с хранилищем постеров', async () => {
    const app = await T.mountApp({ query: '?test=1' });
    try {
      const db = await app.win.AniTier.openMediaDB();
      T.assert(db, 'IndexedDB должна быть доступна');
      T.eq(db.version, 2);
      T.assert(db.objectStoreNames.contains('images'));
      T.assert(db.objectStoreNames.contains('media'));
      T.assert(db.objectStoreNames.contains('posters'));

      const A = app.win.AniTier;
      T.eq(A.POSTER_CACHE_LIMIT, 600);
      T.eq(A.POSTER_CACHE_WIDTH, 240);
      T.eq(A.POSTER_CACHE_HEIGHT, 360);
    } finally {
      app.close();
    }
  });

  T.test('poster: промах кэша даёт сгенерированную заглушку', async () => {
    const app = await T.mountApp({ query: '?test=1' });
    try {
      const doc = app.win.document;
      const url = `https://example.invalid/miss-${Date.now()}.jpg`;
      const img = doc.createElement('img');
      img.dataset.title = 'Тестовый тайтл';
      img.dataset.id = '777';
      img.dataset.posterSrc = url;

      app.win.posterFallback(img);
      await T.waitFor(() => String(img.src).startsWith('data:image/svg+xml'), 'Заглушка не появилась');
      T.eq(img.getAttribute('onerror'), null, 'Обработчик ошибки снят');
    } finally {
      app.close();
    }
  });

  T.test('poster: постер скачивается, уменьшается и берётся из кэша', async () => {
    const app = await T.mountApp({ query: '?test=1' });
    const originalFetch = app.win.fetch;
    try {
      const api = app.win.__anitierTest;
      const A = app.win.AniTier;
      const url = `https://example.test/poster-${Date.now()}.png`;
      const png = await makePng(app.win);
      let calls = 0;

      app.win.fetch = async (input, init) => {
        calls += 1;
        T.eq(String(input), url, 'Скачивается нужный постер');
        T.eq(init && init.mode, 'cors');
        return new app.win.Response(png, { status: 200, headers: { 'Content-Type': 'image/png' } });
      };

      const saved = await api.cachePosterImage(url);
      T.eq(saved, true, 'Постер должен сохраниться');
      T.eq(calls, 1);

      const blob = await A.mediaGet('posters', url);
      T.assert(blob && blob.size > 0, 'В кэше должен лежать blob');
      T.eq(blob.type, 'image/jpeg', 'Кэш хранится в JPEG');

      const cachedUrl = await A.posterCachedUrl(url);
      T.assert(cachedUrl && String(cachedUrl).startsWith('blob:'), 'Должен вернуться object URL');
      T.assert(cachedUrl !== url, 'Object URL не совпадает с адресом сети');

      const again = await api.cachePosterImage(url);
      T.eq(again, false, 'Повторно скачивать не нужно');
      T.eq(calls, 1, 'Сеть не должна дёргаться второй раз');

      const doc = app.win.document;
      const img = doc.createElement('img');
      img.dataset.title = 'Кэшированный постер';
      img.dataset.id = '778';
      img.dataset.posterSrc = url;
      app.win.posterFallback(img);
      await T.waitFor(() => String(img.src).startsWith('blob:'), 'Кэшированный постер не подставился');
    } finally {
      app.win.fetch = originalFetch;
      app.close();
    }
  });

  T.test('poster: разметка просит кэшировать только сетевые постеры', async () => {
    const app = await T.mountApp({ query: '?test=1' });
    try {
      const A = app.win.AniTier;
      const remote = A.imgAttrs({ image: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx1.jpg', title: 'Тайтл', id: 1 });
      T.includes(remote, 'data-poster-src="https://s4.anilist.co');
      T.includes(remote, 'onload="cachePoster(this)"');
      T.includes(remote, 'onerror="posterFallback(this)"');

      const local = A.imgAttrs({ image: 'data:image/svg+xml;charset=utf-8,test', title: 'Тайтл', id: 1 });
      T.assert(!local.includes('data-poster-src'), 'Локальную картинку кэшировать не нужно');
      T.assert(!local.includes('cachePoster'), 'Для локальной картинки нет onload');

      const empty = A.imgAttrs({ image: '', title: 'Без постера', id: 2 });
      T.includes(empty, 'data:image/svg+xml');
      T.assert(!empty.includes('data-poster-src'));
    } finally {
      app.close();
    }
  });
})();
