/* Жесты: долгое нажатие на карточке и свайп между вкладками. */
(() => {
  'use strict';
  const T = window.AniTierTests;

  function anime(id, title) {
    return {
      id, malId: id, title, titleRu: '', altTitle: '', originalTitle: title,
      image: '', episodes: 12, type: 'TV', status: 'Завершено', score: 8,
      year: 2020, genres: [],
    };
  }

  T.test('gestures: долгое нажатие открывает быстрые действия карточки', async () => {
    const app = await T.mountApp({ query: '?test=1' });
    try {
      const api = app.win.__anitierTest;
      await api.init();
      const doc = app.win.document;
      api.state.db.loading = false;
      api.state.db.error = null;
      api.state.db.items = [anime(1, 'Быстрый тайтл')];
      app.win.AniTier.renderDB();

      api.openQuickMenu(1);
      const menu = doc.getElementById('quick-menu');
      T.eq(menu.hidden, false);
      T.includes(menu.textContent, 'Быстрый тайтл');
      T.includes(menu.textContent, 'Отметить просмотренным');

      menu.querySelector('[data-action="quick-watched"]').click();
      T.eq(menu.hidden, true, 'Меню закрылось');
      T.assert(api.state.lists.watched.S.concat(api.state.lists.watched.A, api.state.lists.watched.B, api.state.lists.watched.C, api.state.lists.watched.D, api.state.lists.watched.F, api.state.lists.watched.N).some(a => a.id === 1), 'Тайтл отмечен просмотренным');

      api.openQuickMenu(1);
      doc.querySelector('#quick-menu [data-action="quick-open"]').click();
      T.eq(doc.getElementById('modal').hidden, false, 'Карточка открылась');
      T.includes(doc.getElementById('modal-title').textContent, 'Быстрый тайтл');
    } finally {
      app.close();
    }
  });

  T.test('gestures: свайп влево переключает на следующую вкладку', async () => {
    const app = await T.mountApp({ query: '?test=1', width: 390, height: 800 });
    try {
      const api = app.win.__anitierTest;
      await api.init();
      const doc = app.win.document;
      const win = app.win;
      T.eq(api.state.tab, 'db');

      const touch = (x, y) => new win.Touch({ identifier: 1, target: doc.body, clientX: x, clientY: y });
      const fire = (type, touches, changed) => doc.body.dispatchEvent(new win.TouchEvent(type, {
        bubbles: true,
        cancelable: true,
        touches,
        changedTouches: changed || touches,
      }));

      fire('touchstart', [touch(300, 300)]);
      fire('touchmove', [touch(140, 305)]);
      fire('touchend', [], [touch(140, 305)]);

      T.eq(api.state.tab, 'notifications', 'Свайп влево открыл следующую вкладку');

      fire('touchstart', [touch(80, 300)]);
      fire('touchmove', [touch(240, 302)]);
      fire('touchend', [], [touch(240, 302)]);
      T.eq(api.state.tab, 'db', 'Свайп вправо вернул назад');
    } finally {
      app.close();
    }
  });
})();
