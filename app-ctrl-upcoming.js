/* ============================================================
   AniTier вЂ” контроллер премьер (РІС‹РґРµР»РµРЅРѕ РёР· app.js)
   ============================================================ */
(function (App) {
  'use strict';
  const C = window.AniTierCore;

  async function fetchUpcoming(force = false, options = {}) {
    const reload = Boolean(options && options.reload);
    if (reload) {
      return App.withCacheReload(() => fetchUpcomingInner(force, reload));
    }
    return fetchUpcomingInner(force, false);
  }

  async function fetchUpcomingInner(force = false, reload = false) {
    const u = App.state.upcoming;
    if (u.loading) {
      if (force) {
        u.queued = true;
        u.reloadQueued = reload;
      }
      return;
    }
    if (u.items.length && !force) return;
    if (force) App.clearAniListCache();

    if (App.state.forceDemo) {
      u.items = App.demoUpcoming();
      u.loaded = true;
      u.loading = false;
      u.error = null;
      u.fallback = false;
      App.renderUpcoming();
      return;
    }

    u.loading = true;
    u.error = null;
    u.fallback = false;
    App.renderUpcoming();

    try {
      const from = App.startOfTomorrow();
      const to = App.addDays(App.startOfToday(), 91);
      const startGreater = App.fuzzyDateInt(App.startOfToday());
      const startLesser = App.fuzzyDateInt(to);
      const all = [];

      for (let page = 1; page <= 10; page++) {
        const pageData = await App.fetchAniList({
          type: 'ANIME',
          status: 'NOT_YET_RELEASED',
          sort: ['START_DATE'],
          page,
          perPage: 50,
          startDateGreater: startGreater,
          startDateLesser: startLesser,
          isAdult: false,
        });
        all.push(...pageData.media.map(App.mapAniList));
        if (!pageData.pageInfo?.hasNextPage) break;
      }

      u.items = C.dedupeById(all).filter(a => {
        const d = App.parseDate(a.airedFrom);
        return d && d >= from && d <= to;
      }).sort((a, b) => new Date(a.airedFrom) - new Date(b.airedFrom));
      u.loaded = true;
    } catch (err) {
      console.error(err);
      u.error = err.message || 'Ошибка сети';
      App.state.offline = true;
      if (!u.items.length) u.items = App.demoUpcoming();
      App.toast('Календарь премьер недоступен — включён демо-режим');
    } finally {
      u.loading = false;
      App.renderUpcoming();
      App.updateOfflineBanner();
      if (u.queued) {
        const queuedReload = Boolean(u.reloadQueued);
        u.queued = false;
        u.reloadQueued = false;
        fetchUpcoming(true, { reload: queuedReload });
      }
    }
  }


  Object.assign(App, { fetchUpcoming });
})(window.AniTier);