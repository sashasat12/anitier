/* Замеры и ограничители памяти на больших объёмах (пункт 25). */
(() => {
  'use strict';
  const T = window.AniTierTests;

  function makeAnime(i) {
    return {
      id: 100000 + i,
      malId: 100000 + i,
      title: 'Title ' + i,
      titleRu: 'Тайтл ' + i,
      altTitle: 'Alt ' + i,
      image: '',
      episodes: 12 + (i % 12),
      airedEpisodes: 6,
      status: i % 2 ? 'В эфире' : 'Завершено',
      type: 'TV',
      score: 7 + (i % 30) / 10,
      year: 2000 + (i % 24),
      genres: ['Action', 'Drama', 'Fantasy'],
      tags: [],
      studios: [],
      addedAt: i,
    };
  }

  T.test('perf: 1000 тайтлов — нормализация, список и уведомления в бюджете', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const App = app.win.AniTier;
      const win = app.win;
      const C = win.AniTierCore;
      const items = Array.from({ length: 1000 }, (_, i) => makeAnime(i));

      let t0 = win.performance.now();
      for (const a of items) C.normalizeTitleKey(a.title);
      const firstPass = win.performance.now() - t0;
      t0 = win.performance.now();
      for (const a of items) C.normalizeTitleKey(a.title);
      const cachedPass = win.performance.now() - t0;

      App.state.lists.watched.A = items.slice(0, 500).map(a => App.snapshotAnime(a));
      App.state.lists.watched.B = items.slice(500).map(a => App.snapshotAnime(a));
      App.state.tab = 'watched';
      t0 = win.performance.now();
      App.renderTierList('watched');
      const listMs = win.performance.now() - t0;

      App.state.notifications.tracked.episodes = items.map(a => ({ anime: a, episodes: [1, 2, 3] }));
      App.state.tab = 'notifications';
      t0 = win.performance.now();
      App.renderNotifications();
      const notifMs = win.performance.now() - t0;

      const report = {
        firstPass: Math.round(firstPass),
        cachedPass: Math.round(cachedPass),
        listMs: Math.round(listMs),
        notifMs: Math.round(notifMs),
      };
      win.__anitierPerf = report;
      try {
        window.parent.__anitierPerfResults = report;
        const box = window.parent.document.getElementById('perf-report');
        if (box) box.textContent = JSON.stringify(report);
      } catch { /* стенд может быть без родителя */ }
      console.log('perf 1000:', JSON.stringify(report));

      T.assert(listMs < 3000, 'список 1000 тайтлов рендерится быстрее 3 с: ' + listMs.toFixed(0) + ' мс');
      T.assert(notifMs < 5000, 'уведомления на 1000 тайтлов рендерятся быстрее 5 с: ' + notifMs.toFixed(0) + ' мс');
      T.assert(cachedPass < 500, 'повторная нормализация 1000 названий быстрее 500 мс: ' + cachedPass.toFixed(0) + ' мс');
    } finally {
      app.close();
    }
  });

  T.test('perf: state.byId и кэш заглушек не растут бесконечно', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const App = app.win.AniTier;
      for (let i = 0; i < App.ANIME_CACHE_LIMIT + 300; i += 1) {
        App.state.byId.set(i, { id: i, title: 't' + i });
      }
      const removed = App.pruneAnimeCache();
      T.assert(removed > 0, 'давние записи byId удалены');
      T.assert(App.state.byId.size <= App.ANIME_CACHE_LIMIT, 'byId не больше лимита: ' + App.state.byId.size);

      for (let i = 0; i < App.POSTER_PLACEHOLDER_LIMIT + 100; i += 1) App.makePoster('t' + i, i);
      T.assert(App.posterCache.size <= App.POSTER_PLACEHOLDER_LIMIT, 'кэш заглушек не больше лимита: ' + App.posterCache.size);
    } finally {
      app.close();
    }
  });

  T.test('perf: очередь постеров ограничена, параллельность не больше 2', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const test = app.win.__anitierTest;
      const origFetch = app.win.fetch;
      app.win.fetch = () => new Promise(() => {});
      try {
        for (let i = 0; i < 500; i += 1) test.queuePosterCache('https://example.com/p' + i + '.jpg');
        const stats = test.posterQueueStats();
        T.assert(stats.limit > 0, 'лимит очереди задан');
        T.assert(stats.queued <= stats.limit, 'очередь не больше лимита: ' + stats.queued + '/' + stats.limit);
        T.assert(stats.concurrency <= 2, 'параллельных загрузок не больше 2: ' + stats.concurrency);
      } finally {
        app.win.fetch = origFetch;
      }
    } finally {
      app.close();
    }
  });
})();
