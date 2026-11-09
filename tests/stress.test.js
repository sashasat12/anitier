/* Нагрузка: 1000 тайтлов, все окна и сезоны. */
(() => {
  'use strict';
  const T = window.AniTierTests;

  const TIERS = ['S', 'A', 'B', 'C', 'D', 'F', 'N'];
  const TYPES = ['TV', 'Movie', 'OVA', 'ONA', 'Special'];
  const STATUSES = ['Завершено', 'Выходит', 'Анонс'];
  const GENRES = ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Sci-Fi', 'Mystery', 'Romance'];
  const TAGS = ['Time Skip', 'Ensemble Cast', 'Super Power', 'Military', 'School', 'Isekai', 'Martial Arts', 'Tragedy'];

  function emptyFetch() {
    return async url => {
      const u = String(url);
      const json = u.includes('graphql.anilist.co')
        ? { data: { Page: { pageInfo: { hasNextPage: false }, media: [] } } }
        : { data: [], included: [], links: { next: null } };
      return new Response(JSON.stringify(json), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };
  }

  function makeAnime(id, extra = {}) {
    const year = 1990 + (id % 35);
    const title = `Тайтл ${id} — ${GENRES[id % GENRES.length]}`;
    return {
      id,
      malId: id,
      title,
      titleRu: title,
      altTitle: `Title ${id}`,
      originalTitle: `Original ${id}`,
      image: '',
      episodes: 12 + (id % 40),
      type: TYPES[id % TYPES.length],
      status: STATUSES[id % STATUSES.length],
      statusCode: 'finished',
      score: 5 + (id % 51) / 10,
      year,
      airedFrom: `${year}-01-01`,
      airedTo: `${year}-12-31`,
      synopsis: 'Описание тайтла. '.repeat(8),
      genres: [GENRES[id % GENRES.length], GENRES[(id + 3) % GENRES.length]],
      tags: [TAGS[id % TAGS.length], TAGS[(id + 2) % TAGS.length]],
      studios: [`Студия ${id % 10}`],
      url: `https://anilist.co/anime/${id}`,
      source: 'AniList',
      sourceId: id,
      ...extra,
    };
  }

  function seedLists(App, watchedCount, plannedCount) {
    const state = App.state;
    for (let i = 1; i <= watchedCount; i += 1) {
      const anime = makeAnime(i);
      state.lists.watched[TIERS[i % TIERS.length]].push(anime);
      state.byId.set(anime.id, anime);
    }
    for (let i = 1; i <= plannedCount; i += 1) {
      const id = 1000 + i;
      const anime = makeAnime(id);
      state.lists.planned[TIERS[i % TIERS.length]].push(anime);
      state.byId.set(anime.id, anime);
    }
    App.saveState();
  }

  T.test('stress: 1000 тайтлов в списках и все окна открываются', async () => {
    const app = await T.mountApp({
      query: '?test=1',
      setup(win) { win.fetch = emptyFetch(); },
    });
    try {
      const win = app.win;
      await win.__anitierTest.init();
      const App = win.AniTier;
      const doc = win.document;
      seedLists(App, 500, 500);

      App.switchTab('watched');
      T.eq(doc.querySelectorAll('#tiers-watched .tier-card').length, 500, 'в «Просмотрено» 500 карточек');
      T.includes(doc.querySelector('#summary-watched').textContent, '500', 'сводка «Просмотрено» считает 500');

      App.switchTab('planned');
      T.eq(doc.querySelectorAll('#tiers-planned .tier-card').length, 500, 'в «Запланировано» 500 карточек');
      T.includes(doc.querySelector('#summary-planned').textContent, '500', 'сводка «Запланировано» считает 500');

      for (const tab of ['db', 'watched', 'planned', 'notifications', 'upcoming']) {
        App.switchTab(tab);
        T.assert(!doc.querySelector(`#view-${tab}`).hidden, `экран «${tab}» открыт`);
      }

      App.openModal(1);
      T.assert(doc.querySelector('.modal-panel'), 'карточка тайтла открыта');
      for (const tab of ['overview', 'seasons', 'episodes', 'moments']) {
        App.switchModalTab(tab);
        T.assert(doc.querySelector(`#modal-pane-${tab}`), `вкладка карточки «${tab}» отрисована`);
      }
      App.closeModal();

      App.openStats();
      T.eq(doc.querySelector('#stats-modal').hidden, false, 'статистика открыта');
      App.closeStats();

      App.openSettings();
      T.eq(doc.querySelector('#settings-modal').hidden, false, 'настройки открыты');
      App.closeSettings();

      App.openBackup();
      T.eq(doc.querySelector('#backup-modal').hidden, false, 'резервная копия открыта');
      T.assert(doc.querySelector('#backup-content').textContent.trim().length > 0, 'содержимое копии отрисовано');
      App.closeBackup();

      App.openExchange('export', 'watched');
      T.eq(doc.querySelector('#exchange-modal').hidden, false, 'обмен тир-листами открыт');
      App.closeExchange();
      App.openExchange('import', 'planned');
      T.eq(doc.querySelector('#exchange-modal').hidden, false, 'импорт тир-листа открыт');
      App.closeExchange();

      App.openCommand('Тайтл');
      T.eq(doc.querySelector('#command-modal').hidden, false, 'палитра команд открыта');
      T.assert(doc.querySelector('#command-results'), 'результаты палитры отрисованы');
      App.closeCommand();

      App.openCustomForm();
      T.eq(doc.querySelector('#custom-modal').hidden, false, 'своя карточка открыта');
      App.closeCustomForm(false);

      App.openMomentForm(1);
      T.eq(doc.querySelector('#moment-modal').hidden, false, 'форма момента открыта');
      App.closeMomentForm(false);
    } finally {
      app.close();
    }
  });

  T.test('stress: сезоны выдерживают 40 связей, все группы и битые записи', async () => {
    const app = await T.mountApp({
      query: '?test=1',
      setup(win) { win.fetch = emptyFetch(); },
    });
    try {
      const win = app.win;
      await win.__anitierTest.init();
      const App = win.AniTier;
      const doc = win.document;
      const state = App.state;

      const root = makeAnime(9001, { type: 'TV', episodes: 27, year: 2007 });
      const relationTypes = ['PREQUEL', 'SEQUEL', 'PARENT', 'SIDE_STORY', 'SPIN_OFF', 'SUMMARY', 'ALTERNATIVE', 'OTHER'];
      root.relations = [];
      for (let i = 0; i < 40; i += 1) {
        const type = relationTypes[i % relationTypes.length];
        const childType = type === 'SIDE_STORY' && i % 2 === 0 ? 'Movie'
          : type === 'SIDE_STORY' ? 'OVA'
            : TYPES[i % TYPES.length];
        root.relations.push({
          relationType: type,
          anime: makeAnime(10000 + i, { type: childType, year: 2008 + (i % 15) }),
        });
      }
      root.relations.push({ relationType: 'SIDE_STORY', anime: null });
      root.relations.push(null);

      state.lists.watched.S.push(root);
      state.byId.set(root.id, root);
      App.saveState();

      App.switchTab('watched');
      App.openModal(root.id);
      App.switchModalTab('seasons');
      await T.waitFor(() => doc.querySelector('.franchise-link'), 'связанные тайтлы не отрисовались', 6000);

      T.assert(doc.querySelectorAll('.franchise-link').length > 0, 'карточки связей отрисованы');
      T.assert(doc.querySelectorAll('.franchise-group').length >= 1, 'группы сезонов отрисованы');

      const fullButton = doc.querySelector('[data-action="franchise-full"]');
      T.assert(fullButton, 'есть кнопка «Показать всю франшизу»');
      fullButton.click();
      await T.waitFor(
        () => Array.isArray(state.franchiseFullById.get(root.id)),
        'полная франшиза не загрузилась',
        8000,
      );

      const groups = [...doc.querySelectorAll('.franchise-group-title')].map(el => el.textContent);
      T.assert(groups.length >= 4, 'после полной загрузки несколько групп: ' + groups.join(' | '));
      T.assert(doc.querySelectorAll('.franchise-link').length > 0, 'связи после полной загрузки на месте');

      const more = doc.querySelector('[data-action="franchise-more"]');
      if (more) {
        const before = doc.querySelectorAll('.franchise-link').length;
        more.click();
        await T.waitFor(
          () => doc.querySelectorAll('.franchise-link').length > before,
          'кнопка «Показать ещё» не раскрыла связи',
          3000,
        );
      }

      App.closeModal();
    } finally {
      app.close();
    }
  });
})();
