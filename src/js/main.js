/* ============================================================
   main.js — шапка, модалки, карусели, аккордеон, формы
   Без зависимостей.
   ============================================================ */

(function () {
  'use strict';

  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  /* ---------------------------------------------------------
     Оверлей: один на всё приложение
     --------------------------------------------------------- */
  let overlay = null;

  function showOverlay(onClick) {
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'overlay';
      document.body.appendChild(overlay);
    }
    overlay.hidden = false;
    overlay.onclick = onClick;
  }

  function hideOverlay() {
    if (overlay) overlay.hidden = true;
  }

  /* ---------------------------------------------------------
     Выпадающие панели шапки (мега-меню, мини-модалки, меню)
     --------------------------------------------------------- */
  const panels = {};
  $$('[data-panel]').forEach((el) => { panels[el.dataset.panel] = el; });

  let openPanel = null;

  function closePanel() {
    if (!openPanel) return;
    panels[openPanel].hidden = true;
    const trigger = $(`[data-toggle="${openPanel}"]`);
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
    if (openPanel === 'mega' || openPanel === 'mobile-menu') hideOverlay();
    if (openPanel === 'mobile-menu') document.body.classList.remove('no-scroll');
    openPanel = null;
  }

  function togglePanel(name) {
    const el = panels[name];
    if (!el) return;
    const wasOpen = openPanel === name;
    closePanel();
    if (wasOpen) return;

    el.hidden = false;
    openPanel = name;

    const trigger = $(`[data-toggle="${name}"]`);
    if (trigger) trigger.setAttribute('aria-expanded', 'true');

    if (name === 'mega') showOverlay(closePanel);
    if (name === 'mobile-menu') {
      showOverlay(closePanel);
      document.body.classList.add('no-scroll');
    }
  }

  document.addEventListener('click', (e) => {
    const toggle = e.target.closest('[data-toggle]');
    if (toggle) {
      e.preventDefault();
      togglePanel(toggle.dataset.toggle);
      return;
    }

    if (e.target.closest('[data-close]')) {
      closePanel();
      closeModal();
      return;
    }

    // клик вне открытой панели
    if (openPanel && !e.target.closest('[data-panel]')) closePanel();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closePanel(); closeModal(); closeSearch(); }
  });

  /* ---------------------------------------------------------
     Мега-меню: переключение разделов
     --------------------------------------------------------- */
  $$('[data-mega-cat]').forEach((btn) => {
    const activate = () => {
      $$('[data-mega-cat]').forEach((b) => b.classList.toggle('is-active', b === btn));
      $$('[data-mega-panel]').forEach((p) => {
        p.classList.toggle('is-active', p.dataset.megaPanel === btn.dataset.megaCat);
      });
    };
    btn.addEventListener('mouseenter', activate);
    btn.addEventListener('click', activate);
  });

  /* ---------------------------------------------------------
     Sticky-шапка: схлопывается при скролле вниз
     --------------------------------------------------------- */
  const header = $('[data-header]');
  if (header) {
    const threshold = 160;
    let ticking = false;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        header.classList.toggle('is-stuck', window.scrollY > threshold);
        ticking = false;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------------------------------------------------------
     Поиск: панель открывается по фокусу
     --------------------------------------------------------- */
  const search = $('[data-search]');
  const searchPanel = $('[data-search-panel]');

  function closeSearch() {
    if (searchPanel) searchPanel.hidden = true;
  }

  if (search && searchPanel) {
    $('.search__input', search).addEventListener('focus', () => { searchPanel.hidden = false; });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('[data-search]')) closeSearch();
    });
  }

  /* ---------------------------------------------------------
     Модальные окна
     --------------------------------------------------------- */
  let openModalEl = null;

  function closeModal() {
    if (!openModalEl) return;
    openModalEl.hidden = true;
    openModalEl = null;
    document.body.classList.remove('no-scroll');
  }

  function openModal(name) {
    const el = $(`[data-modal="${name}"]`);
    if (!el) return;
    closeModal();
    closePanel();
    el.hidden = false;
    openModalEl = el;
    document.body.classList.add('no-scroll');
    const firstInput = $('input, textarea, button', el);
    if (firstInput) firstInput.focus({ preventScroll: true });
  }

  document.addEventListener('click', (e) => {
    const opener = e.target.closest('[data-modal-open]');
    if (opener) {
      e.preventDefault();
      openModal(opener.dataset.modalOpen);
      return;
    }
    // клик по подложке модалки
    if (openModalEl && e.target === openModalEl) closeModal();
  });

  /* Показать/скрыть пароль */
  document.addEventListener('click', (e) => {
    const eye = e.target.closest('[data-toggle-password]');
    if (!eye) return;
    const input = $('input', eye.parentElement);
    if (!input) return;
    const shown = input.type === 'text';
    input.type = shown ? 'password' : 'text';
    eye.setAttribute('aria-label', shown ? 'Показать пароль' : 'Скрыть пароль');
  });

  /* Табы «Телефон / E-mail» */
  $$('.modal__tabs').forEach((tabs) => {
    tabs.addEventListener('click', (e) => {
      const tab = e.target.closest('.modal__tab');
      if (!tab) return;
      $$('.modal__tab', tabs).forEach((t) => t.classList.toggle('is-active', t === tab));
    });
  });

  /* Тумблер «Аккаунт для компании» */
  $$('[data-toggle-company]').forEach((input) => {
    input.addEventListener('change', () => {
      const fields = $('[data-company-fields]', input.closest('form'));
      if (fields) fields.hidden = !input.checked;
    });
  });

  /* ---------------------------------------------------------
     Формы: заглушка отправки + экран успеха
     --------------------------------------------------------- */
  $$('[data-form]').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      // TODO: интеграция — отправка на бэкенд
      const success = $('[data-form-success]', form.parentElement);
      if (success) {
        form.hidden = true;
        success.hidden = false;
      }
    });
  });

  /* ---------------------------------------------------------
     Карусели на scroll-snap
     --------------------------------------------------------- */
  $$('[data-carousel]').forEach((root) => {
    const track = $('[data-carousel-track]', root);
    const prev = $('[data-carousel-prev]', root);
    const next = $('[data-carousel-next]', root);
    const bar = $('[data-carousel-bar]', root);
    if (!track) return;

    const step = () => {
      const first = track.firstElementChild;
      if (!first) return track.clientWidth;
      const gap = parseFloat(getComputedStyle(track).columnGap) || 20;
      return first.getBoundingClientRect().width + gap;
    };

    const update = () => {
      const max = track.scrollWidth - track.clientWidth;
      if (prev) prev.disabled = track.scrollLeft <= 1;
      if (next) next.disabled = track.scrollLeft >= max - 1;
      if (bar) {
        // Индикатор — полоса фиксированной ширины (79 по макету), едет по треку
        const rail = bar.parentElement.clientWidth - bar.offsetWidth;
        const pos = max > 0 ? track.scrollLeft / max : 0;
        bar.style.left = `${Math.round(pos * rail)}px`;
      }
    };

    if (prev) prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
    if (next) next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));

    track.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  });

  /* ---------------------------------------------------------
     Аккордеон FAQ
     --------------------------------------------------------- */
  $$('.accordion').forEach((acc) => {
    acc.addEventListener('click', (e) => {
      const btn = e.target.closest('.accordion__btn');
      if (!btn) return;
      const item = btn.closest('.accordion__item');
      const isOpen = item.classList.contains('is-open');
      $$('.accordion__item', acc).forEach((i) => {
        i.classList.remove('is-open');
        const b = $('.accordion__btn', i);
        if (b) b.setAttribute('aria-expanded', 'false');
      });
      if (!isOpen) {
        item.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  /* ---------------------------------------------------------
     Cookies
     --------------------------------------------------------- */
  const cookies = $('[data-cookies]');
  if (cookies) {
    const KEY = 'ko-cookies';
    if (!localStorage.getItem(KEY)) cookies.hidden = false;

    const decide = (value) => {
      localStorage.setItem(KEY, value);
      cookies.hidden = true;
    };
    const accept = $('[data-cookies-accept]', cookies);
    const decline = $('[data-cookies-decline]', cookies);
    if (accept) accept.addEventListener('click', () => decide('accepted'));
    if (decline) decline.addEventListener('click', () => decide('declined'));
  }

  /* ---------------------------------------------------------
     Год в копирайте
     --------------------------------------------------------- */
  $$('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });
})();
