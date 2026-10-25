/* ============================================================
   AniTier — отрисовка интерфейса
   Загружается после app-store.js и app-api.js, до app.js.
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

  /* Контроллер загружается после отрисовки: вызовы идут во время работы. */
  const fetchDB = (...args) => App.fetchDB(...args);
  const fetchNotifications = (...args) => App.fetchNotifications(...args);
  const fetchUpcoming = (...args) => App.fetchUpcoming(...args);

  function imgAttrs(a, alt) {
    return `src="${esc(a.image || makePoster(a.title, a.id))}" alt="${esc(alt !== undefined ? alt : a.title)}" loading="lazy" data-title="${esc(a.title)}" data-id="${a.id}" onerror="posterFallback(this)"`;
  }

  function cardHTML(a, ctx) {
    const inW = hasIn('watched', a.id);
    const inP = hasIn('planned', a.id);
    const wc = watchedCount(a.id);
    const stats = episodeStats(a);
    const pTotal = stats.total || stats.available || 0;
    const pct = pTotal ? Math.min(100, Math.round((wc / pTotal) * 100)) : 0;
    const metaBits = [typeRu(a.type) || '—', a.year || '—', a.episodes ? `${a.episodes} эп.` : 'серий: ?'];
    return `<article class="card" data-action="open" data-id="${a.id}" tabindex="0" aria-label="${esc(a.title)}">
      <div class="poster">
        <img ${imgAttrs(a)}>
        <div class="poster-shade"></div>
        ${a.score ? `<span class="badge-score">★ ${a.score.toFixed(1)}</span>` : ''}
        ${a.custom ? '<span class="badge-custom">своя</span>' : ''}
        <span class="badge-eps">${a.episodes ? a.episodes + ' эп.' : '? эп.'}</span>
        <div class="card-actions">
          <button class="mini-btn ${inW ? 'is-on' : ''}" data-action="add-watched" data-id="${a.id}" title="Просмотрено" aria-label="Отметить просмотренным">✓</button>
          <button class="mini-btn ${inP ? 'is-on' : ''}" data-action="add-planned" data-id="${a.id}" title="В планы" aria-label="Добавить в планы">◷</button>
        </div>
      </div>
      <div class="card-body">
        <h3 class="card-title">${esc(a.title)}</h3>
        <p class="card-meta">${esc(metaBits.join(' · '))}</p>
        ${ctx === 'upcoming' && a.airedFrom ? `<p class="card-date"><span>${esc(dateShort(a.airedFrom))}</span><span class="dot"></span><span class="soon">${esc(countdownLabel(a.airedFrom))}</span></p>` : ''}
        ${wc > 0 ? `<div class="card-progress"><span class="cp-bar"><i style="width:${pct}%"></i></span><span class="cp-label">✓ ${wc}${pTotal ? ' / ' + pTotal : ''}</span></div>` : ''}
      </div>
    </article>`;
  }

  /* Карточки таскаются только своими pointer-событиями: нативный drag-and-drop
     на телефоне перехватывает долгое нажатие и обрывает жест, а на мыши
     не даёт управлять прокруткой. */

  function tierCardHTML(list, a, tier) {
    const wc = watchedCount(a.id);
    return `<article class="tier-card" data-action="open" data-id="${a.id}" data-list="${list}" data-tier="${tier}" tabindex="0">
      <img ${imgAttrs(a)}>
      <button class="tc-remove" data-action="remove" data-id="${a.id}" data-list="${list}" title="Убрать из списка" aria-label="Убрать из списка">✕</button>
      <div class="tc-body">
        <div class="tc-title" title="${esc(a.title)}">${esc(a.title)}</div>
        <div class="tc-meta">${a.episodes ? a.episodes + ' эп.' : '? эп.'}${a.score ? ' · ★ ' + a.score.toFixed(1) : ''}${wc ? ' · ✓ ' + wc : ''}</div>
      </div>
    </article>`;
  }

  function skeletonCards(n) {
    return Array.from({ length: n }, () => `<div class="skel"><div class="skel-poster"></div><div class="skel-line"></div><div class="skel-line short"></div></div>`).join('');
  }
  function skeletonRows(n) {
    return Array.from({ length: n }, () => `<div class="skel" style="height:104px"></div>`).join('');
  }

  function msgBlock(emoji, title, text, action) {
    return `<div class="msg">
      <span class="emoji">${emoji}</span>
      <h3>${esc(title)}</h3>
      <p>${esc(text)}</p>
      ${action ? `<button class="btn btn-ghost" data-action="${action}">Попробовать снова</button>` : ''}
    </div>`;
  }

  /* ---------------- фильтры и отрисовка базы ---------------- */
  function initFilterOptions() {
    const yearSelect = $('#filter-year');
    if (yearSelect && yearSelect.options.length <= 1) {
      const maxYear = new Date().getFullYear() + 1;
      for (let year = maxYear; year >= 1990; year -= 1) {
        yearSelect.appendChild(new Option(String(year), String(year)));
      }
    }

    const genreSelect = $('#filter-genre');
    if (genreSelect && genreSelect.options.length <= 1) {
      for (const genre of C.GENRES) {
        genreSelect.appendChild(new Option(genre.label, String(genre.id)));
      }
    }
  }

  function syncFilterUI() {
    const filters = state.db.filters;
    const fieldIds = {
      type: '#filter-type',
      status: '#filter-status',
      year: '#filter-year',
      genre: '#filter-genre',
      minScore: '#filter-score',
    };
    for (const [key, selector] of Object.entries(fieldIds)) {
      const field = $(selector);
      if (field) field.value = filters[key] || '';
    }

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
    const raw = {};
    $$('#db-filters [data-filter]').forEach(field => {
      raw[field.dataset.filter] = field.value;
    });
    return C.normalizeFilters(raw);
  }

  function resetDBFilters() {
    state.db.filters = C.normalizeFilters(C.DEFAULT_FILTERS);
    syncFilterUI();
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
    const s = state.db;
    const grid = $('#db-grid');
    const more = $('#db-more');
    if (!grid) return;

    if ((s.loading || state.booting) && !s.items.length) {
      grid.innerHTML = skeletonCards(12);
      if (more) more.hidden = true;
      updateDBStatus();
      return;
    }
    if (s.error && !s.items.length) {
      const status = s.query && s.resolveVia
        ? ` Поиск: ${s.resolveVia === 'dictionary' ? 'словарь AniTier' : s.resolveVia === 'anilist' ? 'название AniList' : s.resolveVia === 'mymemory' ? 'перевод MyMemory' : 'исходная фраза'}.`
        : '';
      grid.innerHTML = msgBlock('⚠️', 'Не удалось загрузить базу', `${s.error}${status}`, 'retry-db');
      if (more) more.hidden = true;
      updateDBStatus();
      return;
    }
    if (!s.items.length) {
      if (s.mode === 'custom' && !s.query && !C.hasActiveFilters(s.filters)) {
        grid.innerHTML = `<div class="msg">
          <span class="emoji">✎</span>
          <h3>Своих карточек пока нет</h3>
          <p>Добавьте тайтл, которого нет в AniList или Kitsu: название, постер, год и серии.</p>
          <button class="btn btn-primary" data-action="new-custom">Создать карточку</button>
        </div>`;
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
      grid.innerHTML = msgBlock('🔎', 'Ничего не нашлось', text);
      if (more) more.hidden = true;
      updateDBStatus();
      return;
    }

    grid.innerHTML = s.items.map(a => cardHTML(a, 'db')).join('');
    if (more) {
      more.hidden = !s.hasNext;
      more.disabled = s.loading;
      more.textContent = s.loading ? 'Загружаем…' : 'Следующая страница';
    }
    updateDBStatus();
  }

  function releaseLine(a, stats) {
    if (stats.ongoing) {
      if (!stats.info) return 'Считаем вышедшие серии…';
      if (!stats.info.count) return 'Серии ещё не вышли';
      if (stats.total) return `Вышла ${stats.info.count}-я серия из ${stats.total}`;
      return `Вышло ${stats.info.count} ${epWord(stats.info.count)}`;
    }
    if (stats.total) {
      if (stats.total % 10 === 1 && stats.total % 100 !== 11) return `Вышла ${stats.total} серия`;
      return `Вышли все ${stats.total} ${epWord(stats.total)}`;
    }
    if (stats.available) return `Вышло ${stats.available} ${epWord(stats.available)}`;
    return 'Количество серий неизвестно';
  }

  function episodeProgressText(id, stats) {
    const total = stats.total || stats.available || 0;
    return `Просмотрено ${watchedCount(id)}${total ? ' из ' + total : ''}`;
  }

  function chipsHTML(a, stats) {
    const id = a.id;
    const set = watchedSet(id);
    const max = stats.available;
    if (!max) {
      if (stats.ongoing && !stats.info) return '<span class="ep-note">Загружаем список серий…</span>';
      return '<span class="ep-note">Серии пока недоступны</span>';
    }
    if (max > LONG_TITLE_EPS) {
      return `<div class="ep-tools">
        <button class="ep-link" data-action="ep-all" data-id="${id}" data-max="${max}">Отметить все</button>
        <span class="ep-tools-sep">·</span>
        <button class="ep-link" data-action="ep-reset" data-id="${id}">Сбросить</button>
      </div>`;
    }
    let out = '';
    for (let i = 1; i <= max; i++) {
      out += `<button class="ep-chip ${set.has(i) ? 'is-watched' : ''}" data-action="toggle-ep" data-id="${id}" data-ep="${i}" title="Серия ${i}: ${set.has(i) ? 'просмотрена' : 'не просмотрена'}">${i}</button>`;
    }
    return `<div class="ep-chips">${out}</div>
      <div class="ep-tools">
        <button class="ep-link" data-action="ep-all" data-id="${id}" data-max="${max}">Отметить все</button>
        <span class="ep-tools-sep">·</span>
        <button class="ep-link" data-action="ep-reset" data-id="${id}">Сбросить</button>
      </div>`;
  }

  function renderEpisodeBlock(a, variant = 'notif') {
    if (a.status === 'Анонс') {
      return `<div class="ep-block ep-${variant}" data-ep-block="${a.id}" data-variant="${variant}">
        <p class="ep-note">Аниме ещё не вышло — отмечать серии пока нельзя.</p>
      </div>`;
    }
    const stats = episodeStats(a);
    const total = stats.total || stats.available || 0;
    const max = stats.available || 0;
    const wc = watchedCount(a.id);
    const sliderValue = Math.min(wc, max);
    const pct = total ? Math.min(100, Math.round((wc / total) * 100)) : 0;
    const sliderPct = max ? Math.min(100, Math.round((sliderValue / max) * 100)) : 0;
    const nextLine = stats.ongoing && stats.info && stats.info.next
      ? `<span class="ep-next">Следующая: ${stats.info.next.n}-я · ${esc(dateShort(stats.info.next.date))}</span>`
      : '';
    const slider = max > LONG_TITLE_EPS
      ? `<div class="ep-slider-row">
          <span class="ep-slider-bound">0</span>
          <input class="ep-slider" type="range" min="0" max="${max}" step="1" value="${sliderValue}"
            data-action="ep-slider" data-id="${a.id}" data-max="${max}" data-total="${total || max}"
            style="--ep-fill:${sliderPct}%"
            aria-label="Просмотрено серий: ${sliderValue} из ${max}">
          <span class="ep-slider-bound">${max}</span>
        </div>`
      : '';
    return `<div class="ep-block ep-${variant}" data-ep-block="${a.id}" data-variant="${variant}">
      <div class="ep-head">
        <span class="ep-release">${esc(releaseLine(a, stats))}</span>
        <span class="ep-watched">${esc(episodeProgressText(a.id, stats))}</span>
      </div>
      <div class="ep-bar"><i data-ep-bar="${a.id}" style="width:${pct}%"></i></div>
      ${slider}
      ${nextLine}
      ${chipsHTML(a, stats)}
    </div>`;
  }

  function previewEpisodeSlider(slider) {
    const id = Number(slider.dataset.id);
    const max = Number(slider.dataset.max) || 0;
    const total = Number(slider.dataset.total) || max;
    const value = Math.max(0, Math.min(Number(slider.value) || 0, max));
    const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
    const barPct = total ? Math.min(100, Math.round((value / total) * 100)) : 0;
    const block = slider.closest('.ep-block');

    slider.style.setProperty('--ep-fill', `${pct}%`);
    slider.setAttribute('aria-label', `Просмотрено серий: ${value} из ${max}`);
    if (!block) return;

    const label = block.querySelector('.ep-watched');
    if (label) label.textContent = `Просмотрено ${value}${total ? ' из ' + total : ''}`;
    const bar = block.querySelector(`[data-ep-bar="${id}"]`);
    if (bar) bar.style.width = `${barPct}%`;
  }

  function updateEpisodeUI(id) {
    const a = getAnime(id);
    if (!a) return;
    $$(`[data-ep-block="${id}"]`).forEach(block => {
      const variant = block.dataset.variant || 'notif';
      const holder = document.createElement('div');
      holder.innerHTML = renderEpisodeBlock(a, variant);
      const fresh = holder.firstElementChild;
      if (fresh) block.replaceWith(fresh);
    });
  }

  function episodeInfoFromAnime(a) {
    const total = Number(a.episodes) || null;
    const next = a.nextEpisode || null;
    let count = 0;

    if (a.status === 'В эфире') {
      if (a.airedEpisodes != null) count = Math.max(0, Number(a.airedEpisodes) || 0);
      else if (next && next.n) count = Math.max(0, Number(next.n) - 1);
    } else if (a.status === 'Завершено') {
      count = total != null ? total : Math.max(0, Number(a.airedEpisodes) || 0);
    }

    return {
      count,
      last: count,
      lastAired: null,
      next,
      fetchedAt: Date.now(),
      total,
      source: 'api',
    };
  }

  function ensureEpisodeInfo(a) {
    if (!a) return null;
    const cached = state.epInfo[a.id];
    const fresh = cached && Date.now() - Number(cached.fetchedAt || 0) < 2 * 3600000;
    const demoCacheInLiveMode = cached && cached.source === 'demo' && !state.forceDemo && !a.demo;
    if (fresh && !demoCacheInLiveMode) return cached;

    if (state.forceDemo || a.demo) {
      if (a.demoEp) {
        state.epInfo[a.id] = {
          count: Math.min(Number(a.demoEp.aired) || 0, Number(a.episodes) || 99),
          last: Number(a.demoEp.aired) || 0,
          lastAired: a.demoEp.lastAired || null,
          next: a.demoEp.nextDate ? { n: (Number(a.demoEp.aired) || 0) + 1, date: a.demoEp.nextDate } : null,
          fetchedAt: Date.now(),
          total: Number(a.episodes) || Number(a.demoEp.total) || null,
          source: 'demo',
        };
        updateEpisodeUI(a.id);
      }
      return state.epInfo[a.id] || null;
    }

    state.epInfo[a.id] = episodeInfoFromAnime(a);
    saveState();
    updateEpisodeUI(a.id);
    return state.epInfo[a.id];
  }

  function ensureNotificationEpisodes() {
    if (state.tab !== 'notifications') return;
    const all = allNotifications();
    for (const a of all) {
      const info = state.epInfo[a.id];
      const demoCacheInLiveMode = info && info.source === 'demo' && !state.forceDemo && !a.demo;
      const fresh = info && Date.now() - Number(info.fetchedAt || 0) < 2 * 3600000;
      if (fresh && !demoCacheInLiveMode) continue;
      const needsInfo = a.status === 'В эфире' || !a.episodes;
      if (needsInfo) ensureEpisodeInfo(a);
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

    return `<article class="notif notif-${kind}" data-action="open" data-id="${a.id}" tabindex="0" aria-label="${esc(a.title)}">
      <div class="notif-visual"><div class="notif-date"><b>${day}</b><span>${mon}</span></div><img class="notif-poster" ${imgAttrs(a, '')}></div>
      <div class="notif-body">
        <h3 class="notif-title">${esc(a.title)}${isNew ? '<span class="flag-new">new</span>' : ''}</h3>
        <p class="notif-alt">${esc(a.altTitle || '')}</p>
        <div class="notif-meta">
          ${meta}
          ${a.type ? `<span>· ${esc(typeRu(a.type))}</span>` : ''}
          <span>· ${a.episodes ? a.episodes + ' эп.' : 'серий: ?'}</span>
          ${a.score ? `<span>· <b>★ ${a.score.toFixed(1)}</b></span>` : ''}
        </div>
        ${renderEpisodeBlock(a, 'notif')}
      </div>
      <div class="notif-actions">
        <button class="mini-btn ${inW ? 'is-on' : ''}" data-action="add-watched" data-id="${a.id}" title="Добавить в просмотрено" aria-label="Добавить в просмотрено">✓</button>
        <button class="mini-btn ${inP ? 'is-on' : ''}" data-action="add-planned" data-id="${a.id}" title="В планы" aria-label="Добавить в планы">◷</button>
      </div>
    </article>`;
  }

  function renderNotifications() {
    const el = $('#notif-list');
    if (!el) return;
    const n = state.notifications;
    const tracked = n.tracked.episodes.length + n.tracked.seasons.length;
    const recent = n.recent.episodes.length + n.recent.films.length;
    const completed = n.completed.length;
    const totalCount = tracked + recent + completed;

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

    ensureNotificationEpisodes();
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

  function renderUpcoming() {
    const grid = $('#upcoming-grid');
    if (!grid) return;
    const u = state.upcoming;
    if (!u.view) {
      u.view = { query: '', filters: { type: '', genre: '', year: '', minScore: '', status: '' }, month: '', sort: 'date' };
    }
    initUpcomingOptions();

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
        <h3>Все премьеры уже в ваших списках</h3>
        <p>Тайтлы из «Просмотрено» и «Запланировано» здесь не повторяются.</p>
      </div>`;
      return;
    }

    if (!shown.length) {
      grid.innerHTML = `<div class="msg">
        <span class="emoji">🔍</span>
        <h3>Под фильтры ничего не подошло</h3>
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

  /* ---------------- тир-листы ---------------- */
  function renderTierList(name) {
    const root = document.getElementById(name === 'watched' ? 'tiers-watched' : 'tiers-planned');
    if (!root) return;
    const list = state.lists[name];

    root.innerHTML = TIERS.map(t => {
      const items = list[t.id] || [];
      return `<div class="tier-row">
        <div class="tier-label tier-${t.id}" title="${esc(t.name)}">
          <span>${t.label}</span>
          <small>${esc(t.id === 'N' ? 'Без оц.' : t.name)}</small>
          <em>${items.length}</em>
        </div>
        <div class="tier-drop" data-list="${name}" data-tier="${t.id}">
          ${items.length
            ? items.map(a => tierCardHTML(name, a, t.id)).join('')
            : '<span class="tier-hint">Перетащите аниме сюда</span>'}
        </div>
      </div>`;
    }).join('');

    renderStats(name);
  }

  function renderStats(name) {
    const el = document.getElementById('stats-' + name);
    if (!el) return;
    const all = allIn(name);
    const eps = all.reduce((s, a) => s + (Number(a.episodes) || 0), 0);
    const scored = all.filter(a => typeof a.score === 'number');
    const avg = scored.length ? (scored.reduce((s, a) => s + a.score, 0) / scored.length).toFixed(2) : '—';
    el.innerHTML = `
      <div class="stat"><b>${all.length}</b><span>тайтлов</span></div>
      <div class="stat"><b>${eps}</b><span>серий (известных)</span></div>
      <div class="stat"><b>${avg}</b><span>средний балл</span></div>
      <div class="stat"><b>${(state.lists[name].S || []).length}</b><span>в тире S</span></div>`;
  }

  function updateCounters() {
    const w = $('#count-watched');
    const p = $('#count-planned');
    if (w) w.textContent = allIn('watched').length;
    if (p) p.textContent = allIn('planned').length;
  }

  /* ---------------- свои карточки и моменты: формы ---------------- */
  const CUSTOM_TYPES = [
    { value: '', label: 'Не указан' },
    { value: 'TV', label: 'ТВ-сериал' },
    { value: 'Movie', label: 'Фильм' },
    { value: 'OVA', label: 'OVA' },
    { value: 'ONA', label: 'ONA' },
    { value: 'Special', label: 'Спешл' },
  ];

  function openCustomForm(id = null) {
    const editingId = id == null ? null : Number(id);
    if (editingId != null && !getAnime(editingId)) return;
    if (state.modalId != null) closeModal();
    state.customForm = { open: true, editingId, error: '', busy: false };
    renderCustomForm();
    const modal = $('#custom-modal');
    if (modal) modal.hidden = false;
    syncBodyScroll();
    const panel = $('#custom-panel');
    if (panel) { panel.scrollTop = 0; panel.focus({ preventScroll: true }); }
    const field = $('#custom-form input[name="title"]');
    if (field) field.focus({ preventScroll: true });
  }

  function closeCustomForm(reopen = true) {
    const editingId = state.customForm.editingId;
    state.customForm = { open: false, editingId: null, error: '', busy: false };
    const modal = $('#custom-modal');
    if (modal) modal.hidden = true;
    syncBodyScroll();
    if (reopen && editingId != null && getAnime(editingId)) openModal(editingId);
  }

  function renderCustomForm() {
    const box = $('#custom-content');
    if (!box) return;
    const editingId = state.customForm.editingId;
    const card = editingId != null ? getAnime(editingId) : null;
    const val = (key) => esc(card && card[key] != null ? card[key] : '');
    const typeOptions = CUSTOM_TYPES.map(item => (
      `<option value="${esc(item.value)}"${card && (card.type || '') === item.value ? ' selected' : ''}>${esc(item.label)}</option>`
    )).join('');
    const preview = card && card.image
      ? `<img src="${esc(card.image)}" alt="Постер">`
      : '<span>Без постера — будет заглушка</span>';
    box.innerHTML = `<form class="custom-form" id="custom-form" novalidate>
      <h2 id="custom-title">${card ? 'Редактировать карточку' : 'Своя карточка'}</h2>
      <p class="custom-sub">Тайтл, которого нет в AniList или Kitsu. Он попадёт в «Мои карточки» и сможет жить в тир-листах.</p>
      <label class="form-field"><span>Название *</span><input name="title" required maxlength="300" value="${val('title')}" autocomplete="off"></label>
      <label class="form-field"><span>Оригинальное название</span><input name="altTitle" maxlength="300" value="${val('altTitle')}" autocomplete="off"></label>
      <div class="form-row">
        <label class="form-field"><span>Год</span><input name="year" type="number" min="1900" max="2100" value="${card && card.year ? card.year : ''}"></label>
        <label class="form-field"><span>Серии</span><input name="episodes" type="number" min="1" max="9999" value="${card && card.episodes ? card.episodes : ''}"></label>
        <label class="form-field"><span>Тип</span><select name="type">${typeOptions}</select></label>
      </div>
      <label class="form-field"><span>Жанры</span><input name="genres" maxlength="300" value="${esc(card && card.genres ? card.genres.join(', ') : '')}" placeholder="Драма, Фэнтези"></label>
      <label class="form-field"><span>Описание</span><textarea name="synopsis" rows="4" maxlength="2000">${val('synopsis')}</textarea></label>
      <label class="form-field form-file"><span>Постер</span><input name="poster" type="file" accept="image/*"><small>JPG, PNG или WebP до ${C.formatBytes(App.CUSTOM_IMAGE_MAX)}. Полная картинка хранится в браузере.</small></label>
      <div class="custom-poster-preview" id="custom-poster-preview">${preview}</div>
      ${state.customForm.error ? `<p class="form-error">${esc(state.customForm.error)}</p>` : ''}
      <div class="form-actions">
        <button class="btn btn-primary" type="submit"${state.customForm.busy ? ' disabled' : ''}>${state.customForm.busy ? 'Сохраняем…' : 'Сохранить'}</button>
        <button class="btn btn-ghost" type="button" data-action="close-custom">Отмена</button>
      </div>
    </form>`;
  }

  function momentLabel(m) {
    return m.title || (m.kind === 'tiktok' ? 'TikTok' : m.kind === 'gif' ? 'GIF' : 'Видео');
  }

  function momentCardHTML(animeId, m) {
    const thumb = m.thumb
      ? `<img src="${esc(m.thumb)}" alt="" loading="lazy">`
      : `<span class="moment-fallback">${m.kind === 'tiktok' ? 'TikTok' : m.kind === 'gif' ? 'GIF' : '▶'}</span>`;
    const meta = m.kind === 'tiktok' ? 'TikTok' : m.kind === 'gif' ? 'GIF' : 'Видео';
    return `<article class="moment-card" data-moment-card="${esc(m.id)}">
      <button class="moment-preview" type="button" data-action="moment-play" data-id="${animeId}" data-moment="${esc(m.id)}" aria-label="Открыть момент: ${esc(momentLabel(m))}">
        ${thumb}<span class="moment-play-icon">▶</span>
      </button>
      <div class="moment-body">
        <div class="moment-title" title="${esc(momentLabel(m))}">${esc(momentLabel(m))}</div>
        <div class="moment-meta">${esc(meta)}${m.size ? ` · ${esc(C.formatBytes(m.size))}` : ''}</div>
        <div class="moment-actions">
          ${m.kind === 'tiktok' ? `<button class="ep-link" type="button" data-action="moment-open-tiktok" data-id="${animeId}" data-moment="${esc(m.id)}">Открыть в TikTok ↗</button>` : ''}
          <button class="ep-link" type="button" data-action="moment-share" data-id="${animeId}" data-moment="${esc(m.id)}">Поделиться</button>
          <button class="ep-link" type="button" data-action="moment-delete" data-id="${animeId}" data-moment="${esc(m.id)}">Удалить</button>
        </div>
      </div>
    </article>`;
  }

  function momentsHTML(a) {
    const items = momentsFor(a.id);
    return `<div class="modal-section modal-moments">
      <div class="modal-label modal-label-row"><span>Моменты</span><button class="ep-link" type="button" data-action="moment-add" data-id="${a.id}">+ Добавить</button></div>
      ${items.length
        ? `<div class="moments-grid">${items.map(m => momentCardHTML(a.id, m)).join('')}</div>`
        : '<p class="ep-note">Сохранённых моментов пока нет. Добавьте ссылку TikTok или видео/GIF.</p>'}
    </div>`;
  }

  function openMomentForm(animeId) {
    const a = getAnime(animeId);
    if (!a) return;
    if (state.modalId != null) closeModal();
    state.momentForm = { open: true, animeId, mode: 'tiktok', error: '', busy: false, url: '', title: '' };
    renderMomentForm();
    const modal = $('#moment-modal');
    if (modal) modal.hidden = false;
    syncBodyScroll();
    const panel = $('#moment-panel');
    if (panel) { panel.scrollTop = 0; panel.focus({ preventScroll: true }); }
  }

  function closeMomentForm(reopen = true) {
    const animeId = state.momentForm.animeId;
    state.momentForm = { open: false, animeId: null, mode: 'tiktok', error: '', busy: false, url: '', title: '' };
    const modal = $('#moment-modal');
    if (modal) modal.hidden = true;
    syncBodyScroll();
    if (reopen && animeId != null && getAnime(animeId)) openModal(animeId);
  }

  function renderMomentForm() {
    const box = $('#moment-content');
    if (!box) return;
    const f = state.momentForm;
    const a = getAnime(f.animeId);
    if (!a) return;
    const mode = f.mode;    box.innerHTML = `<form class="custom-form moment-form" id="moment-form" novalidate>
      <h2 id="moment-title">Момент из «${esc(a.title)}»</h2>
      <div class="moment-tabs">
        <button type="button" class="chip ${mode === 'tiktok' ? 'is-active' : ''}" data-action="moment-mode" data-mode="tiktok">TikTok</button>
        <button type="button" class="chip ${mode === 'file' ? 'is-active' : ''}" data-action="moment-mode" data-mode="file">Видео или GIF</button>
      </div>
      ${mode === 'tiktok' ? `
        <label class="form-field"><span>Ссылка на TikTok *</span><input name="url" type="url" required placeholder="https://www.tiktok.com/@.../video/..." value="${esc(f.url || '')}" autocomplete="off"></label>
        <label class="form-field"><span>Подпись</span><input name="title" maxlength="200" value="${esc(f.title || '')}" placeholder="Например: любимая сцена"></label>
        <p class="form-note">Плеер TikTok загрузится только после нажатия на момент.</p>
      ` : `
        <label class="form-field form-file"><span>Видео или GIF *</span><input name="file" type="file" accept="video/mp4,video/webm,image/gif"><small>MP4/WebM до ${C.formatBytes(App.MOMENT_VIDEO_MAX)} или GIF до ${C.formatBytes(App.MOMENT_GIF_MAX)}.</small></label>
        <label class="form-field"><span>Подпись</span><input name="title" maxlength="200" value="${esc(f.title || '')}" placeholder="Например: любимая сцена"></label>
        <p class="form-note">Файл хранится в этом браузере. В резервную копию попадут только подпись и миниатюра.</p>
      `}
      ${f.error ? `<p class="form-error">${esc(f.error)}</p>` : ''}
      <div class="form-actions">
        <button class="btn btn-primary" type="submit"${f.busy ? ' disabled' : ''}>${f.busy ? 'Сохраняем…' : 'Добавить момент'}</button>
        <button class="btn btn-ghost" type="button" data-action="close-moment">Отмена</button>
      </div>
    </form>`;
  }

  function tiktokImportOptions() {
    const unique = new Map();
    const add = anime => { if (anime && Number.isFinite(Number(anime.id)) && anime.title) unique.set(Number(anime.id), anime); };
    state.byId.forEach(add);
    for (const list of ['watched', 'planned']) allIn(list).forEach(add);
    (state.db.items || []).forEach(add);
    (state.upcoming.items || []).forEach(add);
    const query = C.normalizeTitleKey(state.tiktokImport.query);
    let items = [...unique.values()];
    if (query) {
      items = items.filter(anime => [anime.title, anime.altTitle, ...(anime.aliases || [])]
        .some(title => C.normalizeTitleKey(title).includes(query)));
    } else {
      const tracked = new Set([...allIn('watched'), ...allIn('planned')].map(anime => anime.id));
      items = items.filter(anime => tracked.has(anime.id));
    }
    return items.slice(0, 16);
  }

  function renderTikTokImport() {
    const model = state.tiktokImport;
    if (!model || !model.open) return;
    let modal = $('#tiktok-import-modal');
    if (!modal) {
      document.body.insertAdjacentHTML('beforeend', `<div class="modal" id="tiktok-import-modal" hidden>
        <div class="modal-backdrop" data-action="close-tiktok-import"></div>
        <section class="modal-panel tiktok-import-panel" role="dialog" aria-modal="true" aria-labelledby="tiktok-import-title" tabindex="-1">
          <button class="modal-close" data-action="close-tiktok-import" aria-label="Закрыть">✕</button>
          <div class="custom-content" id="tiktok-import-content"></div>
        </section>
      </div>`);
      modal = $('#tiktok-import-modal');
    }
    const inputFocused = document.activeElement && document.activeElement.id === 'tiktok-import-search';
    const selection = inputFocused ? document.activeElement.selectionStart : null;
    const items = tiktokImportOptions();
    const rows = items.map(anime => `<button type="button" class="tiktok-import-result" data-action="tiktok-import-save" data-id="${anime.id}">
      <img ${imgAttrs(anime, '')}><span><b>${esc(anime.title)}</b><small>${esc([anime.altTitle, anime.year, typeRu(anime.type)].filter(Boolean).join(' · '))}</small></span><strong>Добавить</strong>
    </button>`).join('');
    const hint = items.length ? '' : model.query
      ? '<p class="ep-note">В загруженном каталоге такого аниме нет. Сначала найдите его во вкладке «База».</p>'
      : '<p class="ep-note">Введите название аниме или выберите его из своих списков ниже.</p>';
    $('#tiktok-import-content').innerHTML = `<h2 id="tiktok-import-title">Добавить видео TikTok к аниме</h2>
      <p class="form-note">Откройте понравившееся видео в TikTok, нажмите «Поделиться» и выберите AniTier. Затем укажите карточку аниме.</p>
      <div class="tiktok-import-preview">${model.thumb ? `<img src="${esc(model.thumb)}" alt="">` : '<span class="moment-fallback">TikTok</span>'}
        <div><b>${esc(model.title || 'Видео TikTok')}</b><button class="ep-link" type="button" data-action="tiktok-import-open-video">Открыть видео в TikTok ↗</button></div></div>
      <label class="form-field"><span>Аниме</span><input id="tiktok-import-search" type="search" value="${esc(model.query)}" placeholder="Например, Фрирен или Bleach" autocomplete="off"></label>
      <div class="tiktok-import-results">${rows || hint}</div>
      <p class="form-note">Видео появится в разделе «Моменты» выбранной карточки. Добавляйте понравившиеся видео по одному через системное меню «Поделиться».</p>`;
    modal.hidden = false;
    const input = $('#tiktok-import-search');
    if (inputFocused && input) {
      input.focus({ preventScroll: true });
      if (selection != null) input.setSelectionRange(selection, selection);
    }
  }

  function renderBackup() {
    const box = $('#backup-content');
    if (!box) return;
    const f = state.backup || {};
    const drive = App.driveAvailable ? App.driveAvailable() : false;
    const disabled = f.busy ? ' disabled' : '';
    const status = f.message
      ? `<p class="backup-status${f.error ? ' is-error' : ''}" role="status">${esc(f.message)}</p>`
      : '';
    const driveBlock = drive
      ? `<div class="backup-block">
          <h3>Google Drive</h3>
          <p>Копия сохраняется в файл <code>anitier-backup.json</code> в вашем Google Drive. Приложение видит только файлы, созданные им самим.</p>
          <div class="form-actions">
            <button class="btn btn-primary" type="button" data-action="backup-drive-save"${disabled}>${f.busy ? 'Подождите…' : 'Сохранить в Google Drive'}</button>
            <button class="btn btn-ghost" type="button" data-action="backup-drive-load"${disabled}>Восстановить из Google Drive</button>
          </div>
        </div>`
      : `<div class="backup-block">
          <h3>Google Drive</h3>
          <p class="form-note">Google Drive доступен на сайте и в PWA. В APK используйте файл — он сохраняется через системный диалог.</p>
        </div>`;
    box.innerHTML = `<h2 id="backup-title">Резервная копия</h2>
      <p class="custom-sub">Списки, прогресс, свои карточки, моменты, настройки и кэш переводов. В копию входят миниатюры, но не полные постеры, видео и GIF — они остаются в этом браузере.</p>
      <div class="backup-block">
        <h3>Файл</h3>
        <p>Скачайте JSON-файл и храните его где удобно. Восстановление заменит текущие списки, прогресс и настройки.</p>
        <div class="form-actions">
          <button class="btn btn-primary" type="button" data-action="backup-download"${disabled}>Скачать файл</button>
          <label class="btn btn-ghost file-btn${f.busy ? ' is-disabled' : ''}">Восстановить из файла
            <input type="file" accept=".json,application/json" data-action="backup-file"${disabled} hidden>
          </label>
        </div>
      </div>
      <div class="backup-block">
        <h3>Медиа отдельно</h3>
        <p>Перенесите полные постеры, видео и GIF в отдельном архиве до 500 МБ. Для переноса на другое устройство сначала восстановите JSON-копию, затем импортируйте этот архив.</p>
        <div class="form-actions">
          <button class="btn btn-ghost" type="button" data-action="media-export"${disabled}>${f.busy ? 'Подождите…' : 'Экспортировать медиа'}</button>
          <label class="btn btn-ghost file-btn${f.busy ? ' is-disabled' : ''}">Импортировать медиа
            <input type="file" accept=".bin,application/octet-stream" data-action="media-file"${disabled} hidden>
          </label>
        </div>
      </div>
      ${driveBlock}
      ${status}
      <p class="form-note backup-note">В JSON входят подписи, ссылки TikTok и миниатюры. Полные постеры, видео и GIF переносите отдельным медиаархивом.</p>`;
  }

  function openBackup() {
    if (state.modalId != null) closeModal();
    if (state.customForm && state.customForm.open) closeCustomForm(false);
    if (state.momentForm && state.momentForm.open) closeMomentForm(false);
    state.backup = { open: true, busy: false, message: '', error: false };
    renderBackup();
    const modal = $('#backup-modal');
    if (modal) modal.hidden = false;
    syncBodyScroll();
    const panel = $('#backup-panel');
    if (panel) { panel.scrollTop = 0; panel.focus({ preventScroll: true }); }
  }

  function closeBackup() {
    state.backup = { open: false, busy: false, message: '', error: false };
    const modal = $('#backup-modal');
    if (modal) modal.hidden = true;
    syncBodyScroll();
  }

  /* ---------------- настройки ---------------- */
  function renderSettings() {
    const box = $('#settings-content');
    if (!box) return;
    const screen = state.settingsScreen || {};
    const version = C.APP_VERSION || '—';
    const bridge = typeof window !== 'undefined' ? window.AniTierAndroid : null;
    const remindersSupported = Boolean(bridge && typeof bridge.setReleaseNotificationsEnabled === 'function');
    const remindersOn = remindersSupported
      && Boolean(App.releaseNotificationsEnabled && App.releaseNotificationsEnabled());
    const searchLang = C.normalizeSearchLang(state.settings.searchLang);
    const provider = state.settings.translationProvider || 'auto';
    const github = C.GITHUB_URL || '';

    const reminders = remindersSupported
      ? `<div class="backup-block">
          <h3>Напоминания о сериях</h3>
          <p>Телефон пришлёт уведомление, когда выходит новая серия отслеживаемого тайтла. Расписание обновляется при каждом открытии «Событий».</p>
          <button class="btn ${remindersOn ? 'btn-primary' : 'btn-ghost'} settings-toggle" type="button" data-action="release-notifications" id="release-notif-toggle" aria-pressed="${remindersOn ? 'true' : 'false'}">${remindersOn ? '✓ Напоминания включены' : 'Включить напоминания'}</button>
        </div>`
      : `<div class="backup-block">
          <h3>Напоминания о сериях</h3>
          <p class="form-note">Работают в приложении для Android. На сайте и в PWA напоминания не приходят.</p>
        </div>`;

    let updateStatus = '';
    if (screen.message) {
      updateStatus = `<p class="backup-status${screen.error ? ' is-error' : ''}" role="status">${esc(screen.message)}</p>`;
    }
    const release = screen.latest;
    const releaseLink = release && release.url && C.compareVersions(release.version, version) > 0
      ? `<button class="btn btn-ghost" type="button" data-action="open-link" data-url="${esc(release.url)}">Открыть релиз ${esc(release.version)}</button>`
      : '';

    box.innerHTML = `<h2 id="settings-title">Настройки</h2>
      <p class="custom-sub">AniTier ${esc(version)} · данные хранятся только на этом устройстве.</p>
      ${reminders}
      <div class="backup-block">
        <h3>Поиск и перевод</h3>
        <label class="settings-field">
          <span>Язык поиска</span>
          <select data-action="settings-search-lang" aria-label="Язык поиска">
            <option value="auto"${searchLang === 'auto' ? ' selected' : ''}>Авто</option>
            <option value="ru"${searchLang === 'ru' ? ' selected' : ''}>Русский</option>
            <option value="en"${searchLang === 'en' ? ' selected' : ''}>English</option>
            <option value="ja"${searchLang === 'ja' ? ' selected' : ''}>日本語</option>
          </select>
        </label>
        <label class="settings-field">
          <span>Перевод синопсисов</span>
          <select data-action="settings-translation" aria-label="Провайдер перевода">
            <option value="auto"${provider === 'auto' ? ' selected' : ''}>Авто: MyMemory → Google</option>
            <option value="mymemory"${provider === 'mymemory' ? ' selected' : ''}>MyMemory</option>
            <option value="google"${provider === 'google' ? ' selected' : ''}>Google Переводчик</option>
          </select>
        </label>
      </div>
      <div class="backup-block">
        <h3>Данные</h3>
        <p>Списки, прогресс, свои карточки, моменты и настройки. Импорт и экспорт — в резервной копии.</p>
        <div class="form-actions">
          <button class="btn btn-ghost" type="button" data-action="open-backup">Резервная копия и перенос</button>
          <button class="btn btn-ghost" type="button" data-action="open-exchange">Обмен тир-листом</button>
        </div>
      </div>
      <div class="backup-block">
        <h3>О приложении</h3>
        <p>Версия ${esc(version)}. Исходники и новости — на GitHub.</p>
        <div class="form-actions">
          <button class="btn btn-ghost" type="button" data-action="open-link" data-url="${esc(github)}">GitHub</button>
          <button class="btn btn-primary" type="button" data-action="check-updates"${screen.checking ? ' disabled' : ''}>${screen.checking ? 'Проверяем…' : 'Проверить обновления'}</button>
          ${releaseLink}
        </div>
        ${updateStatus}
      </div>`;
  }

  function openSettings() {
    if (state.modalId != null) closeModal();
    if (state.backup && state.backup.open) closeBackup();
    state.settingsScreen = { open: true, checking: false, message: '', error: false, latest: null };
    renderSettings();
    const modal = $('#settings-modal');
    if (modal) modal.hidden = false;
    syncBodyScroll();
    const panel = $('#settings-panel');
    if (panel) { panel.scrollTop = 0; panel.focus({ preventScroll: true }); }
  }

  function closeSettings() {
    state.settingsScreen = { open: false, checking: false, message: '', error: false, latest: null };
    const modal = $('#settings-modal');
    if (modal) modal.hidden = true;
    syncBodyScroll();
  }

  function refreshViews() {
    updateCounters();
    renderTierList('watched');
    renderTierList('planned');
    if (state.tab === 'db') renderDB();
    else if (state.tab === 'notifications') renderNotifications();
    else if (state.tab === 'upcoming') renderUpcoming();
    if (state.modalId != null) renderModal();
  }

  function syncBodyScroll() {
    const locked = state.modalId != null
      || Boolean(state.exchange && state.exchange.open)
      || Boolean(state.customForm && state.customForm.open)
      || Boolean(state.momentForm && state.momentForm.open)
      || Boolean(state.tiktokImport && state.tiktokImport.open)
      || Boolean(state.backup && state.backup.open);
    document.body.classList.toggle('no-scroll', locked);
  }

  function tierShort(tier) {
    return tier === 'N' ? 'Без оц.' : tier;
  }

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
    toast(`«${row.anime.title}» → Запланировано · Без оценки`);
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
        <div class="exchange-row-title">${esc(anime.title)}</div>
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
      <div class="exchange-filters" role="group" aria-label="Фильтр сравнения">${filters}</div>
      ${groups || `<div class="exchange-empty">${esc(emptyText)}</div>`}
    </div>`;
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
            <p class="exchange-sub">Вставьте код друга. Сначала покажем сравнение — менять ваш тир-лист можно только по одному тайтлу.</p>
          </div>
          <button class="exchange-link" data-action="exchange-mode" data-mode="export">Экспорт →</button>
        </div>
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

  /* ---------------- модалка ---------------- */
  function openModal(id) {
    const a = getAnime(id);
    if (!a) { toast('Не удалось открыть карточку'); return; }
    state.modalId = id;
    renderModal();
    const modal = $('#modal');
    modal.hidden = false;
    syncBodyScroll();
    const panel = $('.modal-panel');
    if (panel) { panel.scrollTop = 0; panel.focus({ preventScroll: true }); }
    if (a.custom && App.hydrateCustomImage) App.hydrateCustomImage(id);
  }

  function franchiseRelationLabel(type) {
    if (type === 'PREQUEL' || type === 'PARENT') return 'Смотреть раньше';
    if (type === 'CURRENT') return 'Текущая часть';
    if (type === 'SEQUEL') return 'Следующий сезон';
    if (type === 'SPIN_OFF') return 'Спин-офф';
    return 'Связанная история';
  }

  function renderFranchiseSection(anime) {
    if (anime.custom) return '';
    const related = state.franchiseById.get(anime.id);
    if (state.franchiseLoading.has(anime.id)) {
      return '<div class="modal-section franchise-section"><div class="modal-label">Сезоны и порядок просмотра</div><p class="hint">Загружаем связанные сезоны…</p></div>';
    }
    if (state.franchiseErrors.has(anime.id)) {
      return `<div class="modal-section franchise-section"><div class="modal-label">Сезоны и порядок просмотра</div><p class="hint">${esc(state.franchiseErrors.get(anime.id))}</p><button class="btn btn-ghost" data-action="retry-franchise" data-id="${anime.id}">Повторить</button></div>`;
    }
    if (!related) return '<div class="modal-section franchise-section"><div class="modal-label">Сезоны и порядок просмотра</div><p class="hint">Проверяем, есть ли связанные сезоны…</p></div>';
    if (!related.length) return '<div class="modal-section franchise-section"><div class="modal-label">Сезоны и порядок просмотра</div><p class="hint">Связанные сезоны и продолжения не найдены.</p></div>';

    const before = related.filter(link => link.relationType === 'PREQUEL' || link.relationType === 'PARENT');
    const after = related.filter(link => link.relationType !== 'PREQUEL' && link.relationType !== 'PARENT');
    const ordered = [...before, { anime, relationType: 'CURRENT' }, ...after];
    const rows = ordered.map(link => {
      const item = link.anime;
      const tier = findTier('watched', item.id) || findTier('planned', item.id);
      const progress = watchedCount(item.id);
      const isCurrent = link.relationType === 'CURRENT';
      const meta = [typeRu(item.type) || '', item.year || '', item.episodes ? `${item.episodes} серий` : ''].filter(Boolean).join(' · ');
      const listStatus = tier ? `В тире ${tier}` : 'Не в тир-листе';
      const progressStatus = progress ? `Просмотрено ${progress}${item.episodes ? ` из ${item.episodes}` : ''}` : '';
      return `<article class="franchise-link${isCurrent ? ' franchise-current' : ''}" data-action="open" data-id="${item.id}" tabindex="0" role="button"${isCurrent ? ' aria-current="true"' : ''} aria-label="${isCurrent ? 'Текущая часть: ' : 'Открыть: '}${esc(item.title)}">
        <span class="franchise-poster"><img ${imgAttrs(item)}>${item.score ? `<span class="franchise-score">★ ${item.score.toFixed(1)}</span>` : ''}<span class="franchise-link-arrow" aria-hidden="true">›</span></span>
        <span class="franchise-link-main"><span class="franchise-link-kind">${esc(franchiseRelationLabel(link.relationType))}</span><b>${esc(item.title)}</b><small>${esc(meta || 'Данные уточняются')}</small><span class="franchise-link-status">${esc(listStatus)}${progressStatus ? ` · ${esc(progressStatus)}` : ''}</span></span>
      </article>`;
    }).join('');
    return `<div class="modal-section franchise-section"><div class="modal-label">Сезоны и порядок просмотра</div><p class="franchise-intro">Сначала приквелы, затем открытая часть и продолжения. Нажмите карточку, чтобы перейти к сезону.</p><div class="franchise-list">${rows}</div><p class="hint">У каждого сезона свой тир-лист и прогресс серий.</p></div>`;
  }

  function loadFranchise(anime) {
    if (!anime || state.franchiseById.has(anime.id) || state.franchiseLoading.has(anime.id)) return;
    if (anime.custom) { state.franchiseById.set(anime.id, []); return; }
    state.franchiseLoading.add(anime.id);
    state.franchiseErrors.delete(anime.id);
    Promise.resolve(App.fetchAnimeRelations(anime)).then(relations => {
      const allowed = new Set(['PREQUEL', 'SEQUEL', 'PARENT', 'SIDE_STORY', 'SPIN_OFF']);
      const seen = new Set();
      const links = [];
      for (const relation of Array.isArray(relations) ? relations : []) {
        if (!relation || !allowed.has(relation.relationType) || !relation.anime || relation.anime.id === anime.id || seen.has(relation.anime.id)) continue;
        seen.add(relation.anime.id);
        links.push(relation);
      }
      const order = { PREQUEL: 0, PARENT: 1, SEQUEL: 2, SIDE_STORY: 3, SPIN_OFF: 4 };
      links.sort((a, b) => (order[a.relationType] - order[b.relationType])
        || ((Date.parse(a.anime.airedFrom || '') || 0) - (Date.parse(b.anime.airedFrom || '') || 0)));
      state.franchiseById.set(anime.id, links);
    }).catch(error => {
      state.franchiseErrors.set(anime.id, error && error.message ? error.message : 'Не удалось загрузить порядок просмотра');
    }).finally(() => {
      state.franchiseLoading.delete(anime.id);
      if (state.modalId === anime.id) renderModal();
    });
  }

  function closeModal() {
    state.modalId = null;
    const modal = $('#modal');
    if (modal) modal.hidden = true;
    if (App.revokeMomentUrls) App.revokeMomentUrls();
    syncBodyScroll();
    if (state.tab === 'db') renderDB();
    else if (state.tab === 'watched' || state.tab === 'planned') renderTierList(state.tab);
  }

  function renderModal() {
    if (state.modalId == null) return;
    const a = getAnime(state.modalId);
    const content = $('#modal-content');
    const panel = $('.modal-panel');
    if (!a || !content) { closeModal(); return; }

    const scrollTop = panel ? panel.scrollTop : 0;
    const inW = hasIn('watched', a.id);
    const inP = hasIn('planned', a.id);
    const curTier = findTier('watched', a.id) || findTier('planned', a.id);
    const status = a.status || '';
    const sourceName = a.source === 'Kitsu' ? 'Kitsu' : a.source === 'AniList' ? 'AniList' : 'MyAnimeList';
    const sourceUrl = a.url || (a.malId ? `https://myanimelist.net/anime/${a.malId}` : '');
    const sourceLine = a.custom
      ? '<span class="modal-source">Своя карточка</span>'
      : sourceUrl ? `<a class="mal-link" href="${esc(sourceUrl)}" target="_blank" rel="noopener">Открыть на ${esc(sourceName)} ↗</a>` : '';
    const customActions = a.custom ? `<div class="modal-custom-actions">
      <button class="btn btn-ghost" data-action="edit-custom" data-id="${a.id}">Редактировать</button>
      <button class="btn btn-ghost btn-danger" data-action="delete-custom" data-id="${a.id}">Удалить карточку</button>
    </div>` : '';
    const facts = [
      a.type ? `<span class="fact"><span>Тип:</span> ${esc(typeRu(a.type))}</span>` : '',
      a.episodes ? `<span class="fact"><span>Серии:</span> ${a.episodes}</span>` : '<span class="fact"><span>Серии:</span> ?</span>',
      a.year ? `<span class="fact"><span>Год:</span> ${a.year}</span>` : '',
      status ? `<span class="fact"><span>Статус:</span> ${esc(status)}</span>` : '',
      a.airedFrom ? `<span class="fact"><span>Старт:</span> ${esc(dateShort(a.airedFrom))}</span>` : '',
    ].filter(Boolean).join('');

    const tiers = TIERS.map(t => `<button class="tier-pick tier-${t.id} ${curTier === t.id ? 'is-active' : ''}" data-action="set-tier" data-id="${a.id}" data-tier="${t.id}" title="${esc(t.name)}" aria-label="Тир ${esc(t.name)}">${t.label}</button>`).join('');
    const genres = (a.genres || []).map(g => `<span class="tag">${esc(C.genreRu(g))}</span>`).join('');
    const poster = a.image || makePoster(a.title, a.id);
    const translationProvider = state.settings.translationProvider || 'auto';
    const translatedSynopsis = App.cachedTranslation ? App.cachedTranslation(a.synopsis, translationProvider) : '';
    const translatedVia = App.cachedTranslationProvider ? App.cachedTranslationProvider(a.synopsis, translationProvider) : '';
    const translationRequestKey = `${a.id}:${translationProvider}`;
    const canTranslateSynopsis = Boolean(a.synopsis && !C.hasCyrillic(a.synopsis));
    const synopsisMode = state.synopsisModes.get(a.id) || 'translated';
    const showTranslatedSynopsis = Boolean(canTranslateSynopsis && translatedSynopsis && synopsisMode !== 'original');
    const synopsis = (showTranslatedSynopsis ? translatedSynopsis : a.synopsis) || 'Описание пока недоступно.';
    const synopsisControls = canTranslateSynopsis
      ? `<div class="synopsis-toolbar">
          <label class="synopsis-provider">Переводчик
            <select data-action="synopsis-provider" aria-label="Переводчик описания">
              <option value="auto"${translationProvider === 'auto' ? ' selected' : ''}>Авто: MyMemory → Google</option>
              <option value="mymemory"${translationProvider === 'mymemory' ? ' selected' : ''}>MyMemory</option>
              <option value="google"${translationProvider === 'google' ? ' selected' : ''}>Google Переводчик</option>
            </select>
          </label>
          <span class="synopsis-translation-status" role="status">${translatedSynopsis ? (showTranslatedSynopsis ? `Перевод: ${translatedVia === 'google' ? 'Google' : 'MyMemory'}` : 'Оригинал') : (state.synopsisTranslating.has(translationRequestKey) ? 'Переводим…' : 'Перевод пока недоступен')}</span>
          <div class="synopsis-switch" role="group" aria-label="Язык описания">
            <button type="button" data-action="synopsis-mode" data-id="${a.id}" data-mode="translated" aria-pressed="${showTranslatedSynopsis ? 'true' : 'false'}"${translatedSynopsis ? '' : ' disabled'}>Перевод</button>
            <button type="button" data-action="synopsis-mode" data-id="${a.id}" data-mode="original" aria-pressed="${!showTranslatedSynopsis ? 'true' : 'false'}">Оригинал</button>
          </div>
        </div>`
      : '';

    content.innerHTML = `
      <div class="modal-grid">
        <div class="modal-poster">
          <div class="modal-poster-wrap">
            <img src="${esc(poster)}" alt="${esc(a.title)}" data-title="${esc(a.title)}" data-id="${a.id}" onerror="posterFallback(this)">
            <div class="modal-side-score">${a.score ? `★ ${a.score.toFixed(2)}` : '★ —'}<small>рейтинг</small></div>
          </div>
        </div>
        <div class="modal-info">
          <div class="modal-eyebrow">${esc(typeRu(a.type) || 'Аниме')}${a.year ? ' · ' + a.year : ''}</div>
          <h2 id="modal-title">${esc(a.title)}</h2>
          ${a.altTitle ? `<p class="modal-alt">${esc(a.altTitle)}</p>` : ''}
          <div class="modal-facts">${facts}</div>
          <div class="modal-actions">
            <button class="btn ${inW ? 'is-on' : 'btn-primary'}" data-action="add-watched" data-id="${a.id}">${inW ? '✓ В просмотрено' : 'Отметить просмотренным'}</button>
            <button class="btn btn-ghost ${inP ? 'is-on' : ''}" data-action="add-planned" data-id="${a.id}">${inP ? '◷ В планах' : 'Запланировать'}</button>
            ${!a.custom ? `<button class="btn btn-ghost" data-action="tiktok-search" data-id="${a.id}">Искать в TikTok</button>` : ''}
          </div>
          ${customActions}
          <div class="modal-section">
            <div class="modal-label">Тир-лист</div>
            <div class="tier-picker">${tiers}</div>
            <p class="hint">${inW || inP
              ? 'Выберите уровень — карточка переедет в выбранный тир.'
              : 'Выберите тир, чтобы сразу добавить тайтл в «Просмотрено».'}</p>
          </div>
          ${renderFranchiseSection(a)}
          <div class="modal-section modal-episodes">
            <div class="modal-label">Серии и прогресс</div>
            ${renderEpisodeBlock(a, 'modal')}
          </div>
          ${momentsHTML(a)}
          <section class="modal-section modal-synopsis-section">
            <div class="modal-label">Описание</div>
            ${synopsisControls}
            <p class="modal-synopsis"${showTranslatedSynopsis ? ' data-translated="1" title="Автоматический перевод"' : ''}>${esc(synopsis)}</p>
          </section>
          ${genres ? `<div class="tags">${genres}</div>` : ''}
          ${sourceLine}
        </div>
      </div>`;

    const fresh = $('.modal-panel');
    if (fresh) fresh.scrollTop = scrollTop;

    if (!state.franchiseById.has(a.id) && !state.franchiseLoading.has(a.id) && !state.franchiseErrors.has(a.id)) loadFranchise(a);

    if (!a.custom && (!state.epInfo[a.id] || Date.now() - Number(state.epInfo[a.id].fetchedAt || 0) > 2 * 3600000)) {
      if (a.status === 'В эфире' || !a.episodes) ensureEpisodeInfo(a);
    }
  }

  /* ---------------- вкладки ---------------- */
  function switchTab(tab, opts = {}) {
    if (!VIEW_TABS.includes(tab)) return;
    state.tab = tab;
    $$('.tab').forEach(t => {
      const on = t.dataset.tab === tab;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    $$('.view').forEach(v => { v.hidden = v.id !== 'view-' + tab; });

    if (!opts.deferActions) {
      if (tab === 'db') renderDB();
      if (tab === 'watched' || tab === 'planned') renderTierList(tab);
      if (tab === 'notifications') { renderNotifications(); markNotificationsSeen(); fetchNotifications(); ensureNotificationEpisodes(); }
      if (tab === 'upcoming') { renderUpcoming(); fetchUpcoming(); }
    }
    if (!opts.deferPersistence && App.persistCatalogPreferences) App.persistCatalogPreferences();
    updateOfflineBanner();

    if (!opts.silent) window.scrollTo({ top: 0, behavior: 'smooth' });
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
  function toast(message) {
    const box = $('#toasts');
    if (!box) return;
    while (box.children.length >= 4) box.firstElementChild.remove();
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    box.appendChild(el);
    setTimeout(() => {
      el.classList.add('is-out');
      setTimeout(() => el.remove(), 240);
    }, 3200);
  }

  Object.assign(App, {
    imgAttrs,
    cardHTML,
    tierCardHTML,
    skeletonCards,
    skeletonRows,
    msgBlock,
    initFilterOptions,
    syncFilterUI,
    syncModeChips,
    syncLangUI,
    readFiltersFromUI,
    resetDBFilters,
    updateDBStatus,
    renderDB,
    releaseLine,
    episodeProgressText,
    chipsHTML,
    renderEpisodeBlock,
    previewEpisodeSlider,
    updateEpisodeUI,
    episodeInfoFromAnime,
    ensureEpisodeInfo,
    ensureNotificationEpisodes,
    notifRowHTML,
    renderNotifications,
    invalidateNotificationEpisodes,
    allNotifications,
    markNotificationsSeen,
    updateBell,
    renderUpcoming,
    renderTierList,
    renderStats,
    updateCounters,
    openCustomForm,
    closeCustomForm,
    renderCustomForm,
    momentLabel,
    momentCardHTML,
    momentsHTML,
    openMomentForm,
    closeMomentForm,
    renderMomentForm,
    renderTikTokImport,
    renderBackup,
    openBackup,
    closeBackup,
    renderSettings,
    openSettings,
    closeSettings,
    refreshViews,
    syncBodyScroll,
    tierShort,
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
    openModal,
    closeModal,
    renderModal,
    renderFranchiseSection,
    switchTab,
    updateOfflineBanner,
    toast,
  });
})(window.AniTier);
