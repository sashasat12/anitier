/* ============================================================
   AniTier — обмен тир-листами (выделено из app-render-modals.js)
   ============================================================ */
(function (App) {
  'use strict';

  const C = window.AniTierCore;
  const {
    state,
    TIERS,
    TIER_IDS,
    LIST_LABELS,
    EXCHANGE_FILTERS,
    TYPE_RU,
    typeRu,
    normalizeUpdateCheck,
    MONTHS_SHORT,
    MONTHS_FULL,
    VIEW_TABS,
    LONG_TITLE_EPS,
    $,
    $$,
    esc,
    escXml,
    plural,
    epWord,
    startOfToday,
    endOfToday,
    startOfTomorrow,
    addDays,
    daysBetween,
    parseDate,
    fuzzyDateInt,
    monthLabel,
    dateShort,
    countdownLabel,
    relativePast,
    makePoster,
    hasIn,
    findTier,
    getAnime,
    pruneAnimeCache,
    allIn,
    addToList,
    removeFromList,
    moveToTier,
    saveState,
    momentsFor,
    watchedSet,
    watchedCount,
    episodeStats,
    toggleEpisode,
    setWatchedUpTo,
    clearProgress,
  } = App;
  /* Перекрёстные вызовы */
  const displayTitle = (...a) => App.displayTitle(...a);
  const tierShort = (...a) => App.tierShort(...a);
  const imgAttrs = (...a) => App.imgAttrs(...a);
  const closeModal = (...a) => App.closeModal(...a);
  const syncBodyScroll = (...a) => App.syncBodyScroll(...a);


  function openExchange(mode, list) {
    if (state.modalId != null) closeModal();
    const exportList = list === 'planned' ? 'planned' : 'watched';
    state.exchange = {
      open: true,
      mode: mode === 'import' ? 'import' : 'export',
      list: exportList,
      code: '',
      parsed: null,
      comparison: null,
      filter: 'all',
      error: '',
      importBusy: false,
      importError: '',
      importPlan: null,
      importResult: null,
      importSource: '',
      importToken: 0,
      pngBusy: false,
    };
    if (state.exchange.mode === 'export') {
      state.exchange.code = C.encodeTierShare(C.makeTierShare(exportList, state.lists[exportList], { tierIds: TIER_IDS }));
    }
    const modal = $('#exchange-modal');
    if (modal) modal.hidden = false;
    renderExchange();
    syncBodyScroll();
    const panel = $('#exchange-panel');
    if (panel) {
      panel.scrollTop = 0;
      panel.focus({ preventScroll: true });
    }
  }

  function closeExchange() {
    state.exchange.open = false;
    const modal = $('#exchange-modal');
    if (modal) modal.hidden = true;
    syncBodyScroll();
  }

  function setExchangeMode(mode) {
    const ex = state.exchange;
    if (!ex.open) return;
    ex.mode = mode === 'import' ? 'import' : 'export';
    ex.parsed = null;
    ex.comparison = null;
    ex.error = '';
    ex.filter = 'all';
    ex.importBusy = false;
    ex.importError = '';
    ex.importPlan = null;
    ex.importResult = null;
    ex.importSource = '';
    ex.importToken += 1;
    ex.pngBusy = false;
    if (ex.mode === 'export') {
      ex.code = C.encodeTierShare(C.makeTierShare(ex.list, state.lists[ex.list], { tierIds: TIER_IDS }));
    }
    renderExchange();
    const panel = $('#exchange-panel');
    if (panel) panel.scrollTop = 0;
  }

  function switchExchangeList(list) {
    const ex = state.exchange;
    if (!ex.open || ex.mode !== 'export') return;
    ex.list = list === 'planned' ? 'planned' : 'watched';
    ex.code = C.encodeTierShare(C.makeTierShare(ex.list, state.lists[ex.list], { tierIds: TIER_IDS }));
    renderExchange();
  }

  function parseImportCode() {
    const ex = state.exchange;
    if (!ex.open || ex.mode !== 'import') return;
    const field = $('#import-code');
    const code = field ? field.value : ex.code;
    ex.code = code;
    ex.parsed = null;
    ex.comparison = null;
    ex.error = '';
    ex.filter = 'all';

    if (!code.trim()) {
      ex.error = 'Вставьте код тир-листа.';
      renderExchange();
      return;
    }

    try {
      const parsed = C.parseTierShare(code, { tierIds: TIER_IDS });
      ex.parsed = parsed;
      ex.comparison = C.compareTierLists(parsed.tiers, state.lists, { tierIds: TIER_IDS });
    } catch (err) {
      ex.error = err && err.message ? err.message : 'Не удалось прочитать код тир-листа.';
    }
    renderExchange();
  }

  function clearExchangeCode() {
    const ex = state.exchange;
    ex.code = '';
    ex.parsed = null;
    ex.comparison = null;
    ex.error = '';
    ex.filter = 'all';
    renderExchange();
    const field = $('#import-code');
    if (field) field.focus();
  }

  async function copyShareCode() {
    const field = $('#share-code');
    const text = field ? field.value : state.exchange.code;
    let copied = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        copied = true;
      }
    } catch {
      copied = false;
    }
    if (!copied && field) {
      field.focus();
      field.select();
      field.setSelectionRange(0, field.value.length);
      try { copied = document.execCommand('copy'); } catch { copied = false; }
    }
    toast(copied ? 'Код тир-листа скопирован' : 'Выделите код и скопируйте вручную');
  }

  function addExchangeItem(id) {
    const ex = state.exchange;
    if (!ex.open || !ex.parsed || !ex.comparison) return;
    const row = ex.comparison.rows.find(item => item.anime.id === id);
    if (!row) return;
    if (row.match || hasIn('watched', id) || hasIn('planned', id)) {
      toast('Этот тайтл уже есть в ваших списках');
      renderExchange();
      return;
    }

    addToList('planned', row.anime, 'N', true);
    ex.comparison = C.compareTierLists(ex.parsed.tiers, state.lists, { tierIds: TIER_IDS });
    renderExchange();
    toast(`«${displayTitle(row.anime)}» → Запланировано · Без оценки`);
  }

  function exchangeRowHTML(row) {
    const anime = row.anime;
    const match = row.match;
    const meta = [
      anime.year || '',
      anime.episodes ? `${anime.episodes} эп.` : '',
      anime.score ? `★ ${anime.score.toFixed(1)}` : '',
    ].filter(Boolean).join(' · ');
    const status = match
      ? `<span class="exchange-badge you ${row.sameTier ? 'same' : 'different'}">${match.list === 'watched' ? 'Просмотрено' : 'В планах'}: ${esc(tierShort(match.tier))}</span>`
      : '<span class="exchange-badge new">Нет у вас</span>';
    const diff = match && !row.sameTier ? '<span class="exchange-badge diff">Другой тир</span>' : '';
    const add = match
      ? ''
      : `<button class="btn btn-tiny btn-primary exchange-add" data-action="exchange-add" data-id="${anime.id}">+ В планы</button>`;

    return `<article class="exchange-row">
      <img class="exchange-poster" ${imgAttrs(anime, '')}>
      <div class="exchange-row-main">
        <div class="exchange-row-title">${esc(displayTitle(anime))}</div>
        <div class="exchange-row-meta">${esc(meta || 'данные неполные')}</div>
        <div class="exchange-row-badges">
          <span class="exchange-badge friend">Друг: ${esc(tierShort(row.tier))}</span>
          ${status}${diff}
        </div>
      </div>
      ${add}
    </article>`;
  }

  function renderExchangeComparison(parsed, comparison, filter) {
    const summary = comparison.summary;
    const listLabel = LIST_LABELS[parsed.list] || parsed.list;
    const filters = EXCHANGE_FILTERS.map(item => {
      const count = item.id === 'all'
        ? summary.total
        : item.id === 'new'
          ? summary.newCount
          : summary.differentTier;
      return `<button class="exchange-chip ${filter === item.id ? 'is-active' : ''}" data-action="exchange-filter" data-filter="${item.id}">${item.label}<b>${count}</b></button>`;
    }).join('');

    const rows = comparison.rows.filter(row => {
      if (filter === 'new') return !row.match;
      if (filter === 'diff') return Boolean(row.match) && !row.sameTier;
      return true;
    });
    const byTier = {};
    for (const row of rows) {
      if (!byTier[row.tier]) byTier[row.tier] = [];
      byTier[row.tier].push(row);
    }
    const groups = TIERS.filter(tier => (byTier[tier.id] || []).length).map(tier => {
      const items = byTier[tier.id];
      return `<section class="exchange-tier">
        <div class="exchange-tier-head">
          <span class="exchange-tier-badge tier-${tier.id}">${esc(tier.label)}</span>
          <b>${esc(tier.name)}</b>
          <em>${items.length}</em>
        </div>
        <div class="exchange-rows">${items.map(exchangeRowHTML).join('')}</div>
      </section>`;
    }).join('');

    const emptyText = filter === 'new'
      ? 'Новых тайтлов нет — всё из этого списка уже есть у вас.'
      : filter === 'diff'
        ? 'Расхождений по тирам нет.'
        : 'В этом тир-листе нет тайтлов.';

    const moves = Array.isArray(summary.tierMoves)
      ? summary.tierMoves.map(item => `<span class="exchange-move">${esc(tierShort(item.friend))} → ${esc(tierShort(item.yours))}<b>${item.count}</b></span>`).join('')
      : '';
    const taste = summary.common
      ? `<div class="exchange-taste">
          <div class="exchange-taste-score"><b>${summary.tasteMatch}%</b><span>Совпадение тиров</span></div>
          <div class="exchange-taste-details">
            <span>Тот же тир: <b>${summary.sameTier}</b></span>
            <span>Разный тир: <b>${summary.differentTier}</b></span>
          </div>
          ${moves ? `<div class="exchange-moves"><span class="exchange-moves-label">Расхождения:</span>${moves}</div>` : ''}
        </div>`
      : '';

    return `<div class="exchange-compare">
      <div class="exchange-summary">
        <div class="exchange-summary-main">
          <span class="exchange-summary-label">Тир-лист друга</span>
          <b>${esc(listLabel)}</b>
        </div>
        <div class="exchange-stats">
          <span><b>${summary.total}</b> всего</span>
          <span><b>${summary.common}</b> общих</span>
          <span><b>${summary.newCount}</b> новых</span>
          <span><b>${summary.yoursOnly}</b> только у вас</span>
        </div>
      </div>
      ${taste}
      <div class="exchange-filters" role="group" aria-label="Фильтр сравнения">${filters}</div>
      ${groups || `<div class="exchange-empty">${esc(emptyText)}</div>`}
    </div>`;
  }

  function renderImportBlock(ex) {
    const pick = `<div class="exchange-pick">
      <button class="btn btn-ghost" data-action="exchange-import-pick" data-source="mal">MyAnimeList (.xml)</button>
      <button class="btn btn-ghost" data-action="exchange-import-pick" data-source="shikimori">Shikimori (.json)</button>
      <button class="btn btn-ghost" data-action="exchange-import-pick" data-source="anilist">AniList (.json.gz)</button>
      <input type="file" id="import-list-file" data-action="import-list-file" accept=".xml,.json,.json.gz,.gz,text/xml,application/xml,application/json,application/gzip" hidden>
    </div>`;

    if (ex.importBusy) {
      return `<section class="exchange-import">
        <div class="exchange-import-head">
          <div class="exchange-eyebrow">Импорт списка</div>
          <p class="exchange-sub">Файл читается в браузере и никуда не отправляется.</p>
        </div>
        <div class="exchange-import-status" role="status">Читаем файл и сверяем с AniList…</div>
        ${pick}
      </section>`;
    }

    const plan = ex.importPlan;
    const result = ex.importResult;
    let preview = '';
    if (plan) {
      const summary = plan.summary;
      const tiers = TIERS
        .filter(tier => summary.tierCounts[tier.id])
        .map(tier => `${tier.id} ${summary.tierCounts[tier.id]}`)
        .join(' · ');
      const missing = plan.unmatched.slice(0, 8).map(row => (
        `<li>${esc(row.title || `MAL #${row.malId || '?'}`)}</li>`
      )).join('');
      const moreMissing = plan.unmatched.length > 8
        ? `<li>и ещё ${plan.unmatched.length - 8}</li>`
        : '';
      const addLabel = summary.newCount
        ? `Добавить ${summary.newCount} ${plural(summary.newCount, 'тайтл', 'тайтла', 'тайтлов')}`
        : 'Новых тайтлов нет';
      preview = `<div class="exchange-import-plan">
        <div class="exchange-import-summary">
          <span><b>${summary.total}</b> в файле</span>
          <span><b>${summary.newCount}</b> новых</span>
          <span><b>${summary.already}</b> уже у вас</span>
          <span><b>${summary.unmatched}</b> не найдено</span>
        </div>
        <div class="exchange-import-lists">
          <span>Просмотрено: <b>${summary.watched}</b></span>
          <span>Запланировано: <b>${summary.planned}</b></span>
          ${tiers ? `<span>Тиры: <b>${esc(tiers)}</b></span>` : ''}
        </div>
        ${plan.unmatched.length ? `<details class="exchange-import-missing">
          <summary>${plan.unmatched.length} ${plural(plan.unmatched.length, 'тайтл', 'тайтла', 'тайтлов')} не нашлись в AniList</summary>
          <ul>${missing}${moreMissing}</ul>
        </details>` : ''}
        <div class="exchange-actions">
          <button class="btn btn-primary" data-action="exchange-import-confirm" ${summary.newCount ? '' : 'disabled'}>${esc(addLabel)}</button>
          <button class="btn btn-ghost" data-action="exchange-import-cancel">Отменить импорт</button>
        </div>
        <p class="exchange-note">Существующие тайтлы и их тиры не меняются. Прогресс серий восстановится из файла.</p>
      </div>`;
    } else if (result) {
      preview = `<div class="exchange-import-result" role="status">
        <b>Импорт завершён.</b> Добавлено: ${result.added}. Пропущено как уже существующие: ${result.skipped}.
        ${result.unmatched ? ` Не найдено в AniList: ${result.unmatched}.` : ''}
      </div>`;
    }

    return `<section class="exchange-import">
      <div class="exchange-import-head">
        <div class="exchange-eyebrow">Импорт списка</div>
        <p class="exchange-sub">Перенесите оценки из MyAnimeList, Shikimori или AniList: файл читается в браузере и никуда не отправляется.</p>
      </div>
      ${pick}
      ${ex.importError ? `<div class="exchange-error" role="alert">${esc(ex.importError)}</div>` : ''}
      ${preview}
    </section>`;
  }

  function renderExchange() {
    const content = $('#exchange-content');
    const ex = state.exchange;
    if (!content || !ex.open) return;
    const isExport = ex.mode === 'export';
    const listLabel = LIST_LABELS[ex.list] || LIST_LABELS.watched;
    let body = '';

    if (isExport) {
      const count = allIn(ex.list).length;
      const switchHTML = ['watched', 'planned'].map(name => (
        `<button class="exchange-tab ${ex.list === name ? 'is-active' : ''}" data-action="exchange-list" data-list="${name}">${LIST_LABELS[name]}</button>`
      )).join('');
      body = `<div class="exchange-head">
          <div>
            <div class="exchange-eyebrow">Обмен тир-листом</div>
            <h2 id="exchange-title">Экспорт</h2>
            <p class="exchange-sub">Скопируйте код и отправьте другу. Внутри — список «${esc(listLabel)}»: ${count} ${plural(count, 'тайтл', 'тайтла', 'тайтлов')}.</p>
          </div>
          <div class="exchange-switch" role="group" aria-label="Какой список экспортировать">${switchHTML}</div>
        </div>
        ${count ? `<label class="exchange-field">
          <span>Код тир-листа</span>
          <textarea class="exchange-code" id="share-code" readonly rows="7">${esc(ex.code)}</textarea>
        </label>
        <div class="exchange-actions">
          <button class="btn btn-primary" data-action="exchange-copy">Скопировать код</button>
          <button class="btn btn-ghost" data-action="tier-png" data-list="${esc(ex.list)}" ${ex.pngBusy ? 'disabled' : ''}>${ex.pngBusy ? 'Готовим PNG…' : 'Скачать PNG'}</button>
          <button class="btn btn-ghost" data-action="exchange-mode" data-mode="import">Перейти к импорту</button>
        </div>
        <p class="exchange-note">Код начинается с <code>${esc(C.SHARE_PREFIX)}</code>. Его можно отправить в мессенджере — файл не нужен.</p>`
          : `<div class="exchange-empty">В списке «${esc(listLabel)}» пока нет тайтлов. Добавьте хотя бы один — и код появится здесь.</div>
        <div class="exchange-actions">
          <button class="btn btn-ghost" data-action="exchange-mode" data-mode="import">Перейти к импорту</button>
        </div>`}
        <div class="exchange-footer">
          <span>Ничего не меняется, пока вы не добавите тайтлы в планы.</span>
          <button class="btn btn-ghost" data-action="close-exchange">Закрыть</button>
        </div>`;
    } else {
      const parsed = ex.parsed;
      const comparison = ex.comparison;
      body = `<div class="exchange-head">
          <div>
            <div class="exchange-eyebrow">Обмен тир-листом</div>
            <h2 id="exchange-title">Импорт и сравнение</h2>
            <p class="exchange-sub">Перенесите свой список из MyAnimeList или Shikimori либо вставьте код друга. Перед добавлением покажем, что изменится.</p>
          </div>
          <button class="exchange-link" data-action="exchange-mode" data-mode="export">Экспорт →</button>
        </div>
        ${renderImportBlock(ex)}
        <div class="exchange-divider"><span>или код друга</span></div>
        <label class="exchange-field">
          <span>Код тир-листа</span>
          <textarea class="exchange-code" id="import-code" rows="6" placeholder="Вставьте сюда ANITIER-TIER-1:…">${esc(ex.code)}</textarea>
        </label>
        ${ex.error ? `<div class="exchange-error" role="alert">${esc(ex.error)}</div>` : ''}
        <div class="exchange-actions">
          <button class="btn btn-primary" data-action="exchange-parse">Сравнить</button>
          ${parsed ? '<button class="btn btn-ghost" data-action="exchange-clear">Очистить</button>' : ''}
        </div>
        ${parsed && comparison ? renderExchangeComparison(parsed, comparison, ex.filter) : ''}
        <div class="exchange-footer">
          <span>Импорт не перезаписывает существующие тиры и не добавляет всё сразу.</span>
          <button class="btn btn-ghost" data-action="close-exchange">Ничего не добавлять</button>
        </div>`;
    }

    content.innerHTML = body;
  }

  Object.assign(App, {
    openExchange,
    closeExchange,
    setExchangeMode,
    switchExchangeList,
    parseImportCode,
    clearExchangeCode,
    copyShareCode,
    addExchangeItem,
    exchangeRowHTML,
    renderExchangeComparison,
    renderExchange,
  });
})(window.AniTier);
