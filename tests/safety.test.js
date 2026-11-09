/* Страховочная копия в памяти APK и перенос данных из старых сборок. */
(() => {
  'use strict';
  const T = window.AniTierTests;

  function fakeBridge(win) {
    const box = { snapshot: '', saves: 0 };
    win.AniTierAndroid = {
      saveSnapshot(json) {
        if (typeof json !== 'string' || !json) return false;
        box.snapshot = json;
        box.saves++;
        return true;
      },
      loadSnapshot() {
        return box.snapshot;
      },
      snapshotSavedAt() {
        return 0;
      },
    };
    return box;
  }

  T.test('safety: данные старой сборки переносятся в текущее хранилище', async () => {
    const app = await T.mountApp({ query: '?test=1' });
    try {
      const win = app.win;
      const App = win.AniTier;
      App._testNoReload = true;
      win.localStorage.removeItem(App.LS_KEY);
      fakeBridge(win);

      const legacyState = {
        schemaVersion: 1,
        watched: { S: [{ id: 52991, title: 'Фрирен' }], A: [], B: [], C: [], D: [], F: [], N: [] },
        planned: { S: [], A: [], B: [], C: [], D: [], F: [], N: [] },
        settings: {},
      };
      const payload = JSON.stringify({ 'anitier.v1': JSON.stringify(legacyState) });
      T.eq(App.receiveLegacyData(payload), true, 'данные приняты');

      const saved = JSON.parse(win.localStorage.getItem(App.LS_KEY) || 'null');
      T.assert(saved && saved.watched && saved.watched.S[0].title === 'Фрирен', 'список записан в хранилище');
      T.eq(App.receiveLegacyData(payload), false, 'повторный перенос не затирает текущие данные');
    } finally {
      app.close();
    }
  });

  T.test('safety: пустое хранилище восстанавливается из копии', async () => {
    const app = await T.mountApp({ query: '?test=1' });
    try {
      const win = app.win;
      const App = win.AniTier;
      App._testNoReload = true;
      win.localStorage.removeItem(App.LS_KEY);
      const box = fakeBridge(win);
      const state = {
        watched: { S: [{ id: 7, title: 'Блич' }], A: [], B: [], C: [], D: [], F: [], N: [] },
        planned: { S: [], A: [], B: [], C: [], D: [], F: [], N: [] },
      };
      box.snapshot = JSON.stringify(win.AniTierCore.makeSafetySnapshot(
        { 'anitier.v1': JSON.stringify(state) }, 1700000000000,
      ));

      T.eq(App.recoverOnBoot(), true, 'копия восстановлена');
      const saved = JSON.parse(win.localStorage.getItem(App.LS_KEY) || 'null');
      T.assert(saved && saved.watched && saved.watched.S[0].id === 7, 'данные вернулись в localStorage');
    } finally {
      app.close();
    }
  });

  T.test('safety: блоки копий рисуются в окне резервной копии', async () => {
    const app = await T.mountApp({ query: '?test=1' });
    try {
      const win = app.win;
      const App = win.AniTier;
      const box = fakeBridge(win);
      win.AniTierAndroid.loadLegacyData = () => JSON.stringify({
        'anitier.v1': JSON.stringify({
          watched: { S: [{ id: 7, title: 'Блич' }], A: [], B: [], C: [], D: [], F: [], N: [] },
          planned: { S: [], A: [], B: [], C: [], D: [], F: [], N: [] },
        }),
      });
      win.AniTierAndroid.clearLegacyData = () => true;
      box.snapshot = JSON.stringify(win.AniTierCore.makeSafetySnapshot(
        { 'anitier.v1': '{"watched":{"S":[{"id":1}]}}' }, 1700000000000,
      ));

      App.openBackup();
      const doc = win.document;
      const text = (doc.getElementById('backup-content') || {}).textContent || '';
      T.includes(text, 'Страховочная копия на устройстве', 'блок страховочной копии показан');
      T.includes(text, 'Данные прошлой версии', 'блок данных прошлой версии показан');
      T.assert(doc.querySelector('[data-action="safety-save"]'), 'есть кнопка сохранения копии');
      T.assert(doc.querySelector('[data-action="safety-merge"]'), 'есть кнопка объединения копии');
      T.assert(doc.querySelector('[data-action="safety-legacy-merge"]'), 'есть кнопка объединения старых списков');
      T.assert(doc.querySelector('[data-action="backup-merge-file"]'), 'есть объединение из файла');
      T.assert(doc.querySelector('[data-action="safety-legacy-restore"]'), 'есть кнопка возврата старых списков');
      App.closeBackup();
    } finally {
      app.close();
    }
  });

  T.test('safety: данные прошлой версии объединяются с текущими', async () => {
    const app = await T.mountApp({ query: '?test=1' });
    try {
      const win = app.win;
      const App = win.AniTier;
      const bridge = fakeBridge(win);
      const legacyState = {
        schemaVersion: 1,
        watched: { S: [{ id: 2, title: 'Старый' }], A: [], B: [], C: [], D: [], F: [], N: [] },
        planned: { S: [], A: [], B: [], C: [], D: [], F: [], N: [] },
        customCards: [{ id: -2, customId: 'c2', title: 'Старая своя', genres: [] }],
        progress: {},
        settings: { theme: 'amoled', titleLang: 'original' },
      };
      win.AniTierAndroid.loadLegacyData = () => JSON.stringify({ 'anitier.v1': JSON.stringify(legacyState) });
      win.AniTierAndroid.clearLegacyData = () => { bridge.cleared = true; return true; };
      win.confirm = () => true;
      win.localStorage.setItem(App.LS_KEY, JSON.stringify({
        schemaVersion: 1,
        watched: { S: [{ id: 1, title: 'Текущий' }], A: [], B: [], C: [], D: [], F: [], N: [] },
        planned: { S: [], A: [], B: [], C: [], D: [], F: [], N: [] },
        customCards: [],
        progress: {},
        settings: { theme: 'dark', titleLang: 'ru' },
      }));

      T.eq(App.mergeLegacyManually(), true, 'слияние выполнено');
      const saved = JSON.parse(win.localStorage.getItem(App.LS_KEY) || '{}');
      T.eq(saved.watched.S.map(a => a.id), [1, 2], 'старая карточка добавлена к текущей');
      T.eq(saved.settings.theme, 'amoled', 'настройки вернулись из прошлой версии');
      T.eq(saved.customCards.length, 1, 'своя карточка вернулась');
      T.eq(bridge.cleared, true, 'файл прошлой версии очищен после слияния');
    } finally {
      app.close();
    }
  });

  T.test('safety: изменения списков попадают в страховочную копию', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const win = app.win;
      const App = win.AniTier;
      const box = fakeBridge(win);

      App.addToList('watched', {
        id: 52991, malId: 52991, title: 'Фрирен', image: '', episodes: 28, status: 'Завершено',
      }, 'S');
      App.flushStateSave();
      T.eq(App.saveSnapshotNow(), true, 'копия записана через мост');

      const parsed = win.AniTierCore.parseSafetySnapshot(box.snapshot);
      T.assert(parsed.cards >= 1, 'в копии есть карточки: ' + parsed.cards);
      T.assert(parsed.items[App.LS_KEY], 'в копии есть состояние списков');
    } finally {
      app.close();
    }
  });
  T.test('safety: запись из памяти не затирает восстановленные данные', async () => {
    const app = await T.mountApp({ query: '?test=1' });
    try {
      const win = app.win;
      const App = win.AniTier;
      const restored = JSON.stringify({
        watched: { S: [{ id: 7, title: 'Блич' }], A: [], B: [], C: [], D: [], F: [], N: [] },
        planned: { S: [], A: [], B: [], C: [], D: [], F: [], N: [] },
      });
      win.localStorage.setItem(App.LS_KEY, restored);
      App._suppressStateSave = true;
      App.flushStateSave();
      T.eq(win.localStorage.getItem(App.LS_KEY), restored, 'восстановленные данные не затёрты');
      App._suppressStateSave = false;
    } finally {
      app.close();
    }
  });
})();
