/* ============================================================
   AniTier — контроллер локальной диагностики (выделено из app.js)
   ============================================================ */
(function (App) {
  'use strict';
  const C = window.AniTierCore;
  const toast = (...a) => App.toast(...a);


  const DIAG_LIMIT = 50;

  const diagState = {
    errors: [],
    requestFailures: 0,
    requestTotal: 0,
    byOrigin: Object.create(null),
  };

  function sanitizeDiagText(value, max = 220) {
    let text = String(value == null ? '' : value).replace(/[\r\n\t]+/g, ' ').trim();
    /* Убираем URL с параметрами и длинные пути: в них могут быть поисковые запросы. */
    text = text.replace(/https?:\/\/[^\s)]+/gi, (url) => {
      try {
        const u = new URL(url);
        return u.origin + '/…';
      } catch {
        return '[url]';
      }
    });
    text = text.replace(/([?#]).{1,200}/g, '$1…');
    if (text.length > max) text = text.slice(0, max - 1) + '…';
    return text;
  }

  function diagOriginCategory(input) {
    try {
      const host = new URL(String(input || ''), location.href).hostname;
      if (host.includes('anilist')) return 'AniList';
      if (host.includes('kitsu')) return 'Kitsu';
      if (host.includes('translate') || host.includes('mymemory') || host.includes('wikidata')) return 'Перевод';
      if (host.includes('googleapis') || host.includes('google') || host.includes('gstatic')) return 'Google';
      if (host === location.hostname) return 'Локально';
      return 'Другое';
    } catch {
      return 'Другое';
    }
  }

  function recordDiagError(source, error, extra) {
    try {
      const message = sanitizeDiagText(
        extra && extra.message ? extra.message
          : error && error.message ? error.message
          : typeof error === 'string' ? error
          : String(error || 'Ошибка')
      );
      diagState.errors.push({
        at: new Date().toISOString(),
        source: sanitizeDiagText(source || 'app', 40),
        message: message || 'Ошибка',
        status: extra && Number.isFinite(Number(extra.status)) ? Number(extra.status) : undefined,
      });
      if (diagState.errors.length > DIAG_LIMIT) diagState.errors.splice(0, diagState.errors.length - DIAG_LIMIT);
    } catch { /* диагностика не должна ломать приложение */ }
  }

  function recordRequestResult(input, ok, status) {
    try {
      diagState.requestTotal += 1;
      const origin = diagOriginCategory(input);
      if (!diagState.byOrigin[origin]) diagState.byOrigin[origin] = { total: 0, failed: 0 };
      diagState.byOrigin[origin].total += 1;
      if (!ok) {
        diagState.requestFailures += 1;
        diagState.byOrigin[origin].failed += 1;
        recordDiagError('network', null, {
          message: origin + ': запрос не выполнен',
          status,
        });
      }
    } catch { /* диагностика не должна ломать приложение */ }
  }

  function buildDiagnosticsReport(now = new Date(), env = {}) {
    const version = (C && C.APP_VERSION) || '—';
    const nav = typeof navigator !== 'undefined' ? navigator : {};
    const lines = [
      'AniTier — диагностика',
      'Время: ' + (now instanceof Date ? now.toISOString() : String(now)),
      'Версия: ' + version,
      'Платформа: ' + String(env.platform || nav.platform || '—'),
      'User-Agent: ' + sanitizeDiagText(nav.userAgent || '—', 160),
      'Онлайн: ' + String(typeof nav.onLine === 'boolean' ? nav.onLine : '—'),
      'Режим: ' + String(env.mode || 'web'),
      'Запросы: всего ' + diagState.requestTotal + ', ошибок ' + diagState.requestFailures,
    ];
    const origins = Object.keys(diagState.byOrigin || {}).sort();
    if (origins.length) {
      lines.push('Источники: ' + origins.map(k => k + ' ' + diagState.byOrigin[k].failed + '/' + diagState.byOrigin[k].total).join(', '));
    }
    lines.push('Ошибки (последние ' + diagState.errors.length + ', без названий и прогресса):');
    if (!diagState.errors.length) {
      lines.push('- нет записей');
    } else {
      for (const e of diagState.errors.slice(-20)) {
        lines.push('- [' + e.at + '] ' + e.source + (e.status ? ' HTTP ' + e.status : '') + ': ' + e.message);
      }
    }
    return lines.join('\n');
  }

  async function copyDiagnostics() {
    const text = buildDiagnosticsReport();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      toast('Диагностика скопирована');
    } catch (err) {
      recordDiagError('diag', err);
      toast('Не удалось скопировать диагностику');
    }
  }

  function installDiagnostics() {
    if (typeof window === 'undefined' || window.__anitierDiagInstalled) return;
    window.__anitierDiagInstalled = true;
    window.addEventListener('error', (event) => {
      recordDiagError('runtime', event && event.error ? event.error : event && event.message);
    });
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event ? event.reason : null;
      recordDiagError('promise', reason);
    });
    if (typeof window.fetch === 'function') {
      const orig = window.fetch.bind(window);
      window.fetch = async function diagFetch(input, init) {
        try {
          const res = await orig(input, init);
          recordRequestResult(input, res && res.ok !== false, res && res.status);
          return res;
        } catch (err) {
          recordRequestResult(input, false);
          throw err;
        }
      };
    }
  }

  Object.assign(App, {
    sanitizeDiagText,
    diagOriginCategory,
    recordDiagError,
    recordRequestResult,
    buildDiagnosticsReport,
    copyDiagnostics,
    installDiagnostics,
    diagState,
  });
})(window.AniTier);
