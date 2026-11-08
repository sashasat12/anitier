/* Локальная диагностика: без названий, без отправки (пункт 28). */
(() => {
  'use strict';
  const T = window.AniTierTests;

  T.test('diag: sanitizeDiagText убирает URL и параметры', async () => {
    const mounted = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      await mounted.win.__anitierTest.init();
      const App = mounted.win.AniTier;
      T.assert(typeof App.sanitizeDiagText === 'function', 'sanitizeDiagText экспортирован');
      const text = App.sanitizeDiagText('Ошибка https://kitsu.io/api/edge/anime?filter[text]=Naruto');
      T.assert(!text.includes('Naruto'), 'поисковый запрос не должен попасть в диагностику');
      T.assert(text.includes('kitsu.io') || text.includes('url') || text.includes('…'), 'URL обезличен');
    } finally {
      mounted.close();
    }
  });

  T.test('diag: отчёт содержит счётчики и не содержит названий/прогресса', async () => {
    const mounted = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      await mounted.win.__anitierTest.init();
      const App = mounted.win.AniTier;
      App.diagState.requestTotal = 3;
      App.diagState.requestFailures = 1;
      App.diagState.errors = [{ at: '2026-01-01T00:00:00.000Z', source: 'network', message: 'AniList: запрос не выполнен', status: 500 }];
      App.diagState.byOrigin = { AniList: { total: 2, failed: 1 }, Kitsu: { total: 1, failed: 0 } };
      const report = App.buildDiagnosticsReport(new Date('2026-01-01T00:00:00.000Z'), { platform: 'test', mode: 'web' });
      T.includes(report, 'AniTier — диагностика');
      T.includes(report, 'Запросы: всего 3, ошибок 1');
      T.includes(report, 'AniList');
      T.includes(report, 'HTTP 500');
      T.assert(!report.includes('Наруто') && !report.includes('watched') && !report.includes('progress'), 'нет названий и прогресса');
    } finally {
      mounted.close();
    }
  });
})();
