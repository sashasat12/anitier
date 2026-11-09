/* ============================================================
   AniTier — настройки и статистика профиля (выделено из app-render-modals.js)
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
  const closeModal = (...a) => App.closeModal(...a);
  const closeBackup = (...a) => App.closeBackup(...a);
  const syncBodyScroll = (...a) => App.syncBodyScroll(...a);
  const toast = (...a) => App.toast(...a);
  const renderDB = (...a) => App.renderDB(...a);
  const renderNotifications = (...a) => App.renderNotifications(...a);
  const renderUpcoming = (...a) => App.renderUpcoming(...a);
  const renderCommand = (...a) => App.renderCommand(...a);
  const canRestoreFocus = (...a) => (App.canRestoreFocus ? App.canRestoreFocus(...a) : true);

  function renderUpdateCard() {
    const el = $('#update-card');
    if (!el) return;
    const card = state.updateCard;
    if (!card) {
      el.hidden = true;
      el.innerHTML = '';
      return;
    }

    if (card.mode === 'ask') {
      el.innerHTML = `<div class="update-card-body">
        <button class="update-card-close" type="button" data-action="dismiss-update" aria-label="Скрыть">✕</button>
        <span class="update-card-kicker">Обновления</span>
        <h3>Проверять обновления при запуске?</h3>
        <p>AniTier сможет сразу предлагать новую версию. Проверка обращается только к GitHub и не отправляет ваши списки.</p>
        <div class="update-card-actions">
          <button class="btn btn-primary" type="button" data-action="update-allow">Разрешить</button>
          <button class="btn btn-ghost" type="button" data-action="update-deny">Не проверять</button>
        </div>
      </div>`;
      el.hidden = false;
      return;
    }

    const release = card.release || {};
    const version = release.version || '';
    el.innerHTML = `<div class="update-card-body">
      <button class="update-card-close" type="button" data-action="dismiss-update" aria-label="Скрыть">✕</button>
      <span class="update-card-kicker">Доступно обновление</span>
      <h3>AniTier ${esc(version)}</h3>
      <p>У вас ${esc(C.APP_VERSION)}. ${card.apk
        ? 'Нажмите «Скачать» — файл загрузится в приложении и откроется установщик. Списки и настройки сохранятся.'
        : 'Откройте релиз на GitHub и установите свежую версию.'}</p>
      <div class="update-card-actions">
        <button class="btn btn-primary" type="button" data-action="open-update">${card.apk ? 'Скачать обновление' : 'Открыть релиз'}</button>
        <button class="btn btn-ghost" type="button" data-action="dismiss-update">Позже</button>
      </div>
    </div>`;
    el.hidden = false;
  }

  function changelogHTML(current) {
    const list = Array.isArray(C.CHANGELOG) ? C.CHANGELOG : [];
    if (!list.length) return '<p class="custom-sub">История изменений пока пуста.</p>';
    return `<div class="changelog">${list.map(entry => `
      <article class="changelog-release" data-search="${esc([entry.version, entry.title, ...(entry.items || [])].join(' ').toLowerCase())}">
        <header class="changelog-head">
          <h3>${esc(entry.version)}${entry.version === current ? '<span class="changelog-badge">текущая</span>' : ''}</h3>
          ${entry.date ? `<span class="changelog-date">${esc(entry.date)}</span>` : ''}
        </header>
        ${entry.title ? `<p class="changelog-title">${esc(entry.title)}</p>` : ''}
        <ul class="changelog-list">
          ${(entry.items || []).map(item => `<li>${esc(item)}</li>`).join('')}
        </ul>
      </article>`).join('')}</div>`;
  }

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
    const titleLang = state.settings.titleLang === 'original' ? 'original' : 'ru';
    const synopsisLang = state.settings.synopsisLang === 'original' ? 'original' : 'translated';
    const provider = state.settings.translationProvider || 'auto';
    const updateCheck = normalizeUpdateCheck(state.settings.updateCheck);
    const theme = state.settings.theme === 'amoled' ? 'amoled' : 'dark';
    const density = state.settings.density === 'compact' ? 'compact' : 'comfortable';
    const fontSize = ['small', 'large'].includes(state.settings.fontSize) ? state.settings.fontSize : 'normal';
    const github = C.GITHUB_URL || '';

    if (screen.view === 'changelog') {
      box.innerHTML = `<div class="changelog-screen-head">
          <button class="btn btn-ghost" type="button" data-action="settings-back">← Назад</button>
          <h2 id="settings-title">История изменений</h2>
        </div>
        <p class="custom-sub">Версия ${esc(version)} · что появилось в приложении.</p>
        <div class="changelog-search">
          <input id="changelog-search" type="search" placeholder="Найти версию или изменение" autocomplete="off" aria-label="Поиск по истории изменений">
        </div>
        ${changelogHTML(version)}`;
      return;
    }

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
    const apkBridge = typeof window !== 'undefined' ? window.AniTierAndroid : null;
    const canDownload = Boolean(apkBridge && typeof apkBridge.downloadUpdate === 'function');
    const releaseLink = release && release.url && C.compareVersions(release.version, version) > 0
      ? (canDownload
        ? `<button class="btn btn-primary" type="button" data-action="download-update" data-version="${esc(release.version)}">Скачать обновление ${esc(release.version)}</button>`
        : `<button class="btn btn-ghost" type="button" data-action="open-link" data-url="${esc(release.url)}">Открыть релиз ${esc(release.version)}</button>`)
      : '';

    box.innerHTML = `<h2 id="settings-title">Настройки</h2>
      <p class="custom-sub">AniTier ${esc(version)} · данные хранятся только на этом устройстве.</p>
      ${reminders}
      <div class="backup-block">
        <h3>Язык контента</h3>
        <label class="settings-field">
          <span>Названия тайтлов</span>
          <select data-action="settings-title-lang" aria-label="Язык названий">
            <option value="ru"${titleLang === 'ru' ? ' selected' : ''}>Русские, если есть</option>
            <option value="original"${titleLang === 'original' ? ' selected' : ''}>Оригинальные</option>
          </select>
        </label>
        <label class="settings-field">
          <span>Описания</span>
          <select data-action="settings-synopsis-lang" aria-label="Язык описаний">
            <option value="translated"${synopsisLang === 'translated' ? ' selected' : ''}>Перевод на русский</option>
            <option value="original"${synopsisLang === 'original' ? ' selected' : ''}>Оригинал</option>
          </select>
        </label>
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
          <span>Перевод описаний</span>
          <select data-action="settings-translation" aria-label="Провайдер перевода">
            <option value="auto"${provider === 'auto' ? ' selected' : ''}>Авто: MyMemory → Google</option>
            <option value="mymemory"${provider === 'mymemory' ? ' selected' : ''}>MyMemory</option>
            <option value="google"${provider === 'google' ? ' selected' : ''}>Google Переводчик</option>
          </select>
        </label>
      </div>
      <div class="backup-block">
        <h3>Оформление</h3>
        <label class="settings-field">
          <span>Тема</span>
          <select data-action="settings-theme" aria-label="Тема">
            <option value="dark"${theme === 'dark' ? ' selected' : ''}>Тёмная</option>
            <option value="amoled"${theme === 'amoled' ? ' selected' : ''}>AMOLED — чёрная</option>
          </select>
        </label>
        <label class="settings-field">
          <span>Плотность</span>
          <select data-action="settings-density" aria-label="Плотность карточек">
            <option value="comfortable"${density === 'comfortable' ? ' selected' : ''}>Обычная</option>
            <option value="compact"${density === 'compact' ? ' selected' : ''}>Компактная</option>
          </select>
        </label>
        <label class="settings-field">
          <span>Размер шрифта</span>
          <select data-action="settings-font" aria-label="Размер шрифта">
            <option value="small"${fontSize === 'small' ? ' selected' : ''}>Мелкий</option>
            <option value="normal"${fontSize === 'normal' ? ' selected' : ''}>Обычный</option>
            <option value="large"${fontSize === 'large' ? ' selected' : ''}>Крупный</option>
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
        <h3>Хранилище и кэш</h3>
        <p>Занято устройством: <strong id="storage-usage">${esc(screen.storageText || 'проверяем…')}</strong>. Можно очистить кэш API и постеров — списки, прогресс, карточки и моменты не затрагиваются.</p>
        ${screen.cacheMessage ? `<p class="backup-status${screen.cacheError ? ' is-error' : ''}" role="status">${esc(screen.cacheMessage)}</p>` : ''}
        <div class="form-actions">
          <button class="btn btn-ghost" type="button" data-action="settings-refresh-storage"${screen.storageBusy ? ' disabled' : ''}>${screen.storageBusy ? 'Проверяем…' : 'Обновить'}</button>
          <button class="btn btn-ghost" type="button" data-action="settings-clear-cache"${screen.cacheBusy ? ' disabled' : ''}>${screen.cacheBusy ? 'Очищаем…' : 'Очистить кэш'}</button>
        </div>
      </div>
      <div class="backup-block">
        <h3>Что нового</h3>
        <p>История изменений по версиям: что появилось, что исправили и что стало удобнее.</p>
        <button class="btn btn-ghost" type="button" data-action="open-changelog">История изменений</button>
      </div>
      <div class="backup-block">
        <h3>Диагностика</h3>
        <p>Локальный журнал ошибок и счётчик запросов. Названия тайтлов и прогресс не записываются, данные никуда не отправляются.</p>
        <p class="backup-status" role="status">Запросов: ${App.diagState ? App.diagState.requestTotal : 0}, ошибок: ${App.diagState ? App.diagState.requestFailures : 0} · записей в журнале: ${App.diagState ? App.diagState.errors.length : 0}</p>
        <div class="form-actions">
          <button class="btn btn-ghost" type="button" data-action="copy-diagnostics">Скопировать диагностику</button>
        </div>
      </div>
      <div class="backup-block">
        <h3>О приложении</h3>
        <p>Версия ${esc(version)}. Исходники и новости — на GitHub.</p>
        <label class="settings-field">
          <span>Проверка обновлений</span>
          <select data-action="settings-update-check" aria-label="Проверка обновлений при запуске">
            <option value="on"${updateCheck === 'on' ? ' selected' : ''}>Проверять при запуске</option>
            <option value="ask"${updateCheck === 'ask' ? ' selected' : ''}>Спрашивать при запуске</option>
            <option value="off"${updateCheck === 'off' ? ' selected' : ''}>Не проверять</option>
          </select>
        </label>
        <div class="form-actions">
          <button class="btn btn-ghost" type="button" data-action="open-link" data-url="${esc(github)}">GitHub</button>
          <button class="btn btn-primary" type="button" data-action="check-updates"${screen.checking ? ' disabled' : ''}>${screen.checking ? 'Проверяем…' : 'Проверить обновления'}</button>
          ${releaseLink}
        </div>
        ${updateStatus}
      </div>`;
  }

  function statsTierRows(stats) {
    const max = Math.max(1, ...TIER_IDS.map(tier => stats.tierCounts[tier] || 0));
    return TIERS.map(tier => {
      const count = stats.tierCounts[tier.id] || 0;
      const width = Math.round((count / max) * 100);
      return `<div class="stats-tier-row">
        <span class="stats-tier-badge tier-${tier.id}">${esc(tier.label)}</span>
        <span class="stats-tier-name">${esc(tier.name)}</span>
        <span class="stats-tier-track"><span class="stats-tier-fill tier-${tier.id}" style="width:${width}%"></span></span>
        <b>${count}</b>
      </div>`;
    }).join('');
  }

  function renderStatsScreen() {
    const box = $('#stats-content');
    if (!box) return;
    const stats = C.buildProfileStats(state.lists, state.progress);
    if (!stats.watched && !stats.planned) {
      box.innerHTML = `<section class="stats-screen">
        <header class="stats-head">
          <div class="exchange-eyebrow">Профиль</div>
          <h2 id="stats-title">Статистика</h2>
          <p class="exchange-sub">Здесь появятся часы за экраном, любимые жанры и распределение по тирам.</p>
        </header>
        <div class="exchange-empty">Пока пусто. Добавьте первый тайтл в «Просмотрено» — статистика соберётся сама.</div>
      </section>`;
      return;
    }

    const time = C.formatWatchTime(stats.minutes);
    const avg = stats.averageScore == null ? '—' : String(stats.averageScore);
    const genres = stats.topGenres.length
      ? stats.topGenres.map(genre => `<button type="button" class="stats-chip stats-chip-btn" data-action="stats-find-genre" data-genre="${esc(genre.name)}">${esc(genre.name)} <b>${genre.count}</b></button>`).join('')
      : '<span class="stats-muted">Жанры появятся, когда в списке будут тайтлы с жанрами.</span>';
    const tags = Array.isArray(stats.topTags) && stats.topTags.length
      ? stats.topTags.map(tag => `<button type="button" class="stats-chip stats-chip-btn" data-action="stats-find-tag" data-tag="${esc(tag.name)}">${esc(tag.name)} <b>${tag.count}</b></button>`).join('')
      : '';
    const studios = stats.topStudios.length
      ? stats.topStudios.map(studio => `<li><span>${esc(studio.name)}</span><b>${studio.count}</b></li>`).join('')
      : '';
    const years = stats.years.length
      ? stats.years.slice(0, 8).map(year => `<span class="stats-chip">${year.year} <b>${year.count}</b></span>`).join('')
      : '';
    const completionWidth = Math.max(0, Math.min(100, stats.completion));

    box.innerHTML = `<section class="stats-screen">
      <header class="stats-head">
        <div class="exchange-eyebrow">Профиль</div>
        <h2 id="stats-title">Статистика</h2>
        <p class="exchange-sub">Собрана из ваших списков и отмеченных серий. По 24 минуты на серию.</p>
      </header>

      <div class="stats-hero">
        <div class="stats-hero-time">
          <b>${esc(time)}</b>
          <span>за экраном</span>
        </div>
        <div class="stats-hero-grid">
          <div><b>${stats.episodesWatched}</b><span>серий просмотрено</span></div>
          <div><b>${stats.watched}</b><span>тайтлов в «Просмотрено»</span></div>
          <div><b>${avg}</b><span>средняя оценка</span></div>
          <div><b>${stats.planned}</b><span>в планах</span></div>
        </div>
      </div>

      <div class="stats-progress-card">
        <div class="stats-progress-head">
          <b>Завершено ${stats.completed} из ${stats.watched}</b>
          <span>${stats.completion}%</span>
        </div>
        <div class="stats-progress-track"><span style="width:${completionWidth}%"></span></div>
        <p class="stats-muted">Смотрю ${stats.inProgress} · не начато ${stats.notStarted} · известно серий ${stats.knownEpisodes}</p>
      </div>

      <h3 class="stats-subtitle">По тирам</h3>
      <div class="stats-tier-list">${statsTierRows(stats)}</div>

      <h3 class="stats-subtitle">Любимые жанры</h3>
      <div class="stats-chips">${genres}</div>

      ${tags ? `<h3 class="stats-subtitle">Любимые теги</h3>
      <div class="stats-chips">${tags}</div>` : ''}

      ${studios ? `<h3 class="stats-subtitle">Студии</h3>
      <ul class="stats-studio-list">${studios}</ul>` : ''}

      ${years ? `<h3 class="stats-subtitle">Годы выхода</h3>
      <div class="stats-chips">${years}</div>` : ''}
    </section>`;
  }

  function openStats() {
    if (state.modalId != null) closeModal();
    if (state.settingsScreen && state.settingsScreen.open) closeSettings();
    state.statsScreen = { open: true };
    renderStatsScreen();
    const modal = $('#stats-modal');
    if (modal) modal.hidden = false;
    syncBodyScroll();
    const panel = $('#stats-panel');
    if (panel) {
      panel.scrollTop = 0;
      panel.focus({ preventScroll: true });
    }
  }

  function closeStats() {
    state.statsScreen = { open: false };
    const modal = $('#stats-modal');
    if (modal) modal.hidden = true;
    syncBodyScroll();
  }

  function openSettings() {
    if (state.modalId != null) closeModal();
    if (state.statsScreen && state.statsScreen.open) closeStats();
    if (state.backup && state.backup.open) closeBackup();
    state.settingsScreen = {
      open: true, view: 'main', checking: false, message: '', error: false, latest: null,
      storageText: 'проверяем…', storageBusy: false, cacheBusy: false, cacheMessage: '', cacheError: false,
    };
    renderSettings();
    const modal = $('#settings-modal');
    if (modal) modal.hidden = false;
    syncBodyScroll();
    const panel = $('#settings-panel');
    if (panel) { panel.scrollTop = 0; panel.focus({ preventScroll: true }); }
    if (App.refreshStorageInfo) App.refreshStorageInfo();
  }

  function closeSettings() {
    state.settingsScreen = { open: false, view: 'main', checking: false, message: '', error: false, latest: null };
    const modal = $('#settings-modal');
    if (modal) modal.hidden = true;
    syncBodyScroll();
  }

  Object.assign(App, {
    renderUpdateCard,
    changelogHTML,
    renderSettings,
    statsTierRows,
    renderStatsScreen,
    openStats,
    closeStats,
    openSettings,
    closeSettings,
  });
})(window.AniTier);
