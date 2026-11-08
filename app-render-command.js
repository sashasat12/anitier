/* ============================================================
   AniTier — глобальный поиск (выделено из app-render-modals.js)
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
  const imgAttrs = (...a) => App.imgAttrs(...a);
  const tierShort = (...a) => App.tierShort(...a);
  const closeModal = (...a) => App.closeModal(...a);
  const openModal = (...a) => App.openModal(...a);
  const closeStats = (...a) => App.closeStats(...a);
  const closeSettings = (...a) => App.closeSettings(...a);
  const closeBackup = (...a) => App.closeBackup(...a);
  const closeExchange = (...a) => App.closeExchange(...a);
  const closeCustomForm = (...a) => App.closeCustomForm(...a);
  const closeMomentForm = (...a) => App.closeMomentForm(...a);
  const syncBodyScroll = (...a) => App.syncBodyScroll(...a);

  let commandReturnFocus = null;

  function commandWhereLabel(result) {
    if (result.where === 'watched') return `Просмотрено · ${tierShort(result.tier)}`;
    if (result.where === 'planned') return `Планы · ${tierShort(result.tier)}`;
    if (result.where === 'custom') return 'Своя карточка';
    return 'База';
  }

  function syncCommandSelection() {
    const input = $('#command-input');
    const box = $('#command-results');
    if (!input || !box) return;
    const active = state.command.results.length ? state.command.index : -1;
    if (active >= 0) input.setAttribute('aria-activedescendant', `command-row-${active}`);
    else input.removeAttribute('aria-activedescendant');

    const rows = box.querySelectorAll('.command-row');
    rows.forEach((row, index) => {
      const on = index === active;
      row.classList.toggle('is-active', on);
      row.setAttribute('aria-selected', on ? 'true' : 'false');
    });

    const row = box.querySelector('.command-row.is-active');
    if (!row) return;
    const boxRect = box.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    if (rowRect.top < boxRect.top) box.scrollTop -= boxRect.top - rowRect.top;
    else if (rowRect.bottom > boxRect.bottom) box.scrollTop += rowRect.bottom - boxRect.bottom;
  }

  function renderCommandResults() {
    const box = $('#command-results');
    if (!box) return;
    const query = state.command.query.trim();
    if (!query) {
      state.command.results = [];
      state.command.index = 0;
      box.innerHTML = '<div class="command-empty">Начните вводить название — поиск идёт по спискам, своим карточкам и загруженной базе.</div>';
      syncCommandSelection();
      return;
    }

    const results = C.searchGlobal({
      lists: state.lists,
      customCards: state.customCards,
      dbItems: state.db.items,
    }, query, { limit: 8 });

    state.command.results = results;
    state.command.index = Math.max(0, Math.min(state.command.index, Math.max(0, results.length - 1)));

    if (!results.length) {
      box.innerHTML = '<div class="command-empty">Ничего не нашлось. Проверьте раскладку или попробуйте English.</div>';
      syncCommandSelection();
      return;
    }

    box.innerHTML = results.map((result, index) => {
      const a = result.anime;
      const meta = [a.year, typeRu(a.type), a.score ? `★ ${a.score.toFixed(1)}` : '']
        .filter(Boolean)
        .map(item => esc(item))
        .join(' · ');
      return `<button type="button" class="command-row ${index === state.command.index ? 'is-active' : ''}" id="command-row-${index}" role="option" aria-selected="${index === state.command.index}" data-action="command-open" data-id="${a.id}" data-index="${index}" tabindex="-1">
        <img class="command-poster" ${imgAttrs(a, '')}>
        <span class="command-main">
          <b>${esc(displayTitle(a))}</b>
          <small>${meta || 'Без года'}</small>
        </span>
        <span class="command-badge command-badge-${result.where}">${esc(commandWhereLabel(result))}</span>
      </button>`;
    }).join('');
    syncCommandSelection();
  }

  function openCommand(initialQuery = '') {
    if (state.modalId != null) closeModal();
    if (state.statsScreen && state.statsScreen.open) closeStats();
    if (state.settingsScreen && state.settingsScreen.open) closeSettings();
    if (state.backup && state.backup.open) closeBackup();
    if (state.exchange && state.exchange.open) closeExchange();
    if (state.customForm && state.customForm.open) closeCustomForm(false);
    if (state.momentForm && state.momentForm.open) closeMomentForm(false);
    if (state.tiktokImport && state.tiktokImport.open && typeof App.closeTikTokImport === 'function') App.closeTikTokImport();
    const active = document.activeElement;
    commandReturnFocus = active && active !== document.body ? active : null;
    state.command = { open: true, query: String(initialQuery || ''), index: 0, results: [] };
    const modal = $('#command-modal');
    if (modal) modal.hidden = false;
    const input = $('#command-input');
    if (input) input.value = state.command.query;
    renderCommandResults();
    syncBodyScroll();
    if (input) {
      input.focus({ preventScroll: true });
      input.select();
    }
  }

  function canRestoreFocus(el) {
    if (!el || !el.isConnected || typeof el.focus !== 'function') return false;
    return typeof el.getClientRects !== 'function' || el.getClientRects().length > 0;
  }

  function closeCommand(options = {}) {
    const restoreFocus = options.restoreFocus !== false;
    state.command = { open: false, query: '', index: 0, results: [] };
    const modal = $('#command-modal');
    if (modal) modal.hidden = true;
    syncBodyScroll();
    if (!restoreFocus) {
      commandReturnFocus = null;
      return;
    }
    const fallback = document.querySelector('[data-action="open-command"]');
    const target = canRestoreFocus(commandReturnFocus) ? commandReturnFocus : fallback;
    commandReturnFocus = null;
    if (canRestoreFocus(target)) target.focus({ preventScroll: true });
  }

  function setCommandQuery(value) {
    state.command.query = String(value || '');
    state.command.index = 0;
    renderCommandResults();
  }

  function moveCommand(delta) {
    const total = state.command.results.length;
    if (!total) return;
    state.command.index = (state.command.index + delta + total) % total;
    /* Без перерисовки: подчёркиваем другую строку на месте, иначе постеры
       пересоздаются и список мигает при каждом нажатии. */
    syncCommandSelection();
  }

  function jumpCommand(edge) {
    const total = state.command.results.length;
    if (!total) return;
    state.command.index = edge === 'last' ? total - 1 : 0;
    syncCommandSelection();
  }

  function openCommandResult(index) {
    const result = state.command.results[index];
    if (!result) return;
    closeCommand({ restoreFocus: false });
    openModal(result.anime.id);
  }

  Object.assign(App, {
    commandReturnFocus,
    commandWhereLabel,
    syncCommandSelection,
    renderCommandResults,
    openCommand,
    canRestoreFocus,
    closeCommand,
    setCommandQuery,
    moveCommand,
    jumpCommand,
    openCommandResult,
  });
})(window.AniTier);
