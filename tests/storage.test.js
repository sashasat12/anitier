/* Сохранение: миграция схемы, debounce и ошибка quota (пункт 19). */
(() => {
  'use strict';
  const T = window.AniTierTests;

  T.test('storage: migrateState поднимает старую версию без потери данных', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const App = app.win.AniTier;
      const raw = {
        watched: { S: [{ id: 7, title: 'Фрирен', malId: 52991, episodes: 28 }], A: [], B: [], C: [], D: [], F: [], N: [] },
        planned: { S: [], A: [{ id: 11, title: 'Блич', malId: 269 }], B: [], C: [], D: [], F: [], N: [] },
        progress: { 7: { watched: [1, 2, 3], updated: 123 } },
        customCards: [{ id: -1, customId: 'c1', title: 'Своя карточка', genres: ['Драма'] }],
        seenNotifications: ['anime:52991'],
        settings: { theme: 'amoled', titleLang: 'original' },
      };
      const migrated = App.migrateState(raw);
      T.assert(migrated, 'миграция вернула результат');
      T.eq(migrated.schemaVersion, App.SCHEMA_VERSION, 'schemaVersion поднята');
      T.eq(migrated.watched.S[0].title, 'Фрирен', 'список просмотренного сохранён');
      T.eq(migrated.planned.A[0].id, 11, 'запланированное сохранено');
      T.eq(migrated.progress['7'].watched.length, 3, 'прогресс сохранён');
      T.eq(migrated.customCards[0].title, 'Своя карточка', 'свои карточки сохранены');
      T.assert(migrated.seenNotifications.includes('anime:52991'), 'уведомления сохранены');
      T.eq(migrated.settings.theme, 'amoled', 'настройки сохранены');

      app.win.localStorage.setItem(App.LS_KEY, JSON.stringify(raw));
      App.loadState();
      T.eq(App.state.lists.watched.S[0].title, 'Фрирен', 'loadState читает старое сохранение');
      T.eq(App.watchedCount(7), 3, 'прогресс загружен после миграции');
      T.eq(App.state.settings.theme, 'amoled', 'настройки загружены');
      T.eq(App.state.customCards[0].title, 'Своя карточка', 'своя карточка загружена');
    } finally {
      app.close();
    }
  });

  T.test('storage: flushStateSave записывает актуальные данные со схемой', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const App = app.win.AniTier;
      App.state.settings.theme = 'amoled';
      const ok = App.flushStateSave();
      T.eq(ok, true, 'запись успешна');
      const saved = JSON.parse(app.win.localStorage.getItem(App.LS_KEY) || '{}');
      T.eq(saved.schemaVersion, App.SCHEMA_VERSION, 'schemaVersion записана');
      T.eq(saved.settings.theme, 'amoled', 'настройки записаны');
    } finally {
      app.close();
    }
  });

  T.test('storage: debounce откладывает запись и не блокирует вызов', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const App = app.win.AniTier;
      const key = '__anitier_debounce_test__';
      app.win.localStorage.removeItem(App.LS_KEY);
      App._testForceDebounce = true;
      try {
        App.state.settings.titleLang = 'original';
        const t0 = app.win.performance.now();
        App.saveState();
        const dt = app.win.performance.now() - t0;
        T.assert(dt < 50, 'saveState вернулся быстро: ' + dt.toFixed(1) + 'ms');
        const before = app.win.localStorage.getItem(App.LS_KEY);
        T.eq(before, null, 'до срабатывания таймера запись не выполнена');
        await new Promise(r => app.win.setTimeout(r, 500));
        const saved = JSON.parse(app.win.localStorage.getItem(App.LS_KEY) || '{}');
        T.eq(saved.settings && saved.settings.titleLang, 'original', 'после debounce данные записаны');
        void key;
      } finally {
        App._testForceDebounce = false;
        App.flushStateSave();
      }
    } finally {
      app.close();
    }
  });

  T.test('storage: ошибка quota видна пользователю', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const App = app.win.AniTier;
      const toasts = [];
      const originalToast = App.toast;
      App.toast = (msg) => { toasts.push(String(msg)); if (originalToast) return originalToast.call(App, msg); };
      const storage = app.win.localStorage;
      const originalSetItem = storage.setItem.bind(storage);
      storage.setItem = (k, v) => {
        if (k === App.LS_KEY) {
          const err = new Error('QuotaExceededError');
          err.name = 'QuotaExceededError';
          throw err;
        }
        return originalSetItem(k, v);
      };
      try {
        App._testImmediateSave = true;
        const ok = App.saveState();
        T.eq(ok, false, 'saveState сообщает об ошибке');
      } finally {
        App._testImmediateSave = false;
        storage.setItem = originalSetItem;
        App.toast = originalToast;
      }
      T.assert(toasts.some(t => /хранилищ|места|не удалось сохранить/i.test(t)),
        'показано явное сообщение о нехватке места: ' + toasts.join(' | '));
    } finally {
      app.close();
    }
  });

  T.test('storage: миграция миниатюр карточек и моментов в IndexedDB', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const App = app.win.AniTier;
      if (typeof app.win.indexedDB === 'undefined') return;
      const img = 'data:image/jpeg;base64,' + btoa('thumb');
      const rawState = {
        schemaVersion: 1,
        watched: { S: [], A: [{ id: -1, customId: 'c1', custom: true, title: 'Карточка', image: img, imageKey: '' }], B: [], C: [], D: [], F: [], N: [] },
        planned: { S: [], A: [], B: [], C: [], D: [], F: [], N: [] },
        customCards: [{ id: -1, customId: 'c1', custom: true, title: 'Карточка', image: img }],
        progress: {}, epInfo: {}, seenNotifications: [],
        settings: App.normalizeSettings(null),
        listViews: { watched: {}, planned: {} },
      };
      const rawMoments = { '-1': [{ id: 'm1', kind: 'tiktok', url: 'https://www.tiktok.com/@u/video/7412345678901234567', title: 'М', thumb: img, createdAt: 1 }] };
      app.win.localStorage.setItem(App.LS_KEY, JSON.stringify(rawState));
      app.win.localStorage.setItem(App.MOMENTS_KEY, JSON.stringify(rawMoments));
      App.loadState();
      App.loadMoments();
      const res = await App.migrateLocalThumbnails();
      T.assert((res.migratedCards || 0) >= 1, 'мигрирована миниатюра карточки');
      T.assert((res.migratedMoments || 0) >= 1, 'мигрирована миниатюра момента');

      const savedState = JSON.parse(app.win.localStorage.getItem(App.LS_KEY) || '{}');
      const stateText = JSON.stringify(savedState);
      T.assert(!stateText.includes('data:image/jpeg;base64,thumb'), 'data URL карточки не хранится в localStorage');
      T.assert(savedState.customCards && savedState.customCards[0] && savedState.customCards[0].imageKey, 'сохранён ключ миниатюры карточки');

      const savedMoments = JSON.parse(app.win.localStorage.getItem(App.MOMENTS_KEY) || '{}');
      const momentsText = JSON.stringify(savedMoments);
      T.assert(!momentsText.includes('data:image/jpeg;base64,thumb'), 'data URL момента не хранится в localStorage');
      T.eq(savedMoments['-1'][0].thumbKey, 'moment:m1:thumb', 'сохранён ключ миниатюры момента');

      T.assert(App.state.customCards[0].image, 'миниатюра карточки доступна в памяти после миграции');
      T.assert(App.momentsFor(-1)[0].thumb, 'миниатюра момента доступна в памяти после миграции');
    } finally {
      app.close();
    }
  });

  T.test('storage: сериализация не кладёт data URL миниатюр в localStorage при наличии ключей', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const App = app.win.AniTier;
      const card = {
        id: -2, customId: 'c2', custom: true, title: 'К2',
        image: 'data:image/png;base64,AAAA', imageKey: 'custom:c2:thumb',
        genres: [], createdAt: 1, updatedAt: 1,
      };
      const serialized = App.serializeCustomCard(card);
      T.eq(serialized.image, '', 'data URL не сериализуется при наличии ключа');
      T.eq(serialized.imageKey, 'custom:c2:thumb', 'ключ сохранён');

      App.state.customCards = [App.normalizeCustomCard(card)];
      App.flushStateSave();
      const saved = JSON.parse(app.win.localStorage.getItem(App.LS_KEY) || '{}');
      T.assert(!JSON.stringify(saved).includes('data:image/png;base64,AAAA'), 'localStorage не содержит data URL');
    } finally {
      app.close();
    }
  });

  T.test('storage: очистка кэша не удаляет списки и прогресс', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const App = app.win.AniTier;
      const win = app.win;
      App.addToList('watched', { id: 52991, malId: 52991, title: 'Фрирен', image: '', episodes: 28, status: 'Завершено' }, 'A');
      App.state.progress[52991] = { watched: [1, 2], updated: Date.now() };
      App.flushStateSave();

      win.navigator.storage.estimate = async () => ({ usage: 2048, quota: 1024 * 1024 });
      win.confirm = () => true;
      App.clearAniListCache = () => {};
      App.clearPersistentApiCache = async () => {};
      if (App.clearPosterStore) {
        const orig = App.clearPosterStore;
        App.clearPosterStore = async () => { await orig(); };
      }

      App.openSettings();
      await new Promise(r => win.setTimeout(r, 50));
      await App.refreshStorageInfo();
      const html = win.document.getElementById('settings-content').textContent || '';
      T.assert(/2[.,]?0?s*К?Б|2048|из/i.test(html), 'в настройках показан объём хранилища');

      await App.clearAppCache();
      T.eq(App.hasIn('watched', 52991), true, 'список сохранён');
      T.eq(App.watchedCount(52991), 2, 'прогресс сохранён');
      const saved = JSON.parse(win.localStorage.getItem(App.LS_KEY) || '{}');
      T.assert(saved.watched && JSON.stringify(saved.watched).includes('52991'), 'данные сохранены в localStorage');
    } finally {
      app.close();
    }
  });
})();
