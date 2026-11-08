/* CSP и отсутствие inline-обработчиков (пункт 22). */
(() => {
  'use strict';
  const T = window.AniTierTests;

  const SOURCES = ['../index.html', '../mobile/index.html', '../app-render.js', '../app-render-cards.js', '../app-render-lists.js', '../app-render-screens.js', '../app-render-modals.js'];

  T.test('csp: нет inline onload/onerror обработчиков постеров', async () => {
    const texts = await Promise.all(SOURCES.map(src => fetch(src).then(r => r.text())));
    const hits = [];
    SOURCES.forEach((src, i) => {
      if (/\bon(load|error)\s*=/.test(texts[i])) hits.push(src);
    });
    T.eq(hits, [], 'найдены inline-обработчики: ' + hits.join(', '));
  });

  T.test('csp: meta Content-Security-Policy есть и содержит нужные источники', async () => {
    for (const src of ['../index.html', '../mobile/index.html']) {
      const html = await fetch(src).then(r => r.text());
      const tag = html.match(/<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/i);
      T.assert(tag, src + ': нет CSP meta');
      const csp = tag[0];
      for (const origin of ['graphql.anilist.co', 'kitsu.io', 'fonts.googleapis.com', 'fonts.gstatic.com', 'accounts.google.com', 'query.wikidata.org', 'api.mymemory.translated.net', 'translate.googleapis.com']) {
        T.assert(csp.includes(origin), src + ': в CSP нет ' + origin);
      }
      T.assert(!/\bscript-src[^;]*unsafe-inline/.test(csp), src + ': script-src не должен разрешать unsafe-inline');
    }
  });
})();
