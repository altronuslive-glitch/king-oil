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
  const headerSpacer = $('[data-header-spacer]');

  if (header) {
    let fullHeight = 160;

    // Место под фиксированную шапку. Меряем всегда в развёрнутом виде,
    // иначе после переключения запомним компактную высоту.
    const measure = () => {
      const wasStuck = header.classList.contains('is-stuck');
      header.classList.remove('is-stuck');
      fullHeight = header.offsetHeight;
      if (headerSpacer) headerSpacer.style.height = `${fullHeight}px`;
      if (wasStuck) header.classList.add('is-stuck');
    };

    // Без rAF: чтение scrollY и переключение класса не вызывают пересчёт вёрстки,
    // а троттлинг через кадры залипает, если вкладка не отрисовывается
    const onScroll = () => {
      const stuck = header.classList.contains('is-stuck');
      // Гистерезис: включаем ниже шапки, выключаем заметно выше,
      // чтобы на границе не было мерцания
      if (!stuck && window.scrollY > fullHeight) header.classList.add('is-stuck');
      else if (stuck && window.scrollY < fullHeight - 48) header.classList.remove('is-stuck');
    };

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { measure(); onScroll(); }, 150);
    });

    window.addEventListener('scroll', onScroll, { passive: true });
    measure();
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
        // Индикатор стоит на месте и заполняется: доля просмотренного от общей ширины ленты
        const seen = (track.scrollLeft + track.clientWidth) / track.scrollWidth;
        bar.style.width = `${Math.min(100, Math.round(seen * 100))}%`;
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
     Таббар: активный пункт по адресу страницы
     (разметка таббара общая для всех страниц, см. partials/tabbar.html)
     --------------------------------------------------------- */
  const page = location.pathname.split('/').pop() || 'index.html';
  $$('.tabbar a').forEach((a) => {
    a.classList.toggle('is-active', a.getAttribute('href') === page);
  });

  /* ---------------------------------------------------------
     Каталог: дропдаун сортировки
     --------------------------------------------------------- */
  $$('[data-sort]').forEach((root) => {
    const btn = $('[data-sort-btn]', root);
    const panelEl = $('[data-sort-panel]', root);
    if (!btn || !panelEl) return;

    const close = () => {
      panelEl.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    };

    btn.addEventListener('click', () => {
      const open = panelEl.hidden;
      panelEl.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
    });

    panelEl.addEventListener('click', (e) => {
      const option = e.target.closest('.sort__option');
      if (!option) return;
      $$('.sort__option', panelEl).forEach((o) => o.classList.toggle('is-active', o === option));
      // TODO: интеграция — пересортировка выдачи на бэкенде
      close();
    });

    document.addEventListener('click', (e) => { if (!e.target.closest('[data-sort]')) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  });

  /* ---------------------------------------------------------
     Каталог: фильтры
     --------------------------------------------------------- */
  $$('[data-filters]').forEach((root) => {
    const toggle = $('[data-filters-toggle]', root);

    // На мобильном селекты уезжают в шторку: открываем её с оверлеем и блокируем прокрутку
    function setOpen(open) {
      root.classList.toggle('is-open', open);
      if (toggle) toggle.setAttribute('aria-expanded', String(open));
      document.body.classList.toggle('no-scroll', open);
      if (open) showOverlay(() => setOpen(false)); else hideOverlay();
    }

    if (toggle) toggle.addEventListener('click', () => setOpen(!root.classList.contains('is-open')));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && root.classList.contains('is-open')) setOpen(false);
    });

    root.addEventListener('click', (e) => {
      if (e.target.closest('[data-filters-close]')) {
        setOpen(false);
        return;
      }
      // TODO: интеграция — снятие фильтра должно перезапрашивать выдачу
      if (e.target.closest('[data-chip-remove]')) {
        e.target.closest('[data-chip-remove]').remove();
        return;
      }
      if (e.target.closest('[data-filters-reset]')) {
        $$('[data-chip-remove]', root).forEach((chip) => chip.remove());
        $$('select', root).forEach((s) => { s.selectedIndex = 0; });
      }
    });
  });

  /* ---------------------------------------------------------
     Каталог: подбор по автомобилю.
     Модель и год открываются только после выбора марки — состояния
     в макете нет, логика заложена самостоятельно.
     --------------------------------------------------------- */
  const carBrand = $('[data-car-brand]');
  if (carBrand) {
    const dependent = [$('[data-car-model]'), $('[data-car-year]')].filter(Boolean);
    carBrand.addEventListener('change', () => {
      dependent.forEach((s) => { s.disabled = !carBrand.value; });
    });
  }

  /* ---------------------------------------------------------
     Табы-переключатели (выбор объёма в карточке товара)
     --------------------------------------------------------- */
  $$('[data-tabs]').forEach((group) => {
    group.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-tab]');
      if (!tab) return;
      $$('[data-tab]', group).forEach((t) => t.classList.toggle('is-active', t === tab));
    });
  });

  /* ---------------------------------------------------------
     Степпер количества
     --------------------------------------------------------- */
  $$('[data-stepper]').forEach((root) => {
    const input = $('input', root);
    if (!input) return;

    const min = Number(input.min) || 1;
    const max = Number(input.max) || Infinity;

    const clamp = () => {
      const value = Math.min(max, Math.max(min, Number(input.value) || min));
      input.value = String(value);
      $$('[data-step]', root).forEach((btn) => {
        const next = value + Number(btn.dataset.step);
        btn.disabled = next < min || next > max;
      });
    };

    root.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-step]');
      if (!btn) return;
      input.value = String(Number(input.value) + Number(btn.dataset.step));
      clamp();
    });
    input.addEventListener('change', clamp);
    clamp();
  });

  /* ---------------------------------------------------------
     Галерея товара: превью переключают главный кадр
     --------------------------------------------------------- */
  $$('[data-gallery]').forEach((root) => {
    const main = $('.gallery__main img', root);
    root.addEventListener('click', (e) => {
      const thumb = e.target.closest('[data-gallery-thumb]');
      if (!thumb) return;
      $$('[data-gallery-thumb]', root).forEach((t) => t.classList.toggle('is-active', t === thumb));
      const img = $('img', thumb);
      if (main && img) {
        main.src = img.dataset.full || img.src;
        main.alt = img.alt;
      }
    });
  });

  /* ---------------------------------------------------------
     Корзина: удаление позиции и пустое состояние.
     Страницы нет в макете — поведение стандартное.
     --------------------------------------------------------- */
  (function () {
    const list = $('.cart__list');
    if (!list) return;
    const empty = $('[data-cart-empty]', list);
    const summary = $('[data-cart-summary]');

    list.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-cart-remove]');
      if (!btn) return;
      btn.closest('.cart-row').remove();

      const left = $$('.cart-row', list).length;
      if (empty) empty.hidden = left > 0;
      if (summary) summary.hidden = left === 0;
    });
  })();

  /* ---------------------------------------------------------
     Выбор города: подставляет телефон, адрес, часы и точки на карте.
     Данные — с king-oil.ru, координаты точек получены геокодером по адресам.
     --------------------------------------------------------- */
  const CITIES = {
    omsk: {
      name: 'Омск',
      phone: '8 (3812) 475-777',
      tel: '+73812475777',
      address: 'г. Омск, ул. Герцена, 197А',
      hours: 'Пн–Сб: 9:00 – 20:00, Вс: 10:00 – 19:00',
      pointsCount: '3 точки самовывоза',
      // Запятые в pt нельзя кодировать — виджет тогда не рисует метки
      map: 'https://yandex.ru/map-widget/v1/?ll=73.327,55.018&z=11'
         + '&pt=73.3748215,55.0176798,pm2rdm~73.3313739,54.9877034,pm2rdm~73.2796678,55.0473865,pm2rdm'
    },
    tyumen: {
      name: 'Тюмень',
      phone: '8 (3452) 931-444',
      tel: '+73452931444',
      address: 'г. Тюмень, ул. 50 лет Октября, 211',
      hours: 'Пн–Пт: 9:00 – 20:00, Сб–Вс: 10:00 – 19:00',
      pointsCount: '1 точка самовывоза',
      map: 'https://yandex.ru/map-widget/v1/?ll=65.6285146,57.1203743&z=15'
         + '&pt=65.6285146,57.1203743,pm2rdm'
    }
  };

  const CITY_KEY = 'ko-city';

  function applyCity(key) {
    const city = CITIES[key];
    if (!city) return;

    $$('[data-city-label]').forEach((el) => { el.textContent = city.name; });
    $$('[data-city-phone]').forEach((el) => {
      el.textContent = city.phone;
      el.setAttribute('href', 'tel:' + city.tel);
    });
    $$('[data-city-address]').forEach((el) => { el.textContent = city.address; });
    $$('[data-city-hours]').forEach((el) => { el.textContent = city.hours; });
    $$('[data-city-points-count]').forEach((el) => { el.textContent = city.pointsCount; });
    $$('[data-city-map]').forEach((el) => { el.setAttribute('src', city.map); });
    $$('[data-city-set]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.citySet === key);
    });

    try { localStorage.setItem(CITY_KEY, key); } catch (err) { /* приватный режим */ }
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-city-set]');
    if (!btn) return;
    applyCity(btn.dataset.citySet);
    closePanel();
  });

  if ($('[data-city]')) {
    let saved = 'omsk';
    try { saved = localStorage.getItem(CITY_KEY) || 'omsk'; } catch (err) { /* приватный режим */ }
    applyCity(CITIES[saved] ? saved : 'omsk');
  }

  /* ---------------------------------------------------------
     Год в копирайте
     --------------------------------------------------------- */
  $$('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });
})();
