/* Целостность оболочек: списки модулей не должны расходиться (пункт 31). */
(() => {
  'use strict';
  const T = window.AniTierTests;

  const SHARED = [
    'tags.js', 'titles-ru-anilist.js', 'titles-ru.js', 'changelog.js', 'core.js',
    'app-store.js', 'app-api.js',
    'app-render-cards.js', 'app-render-lists.js', 'app-render-screens.js', 'app-render-modals.js', 'app-render-exchange.js', 'app-render-png.js', 'app-render-settings.js', 'app-render-command.js',
    'app-ctrl-catalog.js', 'app-ctrl-notifications.js', 'app-ctrl-upcoming.js', 'app-ctrl-backup.js', 'app-ctrl-posters.js', 'app-ctrl-moments.js', 'app-ctrl-settings.js', 'app-ctrl-diagnostics.js', 'app-ctrl-gestures.js',
    'app.js',
  ];
  const MOBILE_ONLY = ['mobile.js'];
  const SHARED_CSS = ['styles.css'];
  const MOBILE_CSS = ['mobile.css'];
  const MOBILE_ASSETS = ['manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'index.html'];

  function norm(name) {
    return String(name || '').split('?')[0].replace(/^\.{1,2}\//, '').replace(/^(mobile\/)/, '');
  }

  function extractScriptSrcs(html) {
    const out = [];
    const re = /<script[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let m;
    while ((m = re.exec(html))) out.push(norm(m[1]));
    return out;
  }

  function extractLinkHrefs(html) {
    const out = [];
    const re = /<link[^>]+href=["']([^"']+)["'][^>]*rel=["']stylesheet["'][^>]*>|<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
    let m;
    while ((m = re.exec(html))) out.push(norm(m[1] || m[2]));
    return out;
  }

  function extractSwShell(text) {
    const start = text.indexOf('const SHELL');
    const end = start >= 0 ? text.indexOf('];', start) : -1;
    if (start < 0 || end < 0) return [];
    const block = text.slice(start, end);
    const out = [];
    const re = /'([^']+)'/g;
    let m;
    while ((m = re.exec(block))) out.push(norm(m[1]));
    return out;
  }

  function extractBuildNames(text) {
    const out = new Set();
    const re = /(?:Read-Text\s+['"]([^'"]+\.js)['"])|(?:src=["'][^"']*?([A-Za-z0-9_-]+\.js)(?:\?[^"']*)?["'])/g;
    let m;
    while ((m = re.exec(text))) {
      const name = norm(m[1] || m[2]);
      if (name && !name.startsWith('serve') && !name.startsWith('build') && !name.startsWith('test') && !name.startsWith('release') && !name.startsWith('smoke') && !name.startsWith('graph')) out.add(name);
    }
    return [...out];
  }

  function assertHasAll(haystack, names, label) {
    for (const name of names) {
      T.assert(haystack.includes(name), label + ': отсутствует ' + name);
    }
  }

  function assertOrdered(haystack, names, label) {
    let prev = -1;
    for (const name of names) {
      const i = haystack.indexOf(name);
      T.assert(i >= 0, label + ': отсутствует ' + name);
      T.assert(i > prev, label + ': нарушен порядок у ' + name);
      prev = i;
    }
  }

  T.test('shell: общие модули совпадают в index/mobile/build-phone/sw', async () => {
    const [index, mobile, build, sw] = await Promise.all([
      fetch('../index.html').then(r => r.text()),
      fetch('../mobile/index.html').then(r => r.text()),
      fetch('../build-phone.ps1').then(r => r.text()),
      fetch('../mobile/sw.js').then(r => r.text()),
    ]);

    const indexScripts = extractScriptSrcs(index);
    const mobileScripts = extractScriptSrcs(mobile);
    const buildNames = extractBuildNames(build);
    const swShell = extractSwShell(sw);

    assertOrdered(indexScripts, SHARED, 'index.html');
    assertOrdered(mobileScripts, SHARED.concat(MOBILE_ONLY), 'mobile/index.html');

    assertHasAll(buildNames, SHARED, 'build-phone.ps1');
    assertHasAll(buildNames, MOBILE_ONLY, 'build-phone.ps1');
    // стили тоже вшиваются в автономный файл
    T.assert(/styles\.css/i.test(build), 'build-phone.ps1: отсутствует styles.css');
    T.assert(/mobile\.css|mobile\\mobile\.css/i.test(build), 'build-phone.ps1: отсутствует mobile.css');

    assertHasAll(swShell, SHARED, 'mobile/sw.js SHELL');
    assertHasAll(swShell, MOBILE_ONLY, 'mobile/sw.js SHELL');
    assertHasAll(swShell, SHARED_CSS, 'mobile/sw.js SHELL');
    assertHasAll(swShell, MOBILE_CSS, 'mobile/sw.js SHELL');
    assertHasAll(swShell, MOBILE_ASSETS, 'mobile/sw.js SHELL');
    assertOrdered(swShell.filter(n => SHARED.includes(n)), SHARED, 'mobile/sw.js SHELL (общие)');

    // версия кеша должна содержать APP_VERSION (release.ps1 проверяет)
    const C = window.AniTierCore;
    const cache = (sw.match(/const\s+CACHE\s*=\s*'([^']+)'/) || [])[1] || '';
    T.assert(cache, 'mobile/sw.js: CACHE не найден');
    T.includes(cache, C.APP_VERSION, 'mobile/sw.js: CACHE не содержит APP_VERSION');
  });

  /* Автономный файл вшивает модули внутрь страницы. Если CSP оболочки это
     запрещает, приложение не запускается: пустой экран вместо каталога. */
  T.test('shell: автономный файл разрешает свои встроенные скрипты', async () => {
    const html = await fetch('../AniTier-phone.html').then(r => r.text());
    const inline = (html.match(/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/gi) || []).length;
    T.assert(inline > 0, 'AniTier-phone.html: нет встроенных скриптов — файл не автономный');
    T.eq(extractScriptSrcs(html).length, 0, 'AniTier-phone.html: остались внешние скрипты');

    const meta = html.match(/<meta[^>]+Content-Security-Policy[^>]*>/i);
    const csp = meta ? ((meta[0].match(/content="([^"]*)"/i) || [])[1] || '') : '';
    T.assert(csp, 'AniTier-phone.html: не найдена CSP');
    const scriptSrc = (csp.match(/script-src([^;]*)/i) || [])[1] || '';
    T.includes(scriptSrc, "'unsafe-inline'", 'AniTier-phone.html: CSP блокирует встроенные скрипты');
  });

  /* CSP не должна отрезать сетевые запросы приложения: проверка обновлений
     ходит на api.github.com, каталог — в AniList и Kitsu. */
  T.test('shell: CSP разрешает сетевые запросы приложения', async () => {
    const [index, mobile] = await Promise.all([
      fetch('../index.html').then(r => r.text()),
      fetch('../mobile/index.html').then(r => r.text()),
    ]);
    const hosts = [
      'https://graphql.anilist.co',
      'https://kitsu.io',
      'https://api.github.com',
      'https://translate.googleapis.com',
      'https://www.googleapis.com',
      'https://oauth2.googleapis.com',
    ];
    for (const [name, html] of [['index.html', index], ['mobile/index.html', mobile]]) {
      const meta = html.match(/<meta[^>]+Content-Security-Policy[^>]*>/i);
      const csp = meta ? ((meta[0].match(/content="([^"]*)"/i) || [])[1] || '') : '';
      T.assert(csp, name + ': не найдена CSP');
      const connect = (csp.match(/connect-src([^;]*)/i) || [])[1] || '';
      for (const host of hosts) {
        T.includes(connect, host, name + ': CSP connect-src без ' + host);
      }
    }
  });
})();
