/* Обмен тир-листами: код, разбор, сравнение и точечное добавление в планы. */
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
      malId: null,
      title: 'Тайтл',
      altTitle: '',
      image: '',
      episodes: 12,
      type: 'TV',
      status: 'Завершено',
      score: 8,
      year: 2020,
      airedFrom: '',
      airedTo: '',
      synopsis: '',
      genres: [],
      url: '',
      source: '',
      sourceId: null,
      demo: false,
      ...overrides,
    };
  }

  T.test('exchange: код тир-листа кодируется и разбирается без потерь', () => {
    const C = core();
    const tiers = {
      S: [anime({
        id: 52991,
        malId: 52991,
        title: 'Провожающая в последний путь Фрирен',
        altTitle: 'Sousou no Frieren',
        year: 2023,
        episodes: 28,
        score: 9.3,
        genres: ['Приключения', 'Драма'],
        source: 'AniList',
        sourceId: 52991,
      })],
      A: [anime({ id: 21, malId: 21, title: 'Ван-Пис', altTitle: 'One Piece', year: 1999 })],
      B: [],
      C: [],
      D: [],
      F: [],
      N: [],
    };

    const payload = C.makeTierShare('watched', tiers, {
      now: new Date('2026-01-02T03:04:05Z'),
      tierIds: C.TIER_IDS,
    });
    const code = C.encodeTierShare(payload);
    T.includes(code, C.SHARE_PREFIX);
    T.assert(!/[+/]/.test(code), 'Код должен быть URL-safe');

    const parsed = C.parseTierShare(code, { tierIds: C.TIER_IDS });
    T.eq(parsed.list, 'watched');
    T.eq(parsed.total, 2);
    T.eq(parsed.exportedAt, '2026-01-02T03:04:05.000Z');
    T.eq(parsed.tiers.S[0].title, 'Провожающая в последний путь Фрирен');
    T.eq(parsed.tiers.S[0].altTitle, 'Sousou no Frieren');
    T.eq(parsed.tiers.S[0].malId, 52991);
    T.eq(parsed.tiers.A[0].title, 'Ван-Пис');

    const rawJson = C.parseTierShare(JSON.stringify(payload), { tierIds: C.TIER_IDS });
    T.eq(rawJson.total, 2);
    T.eq(rawJson.tiers.A[0].title, 'Ван-Пис');
  });

  T.test('exchange: чужой или повреждённый код отклоняется', () => {
    const C = core();
    let message = '';
    try { C.parseTierShare('это не код'); } catch (err) { message = err.message; }
    T.includes(message, 'прочитать');

    message = '';
    try {
      C.parseTierShare(JSON.stringify({ kind: 'other', version: 1, list: 'watched', tiers: {} }));
    } catch (err) { message = err.message; }
    T.includes(message, 'не код тир-листа');

    message = '';
    try {
      C.parseTierShare('', { tierIds: C.TIER_IDS });
    } catch (err) { message = err.message; }
    T.includes(message, 'Вставьте');
  });

  T.test('exchange: один тайтл не дублируется между тирами при импорте', () => {
    const C = core();
    const payload = {
      app: 'AniTier',
      kind: C.SHARE_KIND,
      version: C.SHARE_VERSION,
      list: 'planned',
      tiers: {
        S: [anime({ id: 1, title: 'Первый' })],
        A: [anime({ id: 1, title: 'Первый' })],
        B: [anime({ id: 2, title: 'Второй' })],
      },
    };

    const parsed = C.parseTierShare(JSON.stringify(payload), { tierIds: C.TIER_IDS });
    T.eq(parsed.total, 2);
    T.eq(parsed.tiers.S.length, 1);
    T.eq(parsed.tiers.A.length, 0);
    T.eq(parsed.tiers.B.length, 1);
  });

  T.test('exchange: сравнение видит общие, новые и только свои тайтлы', () => {
    const C = core();
    const yourLists = {
      watched: {
        S: [anime({ id: 1, malId: 100, title: 'Общий', year: 2020 })],
        A: [anime({ id: 3, title: 'Только мой', year: 2021 })],
        B: [], C: [], D: [], F: [], N: [],
      },
      planned: {
        S: [], A: [],
        B: [anime({ id: 2, malId: 200, title: 'В планах', year: 2022 })],
        C: [], D: [], F: [], N: [],
      },
    };
    const sharedTiers = {
      S: [anime({ id: 99, malId: 100, title: 'Общий', year: 2020 })],
      A: [anime({ id: 2, malId: 200, title: 'В планах', year: 2022 })],
      B: [anime({ id: 4, title: 'Новый', year: 2023 })],
      C: [], D: [], F: [], N: [],
    };

    const comparison = C.compareTierLists(sharedTiers, yourLists, { tierIds: C.TIER_IDS });
    T.eq(comparison.summary.total, 3);
    T.eq(comparison.summary.common, 2);
    T.eq(comparison.summary.newCount, 1);
    T.eq(comparison.summary.watched, 1);
    T.eq(comparison.summary.planned, 1);
    T.eq(comparison.summary.sameTier, 1);
    T.eq(comparison.summary.differentTier, 1);
    T.eq(comparison.summary.yoursOnly, 1);
    T.eq(comparison.summary.tasteMatch, 50, 'Один общий тир из двух');
    T.eq(comparison.summary.tierMoves, [{ friend: 'A', yours: 'B', count: 1 }]);

    const common = comparison.rows.find(row => row.anime.id === 99);
    T.eq(common.match.list, 'watched');
    T.eq(common.match.tier, 'S');
    T.eq(common.sameTier, true);

    const different = comparison.rows.find(row => row.anime.id === 2);
    T.eq(different.match.list, 'planned');
    T.eq(different.match.tier, 'B');
    T.eq(different.sameTier, false);

    const fresh = comparison.rows.find(row => row.anime.id === 4);
    T.eq(fresh.match, null);
  });

  T.test('app: импорт показывает сравнение и добавляет только по кнопке', async () => {
    const app = await T.mountApp({ query: '?demo=1&test=1' });

    try {
      await app.win.__anitierTest.init();
      const api = app.win.__anitierTest;
      const doc = app.win.document;
      const state = api.state;
      const C = app.win.AniTierCore;

      const frieren = anime({
        id: 52991,
        malId: 52991,
        title: 'Провожающая в последний путь Фрирен',
        altTitle: 'Sousou no Frieren',
        year: 2023,
        episodes: 28,
        score: 9.3,
        source: 'AniList',
        sourceId: 52991,
      });
      const fma = anime({
        id: 5114,
        malId: 5114,
        title: 'Стальной алхимик: Братство',
        altTitle: 'Fullmetal Alchemist: Brotherhood',
        year: 2009,
        episodes: 64,
        score: 9.1,
        source: 'AniList',
        sourceId: 5114,
      });
      const onlyMine = anime({ id: 777, title: 'Только мой тайтл', year: 2021 });
      state.lists.watched.S = [frieren];
      state.lists.watched.A = [onlyMine];
      state.lists.planned.B = [fma];

      T.assert(doc.querySelector('[data-action="exchange-export"]'), 'Нет кнопки экспорта');
      T.assert(doc.querySelector('[data-action="exchange-import"]'), 'Нет кнопки импорта');

      api.openExchange('export', 'watched');
      const modal = doc.getElementById('exchange-modal');
      T.eq(modal.hidden, false);
      const watchedCode = doc.getElementById('share-code').value;
      T.includes(watchedCode, C.SHARE_PREFIX);
      const exported = C.parseTierShare(watchedCode);
      T.eq(exported.list, 'watched');
      T.eq(exported.total, 2);

      doc.querySelector('[data-action="exchange-list"][data-list="planned"]').click();
      const plannedCode = doc.getElementById('share-code').value;
      T.assert(plannedCode !== watchedCode, 'Код другого списка не обновился');
      T.eq(C.parseTierShare(plannedCode).tiers.B[0].id, 5114);

      const fresh = anime({
        id: 44511,
        malId: 44511,
        title: 'Человек-бензопила',
        altTitle: 'Chainsaw Man',
        year: 2022,
        episodes: 12,
        score: 8.5,
        source: 'AniList',
        sourceId: 44511,
      });
      const friendCode = C.encodeTierShare(C.makeTierShare('watched', {
        S: [frieren],
        A: [fma],
        B: [fresh],
      }));

      api.openExchange('import', 'watched');
      const field = doc.getElementById('import-code');
      T.assert(field, 'Нет поля для кода импорта');
      field.value = friendCode;
      field.dispatchEvent(new app.win.Event('input', { bubbles: true }));
      doc.querySelector('[data-action="exchange-parse"]').click();

      T.eq(state.exchange.comparison.summary.total, 3);
      T.eq(state.exchange.comparison.summary.common, 2);
      T.eq(state.exchange.comparison.summary.newCount, 1);
      T.eq(state.exchange.comparison.summary.yoursOnly, 1);
      T.eq(state.exchange.comparison.summary.differentTier, 1);

      const content = doc.getElementById('exchange-content');
      T.includes(content.textContent, 'Ничего не добавлять');
      T.includes(content.textContent, 'Совпадение тиров');
      T.includes(content.textContent, 'Расхождения');
      T.assert(content.textContent.includes('50%'), 'Должно быть видно совпадение тиров');
      T.assert(!content.textContent.includes('Добавить все'), 'Не должно быть массового добавления');
      T.eq(doc.querySelectorAll('[data-action="exchange-add"]').length, 1, 'Кнопка добавления должна быть только у нового тайтла');
      T.eq(state.lists.planned.N.length, 0, 'Импорт не должен добавлять тайтлы автоматически');

      doc.querySelector('[data-action="exchange-filter"][data-filter="new"]').click();
      T.eq(doc.querySelectorAll('.exchange-row').length, 1);

      doc.querySelector('[data-action="exchange-add"]').click();
      T.eq(state.lists.planned.N.length, 1, 'Новый тайтл не попал в планы');
      T.eq(state.lists.planned.N[0].id, 44511);
      T.eq(state.lists.planned.N[0].title, 'Человек-бензопила');
      T.eq(state.lists.planned.B[0].id, 5114, 'Существующий тир B изменился');
      T.eq(state.lists.watched.S[0].id, 52991, 'Просмотренное изменилось');
      T.eq(state.lists.watched.A[0].id, 777, 'Просмотренное изменилось');
      T.eq(doc.querySelectorAll('[data-action="exchange-add"]').length, 0, 'После добавления кнопка должна исчезнуть');

      doc.querySelector('[data-action="exchange-filter"][data-filter="all"]').click();
      T.includes(content.textContent, 'В планах: Без оц.');

      doc.querySelector('.modal-close[data-action="close-exchange"]').click();
      T.eq(modal.hidden, true);
    } finally {
      app.close();
    }
  });
})();
