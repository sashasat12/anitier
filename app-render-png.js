/* ============================================================
   AniTier — экспорт тир-листа в PNG (выделено из app.js)
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
  const posterCachedUrl = (...a) => App.posterCachedUrl(...a);
  const renderExchange = (...a) => App.renderExchange(...a);
  const androidSaveMedia = (...a) => App.androidSaveMedia(...a);
  const toast = (...a) => App.toast(...a);

  /* ---------------- PNG тир-листа ---------------- */
  const TIER_IMAGE_GRADIENTS = {
    S: ['#ff5c8a', '#ff2d6f'],
    A: ['#ffb15c', '#ff8a2b'],
    B: ['#ffe066', '#ffcc00'],
    C: ['#6ee7a8', '#22c55e'],
    D: ['#7dd3fc', '#38bdf8'],
    F: ['#cbd5e1', '#94a3b8'],
    N: ['#3a4258', '#232838'],
  };

  function canvasRoundRect(ctx, x, y, width, height, radius) {
    const r = Math.max(0, Math.min(radius, width / 2, height / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function loadCanvasImage(src) {
    return new Promise(resolve => {
      const url = String(src || '');
      if (!url) { resolve(null); return; }
      const img = new Image();
      let settled = false;
      const finish = value => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      if (/^https?:/i.test(url)) img.crossOrigin = 'anonymous';
      img.onload = () => finish(img);
      img.onerror = () => finish(null);
      setTimeout(() => finish(null), 8000);
      img.src = url;
    });
  }

  function drawPosterCover(ctx, img, x, y, width, height) {
    if (!img || !img.width || !img.height) return;
    const scale = Math.max(width / img.width, height / img.height);
    const drawWidth = img.width * scale;
    const drawHeight = img.height * scale;
    ctx.save();
    canvasRoundRect(ctx, x, y, width, height, 9);
    ctx.clip();
    ctx.drawImage(img, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
    ctx.restore();
  }

  function drawWrappedText(ctx, text, x, y, maxWidth, maxLines, lineHeight) {
    const words = String(text || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return;
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(test).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    if (lines.length > maxLines) {
      lines.length = maxLines;
      let last = lines[maxLines - 1].replace(/[\s,.:;—–-]+$/, '');
      while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
      lines[maxLines - 1] = `${last}…`;
    }
    lines.forEach((value, index) => ctx.fillText(value, x, y + index * lineHeight));
  }

  function tierPngFileName(listName) {
    const date = new Date();
    const stamp = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
    return `AniTier-${listName === 'planned' ? 'planned' : 'watched'}-${stamp}.png`;
  }

  async function mapWithLimit(items, limit, fn) {
    const list = Array.isArray(items) ? items : [];
    const max = Math.max(1, Number(limit) || 1);
    const out = new Array(list.length);
    let next = 0;
    async function worker() {
      while (next < list.length) {
        const i = next++;
        out[i] = await fn(list[i], i);
      }
    }
    await Promise.all(Array.from({ length: Math.min(max, list.length) }, () => worker()));
    return out;
  }

  function tierPngTitle(anime) {
    if (App.displayTitle) return App.displayTitle(anime) || anime.altTitle || anime.title || '';
    return anime.titleRu || anime.title || anime.altTitle || anime.originalTitle || '';
  }

  async function buildTierListPngBlob(listName) {
    const name = listName === 'planned' ? 'planned' : 'watched';
    const groups = TIERS.map(tier => ({
      tier: tier.id,
      label: tier.id === 'N' ? 'N' : tier.label,
      name: tier.name,
      items: state.lists[name][tier.id] || [],
    })).filter(group => group.items.length);
    const total = groups.reduce((sum, group) => sum + group.items.length, 0);
    if (!total) throw new Error('В списке пока нет тайтлов.');

    const layout = C.buildTierImageLayout(groups, { maxItems: 400 });
    const canvas = document.createElement('canvas');
    canvas.width = layout.width;
    canvas.height = layout.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Браузер не умеет рисовать PNG.');

    const background = ctx.createLinearGradient(0, 0, layout.width, layout.height);
    background.addColorStop(0, '#0b0f19');
    background.addColorStop(.55, '#0a0d15');
    background.addColorStop(1, '#14101c');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, layout.width, layout.height);

    const heading = LIST_LABELS[name] || name;
    const dateText = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ff9dbc';
    ctx.font = '800 12px "Segoe UI", Arial, sans-serif';
    ctx.fillText('ТИР-ЛИСТ ANITIER', layout.padding, 42);
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 46px "Segoe UI", Arial, sans-serif';
    ctx.fillText(heading, layout.padding, 94);
    ctx.fillStyle = '#8b93ac';
    ctx.font = '600 15px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`${total} ${plural(total, 'тайтл', 'тайтла', 'тайтлов')} · ${dateText}`, layout.padding, 122);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#ff4d8d';
    ctx.font = '800 30px "Segoe UI", Arial, sans-serif';
    ctx.fillText('AniTier', layout.width - layout.padding, 70);
    ctx.fillStyle = '#626b84';
    ctx.font = '700 10px "Segoe UI", Arial, sans-serif';
    ctx.fillText('ANIME TIER LIST', layout.width - layout.padding, 88);
    ctx.textAlign = 'left';

    const tiles = layout.tiers.flatMap(tier => tier.items);
    await mapWithLimit(tiles, 8, async tile => {
      const src = String(tile.anime.image || '');
      let image = null;
      if (/^https?:\/\//i.test(src)) {
        /* Сначала кэш: не создаём лишних запросов к AniList/Kitsu. */
        const cached = await posterCachedUrl(src);
        if (cached) image = await loadCanvasImage(cached);
        if (!image) image = await loadCanvasImage(src);
      } else if (src) {
        image = await loadCanvasImage(src);
      }
      if (!image) image = await loadCanvasImage(makePoster(tierPngTitle(tile.anime), tile.anime.id));
      tile.poster = image;
    });

    for (const tier of layout.tiers) {
      ctx.fillStyle = 'rgba(255, 255, 255, .035)';
      canvasRoundRect(ctx, layout.padding, tier.y, layout.width - layout.padding * 2, tier.height, 18);
      ctx.fill();

      const panelX = layout.padding + 14;
      const panelY = tier.y + 14;
      const panelWidth = layout.labelWidth - 28;
      const panelHeight = tier.height - 28;
      const colors = TIER_IMAGE_GRADIENTS[tier.tier] || TIER_IMAGE_GRADIENTS.N;
      const panel = ctx.createLinearGradient(panelX, panelY, panelX + panelWidth, panelY + panelHeight);
      panel.addColorStop(0, colors[0]);
      panel.addColorStop(1, colors[1]);
      ctx.fillStyle = panel;
      canvasRoundRect(ctx, panelX, panelY, panelWidth, panelHeight, 14);
      ctx.fill();

      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 42px "Segoe UI", Arial, sans-serif';
      ctx.fillText(tier.label, panelX + panelWidth / 2, panelY + 58);
      ctx.font = '700 12px "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, .95)';
      ctx.fillText(tier.name, panelX + panelWidth / 2, panelY + 80);
      ctx.font = '600 11px "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, .68)';
      ctx.fillText(`${tier.count}`, panelX + panelWidth / 2, panelY + panelHeight - 12);
      ctx.textAlign = 'left';

      for (const tile of tier.items) {
        if (tile.poster) {
          drawPosterCover(ctx, tile.poster, tile.x, tile.y, layout.posterWidth, layout.posterHeight);
          ctx.strokeStyle = 'rgba(255, 255, 255, .14)';
          ctx.lineWidth = 1;
          canvasRoundRect(ctx, tile.x + .5, tile.y + .5, layout.posterWidth - 1, layout.posterHeight - 1, 9);
          ctx.stroke();
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, .06)';
          canvasRoundRect(ctx, tile.x, tile.y, layout.posterWidth, layout.posterHeight, 9);
          ctx.fill();
        }
        ctx.fillStyle = '#c8d1e5';
        ctx.font = '600 11.5px "Segoe UI", Arial, sans-serif';
        drawWrappedText(ctx, tierPngTitle(tile.anime), tile.x, tile.y + layout.posterHeight + 15, layout.posterWidth, 2, 13.5);
      }
    }

    const footerY = layout.height - 58;
    ctx.strokeStyle = 'rgba(255, 255, 255, .1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(layout.padding, footerY);
    ctx.lineTo(layout.width - layout.padding, footerY);
    ctx.stroke();
    ctx.fillStyle = '#7e879f';
    ctx.font = '600 15px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Собрано в AniTier · ${dateText}`, layout.padding, footerY + 30);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ff9dbc';
    ctx.font = '800 15px "Segoe UI", Arial, sans-serif';
    ctx.fillText(layout.omitted ? `Показаны первые ${total - layout.omitted} из ${total}` : 'github.com/sashasat12/anitier', layout.width - layout.padding, footerY + 30);
    ctx.textAlign = 'left';

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Не удалось собрать PNG.');
    return { blob, width: canvas.width, height: canvas.height, total, omitted: layout.omitted };
  }

  async function exportTierPng(listName) {
    const ex = state.exchange;
    if (ex.pngBusy) return;
    ex.pngBusy = true;
    renderExchange();
    try {
      const png = await buildTierListPngBlob(listName);
      const fileName = tierPngFileName(listName);
      if (window.AniTierAndroid && typeof window.AniTierAndroid.beginMediaSave === 'function') {
        await androidSaveMedia(png.blob, fileName, 'PNG');
      } else {
        const url = URL.createObjectURL(png.blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      }
      toast('PNG тир-листа сохранён');
    } catch (err) {
      toast(err && err.message ? err.message : 'Не удалось собрать PNG');
    } finally {
      ex.pngBusy = false;
      if (ex.open) renderExchange();
    }
  }

  Object.assign(App, {
    loadCanvasImage,
    canvasRoundRect,
    drawPosterCover,
    drawWrappedText,
    tierPngFileName,
    mapWithLimit,
    tierPngTitle,
    buildTierListPngBlob,
    exportTierPng,
  });
})(window.AniTier);
