/* ============================================================
   AniTier — экраны: каталог, уведомления, календарь, навигация (выделено из app-render.js)
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
  /* Перекрёстные вызовы и контроллеры (ленивые) */
  const renderContinue = (...a) => App.renderContinue(...a);
  const cardHTML = (...a) => App.cardHTML(...a);
  const skeletonCards = (...a) => App.skeletonCards(...a);
  const skeletonRows = (...a) => App.skeletonRows(...a);
  const msgBlock = (...a) => App.msgBlock(...a);
  const imgAttrs = (...a) => App.imgAttrs(...a);
  const renderEpisodeBlock = (...a) => App.renderEpisodeBlock(...a);
  const ensureEpisodeInfo = (...a) => App.ensureEpisodeInfo(...a);
  const animeStatusCodeView = (...a) => App.animeStatusCodeView(...a);
  const renderTierList = (...a) => App.renderTierList(...a);
  const openModal = (...a) => App.openModal(...a);
  const closeModal = (...a) => App.closeModal(...a);
  const renderModal = (...a) => App.renderModal(...a);
  const renderStatsScreen = (...a) => App.renderStatsScreen(...a);
  const renderCommandResults = (...a) => App.renderCommandResults(...a);
  const syncContinueToggle = (...a) => App.syncContinueToggle && App.syncContinueToggle(...a);
  const fetchDB = (...a) => App.fetchDB(...a);
  const fetchNotifications = (...a) => App.fetchNotifications(...a);
  const fetchUpcoming = (...a) => App.fetchUpcoming(...a);
  /* ---------------- внешний вид и названия ---------------- */
  function displayTitle(a) {
    if (!a) return '';
    if (state.settings && state.settings.titleLang === 'original') {
      return a.originalTitle || a.altTitle || a.titleRu || a.title || '';
    }
    return a.titleRu || a.title || a.originalTitle || '';
  }

  /** Тема, плотность и размер шрифта: классы на <html>, стили — в styles.css. */
  function applyAppearance() {
    const root = document.documentElement;
    const theme = state.settings.theme === 'amoled' ? 'amoled' : 'dark';
    const density = state.settings.density === 'compact' ? 'compact' : 'comfortable';
    const font = ['small', 'large'].includes(state.settings.fontSize) ? state.settings.fontSize : 'normal';
    root.dataset.theme = theme;
    root.dataset.density = density;
    root.dataset.font = font;
  }

  /* ---------------- фильтры каталога ---------------- */
  /* ---------------- фильтры и отрисовка базы ---------------- */
  const FILTER_MENU_KEYS = ['type', 'status', 'year', 'genre', 'tags'];

  function filterFieldOptions(key) {
    if (key === 'type') return C.TYPES.map(item => ({ value: item.value, label: item.label }));
    if (key === 'status') return C.STATUSES.map(item => ({ value: item.value, label: item.label }));
    if (key === 'year') {
      const maxYear = new Date().getFullYear() + 1;
      const years = [];
      for (let year = maxYear; year >= 1990; year -= 1) {
        years.push({ value: String(year), label: String(year) });
      }
      return years;
    }
    if (key === 'genre') return C.GENRES.map(genre => ({ value: String(genre.id), label: genre.label }));
    if (key === 'tags') {
      return C.TAGS.map(tag => ({
        value: tag.name,
        label: tag.ru && tag.ru !== tag.name ? tag.ru : tag.name,
        category: tag.category || '',
      }));
    }
    return [];
  }

  function renderFilterMenu(key) {
    const panel = document.querySelector(`[data-filter-panel="${key}"]`);
    if (!panel || panel.childElementCount) return;

    if (key === 'tags') {
      const groups = new Map();
      for (const option of filterFieldOptions('tags')) {
        const category = C.tagCategoryLabel(option.category);
        if (!groups.has(category)) groups.set(category, []);
        groups.get(category).push(option);
      }
      const sections = [...groups.entries()].map(([category, options]) => (
        `<div class="filter-menu-group">${esc(category)}</div>${
          options.map(option => (
            `<label class="filter-option" data-search="${esc((option.value + ' ' + option.label).toLowerCase())}"><input type="checkbox" data-filter="tags" value="${esc(option.value)}"><span>${esc(option.label)}</span></label>`
          )).join('')
        }`
      )).join('');
      panel.innerHTML = `<div class="filter-menu-search"><input type="search" placeholder="Найти тег" aria-label="Поиск тега" autocomplete="off"></div><div class="filter-menu-scroll">${sections}</div><div class="filter-menu-footer"><button type="button" class="btn btn-ghost btn-small" data-action="clear-tag-filter">Сбросить теги</button></div>`;
      return;
    }

    panel.innerHTML = filterFieldOptions(key).map(option => (
      `<label class="filter-option"><input type="checkbox" data-filter="${key}" value="${esc(option.value)}"><span>${esc(option.label)}</span></label>`
    )).join('');
  }

  function initFilterOptions() {
    FILTER_MENU_KEYS.forEach(renderFilterMenu);
  }

  function closeFilterMenus() {
    $$('#db-filters [data-filter-panel]').forEach(panel => { panel.hidden = true; });
    $$('#db-filters [data-filter-menu]').forEach(button => button.setAttribute('aria-expanded', 'false'));
  }

  /* Меню «⋯» на вкладке «База»: язык поиска, своя карточка, случайное. */
  function closeDBMoreMenu() {
    const menu = $('#db-more-menu');
    if (!menu || menu.hidden) return;
    menu.hidden = true;
    const btn = menu.parentElement ? menu.parentElement.querySelector('.db-more-btn') : null;
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  function toggleDBMoreMenu() {
    const menu = $('#db-more-menu');
    if (!menu) return;
    const willOpen = menu.hidden;
    closeDBMoreMenu();
    if (willOpen) {
      menu.hidden = false;
      const btn = menu.parentElement ? menu.parentElement.querySelector('.db-more-btn') : null;
      if (btn) btn.setAttribute('aria-expanded', 'true');
    }
  }

  function filterMenuLabel(key, values) {
    const labels = values.map(value => {
      const option = filterFieldOptions(key).find(item => item.value === value);
      return option ? option.label : value;
    });
    if (!labels.length) return 'Любой';
    if (labels.length <= 2) return labels.join(', ');
    return `${labels.length} выбрано`;
  }

  function syncFilterUI() {
    const filters = C.normalizeFilters(state.db.filters);

    for (const key of FILTER_MENU_KEYS) {
      const values = filters[key];
      $$(`#db-filters input[type="checkbox"][data-filter="${key}"]`).forEach(box => {
        box.checked = values.includes(box.value);
      });
      const label = document.querySelector(`[data-filter-value="${key}"]`);
      if (label) {
        label.textContent = filterMenuLabel(key, values);
        label.title = filterMenuLabel(key, values);
      }
      const button = document.querySelector(`[data-filter-menu="${key}"]`);
      if (button) button.classList.toggle('has-value', values.length > 0);
    }

    const score = $('#filter-score');
    if (score) score.value = filters.minScore || '0';
    const scoreValue = $('#filter-score-value');
    if (scoreValue) scoreValue.textContent = filters.minScore ? `от ${filters.minScore}` : 'Любой';

    const count = C.countActiveFilters(filters);
    const badge = $('#filter-count');
    if (badge) {
      badge.textContent = String(count);
      badge.hidden = count === 0;
    }
    const toggle = $('[data-action="toggle-filters"]');
    if (toggle) toggle.classList.toggle('is-active', count > 0);
  }

  function syncModeChips() {
    $$('#db-modes .chip').forEach(chip => chip.classList.toggle('is-active', chip.dataset.mode === state.db.mode));
  }

  const SEARCH_PLACEHOLDERS = {
    auto: 'Поиск: «Фрирен», «Jujutsu Kaisen»…',
    ru: 'Поиск: «Фрирен», «Атака титанов»…',
    en: 'Search: “Frieren”, “Jujutsu Kaisen”…',
    ja: '検索: 「葬送のフリーレン」…',
  };

  function syncLangUI() {
    const lang = C.normalizeSearchLang(state.settings && state.settings.searchLang);
    const select = $('#search-lang');
    if (select) select.value = lang;
    const input = $('#search-input');
    if (input) input.placeholder = SEARCH_PLACEHOLDERS[lang] || SEARCH_PLACEHOLDERS.auto;
  }

  function readFiltersFromUI() {
    const raw = { type: [], status: [], year: [], genre: [], tags: [], minScore: '' };
    $$('#db-filters input[type="checkbox"][data-filter]').forEach(field => {
      if (!field.checked) return;
      const key = field.dataset.filter;
      if (Array.isArray(raw[key])) raw[key].push(field.value);
    });
    const score = $('#filter-score');
    if (score) raw.minScore = String(score.value || '0');
    return C.normalizeFilters(raw);
  }

  function resetDBFilters() {
    state.db.filters = C.normalizeFilters(C.DEFAULT_FILTERS);
    syncFilterUI();
    closeFilterMenus();
    if (App.persistCatalogPreferences) App.persistCatalogPreferences();
  }

  function updateDBStatus() {
    const el = $('#db-status');
    if (!el) return;
    const s = state.db;
    const resolutionLabels = {
      dictionary: 'словарь AniTier',
      anilist: 'название AniList',
      mymemory: 'перевод MyMemory',
      raw: 'исходный запрос',
    };
    const resolution = s.query && s.resolveVia ? ` · запрос: ${resolutionLabels[s.resolveVia] || 'без преобразования'}` : '';
    const unavailable = s.alt && s.alt.failedSources && s.alt.failedSources.length
      ? ` · недоступен: ${s.alt.failedSources.join(', ')}`
      : '';
    if (!s.items.length) {
      el.textContent = s.query && !s.loading
        ? `Проверено: ${s.sources.length ? s.sources.join(' + ') : 'нет доступных источников'}${resolution}${unavailable}`
        : '';
      return;
    }
    const page = Math.max(1, s.page - 1);
    const sources = s.sources.length ? ` · ${s.sources.join(' + ')}` : '';
    if (s.loading) {
      el.textContent = `Показано ${s.items.length} · загружаем страницу ${s.page}…${sources}${resolution}${unavailable}`;
    } else if (s.hasNext) {
      el.textContent = `Показано ${s.items.length} · страница ${page}${sources}${resolution}${unavailable}`;
    } else {
      el.textContent = `Показано ${s.items.length} · все результаты${sources}${resolution}${unavailable}`;
    }
  }

  function renderDB() {
    renderContinue();
    const s = state.db;
    const grid = $('#db-grid');
    const more = $('#db-more');
    if (!grid) return;

    const busy = Boolean(s.loading || state.booting);
    grid.setAttribute('aria-busy', busy ? 'true' : 'false');

    if (busy && !s.items.length) {
      grid.innerHTML = skeletonCards(12);
      grid.dataset.cardSignature = '';
      if (more) more.hidden = true;
      updateDBStatus();
      return;
    }
    if (s.error && !s.items.length) {
      const status = s.query && s.resolveVia
        ? ` Поиск: ${s.resolveVia === 'dictionary' ? 'словарь AniTier' : s.resolveVia === 'anilist' ? 'название AniList' : s.resolveVia === 'mymemory' ? 'перевод MyMemory' : 'исходная фраза'}.`
        : '';
      grid.innerHTML = msgBlock('⚠️', 'Не удалось загрузить базу', `${s.error}${status}`, 'retry-db');
      grid.dataset.cardSignature = '';
      if (more) more.hidden = true;
      updateDBStatus();
      return;
    }
    if (!s.items.length) {
      if (s.mode === 'custom' && !s.query && !C.hasActiveFilters(s.filters)) {
        grid.innerHTML = `<div class="msg">
          <span class="emoji">✎</span>
          <h2>Своих карточек пока нет</h2>
          <p>Добавьте тайтл, которого нет в AniList или Kitsu: название, постер, год и серии.</p>
          <button class="btn btn-primary" data-action="new-custom">Создать карточку</button>
        </div>`;
        grid.dataset.cardSignature = '';
        if (more) more.hidden = true;
        updateDBStatus();
        return;
      }
      const hasFilters = C.hasActiveFilters(s.filters);
      let text = 'Попробуйте обновить данные.';
      if (s.query) {
        const resolutionLabels = {
          dictionary: 'подобрано английское название из словаря AniTier',
          anilist: 'найден английский вариант названия в AniList',
          mymemory: 'название переведено через MyMemory',
          raw: 'запрос передан без преобразования',
        };
        const resolution = resolutionLabels[s.resolveVia] || 'запрос передан без преобразования';
        const tried = s.sources.length ? ` Проверены: ${s.sources.join(' и ')}.` : '';
        const unavailable = s.alt && s.alt.failedSources && s.alt.failedSources.length
          ? ` Не ответили: ${s.alt.failedSources.join(' и ')}.`
          : '';
        const resolved = s.resolvedQuery && s.resolvedQuery !== s.query
          ? ` Искали «${s.resolvedQuery}» (${resolution}).`
          : ` Способ поиска: ${resolution}.`;
        text = `По запросу «${s.query}» нет результатов.${resolved}${tried}${unavailable} Попробуйте другое название или ослабьте фильтры.`;
      }
      else if (hasFilters) text = 'По выбранным фильтрам ничего не нашлось. Попробуйте ослабить условия.';
      grid.innerHTML = hasFilters || s.query
        ? msgBlock('🔎', 'Ничего не нашлось', text, 'reset-filters', 'Сбросить фильтры')
        : msgBlock('🔎', 'Ничего не нашлось', text, 'refresh', 'Обновить');
      grid.dataset.cardSignature = '';
      if (more) more.hidden = true;
      updateDBStatus();
      return;
    }

    /* Догрузка страницы не должна пересоздавать уже показанные карточки:
       иначе при скролле вся сетка мигает и постеры грузятся заново.
       Смена языка названий — повод перерисовать всё. */
    const key = s.items.map(a => a.id).join(',');
    const lang = state.settings.titleLang === 'original' ? 'original' : 'ru';
    const signature = key + '|' + lang;
    const previous = grid.dataset.cardSignature || '';
    const [previousKey, previousLang] = previous.split('|');
    if (previousLang === lang && previousKey && key.startsWith(previousKey + ',')) {
      const shown = previousKey.split(',').length;
      grid.insertAdjacentHTML('beforeend', s.items.slice(shown).map(a => cardHTML(a, 'db')).join(''));
    } else if (previous !== signature) {
      grid.innerHTML = s.items.map(a => cardHTML(a, 'db')).join('');
    }
    grid.dataset.cardSignature = signature;
    const sortMode = C.normalizeDBSort(s.sort);
    if (sortMode === 'default') {
      grid.querySelectorAll('.card').forEach(card => card.style.removeProperty('order'));
    } else {
      const order = new Map(C.sortCatalogItems(s.items, sortMode).map((anime, index) => [anime.id, index]));
      grid.querySelectorAll('.card').forEach(card => {
        card.style.order = String(order.get(Number(card.dataset.id)) ?? 0);
      });
    }
    if (more) {
      more.hidden = !s.hasNext;
      more.disabled = s.loading;
      more.textContent = s.loading ? 'Загружаем…' : 'Следующая страница';
    }
    updateDBStatus();
  }

  /* ---------------- уведомления ---------------- */
  /* Один вызов saveState на пачку: при открытии уведомлений на 1000 тайтлов
     раньше на каждую серию собирался весь снапшот состояния. Обновление DOM
     тоже не по одному: updateEpisodeUI ищет блок по всему документу, и
     тысяча вызовов превращалась в O(n²). Перерисовываем список один раз. */
  function ensureNotificationEpisodes() {
    if (state.tab !== 'notifications') return;
    const all = allNotifications();
    let changed = false;
    for (const a of all) {
      const info = state.epInfo[a.id];
      const demoCacheInLiveMode = info && info.source === 'demo' && !state.forceDemo && !a.demo;
      const fresh = info && Date.now() - Number(info.fetchedAt || 0) < 2 * 3600000;
      if (fresh && !demoCacheInLiveMode) continue;
      const code = animeStatusCodeView(a);
      const needsInfo = code === 'airing' || code === 'hiatus' || !a.episodes;
      if (needsInfo) {
        const before = state.epInfo[a.id];
        ensureEpisodeInfo(a, { save: false, ui: false });
        if (state.epInfo[a.id] !== before) changed = true;
      }
    }
    if (changed) {
      saveState();
      renderNotifications({ skipEnsure: true });
    }
  }

  /* ---------------- отрисовка: уведомления ---------------- */
  function notifRowHTML(a, kind) {
    const baseDate = kind === 'airing' ? a.airedFrom : (a.airedTo || a.airedFrom);
    const d = parseDate(baseDate);
    const day = d ? d.getDate() : '—';
    const mon = d ? MONTHS_SHORT[d.getMonth()] : '';
    const daysAgo = d ? daysBetween(new Date(d.getFullYear(), d.getMonth(), d.getDate()), startOfToday()) : 99;
    const isNew = daysAgo <= 7;
    const inW = hasIn('watched', a.id);
    const inP = hasIn('planned', a.id);
    const meta = kind === 'airing'
      ? `<span>Старт: ${esc(dateShort(a.airedFrom))}</span>`
      : `<span>Завершено ${esc(relativePast(a.airedTo))}</span>`;

    return `<article class="notif notif-${kind}" data-action="open" data-id="${a.id}" tabindex="0" aria-label="${esc(displayTitle(a))}">
      <div class="notif-visual"><div class="notif-date"><b>${day}</b><span>${mon}</span></div><img class="notif-poster" ${imgAttrs(a, '')}></div>
      <div class="notif-body">
        <h3 class="notif-title">${esc(displayTitle(a))}${isNew ? '<span class="flag-new">new</span>' : ''}</h3>
        <p class="notif-alt">${esc(a.altTitle || '')}</p>
        <div class="notif-meta">
          ${meta}
          ${a.type ? `<span>· ${esc(typeRu(a.type))}</span>` : ''}
          <span>· ${a.episodes ? a.episodes + ' эп.' : 'серий: ?'}</span>
          ${a.score ? `<span>· <b>★ ${a.score.toFixed(1)}</b></span>` : ''}
        </div>
      </div>
      <div class="notif-eps">${renderEpisodeBlock(a, 'notif')}</div>
      <div class="notif-actions">
        <button class="mini-btn ${inW ? 'is-on' : ''}" data-action="add-watched" data-id="${a.id}" title="Добавить в просмотрено" aria-label="Добавить в просмотрено">✓</button>
        <button class="mini-btn ${inP ? 'is-on' : ''}" data-action="add-planned" data-id="${a.id}" title="В планы" aria-label="Добавить в планы">◷</button>
      </div>
    </article>`;
  }

  function renderNotifications(options = {}) {
    const el = $('#notif-list');
    if (!el) return;
    const n = state.notifications;
    const tracked = n.tracked.episodes.length + n.tracked.seasons.length;
    const recent = n.recent.episodes.length + n.recent.films.length;
    const completed = n.completed.length;
    const totalCount = tracked + recent + completed;

    el.setAttribute('aria-busy', n.loading ? 'true' : 'false');
    if (n.loading && !totalCount) { el.innerHTML = skeletonRows(5); return; }
    if (n.error && !totalCount) { el.innerHTML = msgBlock('⚠️', 'Не удалось загрузить уведомления', n.error, 'retry-notifications'); return; }
    const counts = { tracked, recent, completed };
    const tabs = C.NOTIF_TABS.map(tab => `<button class="notif-tab ${n.tab === tab ? 'is-active' : ''}" data-action="notif-tab" data-notif-tab="${tab}">${esc(C.NOTIF_TAB_LABELS[tab])}<b>${counts[tab]}</b></button>`).join('');
    let body = '';
    if (!totalCount) {
      body = msgBlock('🌙', 'Новых обновлений пока нет', 'Загляните позже или обновите данные.');
    } else if (n.tab === 'tracked') {
      const episodes = n.tracked.episodes.map(group => notifRowHTML(group.anime, 'airing')).join('');
      const seasons = n.tracked.seasons.map(item => notifRowHTML(item.sequel, 'airing')).join('');
      body = `${episodes ? `<section class="notif-group"><h2 class="group-head"><span class="group-dot live"></span>Новые серии <b>${n.tracked.episodes.length}</b></h2><div class="notif-list">${episodes}</div></section>` : ''}${seasons ? `<section class="notif-group"><h2 class="group-head"><span class="group-dot live"></span>Продолжения и сезоны <b>${n.tracked.seasons.length}</b></h2><div class="notif-list">${seasons}</div></section>` : ''}${!episodes && !seasons ? '<p class="group-empty">В ваших списках пока нет новых серий или сезонов.</p>' : ''}`;
    } else if (n.tab === 'recent') {
      const episodes = n.recent.episodes.map(group => notifRowHTML(group.anime, 'airing')).join('');
      const films = n.recent.films.map(anime => notifRowHTML(anime, 'completed')).join('');
      body = `${episodes ? `<section class="notif-group"><h2 class="group-head"><span class="group-dot live"></span>Новые серии <b>${n.recent.episodes.length}</b></h2><div class="notif-list">${episodes}</div></section>` : ''}${films ? `<section class="notif-group"><h2 class="group-head"><span class="group-dot done"></span>Недавно вышедшие фильмы <b>${n.recent.films.length}</b></h2><div class="notif-list">${films}</div></section>` : ''}${!episodes && !films ? '<p class="group-empty">Недавних премьер не найдено.</p>' : ''}`;
    } else {
      body = completed
        ? `<section class="notif-group"><h2 class="group-head"><span class="group-dot done"></span>Недавно завершились <b>${completed}</b></h2><div class="notif-list">${n.completed.map(anime => notifRowHTML(anime, 'completed')).join('')}</div></section>`
        : '<p class="group-empty">Недавно завершившихся тайтлов не найдено.</p>';
    }
    el.innerHTML = `<div class="notif-tabs" role="tablist" aria-label="Группы уведомлений">${tabs}</div>${body}`;

    if (!options.skipEnsure) ensureNotificationEpisodes();
  }

  function invalidateNotificationEpisodes() {
    const ids = allNotifications().map(a => a.id);
    let changed = false;
    for (const id of ids) {
      if (state.epInfo[id]) {
        delete state.epInfo[id];
        changed = true;
      }
    }
    if (changed) saveState();
  }

  function allNotifications() {
    const n = state.notifications;
    const media = [
      ...(n.tracked.episodes || []).map(group => group.anime),
      ...(n.tracked.seasons || []).flatMap(item => [item.anime, item.sequel]),
      ...(n.recent.episodes || []).map(group => group.anime),
      ...(n.recent.films || []),
      ...(n.completed || []),
    ];
    return C.dedupeById(media.filter(Boolean));
  }

  function markNotificationsSeen() {
    let changed = false;
    for (const key of C.collectNotificationKeys(state.notifications)) {
      if (!state.seenNotifications.has(key)) {
        state.seenNotifications.add(key);
        changed = true;
      }
    }
    if (changed) saveState();
    updateBell();
  }

  function updateBell() {
    const badge = $('#bell-badge');
    if (!badge) return;
    const unread = C.collectNotificationKeys(state.notifications).filter(key => !state.seenNotifications.has(key)).length;
    badge.hidden = unread === 0;
    badge.textContent = unread > 9 ? '9+' : String(unread);
  }

  /* ---------------- календарь премьер ---------------- */
  /* ---------------- отрисовка: скоро выйдут ---------------- */
  function upcomingListed() {
    return [...allIn('watched'), ...allIn('planned')];
  }

  function initUpcomingOptions() {
    const type = $('#upcoming-type');
    if (type && type.options.length <= 1) {
      for (const item of C.TYPES) type.appendChild(new Option(item.label, item.value));
    }
    const genre = $('#upcoming-genre');
    if (genre && genre.options.length <= 1) {
      for (const item of C.GENRES) genre.appendChild(new Option(item.label, String(item.id)));
    }
  }

  function upcomingMonthLabel(key) {
    return monthLabel(`${key}-01T12:00:00`);
  }

  /* Список месяцев берём из самих премьер, поэтому пустых вариантов нет. */
  function syncUpcomingControls(items) {
    const view = state.upcoming.view;
    const search = $('#upcoming-search');
    if (search && search.value !== view.query) search.value = view.query;
    const type = $('#upcoming-type');
    if (type) type.value = view.filters.type || '';
    const genre = $('#upcoming-genre');
    if (genre) genre.value = view.filters.genre || '';
    const sort = $('#upcoming-sort');
    if (sort) sort.value = view.sort === 'title' ? 'title' : 'date';
    const mine = $('#upcoming-mine');
    if (mine) {
      const on = Boolean(view.mine);
      mine.classList.toggle('btn-primary', on);
      mine.classList.toggle('btn-ghost', !on);
      mine.setAttribute('aria-pressed', on ? 'true' : 'false');
    }

    /* Счётчик на кнопке фильтров и активное состояние. */
    const activeCount = C.countActiveFilters(view.filters) + (view.month ? 1 : 0);
    const badge = $('#upcoming-filter-count');
    if (badge) {
      badge.textContent = String(activeCount);
      badge.hidden = activeCount === 0;
    }
    const toggle = document.querySelector('[data-action="toggle-upcoming-filters"]');
    if (toggle) toggle.classList.toggle('is-active', activeCount > 0);

    const month = $('#upcoming-month');
    if (!month) return;
    const keys = [...new Set(items.map(a => C.upcomingMonthKey(a.airedFrom)).filter(Boolean))].sort();
    const current = [...month.options].slice(1).map(option => option.value);
    const changed = current.length !== keys.length || current.some((value, index) => value !== keys[index]);
    if (changed) {
      month.innerHTML = '<option value="">Все месяцы</option>'
        + keys.map(key => `<option value="${key}">${esc(upcomingMonthLabel(key))}</option>`).join('');
    }
    if (!keys.includes(view.month)) view.month = '';
    month.value = view.month;
  }

  function updateUpcomingStatus(all, shown) {
    const el = $('#upcoming-status');
    if (!el) return;
    if (!all.length) { el.textContent = ''; return; }
    const hidden = Math.max(0, state.upcoming.items.length - all.length);
    const bits = [`Показано ${shown.length} из ${all.length}`];
    if (hidden) bits.push(`скрыто из ваших списков: ${hidden}`);
    const view = state.upcoming.view;
    const active = C.countActiveFilters(view.filters) + (view.month ? 1 : 0) + (view.query.trim() ? 1 : 0);
    if (active) bits.push(`фильтров: ${active}`);
    el.textContent = bits.join(' · ');
  }

  function syncUpcomingMineUI(active) {
    const toggle = document.querySelector('[data-action="toggle-upcoming-filters"]');
    const panel = $('#upcoming-filters');
    const count = $('#upcoming-filter-count');
    if (toggle) {
      toggle.hidden = Boolean(active);
      if (active) {
        toggle.setAttribute('aria-expanded', 'false');
        toggle.classList.remove('is-active');
      }
    }
    if (panel && active) panel.hidden = true;
    if (count && active) count.hidden = true;
    const reset = document.querySelector('#upcoming-more-menu [data-action="reset-upcoming"]');
    if (reset) reset.textContent = active ? 'Сбросить поиск' : 'Сбросить фильтры';
  }

  function renderMyCalendar() {
    const grid = $('#upcoming-grid');
    if (!grid) return;
    const u = state.upcoming;
    syncUpcomingMineUI(true);

    const busy = Boolean(state.notifications.loading && !state.notifications.loaded);
    grid.setAttribute('aria-busy', busy ? 'true' : 'false');
    if (busy) {
      grid.innerHTML = skeletonRows(6);
      const loadingStatus = $('#upcoming-status');
      if (loadingStatus) loadingStatus.textContent = 'Собираем ваши серии…';
      return;
    }

    const all = C.buildCalendarItems(state.notifications, state.epInfo);
    const query = C.normalizeTitleKey(u.view.query);
    const shown = query ? all.filter(item => C.normalizeTitleKey(item.title).includes(query)) : all;
    const status = $('#upcoming-status');
    if (status) status.textContent = all.length ? `Мои серии: ${shown.length} из ${all.length} · доступен поиск` : '';

    const statusEl = $('#upcoming-status');
    if (statusEl) statusEl.textContent = all.length ? `Мои серии: ${shown.length} из ${all.length} · доступен поиск` : '';

    if (!all.length) {
      grid.innerHTML = msgBlock('📅', 'Ближайших серий нет', 'Добавьте тайтлы в «Просмотрено» или «Запланировано» и обновите события.');
      return;
    }
    if (!shown.length) {
      grid.innerHTML = `<div class="msg">
        <span class="emoji">🔍</span>
        <h2>Под запрос ничего не подошло</h2>
        <p>Измените поиск по названию.</p>
        <button class="btn btn-ghost" data-action="reset-upcoming">Сбросить поиск</button>
      </div>`;
      return;
    }

    let html = '';
    let day = '';
    for (const item of shown) {
      const label = dateShort(item.date);
      if (label !== day) {
        day = label;
        html += `<h2 class="month-head">${esc(label)}</h2>`;
      }
      html += `<article class="calendar-row" data-action="open" data-id="${item.id}" tabindex="0" aria-label="Открыть: ${esc(displayTitle(item))}">
        <span class="calendar-date"><b>${esc(label)}</b><small>${esc(countdownLabel(item.date))}</small></span>
        <span class="calendar-main"><b>${esc(displayTitle(item))}</b><small>Серия ${item.n}</small></span>
        <span class="calendar-arrow" aria-hidden="true">›</span>
      </article>`;
    }
    grid.innerHTML = html;
  }

  function renderUpcoming() {
    const grid = $('#upcoming-grid');
    if (!grid) return;
    const u = state.upcoming;
    if (!u.view) {
      u.view = { query: '', filters: { type: '', genre: '', year: '', minScore: '', status: '' }, month: '', sort: 'date', mine: false };
    }
    initUpcomingOptions();
    const mineBtn = $('#upcoming-mine');
    if (mineBtn) {
      const on = Boolean(u.view.mine);
      mineBtn.classList.toggle('btn-primary', on);
      mineBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    }

    if (u.view.mine) {
      renderMyCalendar();
      return;
    }
    syncUpcomingMineUI(false);

    grid.setAttribute('aria-busy', u.loading ? 'true' : 'false');
    if (u.loading && !u.items.length) {
      grid.innerHTML = skeletonCards(10);
      syncUpcomingControls([]);
      return;
    }
    if (u.error && !u.items.length) {
      grid.innerHTML = msgBlock('⚠️', 'Не удалось загрузить премьеры', u.error, 'retry-upcoming');
      return;
    }
    if (!u.items.length) {
      grid.innerHTML = msgBlock('🌌', 'Ближайших премьер не нашлось', 'Попробуйте обновить данные позже.');
      syncUpcomingControls([]);
      updateUpcomingStatus([], []);
      return;
    }

    /* Своё «Просмотрено» и «Запланировано» в премьерах не показываем:
       тайтл уже разобран, второй раз он только мешает. */
    const all = C.excludeListed(u.items, upcomingListed());
    const shown = C.filterUpcoming(all, u.view);
    syncUpcomingControls(all);
    updateUpcomingStatus(all, shown);

    if (!all.length) {
      grid.innerHTML = `<div class="msg">
        <span class="emoji">✅</span>
        <h2>Все премьеры уже в ваших списках</h2>
        <p>Тайтлы из «Просмотрено» и «Запланировано» здесь не повторяются.</p>
      </div>`;
      return;
    }

    if (!shown.length) {
      grid.innerHTML = `<div class="msg">
        <span class="emoji">🔍</span>
        <h2>Под фильтры ничего не подошло</h2>
        <p>Измените запрос, месяц или жанр — или сбросьте фильтры.</p>
        <button class="btn btn-ghost" data-action="reset-upcoming">Сбросить фильтры</button>
      </div>`;
      return;
    }

    let html = '';
    let currentMonth = '';
    for (const a of shown) {
      const month = monthLabel(a.airedFrom);
      if (month !== currentMonth) {
        currentMonth = month;
        html += `<h2 class="month-head">${esc(month)}</h2>`;
      }
      html += cardHTML(a, 'upcoming');
    }
    grid.innerHTML = html;
  }

  /* ---------------- счётчики, обновление экранов, хеши, вкладки ---------------- */
  function updateCounters() {
    const w = $('#count-watched');
    const p = $('#count-planned');
    /* Нулевые счётчики только шумят в навигации — показываем от одного. */
    const set = (el, value) => {
      if (!el) return;
      el.textContent = String(value);
      el.hidden = value === 0;
    };
    set(w, allIn('watched').length);
    set(p, allIn('planned').length);
  }
  function refreshViews() {
    updateCounters();
    renderTierList('watched');
    renderTierList('planned');
    if (state.tab === 'db') renderDB();
    else if (state.tab === 'notifications') renderNotifications();
    else if (state.tab === 'upcoming') renderUpcoming();
    if (state.modalId != null) renderModal();
    if (state.statsScreen && state.statsScreen.open) renderStatsScreen();
    if (state.command && state.command.open) renderCommandResults();
    if (typeof pruneAnimeCache === 'function') pruneAnimeCache();
  }

  function syncBodyScroll() {
    const locked = state.modalId != null
      || Boolean(state.quickMenu)
      || Boolean(state.command && state.command.open)
      || Boolean(state.exchange && state.exchange.open)
      || Boolean(state.customForm && state.customForm.open)
      || Boolean(state.momentForm && state.momentForm.open)
      || Boolean(state.tiktokImport && state.tiktokImport.open)
      || Boolean(state.settingsScreen && state.settingsScreen.open)
      || Boolean(state.statsScreen && state.statsScreen.open)
      || Boolean(state.backup && state.backup.open);
    document.body.classList.toggle('no-scroll', locked);
    /* Скроллбар html тоже отдаёт полосу ширины: без этого нижний лист
       на Android-WebView не достаёт до правого края экрана. */
    if (document.documentElement) document.documentElement.classList.toggle('no-scroll', locked);
  }
  /* ---------------- модалка ---------------- */
  const HASH_TABS = ['db', 'notifications', 'watched', 'planned', 'upcoming'];
  let hashSyncing = false;
  let pendingHashModal = null;

  function parseLocationHash() {
    const raw = String(typeof location !== 'undefined' ? location.hash : '').replace(/^#/, '');
    if (!raw) return { tab: '', modalId: null };
    const anime = raw.match(/^anime\/(\d+)$/);
    if (anime) return { tab: '', modalId: Number(anime[1]) };
    const tab = raw.replace(/\/+$/, '');
    return { tab: HASH_TABS.includes(tab) ? tab : '', modalId: null };
  }

  /* Пишем только осмысленное состояние: вкладку или открытую карточку. */
  function writeLocationHash() {
    if (typeof location === 'undefined' || hashSyncing) return;
    const value = state.modalId != null ? `anime/${state.modalId}` : (state.tab || 'db');
    if (location.hash === `#${value}`) return;
    hashSyncing = true;
    try { location.hash = value; }
    finally { hashSyncing = false; }
  }

  function applyLocationHash() {
    const parsed = parseLocationHash();
    if (parsed.modalId != null) {
      if (!getAnime(parsed.modalId)) { pendingHashModal = parsed.modalId; return; }
      pendingHashModal = null;
      if (state.modalId !== parsed.modalId) openModal(parsed.modalId, { fromHash: true });
      return;
    }
    pendingHashModal = null;
    if (!parsed.tab) return;
    if (state.modalId != null) closeModal({ fromHash: true });
    if (parsed.tab !== state.tab) switchTab(parsed.tab, { fromHash: true });
  }

  /* Ссылка на карточку может прийти раньше загрузки базы: ждём данные. */
  function applyPendingHashModal() {
    if (pendingHashModal == null) return;
    const id = pendingHashModal;
    if (!getAnime(id)) return;
    pendingHashModal = null;
    openModal(id, { fromHash: true });
  }
  /* ---------------- вкладки ---------------- */
  function switchTab(tab, opts = {}) {
    if (!VIEW_TABS.includes(tab)) return;
    state.tab = tab;
    $$('.tab').forEach(t => {
      const on = t.dataset.tab === tab;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
    });
    $$('.view').forEach(v => {
      v.hidden = v.id !== 'view-' + tab;
      v.setAttribute('aria-labelledby', 'tab-' + v.id.replace('view-', ''));
    });

    if (!opts.deferActions) {
      if (tab === 'db') renderDB();
      if (tab === 'watched' || tab === 'planned') renderTierList(tab);
      if (tab === 'notifications') { renderNotifications(); markNotificationsSeen(); fetchNotifications(); ensureNotificationEpisodes(); }
      if (tab === 'upcoming') { renderUpcoming(); fetchUpcoming(); }
    }
    if (!opts.deferPersistence && App.persistCatalogPreferences) App.persistCatalogPreferences();
    updateOfflineBanner();

    if (!opts.silent) window.scrollTo({ top: 0, behavior: 'smooth' });
    if (!opts.fromHash && !state.booting) writeLocationHash();
  }
  /* ---------------- обновление / офлайн ---------------- */
  function updateOfflineBanner() {
    const el = $('#offline-banner');
    if (!el) return;
    const show = state.offline || state.forceDemo;
    el.hidden = !show;
    const text = $('#offline-text');
    if (text && show) {
      const altSearch = state.tab === 'db' && Boolean(state.db.query) && state.db.sources.length > 0;
      if (state.forceDemo) {
        text.textContent = 'Демо-режим: показана локальная подборка, запросы к API отключены.';
      } else if (altSearch) {
        text.textContent = `Основной API недоступен — поиск идёт через ${state.db.sources.join(' и ')}. Остальные данные — демо.`;
      } else {
        text.textContent = 'Нет связи с API — показаны демо-данные.';
      }
    }
  }

  /* ---------------- тосты ---------------- */
  function toast(message, options = {}) {
    const box = $('#toasts');
    if (!box) return;
    const max = document.body && document.body.classList.contains('mobile-app') ? 2 : 4;
    while (box.children.length >= max) box.firstElementChild.remove();
    const el = document.createElement('div');
    el.className = 'toast';
    const text = document.createElement('span');
    text.className = 'toast-text';
    text.textContent = message;
    el.appendChild(text);

    let timer = 0;
    const close = () => {
      clearTimeout(timer);
      el.classList.add('is-out');
      setTimeout(() => el.remove(), 240);
    };

    if (options.actionLabel && typeof options.onAction === 'function') {
      el.classList.add('has-action');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'toast-action';
      button.textContent = options.actionLabel;
      button.addEventListener('click', () => {
        close();
        try { options.onAction(); }
        catch (err) { console.warn('AniTier: действие из уведомления не выполнилось', err); }
      });
      el.appendChild(button);
    }

    box.appendChild(el);
    const duration = Number(options.duration) > 0 ? Number(options.duration) : 3200;
    timer = setTimeout(close, duration);
  }
  Object.assign(App, {
    displayTitle,
    applyAppearance,
    initFilterOptions,
    syncFilterUI,
    closeFilterMenus,
    syncModeChips,
    syncLangUI,
    readFiltersFromUI,
    resetDBFilters,
    updateDBStatus,
    renderDB,
    renderMyCalendar,
    ensureNotificationEpisodes,
    notifRowHTML,
    renderNotifications,
    invalidateNotificationEpisodes,
    allNotifications,
    markNotificationsSeen,
    updateBell,
    renderUpcoming,
    updateCounters,
    refreshViews,
    syncBodyScroll,
    applyLocationHash,
    applyPendingHashModal,
    parseLocationHash,
    writeLocationHash,
    closeDBMoreMenu,
    toggleDBMoreMenu,
    switchTab,
    updateOfflineBanner,
    toast,
  });
})(window.AniTier);
