/* Прокрутка без мигания: догрузка базы и перебор результатов поиска. */
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
      status: 'Завершено',
      score: 8,
      year: 2020,
      genres: [],
    };
  }

  T.test('scroll: догрузка страницы базы не пересоздаёт готовые карточки', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const api = app.win.__anitierTest;
      await api.init();
      const win = app.win;
      const doc = win.document;
      const db = api.state.db;

      db.loading = false;
      db.error = null;
      db.items = [anime(1, 'Первый'), anime(2, 'Второй')];
      win.AniTier.renderDB();

      const grid = doc.getElementById('db-grid');
      T.eq(grid.querySelectorAll('.card').length, 2);
      const firstCard = grid.querySelector('.card');
      const firstImage = firstCard.querySelector('img');
      T.eq(firstCard.dataset.id, '1');

      db.items = db.items.concat([anime(3, 'Третий')]);
      win.AniTier.renderDB();

      T.eq(grid.querySelectorAll('.card').length, 3, 'Новая карточка добавилась');
      T.assert(grid.querySelector('.card') === firstCard, 'Старая карточка осталась тем же узлом');
      T.assert(grid.querySelector('.card img') === firstImage, 'Постер не пересоздавался');
      T.assert(!firstCard.classList.contains('is-new'), 'Без лишних пометок');

      db.items = [anime(9, 'Совсем другой список')];
      win.AniTier.renderDB();
      T.eq(grid.querySelectorAll('.card').length, 1, 'Смена выдачи перерисовывает сетку');
      T.eq(grid.querySelector('.card').dataset.id, '9');
    } finally {
      app.close();
    }
  });

  T.test('scroll: перебор результатов поиска не пересоздаёт строки', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const api = app.win.__anitierTest;
      await api.init();
      const doc = app.win.document;

      api.state.db.items = [anime(1, 'Тест один'), anime(2, 'Тест два'), anime(3, 'Тест три')];
      api.openCommand();
      const input = doc.getElementById('command-input');
      input.value = 'тест';
      input.dispatchEvent(new app.win.Event('input', { bubbles: true }));

      const rows = [...doc.querySelectorAll('.command-row')];
      T.eq(rows.length, 3);
      const posters = rows.map(row => row.querySelector('img'));

      doc.dispatchEvent(new app.win.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      const afterDown = [...doc.querySelectorAll('.command-row')];
      T.assert(afterDown[0] === rows[0], 'Строка осталась тем же узлом');
      T.assert(afterDown[0].querySelector('img') === posters[0], 'Постер не перезагружался');
      T.eq(input.getAttribute('aria-activedescendant'), 'command-row-1');
      T.assert(afterDown[1].classList.contains('is-active'));

      doc.dispatchEvent(new app.win.KeyboardEvent('keydown', { key: 'End', bubbles: true }));
      T.assert(doc.querySelectorAll('.command-row')[2] === rows[2], 'Дом не пересобран');
      T.assert(doc.querySelectorAll('.command-row')[2].classList.contains('is-active'));
    } finally {
      app.close();
    }
  });
  T.test('scroll: у карточек нет анимации появления, а пустые постеры не мигают белым', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });
    try {
      const api = app.win.__anitierTest;
      await api.init();
      const win = app.win;
      const doc = win.document;
      const db = api.state.db;

      db.loading = false;
      db.error = null;
      db.items = [anime(1, 'Первый')];
      win.AniTier.renderDB();

      const topbar = doc.querySelector('.topbar');
      T.eq(win.getComputedStyle(topbar).backdropFilter, 'none', 'Шапка не размывает фон при прокрутке');

      const card = doc.querySelector('#db-grid .card');
      T.eq(win.getComputedStyle(card).animationName, 'none', 'Карточка не переигрывает появление');

      const img = card.querySelector('.poster img');
      const imgStyle = win.getComputedStyle(img);
      T.eq(imgStyle.color, 'rgba(0, 0, 0, 0)', 'Битая картинка не показывает белый alt');
      T.assert(imgStyle.backgroundColor !== 'rgba(0, 0, 0, 0)', 'Под постером тёмная подложка');
      T.eq(img.getAttribute('decoding'), 'async', 'Постер декодируется асинхронно');
    } finally {
      app.close();
    }
  });
})();
