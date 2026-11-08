/* ============================================================
   AniTier — тир-листы и статистика (выделено из app-render.js)
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
  const tierCardHTML = (...a) => App.tierCardHTML(...a);
  /* ---------------- тировые списки ---------------- */
  function listView(name) {
    if (!state.listViews) state.listViews = {};
    let view = state.listViews[name];
    if (!view || typeof view !== 'object') view = { query: '', filters: C.DEFAULT_FILTERS };
    view.query = String(view.query || '');
    view.filters = C.normalizeFilters(view.filters);
    view.sort = C.normalizeListSort(view.sort);
    state.listViews[name] = view;
    return view;
  }

  function listToolsHTML(name) {
    const typeOptions = C.TYPES
      .map(item => `<option value="${esc(item.value)}">${esc(item.label)}</option>`).join('');
    const scoreOptions = C.SCORES
      .map(item => `<option value="${esc(item.value)}">${esc(item.label)}</option>`).join('');
    const sortOptions = C.LIST_SORTS
      .map(item => `<option value="${esc(item.value)}">${esc(item.label)}</option>`).join('');
    return `<div class="list-bar">
        <div class="search">
          <input id="${name}-search" type="search" data-list-search="${name}" placeholder="Поиск: название, жанр, студия" autocomplete="off" aria-label="Поиск в списке">
        </div>
        <button class="btn btn-ghost filter-toggle" type="button" data-action="toggle-list-filters" data-list="${name}" aria-expanded="false" aria-controls="list-filters-${name}">
          Фильтры <b class="filter-count" id="list-filter-count-${name}" hidden>0</b>
        </button>
      </div>
      <div class="filters list-filters" id="list-filters-${name}" hidden>
        <label class="filter-field">
          <span>Тип</span>
          <select id="${name}-type" data-list-filter="type" aria-label="Тип"><option value="">Любой</option>${typeOptions}</select>
        </label>
        <label class="filter-field">
          <span>Жанр</span>
          <select id="${name}-genre" data-list-filter="genre" aria-label="Жанр"><option value="">Любой</option></select>
        </label>
        <label class="filter-field">
          <span>Год</span>
          <select id="${name}-year" data-list-filter="year" aria-label="Год"><option value="">Любой</option></select>
        </label>
        <label class="filter-field">
          <span>Рейтинг</span>
          <select id="${name}-score" data-list-filter="minScore" aria-label="Рейтинг"><option value="">Любой</option>${scoreOptions}</select>
        </label>
        <label class="filter-field">
          <span>Порядок</span>
          <select id="${name}-sort" data-list-sort="${name}" aria-label="Порядок карточек">${sortOptions}</select>
        </label>
        <button class="btn btn-ghost filter-reset" type="button" data-action="reset-list" data-list="${name}">Сбросить</button>
      </div>`;
  }

  /* Панель поиска и фильтров строится один раз: при вводе перерисовывается
     только тир-лист, поэтому поле не теряет фокус и курсор. */
  function syncListControls(name, items) {
    const tools = document.getElementById('list-tools-' + name);
    if (!tools) return;
    if (!tools.dataset.ready) {
      tools.innerHTML = listToolsHTML(name);
      tools.dataset.ready = '1';
    }
    const view = listView(name);
    const search = tools.querySelector(`#${name}-search`);
    if (search && document.activeElement !== search && search.value !== view.query) {
      search.value = view.query;
    }
    const type = tools.querySelector(`#${name}-type`);
    if (type) type.value = view.filters.type[0] || '';
    const score = tools.querySelector(`#${name}-score`);
    if (score) score.value = view.filters.minScore || '';
    const sort = tools.querySelector(`#${name}-sort`);
    if (sort) sort.value = view.sort;

    /* Счётчик активных фильтров на кнопке и её состояние. */
    const active = C.countActiveFilters(view.filters);
    const badge = tools.querySelector(`#list-filter-count-${name}`);
    if (badge) {
      badge.textContent = String(active);
      badge.hidden = active === 0;
    }
    const panel = tools.querySelector(`#list-filters-${name}`);
    const toggle = tools.querySelector(`[data-action="toggle-list-filters"]`);
    if (panel && toggle) {
      const open = !panel.hidden;
      toggle.classList.toggle('is-active', active > 0 || open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    const options = C.listFilterOptions(items);

    const year = tools.querySelector(`#${name}-year`);
    if (year) {
      const keys = options.years.map(String);
      const current = [...year.options].slice(1).map(option => option.value);
      if (current.join('|') !== keys.join('|')) {
        year.innerHTML = '<option value="">Любой</option>'
          + keys.map(key => `<option value="${key}">${key}</option>`).join('');
      }
      const value = view.filters.year[0] || '';
      if (!keys.includes(value)) view.filters.year = [];
      year.value = keys.includes(value) ? value : '';
    }

    const genre = tools.querySelector(`#${name}-genre`);
    if (genre) {
      const keys = options.genres.map(item => String(item.id));
      const current = [...genre.options].slice(1).map(option => option.value);
      if (current.join('|') !== keys.join('|')) {
        genre.innerHTML = '<option value="">Любой</option>'
          + options.genres.map(item => `<option value="${item.id}">${esc(item.label)}</option>`).join('');
      }
      const value = view.filters.genre[0] || '';
      if (!keys.includes(value)) view.filters.genre = [];
      genre.value = keys.includes(value) ? value : '';
    }
  }

  function updateListStatus(name, all, shown) {
    const el = document.getElementById('list-status-' + name);
    if (!el) return;
    const view = listView(name);
    const active = C.countActiveFilters(view.filters) + (view.query.trim() ? 1 : 0);
    if (!active) { el.textContent = ''; return; }
    el.textContent = `Показано ${shown.length} из ${all.length} · фильтров: ${active}`;
  }

  function listVisibleItems(name) {
    const list = name === 'planned' ? 'planned' : 'watched';
    return C.filterItems(allIn(list), listView(list));
  }

  function renderTierList(name) {
    const root = document.getElementById(name === 'watched' ? 'tiers-watched' : 'tiers-planned');
    if (!root) return;
    const list = state.lists[name];
    const all = allIn(name);
    const view = listView(name);
    const shown = new Set(C.filterItems(all, view));
    syncListControls(name, all);

    /* Пустой список подсказывает, что делать дальше, а не просто молчит. */
    let empty = document.getElementById(`empty-${name}`);
    if (!empty) {
      empty = document.createElement('div');
      empty.id = `empty-${name}`;
      empty.className = 'empty-cta';
      root.parentNode.insertBefore(empty, root);
    }
    empty.hidden = all.length > 0;
    if (!empty.hidden) {
      empty.innerHTML = `<b>Пока пусто</b>
        <p>${name === 'watched' ? 'Найдите аниме в базе и отметьте его просмотренным — оно появится здесь.' : 'Найдите аниме в базе и добавьте в планы — оно появится здесь.'}</p>
        <button class="btn btn-primary" type="button" data-action="find-more">Найти аниме</button>`;
    }

    root.innerHTML = TIERS.map(t => {
      const tierItems = list[t.id] || [];
      const items = C.sortListItems(tierItems.filter(a => shown.has(a)), view.sort, state.progress);
      const hidden = tierItems.length > 0 && items.length === 0;
      return `<div class="tier-row">
        <div class="tier-label tier-${t.id}" title="${esc(t.name)}${items.length !== tierItems.length ? ` — показано ${items.length} из ${tierItems.length}` : ''}">
          <span>${t.label}</span>
          <small>${esc(t.id === 'N' ? 'Без оц.' : t.name)}</small>
          <em>${items.length}</em>
        </div>
        <div class="tier-drop" data-list="${name}" data-tier="${t.id}">
          ${items.length
            ? items.map(a => tierCardHTML(name, a, t.id)).join('')
            : `<span class="tier-hint">${hidden ? 'Скрыто фильтром' : 'Перетащите аниме сюда'}</span>`}
        </div>
      </div>`;
    }).join('');

    renderStats(name, all, [...shown]);
    updateListStatus(name, all, [...shown]);
    layoutTierCards(root);
  }

  /* Карточки тир-листа делят ряд по-честному: если тайтлов немного, они
     растягиваются на всю ширину, но не шире разумного предела; если предел
     сработал — ряд центрируется, чтобы пустое место не копилось справа.
     Когда тайтлов больше, чем помещается, работает обычная сетка. */
  function layoutTierCards(root) {
    if (!root) return;
    const narrow = (typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 720px)').matches)
      || document.body.classList.contains('mobile-app');
    const compact = document.documentElement.dataset.density === 'compact';
    const minWidth = narrow ? (compact ? 78 : 92) : (compact ? 110 : 126);
    const maxWidth = narrow ? (compact ? 140 : 160) : (compact ? 210 : 240);

    for (const drop of root.querySelectorAll('.tier-drop')) {
      const cards = drop.querySelectorAll('.tier-card');
      drop.style.removeProperty('grid-template-columns');
      drop.style.removeProperty('justify-content');
      if (!cards.length) continue;
      const style = window.getComputedStyle(drop);
      const gap = parseFloat(style.columnGap) || 0;
      const padding = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
      const width = drop.clientWidth - padding;
      if (width <= 0) continue;
      const capacity = Math.max(1, Math.floor((width + gap) / (minWidth + gap)));

      if (cards.length <= capacity) {
        const per = Math.min(maxWidth, Math.floor((width - gap * (cards.length - 1)) / cards.length));
        if (per >= minWidth) {
          drop.style.gridTemplateColumns = `repeat(${cards.length}, ${per}px)`;
          drop.style.justifyContent = 'center';
          continue;
        }
      }
      drop.style.gridTemplateColumns = `repeat(${Math.min(cards.length, capacity)}, minmax(0, 1fr))`;
    }
  }

  /* Сводка по тирам — одна строка вместо четырёх карточек. */
  function renderStats(name, all = allIn(name), shown = all) {
    const el = document.getElementById('summary-' + name);
    if (!el) return;
    const items = Array.isArray(shown) ? shown : all;
    const list = state.lists[name] || {};
    const itemSet = new Set(items);
    const tierPills = TIERS.map(t => {
      const count = (list[t.id] || []).filter(a => itemSet.has(a)).length;
      return `<span class="list-summary-pill"><span class="tier-dot tier-${t.id}" aria-hidden="true"></span>${esc(t.label)}<b>${count}</b></span>`;
    }).join('');
    const scored = items.filter(a => typeof a.score === 'number');
    const avg = scored.length ? (scored.reduce((s, a) => s + a.score, 0) / scored.length).toFixed(2) : '—';
    el.innerHTML = `<span class="list-summary-pill is-total">Показано<b>${items.length}</b></span>${tierPills}<span class="list-summary-pill">Средний балл<b>${avg}</b></span>`;
  }
  Object.assign(App, {
    listView,
    listToolsHTML,
    syncListControls,
    updateListStatus,
    listVisibleItems,
    renderTierList,
    layoutTierCards,
    renderStats,
  });
})(window.AniTier);
