# AGENTS.md — AniTier

Правила для агентов, работающих в этом репозитории. Читать до первой правки.

## Что это

Одностраничный сайт тир-листов аниме: чистый HTML/CSS/JS, **без сборки, Node, npm и зависимостей**.
Данные — AniList GraphQL (основной) и Kitsu (второй источник текстового поиска), хранение — `localStorage`.

Публикация: GitHub Pages + APK для Android (WebView, без сервера).

## Железные правила

- **Не добавлять зависимости и сборщики.** Никаких `package.json`, `node_modules`, npm-пакетов, фреймворков. Только нативные API браузера.
- **Рабочая папка — только `anime-tier`.** Не открывать сессии и не запускать команды из `C:\Users\sasha`: там весь профиль, снапшоты и поиск файлов упираются в `AppData`.
- **Язык продукта — русский.** Тексты интерфейса, README, сообщения об ошибках, коммиты — по-русски. Идентификаторы в коде — английские.
- **Не править сгенерированные файлы руками**, только пересобирать (см. «Сборка»).

## Структура

| Файл | Роль | Правила |
|---|---|---|
| `core.js` | чистые функции: фильтры, переменные AniList, склейка дублей, пагинация, обмен тир-листами | без DOM, `fetch`, `localStorage` и глобального состояния; экспорт в `root.AniTierCore` |
| `changelog.js` | история версий для экрана «Что нового» | только данные, без DOM и логики; новые версии сверху, `APP_VERSION` в `core.js` совпадает с первой записью |
| `titles-ru.js` | словарь русских названий: MAL ID → название | только данные; ручные записи важнее автоматических |
| `app-store.js` | состояние, `localStorage`, списки, прогресс, операции со списками | без сетевых запросов; экспорт в `window.AniTier` |
| `app-api.js` | AniList/Kitsu, поиск, кэш, демо-данные | без DOM; экспорт в `window.AniTier` |
| `app-render.js` | отрисовка интерфейса, модалки, обмен тир-листами | без сетевых запросов; экспорт в `window.AniTier` |
| `app.js` | контроллер, события, drag & drop, запуск | бизнес-логику выносить в `core.js` или `app-store.js` |
| `index.html` | разметка и вкладки десктопа | без инлайн-стилей и инлайн-скриптов |
| `styles.css` | тёмная тема десктопа | |
| `mobile/` | мобильная PWA: `index.html`, `mobile.css`, `mobile.js`, `manifest.webmanifest`, `sw.js` | логика та же, что на десктопе; не дублировать её без нужды |
| `tests/` | браузерные тесты и раннер | |
| `*.ps1` | сервер, тесты, сборки | Windows PowerShell, без внешних утилит, кроме JDK/SDK для APK |

Ключ хранилища — `anitier.v1`. Схему данных менять только обратно совместимо: старые сохранения пользователя не должны ломаться.

## Команды

```powershell
# локальный сервер (http://127.0.0.1:8080)
powershell -ExecutionPolicy Bypass -File .\serve.ps1

# тесты (headless Edge/Chrome, порт 8099)
powershell -ExecutionPolicy Bypass -File .\test.ps1

# автономный файл для телефона → AniTier-phone.html
powershell -ExecutionPolicy Bypass -File .\build-phone.ps1

# APK (setup-tools.ps1 — только при первой сборке)
powershell -ExecutionPolicy Bypass -File .\android\setup-tools.ps1
powershell -ExecutionPolicy Bypass -File .\android\build-apk.ps1

# граф знаний Graphify (локально, без API-ключей)
graphify extract . --code-only
graphify cluster-only . --no-label
graphify query "вопрос"      # scoped подграф вместо чтения файлов

# снимки графа по версиям и отчёт об изменениях
powershell -ExecutionPolicy Bypass -File .\graph-versions.ps1                    # пересобрать и сохранить снимок текущей версии
powershell -ExecutionPolicy Bypass -File .\graph-versions.ps1 -Tag v1.8.1        # снимок из git-тега
powershell -ExecutionPolicy Bypass -File .\graph-versions.ps1 -Diff v1.8.1 v1.9.0 # отчёт об изменениях
```

## Граф знаний

`graphify-out/` (`graph.json`, `GRAPH_REPORT.md`, `graph.html`) — **генерируемые** файлы, в git не попадают.
Строится локально из AST, ничего никуда не отправляет; LLM не нужен (`--code-only`).
`graphify update . --code-only` — инкрементально обновить после правок кода.
Доступ к графу: MCP-сервер `graphify` (глобальный конфиг OpenCode) и скилл `graphify`.

## Сборка и артефакты

`AniTier-phone.html`, `android/assets/index.html`, `AniTier.apk`, `AniTier.apk.idsig` — **генерируемые**.
После правок в `app-store.js`, `app-api.js`, `app-render.js`, `app.js`, `core.js`, `changelog.js`, `titles-ru.js`, `styles.css`, `index.html` или `mobile/`:

1. `build-phone.ps1` — обновляет `AniTier-phone.html`;
2. `android/build-apk.ps1` — обновляет `AniTier.apk` (сначала `build-phone.ps1`).

## Тесты

- Каждый багфикс и каждая новая чистая функция в `core.js` — с тестом в `tests/core.test.js`.
- Поведение UI — `tests/app.test.js`; мобильная оболочка — `tests/mobile.test.js`; обмен тир-листами — `tests/exchange.test.js`.
- API раннера: `T.test(name, fn)`, `T.assert`, `T.eq`, `T.includes`, `T.waitFor`. Тесты асинхронные, сеть мокать, а не ходить в реальные AniList/Kitsu.
- Перед тем как сказать «готово», прогнать `test.ps1` целиком.

## Данные и офлайн

- AniList GraphQL — основной источник; Kitsu — второй для текстового поиска; результаты склеиваются по MAL ID, ID источника и нормализованному названию с годом.
- Если оба источника недоступны — демо-режим (`?demo=1`) с локальной подборкой.
- Офлайн-оболочку кеширует service worker (`mobile/sw.js`); при изменении файлов оболочки поднимать версию кеша.
- Ключи `localStorage`: `anitier.v1` — списки, прогресс, свои карточки (миниатюры), настройки; `anitier.moments.v1` — метаданные моментов; `anitier.translations.v1` — кэш переводов. Полные постеры и медиа моментов лежат в IndexedDB `anitier-media` (хранилища `images` и `media`) и в резервную копию не входят.
- Google Drive доступен только на сайте и в PWA (`https://`/`http://`), в APK — файловая копия через системный диалог Android.

## Git

- Не коммитить: `android/anitier.keystore`, `*.keystore`, `*.jks`, `AniTier.apk.idsig`, `android/assets/index.html` (см. `.gitignore`).
- `AniTier.apk` в корне — релизный артефакт: обновлять вместе с изменениями интерфейса.
- Коммит — одна законченная правка; сообщение по-русски, в императиве.
