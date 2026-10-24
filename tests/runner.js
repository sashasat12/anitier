/* Мини-раннер тестов: без Node/npm, запускается в браузере. */
(() => {
  'use strict';

  const tests = [];
  const results = [];

  function stringify(value) {
    try { return JSON.stringify(value); }
    catch { return String(value); }
  }

  function timeout(ms, name) {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Таймаут ${ms} мс: ${name}`)), ms);
    });
  }

  const T = {
    test(name, fn) {
      tests.push({ name, fn });
    },

    assert(value, message = 'Условие не выполнено') {
      if (!value) throw new Error(message);
    },

    eq(actual, expected, message = 'Значения не равны') {
      if (stringify(actual) !== stringify(expected)) {
        throw new Error(`${message}: ожидалось ${stringify(expected)}, получено ${stringify(actual)}`);
      }
    },

    includes(haystack, needle, message = 'Подстрока не найдена') {
      if (!String(haystack).includes(needle)) {
        throw new Error(`${message}: ${needle}`);
      }
    },

    async waitFor(predicate, message = 'Условие не стало истинным', timeoutMs = 5000) {
      const started = Date.now();
      while (Date.now() - started < timeoutMs) {
        if (predicate()) return;
        await new Promise(resolve => setTimeout(resolve, 40));
      }
      throw new Error(`${message} (${timeoutMs} мс)`);
    },

    async mountApp(options = {}) {
      const {
        query = '?test=1',
        width = 1280,
        height = 900,
        setup = null,
      } = options;

      const iframe = document.createElement('iframe');
      iframe.style.cssText = `position:fixed;left:-20000px;top:0;width:${width}px;height:${height}px;border:0;`;
      iframe.src = `../index.html${query}`;

      const loaded = new Promise((resolve, reject) => {
        iframe.onload = resolve;
        iframe.onerror = reject;
      });

      document.body.appendChild(iframe);
      await loaded;

      const win = iframe.contentWindow;
      try {
        await T.waitFor(() => win.__anitierTest, 'Приложение не выставило тестовый API', 4000);
        if (win.__anitierTest.clearPersistentApiCache) await win.__anitierTest.clearPersistentApiCache();
        win.localStorage.clear();
        if (setup) await setup(win);
        return {
          iframe,
          win,
          close() { iframe.remove(); },
        };
      } catch (err) {
        iframe.remove();
        throw err;
      }
    },
  };

  window.AniTierTests = T;

  function renderSummary(passed, failed, failures) {
    const summary = document.getElementById('test-summary');
    if (summary) {
      summary.textContent = `${passed} passed, ${failed} failed, ${tests.length} total`;
    }

    const box = document.getElementById('test-failures');
    if (box) {
      box.textContent = failures
        .map(item => `FAIL: ${item.name}\n${item.error && item.error.stack ? item.error.stack : item.error}`)
        .join('\n\n');
    }

    document.documentElement.dataset.testStatus = failed ? 'failed' : 'passed';
    document.documentElement.dataset.testSummary = `${passed}/${tests.length}`;
  }

  async function run() {
    document.documentElement.dataset.testStatus = 'running';

    const failures = [];
    for (const item of tests) {
      const started = Date.now();
      try {
        await Promise.race([
          Promise.resolve().then(item.fn),
          timeout(12000, item.name),
        ]);
        results.push({ name: item.name, ok: true, ms: Date.now() - started });
      } catch (error) {
        results.push({ name: item.name, ok: false, error, ms: Date.now() - started });
        failures.push({ name: item.name, error });
      }
    }

    const passed = results.filter(item => item.ok).length;
    renderSummary(passed, failures.length, failures);
    console.log(`TEST_RESULT ${passed} passed, ${failures.length} failed, ${tests.length} total`);
    for (const failure of failures) {
      console.error(`FAIL: ${failure.name}`, failure.error);
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    run().catch(error => {
      renderSummary(0, 1, [{ name: 'runner', error }]);
      console.error('TEST_RUNNER_ERROR', error);
    });
  });
})();
