/* Уведомления: лента не должна ломаться на две колонки. */
(() => {
  'use strict';
  const T = window.AniTierTests;

  function anime(id, title) {
    return {
      id,
      malId: id,
      title,
      altTitle: '',
      image: '',
      episodes: 12,
      type: 'TV',
      status: 'RELEASING',
      score: 8.5,
      year: 2026,
      genres: [],
      airedFrom: '2026-10-01',
    };
  }

  T.test('notifications: лента идёт одной колонкой, группы — сеткой карточек', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const api = app.win.__anitierTest;
      await api.init();
      const doc = app.win.document;
      const win = app.win;
      const n = api.state.notifications;
      api.state.tab = 'notifications';
      doc.getElementById('view-notifications').hidden = false;

      n.tab = 'tracked';
      n.loading = false;
      n.error = null;
      n.tracked.episodes = [{ anime: anime(1, 'Первый'), latest: 3 }];
      n.tracked.seasons = [{ anime: anime(2, 'Второй'), sequel: anime(3, 'Третий') }];
      n.recent.episodes = [];
      n.recent.films = [];
      n.completed = [];
      win.AniTier.renderNotifications();

      const feed = doc.getElementById('notif-list');
      T.eq(feed.className, 'notif-feed');
      T.eq(win.getComputedStyle(feed).display, 'block', 'Лента — обычный блок');

      const tabs = feed.querySelector('.notif-tabs');
      T.assert(tabs, 'Полоса групп есть');
      const feedWidth = feed.getBoundingClientRect().width;
      const tabsWidth = tabs.getBoundingClientRect().width;
      T.assert(Math.abs(feedWidth - tabsWidth) < 1, 'Полоса групп занимает всю ширину');

      const groups = [...feed.querySelectorAll('.notif-group')];
      T.eq(groups.length, 2, 'Две группы');
      const first = groups[0].getBoundingClientRect();
      const second = groups[1].getBoundingClientRect();
      T.assert(Math.abs(first.width - feedWidth) < 1, 'Группа на всю ширину');
      T.assert(second.top >= first.bottom - 1, 'Группы стоят друг под другом');

      const grid = feed.querySelector('.notif-group .notif-list');
      T.assert(grid, 'Карточки лежат в своей сетке');
      T.eq(win.getComputedStyle(grid).display, 'grid');
      T.assert(grid.getBoundingClientRect().width > 0);
    } finally {
      app.close();
    }
  });

  T.test('notifications: пустая группа показывает подсказку, а не пустоту', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const api = app.win.__anitierTest;
      await api.init();
      const doc = app.win.document;
      const win = app.win;
      const n = api.state.notifications;

      n.tab = 'completed';
      n.loading = false;
      n.error = null;
      n.tracked.episodes = [];
      n.tracked.seasons = [];
      n.recent.episodes = [];
      n.recent.films = [anime(5, 'Недавний фильм')];
      n.completed = [];
      win.AniTier.renderNotifications();

      const feed = doc.getElementById('notif-list');
      T.includes(feed.textContent, 'Недавно завершившихся тайтлов не найдено');
      T.eq(feed.querySelectorAll('.notif-group').length, 0, 'Пустая группа не рисует пустую сетку');
    } finally {
      app.close();
    }
  });
})();
