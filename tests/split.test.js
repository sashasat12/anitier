/* Порядок загрузки после завершения разделения app-render.js (пункт 35). */
(() => {
  'use strict';
  const T = window.AniTierTests;

  const SCRIPTS = [
    'app-store.js', 'app-api.js',
    'app-render-cards.js', 'app-render-lists.js', 'app-render-screens.js', 'app-render-modals.js', 'app-render-exchange.js', 'app-render-png.js',
    'app-ctrl-catalog.js', 'app-ctrl-notifications.js', 'app-ctrl-upcoming.js', 'app-ctrl-backup.js', 'app-ctrl-posters.js', 'app-ctrl-moments.js', 'app-ctrl-settings.js', 'app-ctrl-diagnostics.js',
    'app.js',
  ];

  function indices(text, names) {
    return names.map(name => ({ name, i: text.indexOf(name) }));
  }

  function assertOrder(text, label) {
    const idx = indices(text, SCRIPTS);
    for (const it of idx) T.assert(it.i >= 0, `${label}: не найден ${it.name}`);
    for (let n = 1; n < idx.length; n++) {
      T.assert(idx[n - 1].i < idx[n].i, `${label}: ${idx[n - 1].name} должен идти до ${idx[n].name}`);
    }
  }

  T.test('split: порядок загрузки зафиксирован в index/mobile/build', async () => {
    const [index, mobile, build] = await Promise.all([
      fetch('../index.html').then(r => r.text()),
      fetch('../mobile/index.html').then(r => r.text()),
      fetch('../build-phone.ps1').then(r => r.text()),
    ]);
    assertOrder(index, 'index.html');
    assertOrder(mobile, 'mobile/index.html');
    assertOrder(build, 'build-phone.ps1');
  });
})();
