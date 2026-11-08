/* ============================================================
   AniTier вЂ” РєРѕРЅС‚СЂРѕР»Р»РµСЂ СѓРІРµРґРѕРјР»РµРЅРёР№ (РІС‹РґРµР»РµРЅРѕ РёР· app.js)
   ============================================================ */
(function (App) {
  'use strict';
  const C = window.AniTierCore;

  function hasNotificationData() {
    const n = App.state.notifications;
    return Boolean(
      (n.tracked.episodes && n.tracked.episodes.length)
      || (n.tracked.seasons && n.tracked.seasons.length)
      || (n.recent.episodes && n.recent.episodes.length)
      || (n.recent.films && n.recent.films.length)
      || (n.completed && n.completed.length),
    );
  }

  function trackedMalIds() {
    const ids = [];
    for (const name of ['watched', 'planned']) {
      for (const anime of App.allIn(name)) {
        const id = Number(anime && anime.malId);
        if (Number.isInteger(id) && id > 0) ids.push(id);
      }
    }
    return [...new Set(ids)];
  }

  function trackedEpisodeGroups(mediaList, scheduleEvents) {
    const byAnime = new Map();
    for (const event of scheduleEvents) {
      const anime = event && event.anime;
      if (!anime || anime.id == null) continue;
      const key = String(anime.id);
      if (!byAnime.has(key)) byAnime.set(key, []);
      byAnime.get(key).push(event);
    }

    const now = Date.now();
    const cutoff = now - C.TRACKED_EPISODE_DAYS * 86400000;
    const groups = [];
    for (const anime of mediaList) {
      if (!anime || anime.id == null) continue;
      const watched = App.watchedSet(anime.id);
      const events = (byAnime.get(String(anime.id)) || []).filter(event => {
        const at = App.parseDate(event.date);
        return at && at.getTime() >= cutoff && at.getTime() <= now && !watched.has(event.episode);
      });

      if (!events.length && anime.status === 'В эфире' && anime.nextEpisode) {
        const nextN = Number(anime.nextEpisode.n);
        const nextDate = App.parseDate(anime.nextEpisode.date);
        if (nextN > 1 && nextDate) {
          const episode = nextN - 1;
          const estimated = new Date(nextDate.getTime() - 7 * 86400000);
          if (estimated.getTime() >= cutoff && estimated.getTime() <= now && !watched.has(episode)) {
            events.push({ anime, episode, date: estimated.toISOString() });
          }
        }
      }

      if (!events.length) continue;
      const group = C.groupEpisodesByAnime(events)[0];
      if (group) groups.push(group);
    }

    return groups.sort((a, b) => {
      const at = a.latestAt ? new Date(a.latestAt).getTime() : 0;
      const bt = b.latestAt ? new Date(b.latestAt).getTime() : 0;
      return bt - at;
    });
  }

  function applyDemoNotifications() {
    const n = App.state.notifications;
    const demo = App.demoNotifications();
    n.tracked = demo.tracked;
    n.recent = demo.recent;
    n.completed = demo.completed;
    n.loaded = true;
    n.loading = false;
    n.error = null;
    App.seedDemoEpisodeInfo();
    if (!n.tabTouched) n.tab = C.defaultNotificationTab(n);
    App.renderNotifications();
    if (App.state.tab === 'notifications') App.markNotificationsSeen();
    App.updateBell();
  }

  async function fetchNotifications(force = false, options = {}) {
    const reload = Boolean(options && options.reload);
    if (reload) {
      return App.withCacheReload(() => fetchNotificationsInner(force, reload));
    }
    return fetchNotificationsInner(force, false);
  }

  async function fetchNotificationsInner(force = false, reload = false) {
    const n = App.state.notifications;
    if (n.loading) {
      if (force) {
        n.queued = true;
        n.reloadQueued = reload;
      }
      return;
    }
    if (hasNotificationData() && !force) return;
    if (force) {
      App.clearAniListCache();
      App.invalidateNotificationEpisodes();
    }

    if (App.state.forceDemo) {
      applyDemoNotifications();
      App.syncReleaseNotifications();
      return;
    }

    n.loading = true;
    n.error = null;
    App.renderNotifications();

    try {
      const malIds = trackedMalIds();
      const results = await Promise.allSettled([
        malIds.length ? App.fetchTrackedAnime(malIds) : Promise.resolve([]),
        App.fetchRecentScheduleEvents(C.RECENT_EPISODE_DAYS, 10),
        App.fetchRecentFilms(),
        App.fetchFinishedAnime(),
      ]);

      const [trackedResult, scheduleResult, filmsResult, completedResult] = results;
      const okCount = results.filter(result => result.status === 'fulfilled').length;
      if (!okCount) {
        const reason = results.find(result => result.status === 'rejected');
        throw (reason && reason.reason) || new Error('Ошибка сети');
      }

      const trackedMedia = trackedResult.status === 'fulfilled' ? trackedResult.value : [];
      const scheduleEvents = scheduleResult.status === 'fulfilled' ? scheduleResult.value : [];
      const films = filmsResult.status === 'fulfilled' ? filmsResult.value : [];
      const completed = completedResult.status === 'fulfilled' ? completedResult.value : [];

      n.tracked = {
        episodes: trackedEpisodeGroups(trackedMedia, scheduleEvents),
        seasons: C.collectSeasons(trackedMedia, { releaseDays: C.SEASON_RELEASE_DAYS }),
      };
      n.recent = {
        episodes: C.groupEpisodesByAnime(scheduleEvents).slice(0, 40),
        films,
      };
      n.completed = completed;
      n.loaded = true;
      if (!n.tabTouched) n.tab = C.defaultNotificationTab(n);
    } catch (err) {
      console.error(err);
      n.error = err.message || 'Ошибка сети';
      App.state.offline = true;
      if (!hasNotificationData()) applyDemoNotifications();
      App.toast('Уведомления недоступны — включён демо-режим');
    } finally {
      n.loading = false;
      App.renderNotifications();
      if (App.state.tab === 'notifications') App.markNotificationsSeen();
      App.updateBell();
      App.updateOfflineBanner();
      App.syncReleaseNotifications();
      if (n.queued) {
        const queuedReload = Boolean(n.reloadQueued);
        n.queued = false;
        n.reloadQueued = false;
        fetchNotifications(true, { reload: queuedReload });
      }
    }
  }


  Object.assign(App, {
    hasNotificationData,
    trackedMalIds,
    trackedEpisodeGroups,
    applyDemoNotifications,
    fetchNotifications,
  });
})(window.AniTier);