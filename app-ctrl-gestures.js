/* ============================================================
   AniTier — жесты и перетаскивание (выделено из app.js)
   ============================================================ */
(function (App) {
  'use strict';

  const C = window.AniTierCore;
  const state = App.state;
  const $ = App.$;
  const $$ = App.$$;
  const VIEW_TABS = App.VIEW_TABS;
  const getAnime = (...a) => App.getAnime(...a);
  const hasIn = (...a) => App.hasIn(...a);
  const moveToTier = (...a) => App.moveToTier(...a);
  const refreshCurrent = (...a) => App.refreshCurrent(...a);
  const switchTab = (...a) => App.switchTab(...a);

  /* Значения подавления кликов после жестов: app.js читает их из App. */
  function setSuppressTier(ms) { App.suppressTierClickUntil = Date.now() + ms; }
  function setSuppressQuick(ms) { App.suppressQuickClickUntil = Date.now() + ms; }

  /* ---------------- drag & drop ---------------- */

  let dragState = null;

  let dragPointerY = null;

  let dragAutoScrollFrame = 0;

  let dragGesture = null;

  let dragGhost = null;

  let suppressTierClickUntil = 0;
  App.suppressTierClickUntil = 0;

  function setInstantScroll(on) {
    const scroller = document.scrollingElement || document.documentElement;
    if (!scroller || !scroller.style) return;
    if (on) {
      if (scroller.dataset.dragSmooth != null) return;
      scroller.dataset.dragSmooth = scroller.style.scrollBehavior || '';
      scroller.style.scrollBehavior = 'auto';
    } else if (scroller.dataset.dragSmooth != null) {
      scroller.style.scrollBehavior = scroller.dataset.dragSmooth;
      delete scroller.dataset.dragSmooth;
    }
  }

  function scrollPageBy(delta) {
    const scroller = document.scrollingElement || document.documentElement;
    if (!scroller) return;
    const max = Math.max(0, (scroller.scrollHeight || 0) - (scroller.clientHeight || 0));
    const next = Math.max(0, Math.min(max, (scroller.scrollTop || 0) + delta));
    if (next !== scroller.scrollTop) scroller.scrollTop = next;
  }

  function createDragGhost(card) {
    removeDragGhost();
    const rect = card.getBoundingClientRect();
    const ghost = card.cloneNode(true);
    ghost.classList.add('tier-drag-ghost');
    ghost.classList.remove('dragging');
    ghost.removeAttribute('tabindex');
    ghost.removeAttribute('data-action');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.style.width = `${rect.width}px`;
    document.body.appendChild(ghost);
    dragGhost = ghost;
    return ghost;
  }

  function moveDragGhost(x, y) {
    if (!dragGhost) return;
    dragGhost.style.left = `${x}px`;
    dragGhost.style.top = `${y}px`;
  }

  function removeDragGhost() {
    if (dragGhost && dragGhost.parentNode) dragGhost.parentNode.removeChild(dragGhost);
    dragGhost = null;
  }

  function updateDragTarget(x, y) {
    if (!dragGesture) return;
    const hit = document.elementFromPoint(x, y);
    const drop = hit && hit.closest ? hit.closest('.tier-drop') : null;
    $$('.tier-drop.is-over').forEach(item => { if (item !== drop) item.classList.remove('is-over'); });
    if (drop && drop.dataset.list === dragGesture.list) drop.classList.add('is-over');
    dragGesture.drop = drop;
  }

  function activateDrag(gesture) {
    if (dragGesture !== gesture || gesture.active) return;
    clearTimeout(gesture.timer);
    gesture.active = true;
    dragState = { list: gesture.list, id: gesture.id };
    gesture.card.classList.add('dragging');
    try { gesture.card.setPointerCapture(gesture.pointerId); } catch { /* старые WebView */ }
    createDragGhost(gesture.card);
    moveDragGhost(gesture.clientX, gesture.clientY);
    if (gesture.pointerType === 'touch' && navigator.vibrate) navigator.vibrate(18);
  }

  function runDragAutoScroll() {
    if (dragAutoScrollFrame || !dragState) return;
    setInstantScroll(true);
    const step = () => {
      dragAutoScrollFrame = 0;
      if (!dragState || dragPointerY == null) return;
      const height = window.innerHeight || document.documentElement.clientHeight;
      const delta = C.dragScrollDelta(dragPointerY, height);
      if (!delta) return;
      App.scrollPageBy(delta);
      if (dragGesture && dragGesture.active) updateDragTarget(dragGesture.clientX, dragGesture.clientY);
      dragAutoScrollFrame = window.requestAnimationFrame(step);
    };
    dragAutoScrollFrame = window.requestAnimationFrame(step);
  }

  function cleanupDrag() {
    dragState = null;
    dragPointerY = null;
    if (dragGesture && dragGesture.timer) clearTimeout(dragGesture.timer);
    dragGesture = null;
    if (dragAutoScrollFrame) window.cancelAnimationFrame(dragAutoScrollFrame);
    dragAutoScrollFrame = 0;
    removeDragGhost();
    setInstantScroll(false);
    $$('.tier-card.dragging').forEach(c => c.classList.remove('dragging'));
    $$('.tier-drop.is-over').forEach(d => d.classList.remove('is-over'));
  }

  function bindDragEvents() {
    document.addEventListener('pointerdown', e => {
      if (dragGesture || !e.isPrimary) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const card = e.target.closest && e.target.closest('.tier-card');
      if (!card || e.target.closest('button')) return;
      const pointerType = e.pointerType || 'mouse';
      const gesture = {
        card,
        list: card.dataset.list,
        id: Number(card.dataset.id),
        pointerType,
        startX: e.clientX,
        startY: e.clientY,
        clientX: e.clientX,
        clientY: e.clientY,
        pointerId: e.pointerId,
        active: false,
        timer: 0,
        drop: null,
      };
      /* Пальцем — после долгого нажатия, мышью — сразу после сдвига:
         обычный клик должен открывать тайтл. */
      if (pointerType === 'touch') {
        gesture.timer = setTimeout(() => activateDrag(gesture), 360);
      }
      dragGesture = gesture;
    }, { passive: true });

    /* Пока карточка тащится, отдаём прокрутку автопрокрутке:
       без этого браузер забирает жест себе и присылает pointercancel. */
    document.addEventListener('touchmove', e => {
      if (!dragGesture || !dragGesture.active) return;
      e.preventDefault();
    }, { passive: false });

    /* Долгое нажатие в Android-WebView тянет за собой выделение текста и
       contextmenu, а Chrome вместе с ними присылает pointercancel — жест
       обрывается, и автопрокрутка не запускается. Гасим их, пока палец на карточке. */
    document.addEventListener('contextmenu', e => {
      const card = e.target && e.target.closest && e.target.closest('.tier-card');
      if (card && (dragGesture || dragState)) e.preventDefault();
    });

    document.addEventListener('selectstart', e => {
      const card = e.target && e.target.closest && e.target.closest('.tier-card');
      if (card && (dragGesture || dragState)) e.preventDefault();
    });

    document.addEventListener('pointermove', e => {
      const gesture = dragGesture;
      if (!gesture) return;
      gesture.clientX = e.clientX;
      gesture.clientY = e.clientY;
      if (!gesture.active) {
        const moved = Math.hypot(e.clientX - gesture.startX, e.clientY - gesture.startY);
        if (gesture.pointerType === 'touch') {
          if (moved > 12) {
            clearTimeout(gesture.timer);
            dragGesture = null;
          }
          return;
        }
        if (moved < 6) return;
        activateDrag(gesture);
      }
      e.preventDefault();
      dragPointerY = e.clientY;
      moveDragGhost(e.clientX, e.clientY);
      updateDragTarget(e.clientX, e.clientY);
      runDragAutoScroll();
    }, { passive: false });

    document.addEventListener('pointerup', e => {
      const gesture = dragGesture;
      if (!gesture) return;
      clearTimeout(gesture.timer);
      dragGesture = null;
      if (!gesture.active) return;
      const hit = document.elementFromPoint(e.clientX, e.clientY);
      const drop = hit && hit.closest ? hit.closest('.tier-drop') : gesture.drop;
      setSuppressTier(500);
      cleanupDrag();
      if (drop && drop.dataset.list === gesture.list) moveToTier(gesture.list, gesture.id, drop.dataset.tier);
    }, { passive: true });

    document.addEventListener('pointercancel', cleanupDrag, { passive: true });
  }

  /* ---------------- быстрые жесты: меню карточки и свайпы ---------------- */

  let longPressTimer = 0;

  let touchGesture = null;

  let pullDistance = 0;

  let suppressQuickClickUntil = 0;
  App.suppressQuickClickUntil = 0;

  function isMobileShell() {
    return document.body.classList.contains('mobile-app')
      || (typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 720px)').matches);
  }

  function quickMenuHTML(id) {
    const anime = getAnime(id);
    if (!anime) return '';
    const inW = hasIn('watched', id);
    const inP = hasIn('planned', id);
    return `<div class="quick-backdrop" data-action="quick-close"></div>
      <div class="quick-panel" role="dialog" aria-modal="true" aria-label="Быстрые действия">
        <b class="quick-title">${App.esc(App.displayTitle ? App.displayTitle(anime) : anime.title)}</b>
        <button type="button" class="quick-action" data-action="quick-open" data-id="${id}">Открыть карточку</button>
        <button type="button" class="quick-action ${inW ? 'is-on' : ''}" data-action="quick-watched" data-id="${id}">${inW ? 'Убрать из просмотрено' : 'Отметить просмотренным'}</button>
        <button type="button" class="quick-action ${inP ? 'is-on' : ''}" data-action="quick-planned" data-id="${id}">${inP ? 'Убрать из планов' : 'Добавить в планы'}</button>
        <button type="button" class="quick-action quick-cancel" data-action="quick-close">Отмена</button>
      </div>`;
  }

  function openQuickMenu(id) {
    if (!getAnime(id)) return;
    let box = document.getElementById('quick-menu');
    if (!box) {
      box = document.createElement('div');
      box.id = 'quick-menu';
      box.className = 'quick-menu';
      box.hidden = true;
      document.body.appendChild(box);
    }
    state.quickMenu = { id };
    box.innerHTML = quickMenuHTML(id);
    box.hidden = false;
    App.syncBodyScroll();
    const first = box.querySelector('.quick-action');
    if (first) first.focus({ preventScroll: true });
  }

  function closeQuickMenu() {
    state.quickMenu = null;
    const box = document.getElementById('quick-menu');
    if (box) { box.hidden = true; box.innerHTML = ''; }
    App.syncBodyScroll();
  }

  function pullIndicator() {
    let el = document.getElementById('pull-refresh');
    if (!el) {
      el = document.createElement('div');
      el.id = 'pull-refresh';
      el.className = 'pull-refresh';
      el.setAttribute('aria-hidden', 'true');
      document.body.appendChild(el);
    }
    return el;
  }

  function resetPullIndicator() {
    const el = document.getElementById('pull-refresh');
    if (el) { el.style.transform = ''; el.textContent = ''; el.classList.remove('is-ready', 'is-busy'); }
    pullDistance = 0;
  }

  function bindGestures() {
    document.addEventListener('touchstart', event => {
      if (!isMobileShell() || event.touches.length !== 1) return;
      if (document.body.classList.contains('no-scroll') || state.quickMenu || state.modalId != null) return;
      const target = event.target;
      if (!target || !target.closest) return;
      if (target.closest('input, textarea, select, button, a, [role="dialog"], .modal, .custom-modal, .moment-modal, .exchange-modal, .backup-modal, .settings-modal, .stats-modal, .command-modal, .tiktok-modal, .quick-menu, .ep-chips, .notif-tabs, .continue-row, .chips, .bottom-sheet')) return;

      const touch = event.touches[0];
      touchGesture = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
        pull: window.scrollY <= 0 && !target.closest('.tier-card'),
      };
      pullDistance = 0;

      const card = target.closest('.card[data-id], .notif[data-id]');
      if (card && !target.closest('.card-actions, .notif-actions, .mini-btn, .ep-chip')) {
        const id = Number(card.dataset.id);
        clearTimeout(longPressTimer);
        longPressTimer = setTimeout(() => {
          longPressTimer = 0;
          setSuppressQuick(700);
          openQuickMenu(id);
          if (navigator.vibrate) { try { navigator.vibrate(12); } catch { /* не критично */ } }
          touchGesture = null;
          resetPullIndicator();
        }, 520);
      }
    }, { passive: true });

    document.addEventListener('touchmove', event => {
      if (!touchGesture || event.touches.length !== 1) return;
      const touch = event.touches[0];
      const dx = touch.clientX - touchGesture.x;
      const dy = touch.clientY - touchGesture.y;

      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) clearTimeout(longPressTimer);
      if (Math.abs(dx) > Math.abs(dy) * 1.2) {
        resetPullIndicator();
        return;
      }
      if (!touchGesture.pull || dy <= 0) return;
      pullDistance = Math.min(120, dy * 0.6);
      const el = pullIndicator();
      el.textContent = pullDistance >= 48 ? 'Отпустите, чтобы обновить' : 'Потяните вниз';
      el.classList.toggle('is-ready', pullDistance >= 48);
      el.style.transform = `translate(-50%, ${pullDistance}px)`;
    }, { passive: true });

    document.addEventListener('touchend', event => {
      clearTimeout(longPressTimer);
      if (!touchGesture) { resetPullIndicator(); return; }
      const touch = event.changedTouches && event.changedTouches[0];
      const dx = touch ? touch.clientX - touchGesture.x : 0;
      const dy = touch ? touch.clientY - touchGesture.y : 0;
      const elapsed = Date.now() - touchGesture.time;
      const gesture = touchGesture;
      touchGesture = null;

      if (gesture.pull && pullDistance >= 48 && dy > 0) {
        const el = pullIndicator();
        el.textContent = 'Обновляем…';
        el.classList.add('is-busy');
        el.style.transform = 'translate(-50%, 18px)';
        Promise.resolve(refreshCurrent()).finally(() => {
          setTimeout(() => { el.classList.remove('is-busy'); resetPullIndicator(); }, 600);
        });
        return;
      }
      resetPullIndicator();

      if (elapsed < 900 && Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        const index = VIEW_TABS.indexOf(state.tab);
        if (index < 0) return;
        const next = dx < 0 ? index + 1 : index - 1;
        if (next >= 0 && next < VIEW_TABS.length) switchTab(VIEW_TABS[next]);
      }
    }, { passive: true });

    document.addEventListener('touchcancel', () => {
      clearTimeout(longPressTimer);
      touchGesture = null;
      resetPullIndicator();
    }, { passive: true });
  }

  function bindModalSwipe() {
    const modal = document.getElementById('modal');
    const panel = document.querySelector('.modal-panel');
    if (!modal || !panel) return;
    if (modal.dataset.swipeBound) return;
    modal.dataset.swipeBound = '1';

    panel.addEventListener('touchstart', (e) => {
      if (window.innerWidth > 720) return;
      if (panel.scrollTop > 0) return;
      const t = e.changedTouches[0];
      modalTouch = { y: t.clientY, time: Date.now() };
    }, { passive: true });

    panel.addEventListener('touchmove', (e) => {
      if (!modalTouch) return;
      if (window.innerWidth > 720) return;
      const t = e.changedTouches[0];
      const dy = t.clientY - modalTouch.y;
      if (dy > 0 && panel.scrollTop <= 0) {
        panel.style.transform = `translateY(${Math.min(dy * 0.4, 80)}px)`;
        panel.style.opacity = String(Math.max(0.7, 1 - dy / 400));
      }
    }, { passive: true });

    panel.addEventListener('touchend', (e) => {
      if (!modalTouch) return;
      if (window.innerWidth > 720) { modalTouch = null; return; }
      const t = e.changedTouches[0];
      const dy = t.clientY - modalTouch.y;
      const dt = Date.now() - modalTouch.time;
      panel.style.transform = '';
      panel.style.opacity = '';
      if (dy > 80 && dt < 400 && panel.scrollTop <= 0) {
        if (typeof closeModal === 'function') closeModal();
      }
      modalTouch = null;
    }, { passive: true });
  }

  window.bindModalSwipe = bindModalSwipe;

  Object.assign(App, {
    bindDragEvents,
    bindGestures,
    bindModalSwipe,
    openQuickMenu,
    closeQuickMenu,
    scrollPageBy,
  });
})(window.AniTier);
