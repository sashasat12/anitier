/* Реестр действий: каждое data-action имеет обработчик, неизвестное — предупреждает. */
(() => {
  'use strict';
  const T = window.AniTierTests;

  /* Действия, которые обрабатываются не кликом, а change/input. */
  const NON_CLICK = [
    'backup-file', 'backup-merge-file', 'media-file', 'import-list-file',
    'ep-slider',
    'settings-search-lang', 'settings-theme', 'settings-density', 'settings-font',
    'settings-drive-auto', 'settings-update-check',
    'settings-title-lang', 'settings-synopsis-lang', 'settings-translation',
    'synopsis-provider',
  ];

  const SOURCES = [
    '../index.html',
    '../mobile/index.html',
    '../app.js',
    '../app-render.js',
    '../app-render-cards.js',
    '../app-render-lists.js',
    '../app-render-screens.js',
    '../app-render-modals.js',
    '../app-ctrl-catalog.js',
    '../app-ctrl-notifications.js',
    '../app-ctrl-upcoming.js',
    '../app-ctrl-backup.js',
    '../app-ctrl-moments.js',
    '../app-ctrl-settings.js',
  ];

  function collectActions(text) {
    const out = [];
    const re = /data-action=(?:"([^"]+)"|'([^']+)')/g;
    let match;
    while ((match = re.exec(text))) {
      const value = match[1] || match[2];
      if (!value.includes('${')) out.push(value);
    }
    return out;
  }

  T.test('actions: у каждого data-action есть обработчик', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const handlers = app.win.__anitierTest.actionHandlers;
      T.assert(handlers && typeof handlers === 'object', 'Реестр действий не выставлен');

      const texts = await Promise.all(SOURCES.map(src => fetch(src).then(r => r.text())));
      const actions = [...new Set(texts.flatMap(collectActions))];
      const skip = new Set(NON_CLICK);
      const missing = actions.filter(action => !skip.has(action) && typeof handlers[action] !== 'function');
      T.eq(missing, [], 'data-action без обработчика');
    } finally {
      app.close();
    }
  });

  T.test('actions: неизвестное действие предупреждает в тестовом режиме', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      await app.win.__anitierTest.init();
      const doc = app.win.document;
      const warns = [];
      const original = app.win.console.warn;
      app.win.console.warn = (...args) => { warns.push(args.join(' ')); };
      try {
        const button = doc.createElement('button');
        button.type = 'button';
        button.dataset.action = 'unknown-action';
        doc.body.appendChild(button);
        button.click();
        button.remove();
      } finally {
        app.win.console.warn = original;
      }
      T.assert(warns.some(line => line.includes('unknown-action')), 'Неизвестное действие не предупредило');
    } finally {
      app.close();
    }
  });

  T.test('actions: клик по data-action вызывает обработчик', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      await app.win.__anitierTest.init();
      const doc = app.win.document;
      doc.getElementById('tab-watched').click();
      T.eq(app.win.__anitierTest.state.tab, 'watched', 'Вкладка не переключилась через реестр');
    } finally {
      app.close();
    }
  });
})();
