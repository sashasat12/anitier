/* ============================================================
   AniTier — модалки, формы, настройки, статистика, обмен (выделено из app-render.js)
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
  const openSettings = (...a) => App.openSettings(...a);
  const closeSettings = (...a) => App.closeSettings(...a);
  const openStats = (...a) => App.openStats(...a);
  const closeStats = (...a) => App.closeStats(...a);
  const renderSettings = (...a) => App.renderSettings(...a);
  const renderUpdateCard = (...a) => App.renderUpdateCard(...a);
  /* Перекрёстные вызовы */
  const displayTitle = (...a) => App.displayTitle(...a);
  const imgAttrs = (...a) => App.imgAttrs(...a);
  const tierShort = (...a) => App.tierShort(...a);
  const renderEpisodeBlock = (...a) => App.renderEpisodeBlock(...a);
  const ensureEpisodeInfo = (...a) => App.ensureEpisodeInfo(...a);
  const syncBodyScroll = (...a) => App.syncBodyScroll(...a);
  const renderDB = (...a) => App.renderDB(...a);
  const renderTierList = (...a) => App.renderTierList(...a);
  const toast = (...a) => App.toast(...a);
  const writeLocationHash = (...a) => (App.writeLocationHash || (() => {}))(...a);
  const closeExchange = (...a) => App.closeExchange(...a);
  /* ---------------- формы, моменты, настройки, статистика, обмен, карточка ---------------- */
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
      <button class="moment-remove" type="button" data-action="moment-delete" data-id="${animeId}" data-moment="${esc(m.id)}" title="Удалить момент" aria-label="Удалить момент: ${esc(momentLabel(m))}">✕</button>
      <button class="moment-preview" type="button" data-action="moment-play" data-id="${animeId}" data-moment="${esc(m.id)}" aria-label="Открыть момент: ${esc(momentLabel(m))}">
        ${thumb}<span class="moment-play-icon">▶</span>
      </button>
      <div class="moment-body">
        <div class="moment-title" title="${esc(momentLabel(m))}">${esc(momentLabel(m))}</div>
        <div class="moment-meta">${esc(meta)}${m.size ? ` · ${esc(C.formatBytes(m.size))}` : ''}</div>
        <div class="moment-actions">
          ${m.kind === 'tiktok' ? `<button class="ep-link" type="button" data-action="moment-open-tiktok" data-id="${animeId}" data-moment="${esc(m.id)}">Открыть в TikTok ↗</button>` : ''}
          <button class="ep-link" type="button" data-action="moment-share" data-id="${animeId}" data-moment="${esc(m.id)}">Поделиться</button>
          <button class="ep-link moment-delete-link" type="button" data-action="moment-delete" data-id="${animeId}" data-moment="${esc(m.id)}">Удалить</button>
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
      <h2 id="moment-title">Момент из «${esc(displayTitle(a))}»</h2>
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
        <section class="modal-panel tiktok-import-panel" role="dialog" aria-modal="true" aria-labelledby="tiktok-import-title" aria-describedby="tiktok-import-content" tabindex="-1">
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
      <img ${imgAttrs(anime, '')}><span><b>${esc(displayTitle(anime))}</b><small>${esc([anime.altTitle, anime.year, typeRu(anime.type)].filter(Boolean).join(' · '))}</small></span><strong>Добавить</strong>
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
    const safety = App.safetyAvailable ? App.safetyAvailable() : false;
    const canShareDrive = typeof window !== 'undefined' && window.AniTierAndroid
      && typeof window.AniTierAndroid.shareBackup === 'function';
    const safetyInfo = safety && App.safetySnapshotInfo ? App.safetySnapshotInfo() : null;
    const legacyInfo = safety && App.legacyBackupInfo ? App.legacyBackupInfo() : null;
    const legacyBlock = legacyInfo
      ? `<div class="backup-block">
          <h3>Данные прошлой версии</h3>
          <p>В старой сборке остались списки — ${legacyInfo.cards} ${legacyInfo.cards === 1 ? 'карточка' : 'карточек'}. «Объединить» добавит недостающее к текущим спискам и вернёт настройки, «Вернуть списки» заменит текущие данные.</p>
          <div class="form-actions">
            <button class="btn btn-primary" type="button" data-action="safety-legacy-merge"${disabled}>Объединить</button>
            <button class="btn btn-ghost" type="button" data-action="safety-legacy-restore"${disabled}>Вернуть списки</button>
            <button class="btn btn-ghost" type="button" data-action="safety-legacy-download"${disabled}>Скачать файл</button>
          </div>
        </div>`
      : '';
    const safetyWhen = safetyInfo && safetyInfo.savedAt
      ? new Date(safetyInfo.savedAt).toLocaleString('ru-RU')
      : '';
    const safetyBlock = safety
      ? `<div class="backup-block">
          <h3>Страховочная копия на устройстве</h3>
          <p>Приложение само сохраняет списки, прогресс и настройки в свою память. Копия переживает обновление приложения и очистку данных страницы.</p>
          <p class="form-note">${safetyWhen
            ? `Последняя: ${esc(safetyWhen)}${safetyInfo.cards ? ` · карточек — ${safetyInfo.cards}` : ''}.`
            : 'Пока не создана — сохраните вручную или подождите минуту после изменений.'}</p>
          <div class="form-actions">
            <button class="btn btn-primary" type="button" data-action="safety-save"${disabled}>${f.busy ? 'Подождите…' : 'Сохранить сейчас'}</button>
            <button class="btn btn-ghost" type="button" data-action="safety-restore"${disabled}${safetyInfo && safetyInfo.cards ? '' : ' disabled'}>Восстановить</button>
            <button class="btn btn-ghost" type="button" data-action="safety-merge"${disabled}${safetyInfo && safetyInfo.cards ? '' : ' disabled'}>Объединить</button>
          </div>
        </div>`
      : '';
    const status = f.message
      ? `<p class="backup-status${f.error ? ' is-error' : ''}" role="status">${esc(f.message)}</p>`
      : '';
    const driveBlock = drive
      ? `<div class="backup-block">
          <h3>Google Drive</h3>
          <p>Копия сохраняется в файл <code>anitier-backup.json</code> в вашем Google Drive. Приложение видит только файлы, созданные им самим.</p>
          <label class="settings-field">
            <span>Авто-бэкап</span>
            <select data-action="settings-drive-auto" aria-label="Авто-бэкап в Google Drive"${disabled}>
              <option value="off"${state.settings.driveAutoBackup ? '' : ' selected'}>Выключен</option>
              <option value="on"${state.settings.driveAutoBackup ? ' selected' : ''}>Раз в сутки</option>
            </select>
          </label>
          <p class="form-note">Копия сохраняется при открытии приложения, если прошли сутки. Для тихой записи нужен действующий вход в Google; иначе сохраните вручную.</p>
          <div class="form-actions">
            <button class="btn btn-primary" type="button" data-action="backup-drive-save"${disabled}>${f.busy ? 'Подождите…' : 'Сохранить в Google Drive'}</button>
            <button class="btn btn-ghost" type="button" data-action="backup-drive-load"${disabled}>Восстановить последнюю версию</button>
          </div>
        </div>`
      : canShareDrive
        ? `<div class="backup-block">
            <h3>Google Drive</h3>
            <p>Отправьте копию в приложение Google Drive через системное меню: выберите Drive и папку. Вход в Google не нужен.</p>
            <div class="form-actions">
              <button class="btn btn-primary" type="button" data-action="backup-drive-share"${disabled}>Сохранить в Google Drive</button>
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
        <p>Скачайте JSON-файл и храните его где удобно. «Восстановить» заменит текущие списки, «Объединить» добавит недостающее и вернёт настройки из файла.</p>
        <div class="form-actions">
          <button class="btn btn-primary" type="button" data-action="backup-download"${disabled}>Скачать файл</button>
          <label class="btn btn-ghost file-btn${f.busy ? ' is-disabled' : ''}">Восстановить из файла
            <input type="file" accept=".json,application/json" data-action="backup-file"${disabled} hidden>
          </label>
          <label class="btn btn-ghost file-btn${f.busy ? ' is-disabled' : ''}">Объединить из файла
            <input type="file" accept=".json,application/json" data-action="backup-merge-file"${disabled} hidden>
          </label>
        </div>
      </div>
      ${safetyBlock}
      ${legacyBlock}
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
  function openModal(id, opts = {}) {
    const a = getAnime(id);
    if (!a) { toast('Не удалось открыть карточку'); return; }
    state.modalId = id;
    state.modalTab = 'overview';
    renderModal();
    const modal = $('#modal');
    modal.hidden = false;
    syncBodyScroll();
    const panel = $('.modal-panel');
    if (panel) { panel.scrollTop = 0; panel.focus({ preventScroll: true }); }
    if (a.custom && App.hydrateCustomImage) App.hydrateCustomImage(id);
    if (!opts.fromHash) writeLocationHash();
    if (typeof bindModalSwipe === 'function') bindModalSwipe();
    /* Автоперевод при любом открытии, если пользователь не выбрал оригинал. */
    const synopsisMode = state.synopsisModes && state.synopsisModes.get(id);
    const wantsTranslation = synopsisMode !== 'original'
      && !(state.settings && state.settings.synopsisLang === 'original');
    if (wantsTranslation && a.synopsis && C.hasCyrillic && !C.hasCyrillic(a.synopsis)
      && typeof App.translateModalSynopsis === 'function') {
      App.translateModalSynopsis(id);
    }
  }

  function franchiseRelationLabel(type) {
    if (type === 'PREQUEL' || type === 'PARENT') return 'Смотреть раньше';
    if (type === 'CURRENT') return 'Текущая часть';
    if (type === 'SEQUEL') return 'Следующий сезон';
    if (type === 'SIDE_STORY') return 'Побочная история';
    if (type === 'SPIN_OFF') return 'Спин-офф';
    if (type === 'SUMMARY') return 'Пересказ';
    if (type === 'ALTERNATIVE') return 'Альтернатива';
    if (type === 'ADAPTATION') return 'Адаптация';
    if (type === 'CHARACTER') return 'С участием героев';
    return 'Связанная история';
  }

  /* Дата выхода связи: по ней строится порядок просмотра. */
  function franchiseDate(link) {
    const stamp = Date.parse((link.anime && link.anime.airedFrom) || '');
    if (Number.isFinite(stamp)) return stamp;
    const year = Number(link.anime && link.anime.year) || 0;
    return year ? Date.parse(`${year}-01-01`) : Number.MAX_SAFE_INTEGER;
  }

  const FRANCHISE_PREVIEW = 8;
  const FRANCHISE_MAIN = new Set(['PREQUEL', 'PARENT', 'SEQUEL']);
  const MODAL_TABS = ['overview', 'seasons', 'episodes', 'moments'];

  function franchiseCardHTML(link, opts = {}) {
    const item = link && link.anime;
    if (!item || item.id == null) return '';
    const tier = findTier('watched', item.id) || findTier('planned', item.id);
    const progress = watchedCount(item.id);
    const isCurrent = link.relationType === 'CURRENT';
    const meta = [typeRu(item.type) || '', item.year || '', item.episodes ? `${item.episodes} серий` : ''].filter(Boolean).join(' · ');
    const listStatus = tier ? `В тире ${tier}` : 'Не в тир-листе';
    const progressStatus = progress ? `Просмотрено ${progress}${item.episodes ? ` из ${item.episodes}` : ''}` : '';
    const order = Number.isFinite(opts.order)
      ? `<span class="franchise-order" aria-hidden="true">${opts.order}</span>`
      : '';
    const here = isCurrent ? '<span class="franchise-here">Вы здесь</span>' : '';
    const scoreNum = Number(item.score);
    const score = Number.isFinite(scoreNum) ? scoreNum.toFixed(1) : '';
    return `<article class="franchise-link${isCurrent ? ' franchise-current' : ''}" data-action="open" data-id="${item.id}" tabindex="0" role="button"${isCurrent ? ' aria-current="true"' : ''} aria-label="${isCurrent ? 'Текущий тайтл: ' : 'Открыть: '}${esc(displayTitle(item))}">
      <span class="franchise-poster"><img ${imgAttrs(item)}>${score ? `<span class="franchise-score">★ ${score}</span>` : ''}<span class="franchise-link-arrow" aria-hidden="true">→</span></span>
      <span class="franchise-link-main">
        <span class="franchise-link-kind">${order}${esc(franchiseRelationLabel(link.relationType))}${here}</span>
        <b>${esc(displayTitle(item))}</b>
        <small>${esc(meta || 'Данных немного')}</small>
        <span class="franchise-link-status">${esc(listStatus)}${progressStatus ? ` · ${esc(progressStatus)}` : ''}</span>
      </span>
    </article>`;
  }
  function renderFranchiseSection(anime) {
    if (anime.custom) return '';
    const related = state.franchiseById.get(anime.id);
    const label = '<div class="modal-label">Сезоны и порядок просмотра</div>';
    if (state.franchiseLoading.has(anime.id)) {
      return `<div class="modal-section franchise-section">${label}<p class="hint">Загружаем связанные сезоны…</p></div>`;
    }
    if (state.franchiseErrors.has(anime.id)) {
      return `<div class="modal-section franchise-section">${label}<p class="hint">${esc(state.franchiseErrors.get(anime.id))}</p><button class="btn btn-ghost" data-action="retry-franchise" data-id="${anime.id}">Повторить</button></div>`;
    }
    if (!related) return `<div class="modal-section franchise-section">${label}<p class="hint">Проверяем, есть ли связанные сезоны…</p></div>`;
    if (!related.length) return `<div class="modal-section franchise-section">${label}<p class="hint">Связанные сезоны и продолжения не найдены.</p></div>`;

    const full = state.franchiseFullById.get(anime.id);
    const fullLoading = state.franchiseFullLoading && state.franchiseFullLoading.has(anime.id);
    const useRelated = full || related;
    const built = (window.AniTierCore && typeof window.AniTierCore.buildFranchiseGroups === 'function')
      ? window.AniTierCore.buildFranchiseGroups(useRelated, anime)
      : null;
    let groups = built && Array.isArray(built.groups) ? built.groups : [];
    if (!groups.length) {
      groups = [{ id: 'empty', title: 'Порядок просмотра', list: [], numbered: false }];
    }
    const hidden = groups.reduce((total, group) => total + Math.max(0, (group.list ? group.list.length : 0) - FRANCHISE_PREVIEW), 0);
    const expanded = Boolean(state.franchiseExpanded && state.franchiseExpanded.has(anime.id));
    const sections = groups.map(group => {
      if (!group.list || !group.list.length) return '';
      const shown = expanded ? group.list : group.list.slice(0, FRANCHISE_PREVIEW);
      const rows = shown.map((link, index) => franchiseCardHTML(link, {
        order: group.numbered ? index + 1 : undefined,
      })).join('');
      return `<div class="franchise-group">
        <h4 class="franchise-group-title">${esc(group.title)}<span>${group.list.length}</span></h4>
        <div class="franchise-list">${rows}</div>
      </div>`;
    }).join('');

    return `<div class="modal-section franchise-section">
      ${label}
      <p class="franchise-intro">Основной сюжет — по дате выхода. Фильмы, спешлы и пересказы собраны отдельно.</p>
      ${sections}
      <div class="franchise-actions">
        ${(hidden > 0 || expanded)
          ? `<button class="btn btn-ghost btn-small franchise-more" type="button" data-action="franchise-more" data-id="${anime.id}">${expanded ? 'Свернуть список' : `Показать все (${built.total || useRelated.length + 1})`}</button>`
          : ''}
        ${!full && !fullLoading
          ? `<button class="btn btn-ghost btn-small franchise-full" type="button" data-action="franchise-full" data-id="${anime.id}">Показать всю франшизу</button>`
          : fullLoading ? `<span class="hint">Собираем всю франшизу…</span>` : `<span class="hint">Показана вся доступная франшиза</span>`}
      </div>
      <p class="hint">У каждого тайтла свой тир-лист и прогресс серий.</p>
    </div>`;
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
      /* Только хронология: иначе фильмы и OVA прыгают в конец списка. */
      links.sort((a, b) => (franchiseDate(a) - franchiseDate(b)) || (((a && a.anime && a.anime.id) || 0) - ((b && b.anime && b.anime.id) || 0)));
      state.franchiseById.set(anime.id, links);
    }).catch(error => {
      state.franchiseErrors.set(anime.id, error && error.message ? error.message : 'Не удалось загрузить порядок просмотра');
    }).finally(() => {
      state.franchiseLoading.delete(anime.id);
      if (state.modalId === anime.id) renderModal();
    });
  }

  function closeModal(opts = {}) {
    state.modalId = null;
    state.modalTab = 'overview';
    const modal = $('#modal');
    if (modal) modal.hidden = true;
    if (App.revokeMomentUrls) App.revokeMomentUrls();
    syncBodyScroll();
    if (state.tab === 'db') renderDB();
    else if (state.tab === 'watched' || state.tab === 'planned') renderTierList(state.tab);
    if (!opts.fromHash) writeLocationHash();
  }

  /* Переключение разделов карточки без перерисовки: изображения и прогресс
     остаются на месте, меняются только видимые панели. */
  function switchModalTab(tab, opts = {}) {
    if (!MODAL_TABS.includes(tab)) return;
    state.modalTab = tab;
    $$('.modal-tab').forEach(node => {
      const on = node.dataset.tab === tab;
      node.classList.toggle('is-active', on);
      node.setAttribute('aria-selected', on ? 'true' : 'false');
      node.tabIndex = on ? 0 : -1;
    });
    $$('.modal-pane').forEach(node => {
      node.hidden = node.id !== 'modal-pane-' + tab;
    });
    const panel = $('.modal-panel');
    if (panel) panel.scrollTop = 0;
    if (opts.focus) {
      const active = $('.modal-tab.is-active');
      if (active) active.focus({ preventScroll: true });
    }
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
    const genres = (a.genres || []).map(g => (
      `<button type="button" class="tag tag-link" data-action="find-genre" data-genre="${esc(g)}" title="Найти аниме в жанре «${esc(C.genreRu(g))}»">${esc(C.genreRu(g))}</button>`
    )).join('');
    const spoilerTags = new Set(Array.isArray(a.spoilerTags) ? a.spoilerTags : []);
    const tagChips = (Array.isArray(a.tags) ? a.tags : []).slice(0, 18).map(tag => (
      `<button type="button" class="tag tag-link${spoilerTags.has(tag) ? ' tag-spoiler' : ''}" data-action="find-tag" data-tag="${esc(tag)}"${spoilerTags.has(tag) ? ' title="Может содержать спойлер"' : ''}>${esc(C.genreRu(tag))}</button>`
    )).join('');
    const poster = a.image || makePoster(a.title, a.id);
    const mainTitle = displayTitle(a);
    const secondaryTitle = mainTitle === (a.titleRu || '')
      ? (a.originalTitle || a.altTitle || '')
      : (a.titleRu || a.altTitle || '');
    const translationProvider = state.settings.translationProvider || 'auto';
    const translatedSynopsis = App.cachedTranslation ? App.cachedTranslation(a.synopsis, translationProvider) : '';
    const translatedVia = App.cachedTranslationProvider ? App.cachedTranslationProvider(a.synopsis, translationProvider) : '';
    const translationRequestKey = `${a.id}:${translationProvider}`;
    const canTranslateSynopsis = Boolean(a.synopsis && !C.hasCyrillic(a.synopsis));
    const synopsisMode = state.synopsisModes.get(a.id)
      || (state.settings.synopsisLang === 'original' ? 'original' : 'translated');
    const showTranslatedSynopsis = Boolean(canTranslateSynopsis && translatedSynopsis && synopsisMode !== 'original');
    const synopsis = (showTranslatedSynopsis ? translatedSynopsis : a.synopsis) || 'Описание пока недоступно.';
    const translating = state.synopsisTranslating.has(translationRequestKey);
    const synopsisControls = canTranslateSynopsis
      ? `<div class="synopsis-toolbar">
          <label class="synopsis-provider">Переводчик
            <select data-action="synopsis-provider" aria-label="Переводчик описания">
              <option value="auto"${translationProvider === 'auto' ? ' selected' : ''}>Авто: MyMemory → Google</option>
              <option value="mymemory"${translationProvider === 'mymemory' ? ' selected' : ''}>MyMemory</option>
              <option value="google"${translationProvider === 'google' ? ' selected' : ''}>Google Переводчик</option>
            </select>
          </label>
          <span class="synopsis-translation-status" role="status">${translatedSynopsis ? (showTranslatedSynopsis ? `Перевод: ${translatedVia === 'google' ? 'Google' : 'MyMemory'}` : 'Оригинал') : (translating ? 'Переводим…' : 'Перевод пока недоступен')}</span>
          ${!translatedSynopsis && !translating ? `<button type="button" class="ep-link" data-action="translate-synopsis" data-id="${a.id}">Перевести</button>` : ''}
          <div class="synopsis-switch" role="group" aria-label="Язык описания">
            <button type="button" data-action="synopsis-mode" data-id="${a.id}" data-mode="translated" aria-pressed="${showTranslatedSynopsis ? 'true' : 'false'}"${translatedSynopsis ? '' : ' disabled'}>Перевод</button>
            <button type="button" data-action="synopsis-mode" data-id="${a.id}" data-mode="original" aria-pressed="${!showTranslatedSynopsis ? 'true' : 'false'}">Оригинал</button>
          </div>
        </div>`
      : '';

    const related = state.franchiseById.get(a.id) || [];
    const ownProgress = watchedCount(a.id);
    const momentsCount = momentsFor(a.id).length;
    const episodesCount = a.episodes ? `${ownProgress}/${a.episodes}` : (ownProgress ? String(ownProgress) : '');
    const activeTab = ['overview', 'seasons', 'episodes', 'moments'].includes(state.modalTab) ? state.modalTab : 'overview';
    const tabButton = (id, label, count) => `<button type="button" class="modal-tab${activeTab === id ? ' is-active' : ''}" role="tab" id="modal-tab-${id}" aria-selected="${activeTab === id ? 'true' : 'false'}" aria-controls="modal-pane-${id}" tabindex="${activeTab === id ? '0' : '-1'}" data-action="modal-tab" data-tab="${id}">${label}${count ? `<b>${esc(String(count))}</b>` : ''}</button>`;
    const pane = (id, inner) => `<div class="modal-pane" id="modal-pane-${id}" role="tabpanel" aria-labelledby="modal-tab-${id}"${activeTab === id ? '' : ' hidden'}>${inner}</div>`;

    content.innerHTML = `
      <div class="modal-grid">
        <div class="modal-poster">
          <div class="modal-poster-wrap">
            <img src="${esc(poster)}" alt="${esc(displayTitle(a))}" data-title="${esc(displayTitle(a))}" data-id="${a.id}"${/^https?:\/\//i.test(poster) ? ` data-poster-src="${esc(poster)}"` : ''}>
            <div class="modal-side-score">${a.score ? `★ ${a.score.toFixed(2)}` : '★ —'}<small>рейтинг</small></div>
          </div>
        </div>
        <div class="modal-info">
          <div class="modal-eyebrow">${esc(typeRu(a.type) || 'Аниме')}${a.year ? ' · ' + a.year : ''}</div>
          <h2 id="modal-title">${esc(mainTitle)}</h2>
          ${secondaryTitle ? `<p class="modal-alt">${esc(secondaryTitle)}</p>` : ''}
          <div class="modal-facts">${facts}</div>
          <div class="modal-actions">
            <button class="btn ${inW ? 'is-on' : 'btn-primary'}" data-action="add-watched" data-id="${a.id}">${inW ? '✓ В просмотрено' : 'Отметить просмотренным'}</button>
            <button class="btn btn-ghost ${inP ? 'is-on' : ''}" data-action="add-planned" data-id="${a.id}">${inP ? '◷ В планах' : 'Запланировать'}</button>
            ${!a.custom ? `<button class="btn btn-ghost" data-action="tiktok-search" data-id="${a.id}">Искать в TikTok</button>` : ''}
          </div>
          ${customActions}
          <div class="modal-tabs" role="tablist" aria-label="Разделы карточки">
            ${tabButton('overview', 'Обзор')}
            ${a.custom ? '' : tabButton('seasons', 'Сезоны', related.length ? related.length + 1 : '')}
            ${tabButton('episodes', 'Серии', episodesCount)}
            ${tabButton('moments', 'Моменты', momentsCount || '')}
          </div>
          ${pane('overview', `
            <div class="modal-section">
              <div class="modal-label">Тир-лист</div>
              <div class="tier-picker">${tiers}</div>
              <p class="hint">${inW || inP
                ? 'Выберите уровень — карточка переедет в выбранный тир.'
                : 'Выберите тир, чтобы сразу добавить тайтл в «Просмотрено».'}</p>
            </div>
            <section class="modal-section modal-synopsis-section">
              <div class="modal-label">Описание</div>
              ${synopsisControls}
              <p class="modal-synopsis"${showTranslatedSynopsis ? ' data-translated="1" title="Автоматический перевод"' : ''}>${esc(synopsis)}</p>
            </section>
            ${genres ? `<section class="modal-section modal-genres">
              <div class="modal-label">Жанры</div>
              <div class="tags">${genres}</div>
            </section>` : ''}
            ${tagChips ? `<section class="modal-section modal-tags">
              <div class="modal-label">Теги</div>
              <div class="tags">${tagChips}</div>
              <button class="btn btn-ghost" type="button" data-action="find-similar" data-id="${a.id}">Найти похожие</button>
            </section>` : ''}
            ${sourceLine}
          `)}
          ${a.custom ? '' : pane('seasons', renderFranchiseSection(a))}
          ${pane('episodes', `<div class="modal-section modal-episodes">
            <div class="modal-label">Серии и прогресс</div>
            ${renderEpisodeBlock(a, 'modal')}
          </div>`)}
          ${pane('moments', momentsHTML(a))}
        </div>      </div>`;

    const fresh = $('.modal-panel');
    if (fresh) fresh.scrollTop = scrollTop;

    if (!state.franchiseById.has(a.id) && !state.franchiseLoading.has(a.id) && !state.franchiseErrors.has(a.id)) loadFranchise(a);

    if (!a.custom && (!state.epInfo[a.id] || Date.now() - Number(state.epInfo[a.id].fetchedAt || 0) > 2 * 3600000)) {
      if (a.status === 'В эфире' || !a.episodes) ensureEpisodeInfo(a);
    }
  }
  Object.assign(App, {
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
    renderFranchiseSection,
    openModal,
    closeModal,
    renderModal,
    switchModalTab,
  });
})(window.AniTier);
