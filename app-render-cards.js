/* ============================================================
   AniTier — карточки и общие куски рендера (выделено из app-render.js)
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
  /* ---------------- карточки и общие куски ---------------- */
  function imgAttrs(a, alt) {
    const image = String(a.image || '');
    const src = image || makePoster(a.title, a.id);
    const remote = /^https?:\/\//i.test(image)
      ? ` data-poster-src="${esc(image)}"`
      : '';
    return `src="${esc(src)}" alt="${esc(alt !== undefined ? alt : displayTitle(a))}" loading="lazy" decoding="async" data-title="${esc(displayTitle(a))}" data-id="${a.id}"${remote}`;
  }

  function cardHTML(a, ctx) {
    const inW = hasIn('watched', a.id);
    const inP = hasIn('planned', a.id);
    const wc = watchedCount(a.id);
    const stats = episodeStats(a);
    const pTotal = stats.total || stats.available || 0;
    const pct = pTotal ? Math.min(100, Math.round((wc / pTotal) * 100)) : 0;
    const metaBits = [typeRu(a.type) || '—', a.year || '—', a.episodes ? `${a.episodes} эп.` : 'серий: ?'];
    return `<article class="card" data-action="open" data-id="${a.id}" tabindex="0" aria-label="${esc(displayTitle(a))}">
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
        <h3 class="card-title">${esc(displayTitle(a))}</h3>
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
    return `<article class="tier-card" data-action="open" data-id="${a.id}" data-list="${list}" data-tier="${tier}" tabindex="0" aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown" title="Alt+↑/↓ — перенести в соседний тир">
      <img ${imgAttrs(a)}>
      <button class="tc-remove" data-action="remove" data-id="${a.id}" data-list="${list}" title="Убрать из списка" aria-label="Убрать из списка">✕</button>
      <div class="tc-body">
        <div class="tc-title" title="${esc(displayTitle(a))}">${esc(displayTitle(a))}</div>
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

  function msgBlock(emoji, title, text, action, actionLabel) {
    return `<div class="msg">
      <span class="emoji">${emoji}</span>
      <h2>${esc(title)}</h2>
      <p>${esc(text)}</p>
      ${action ? `<button class="btn btn-ghost" data-action="${action}">${esc(actionLabel || 'Попробовать снова')}</button>` : ''}
    </div>`;
  }

  /* Переключатель строки «Продолжить» */
  function syncContinueToggle() {
    const block = $('#continue-block');
    const row = $('#continue-row');
    if (!block || !row || block.hidden) return;
    const toggle = block.querySelector('.continue-toggle');
    if (!toggle) return;
    row.hidden = Boolean(state.continueCollapsed);
    toggle.textContent = state.continueCollapsed ? 'Развернуть' : 'Свернуть';
    toggle.setAttribute('aria-expanded', state.continueCollapsed ? 'false' : 'true');
  }

  /* ---------------- строка «Продолжить» (рендер-кусок) ---------------- */
  /* ---------------- «Продолжить просмотр» ---------------- */
  const CONTINUE_LIMIT = 6;

  /* Начатые тайтлы из «Просмотрено» с незакрытым прогрессом. */
  function continueItems() {
    const items = [];
    for (const anime of allIn('watched')) {
      const count = watchedCount(anime.id);
      if (count <= 0) continue;
      const stats = episodeStats(anime);
      const total = stats.total || stats.available || 0;
      const max = stats.available || stats.total || 0;
      if (!max || (total && count >= total)) continue;
      const entry = state.progress[anime.id];
      items.push({
        anime,
        count,
        total,
        max,
        updated: Number(entry && entry.updated) || 0,
        next: stats.info && stats.info.next ? stats.info.next : null,
      });
    }
    items.sort((a, b) => (b.updated - a.updated)
      || String(a.anime.title || '').localeCompare(String(b.anime.title || ''), 'ru'));
    return items.slice(0, CONTINUE_LIMIT);
  }

  function continueCardHTML(item) {
    const anime = item.anime;
    const pct = item.total ? Math.min(100, Math.round((item.count / item.total) * 100)) : 0;
    const nextLine = item.next && item.next.date
      ? `Следующая: ${item.next.n}-я · ${esc(dateShort(item.next.date))}`
      : 'Следующая серия';
    return `<article class="continue-card" data-action="open" data-id="${anime.id}" tabindex="0" aria-label="Продолжить: ${esc(displayTitle(anime))}">
      <img ${imgAttrs(anime)}>
      <div class="continue-body">
        <b class="continue-title" title="${esc(displayTitle(anime))}">${esc(displayTitle(anime))}</b>
        <span class="continue-meta">Просмотрено ${item.count}${item.total ? ` из ${item.total}` : ''}</span>
        <span class="continue-next">${nextLine}</span>
        <span class="continue-bar"><i style="width:${pct}%"></i></span>
      </div>
      <button class="btn btn-primary continue-btn" type="button" data-action="quick-watch" data-id="${anime.id}" aria-label="Отметить следующую серию: ${esc(displayTitle(anime))}">+1 серия</button>
    </article>`;
  }

  function renderContinue() {
    const block = $('#continue-block');
    const row = $('#continue-row');
    if (!block || !row) return;
    const items = continueItems();
    block.hidden = !items.length;
    row.innerHTML = items.length ? items.map(continueCardHTML).join('') : '';
    syncContinueToggle();
  }

  /* ---------------- прогресс серий (рендер-кусок) ---------------- */
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

  function animeStatusCodeView(a) {
    return C.animeStatusCode ? C.animeStatusCode(a) : String((a && (a.statusCode || a.status)) || '');
  }

  function renderEpisodeBlock(a, variant = 'notif') {
    if (animeStatusCodeView(a) === 'upcoming') {
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

  function ensureEpisodeInfo(a, options = {}) {
    if (!a) return null;
    const cached = state.epInfo[a.id];
    const fresh = cached && Date.now() - Number(cached.fetchedAt || 0) < 2 * 3600000;
    const demoCacheInLiveMode = cached && cached.source === 'demo' && !state.forceDemo && !a.demo;
    /* Нулевой прогресс «В эфире» — это не данные, а отсутствие данных:
       такой кэш нельзя держать два часа, иначе серии не появятся. */
    const code = animeStatusCodeView(a);
    const emptyAiring = cached && (code === 'airing' || code === 'hiatus') && !Number(cached.count) && !cached.next;
    if (fresh && !demoCacheInLiveMode && !emptyAiring) return cached;

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
        if (options.ui !== false) updateEpisodeUI(a.id);
      }
      return state.epInfo[a.id] || null;
    }

    const info = episodeInfoFromAnime(a);
    if ((code === 'airing' || code === 'hiatus') && !info.count && !info.next) return null;
    state.epInfo[a.id] = info;
    if (options.save !== false) saveState();
    if (options.ui !== false) updateEpisodeUI(a.id);
    return state.epInfo[a.id];
  }

  /* ---------------- короткие подписи тиров ---------------- */
  function tierShort(tier) {
    return tier === 'N' ? 'Без оц.' : tier;
  }
  Object.assign(App, {
    imgAttrs,
    cardHTML,
    tierCardHTML,
    skeletonCards,
    skeletonRows,
    msgBlock,
    continueItems,
    continueCardHTML,
    renderContinue,
    syncContinueToggle,
    releaseLine,
    episodeProgressText,
    chipsHTML,
    animeStatusCodeView,
    renderEpisodeBlock,
    previewEpisodeSlider,
    updateEpisodeUI,
    episodeInfoFromAnime,
    ensureEpisodeInfo,
    tierShort,
  });
})(window.AniTier);
