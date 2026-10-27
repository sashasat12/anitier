/* Статистика профиля: чистый расчёт и экран в модалке. */
(() => {
  'use strict';
  const T = window.AniTierTests;

  function core() {
    const C = window.AniTierCore;
    T.assert(C, 'core.js должен быть подключён');
    return C;
  }

  function anime(overrides = {}) {
    return {
      id: 1,
      malId: 1,
      title: 'Тайтл',
      altTitle: '',
      image: '',
      episodes: 12,
      type: 'TV',
      status: 'Завершено',
      score: null,
      year: 2020,
      genres: [],
      studios: [],
      ...overrides,
    };
  }

  function lists() {
    return {
      watched: {
        S: [anime({
          id: 1,
          title: 'Фрирен',
          episodes: 28,
          score: 9.2,
          year: 2023,
          genres: ['Фэнтези', 'Драма'],
          tags: ['Shounen', 'Isekai'],
          studios: ['Madhouse'],
        })],
        A: [anime({
          id: 2,
          title: 'Бензопила',
          episodes: 12,
          score: 8.5,
          year: 2022,
          genres: ['Экшен'],
          tags: ['Shounen'],
          studios: ['Mappa'],
        })],
        B: [anime({
          id: 3,
          title: 'Без оценки',
          episodes: 12,
          score: null,
          year: 2022,
          genres: ['Экшен'],
          studios: ['Mappa'],
        })],
        C: [],
        D: [],
        F: [],
        N: [],
      },
      planned: {
        S: [], A: [], B: [], C: [], D: [], F: [],
        N: [anime({ id: 4, title: 'В планах' })],
      },
    };
  }

  T.test('stats: время просмотра показывается по-русски', () => {
    const C = core();
    T.eq(C.formatWatchTime(0), '0 мин');
    T.eq(C.formatWatchTime(45), '45 мин');
    T.eq(C.formatWatchTime(60), '1 ч');
    T.eq(C.formatWatchTime(150), '2 ч 30 мин');
    T.eq(C.formatWatchTime(1440), '1 день');
    T.eq(C.formatWatchTime(1500), '1 день 1 ч');
    T.eq(C.formatWatchTime(-10), '0 мин');
  });

  T.test('stats: серии, завершённость, оценки и топы считаются из списков', () => {
    const C = core();
    const stats = C.buildProfileStats(lists(), {
      1: { watched: Array.from({ length: 28 }, (_, i) => i + 1) },
      2: { watched: [1, 2, 3, 4, 5] },
    });

    T.eq(stats.watched, 3);
    T.eq(stats.planned, 1);
    T.eq(stats.episodesWatched, 33);
    T.eq(stats.knownEpisodes, 52);
    T.eq(stats.completed, 1);
    T.eq(stats.inProgress, 1);
    T.eq(stats.notStarted, 1);
    T.eq(stats.completion, 33);
    T.eq(stats.averageScore, 8.9);
    T.eq(stats.minutes, 792, '33 серии по 24 минуты');
    T.eq(stats.hours, 13.2);
    T.eq(stats.tierCounts.S, 1);
    T.eq(stats.tierCounts.A, 1);
    T.eq(stats.tierCounts.N, 0, 'Тиры считаются только по просмотренному');
    T.eq(stats.topGenres[0], { name: 'Экшен', count: 2 });
    T.eq(stats.topGenres[1], { name: 'Драма', count: 1 });
    T.eq(stats.topTags[0], { name: 'Сёнэн', count: 2 });
    T.eq(stats.topTags[1], { name: 'Исекай', count: 1 });
    T.eq(stats.topStudios[0].count, 2);
    T.eq(stats.years.map(year => year.year), [2023, 2022]);
  });

  T.test('stats: пустые списки и настройки дают безопасные значения', () => {
    const C = core();
    const empty = C.buildProfileStats({}, {});
    T.eq(empty.watched, 0);
    T.eq(empty.planned, 0);
    T.eq(empty.completion, 0);
    T.eq(empty.averageScore, null);
    T.eq(empty.topGenres, []);
    T.eq(empty.years, []);

    const custom = C.buildProfileStats(lists(), {}, { minutesPerEpisode: 30, topLimit: 1 });
    T.eq(custom.minutes, 0, 'Без прогресса время не набегает');
    T.eq(custom.topGenres.length, 1, 'Лимит топа соблюдается');
    T.eq(custom.topStudios.length, 1);
  });

  T.test('app: статистика открывается, показывает часы и закрывается', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const api = app.win.__anitierTest;
      await api.init();
      const state = api.state;
      const doc = app.win.document;

      state.lists.watched.S = [anime({
        id: 1,
        title: 'Фрирен',
        episodes: 28,
        score: 9.2,
        year: 2023,
        genres: ['Фэнтези', 'Драма'],
        studios: ['Madhouse'],
      })];
      state.lists.watched.A = [anime({
        id: 2,
        title: 'Бензопила',
        episodes: 12,
        score: 8.5,
        year: 2022,
        genres: ['Экшен'],
        studios: ['Mappa'],
      })];
      state.lists.planned.N = [anime({ id: 3, title: 'В планах' })];
      state.progress[1] = { watched: Array.from({ length: 28 }, (_, i) => i + 1) };
      state.progress[2] = { watched: [1, 2, 3, 4, 5] };

      const open = doc.querySelector('[data-action="open-stats"]');
      T.assert(open, 'На вкладке «Просмотрено» должна быть кнопка статистики');
      open.click();

      const modal = doc.getElementById('stats-modal');
      T.eq(modal.hidden, false, 'Модалка статистики открыта');
      const text = doc.getElementById('stats-content').textContent;
      T.includes(text, '13 ч 12 мин');
      T.includes(text, '33');
      T.includes(text, 'Любимые жанры');
      T.includes(text, 'Фэнтези');
      T.includes(text, 'Madhouse');
      T.includes(text, '50%');
      T.assert(doc.body.classList.contains('no-scroll'), 'Фон не прокручивается');

      doc.querySelector('#stats-panel [data-action="close-stats"]').click();
      T.eq(modal.hidden, true, 'Модалка закрыта');
      T.assert(!doc.body.classList.contains('no-scroll'), 'Прокрутка вернулась');

      state.lists.watched = { S: [], A: [], B: [], C: [], D: [], F: [], N: [] };
      state.lists.planned = { S: [], A: [], B: [], C: [], D: [], F: [], N: [] };
      state.progress = {};
      api.openStats();
      T.includes(doc.getElementById('stats-content').textContent, 'Пока пусто');
    } finally {
      app.close();
    }
  });
})();
