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

  /* Стек, а не одна панель: список городов лежит внутри мобильного меню,
     и при одиночной переменной его открытие закрывало само меню */
  const openPanels = [];
  const FULLSCREEN = ['mega', 'mobile-menu', 'catalog-menu', 'search-page'];
  const NO_SCROLL = FULLSCREEN;

  function hidePanel(name) {
    const el = panels[name];
    if (!el) return;
    el.hidden = true;
    const trigger = $(`[data-toggle="${name}"]`);
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
    if (FULLSCREEN.includes(name)) hideOverlay();
    if (NO_SCROLL.includes(name)) document.body.classList.remove('no-scroll');
  }

  // Закрывает верхнюю панель стека, а с аргументом — конкретную и всё, что над ней
  function closePanel(name) {
    if (!openPanels.length) return;
    const from = name ? openPanels.indexOf(name) : openPanels.length - 1;
    if (from < 0) return;
    openPanels.splice(from).reverse().forEach(hidePanel);
  }

  function closeAllPanels() {
    openPanels.splice(0).reverse().forEach(hidePanel);
  }

  function togglePanel(name) {
    const el = panels[name];
    if (!el) return;

    if (openPanels.includes(name)) { closePanel(name); return; }

    // Панели, не вложенные в уже открытую, закрывают её: два меню рядом не висят
    while (openPanels.length && !panels[openPanels[openPanels.length - 1]].contains(el)) {
      closePanel();
    }

    el.hidden = false;
    openPanels.push(name);

    const trigger = $(`[data-toggle="${name}"]`);
    if (trigger) trigger.setAttribute('aria-expanded', 'true');

    if (FULLSCREEN.includes(name)) showOverlay(() => closePanel(name));
    if (NO_SCROLL.includes(name)) document.body.classList.add('no-scroll');
  }

  document.addEventListener('click', (e) => {
    const toggle = e.target.closest('[data-toggle]');
    if (toggle) {
      e.preventDefault();
      togglePanel(toggle.dataset.toggle);
      return;
    }

    if (e.target.closest('[data-close]')) {
      const panel = e.target.closest('[data-panel]');
      if (panel) closePanel(panel.dataset.panel);
      else closeAllPanels();
      closeModal();
      return;
    }

    // клик вне панелей закрывает всё открытое
    if (openPanels.length && !e.target.closest('[data-panel]')) closeAllPanels();
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
      // В полноэкранном режиме панель — содержимое раздела, её закрывает «Отмена»
      if (header && header.classList.contains('is-search-open')) return;
      if (!e.target.closest('[data-search]') && !e.target.closest('[data-search-toggle]')) closeSearch();
    });
  }

  /* На мобильном поиск — отдельный раздел на весь экран (макет mobile-search):
     лупа открывает, «Отмена» закрывает, крестик чистит поле */
  const searchToggle = $('[data-search-toggle]');
  const searchCancel = $('[data-search-cancel]');
  const searchClear = $('[data-search-clear]');

  function setSearchOpen(open) {
    if (!header || !search) return;
    header.classList.toggle('is-search-open', open);
    if (searchToggle) searchToggle.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('no-scroll', open);
    if (open) {
      // Раздел сразу показывает историю и популярное — панель не ждёт фокуса
      if (searchPanel) searchPanel.hidden = false;
      $('.search__input', search).focus();
    } else {
      closeSearch();
    }
    if (headerSpacer) headerSpacer.style.height = `${header.offsetHeight}px`;
  }

  if (searchToggle) searchToggle.addEventListener('click', () => setSearchOpen(!header.classList.contains('is-search-open')));
  if (searchCancel) searchCancel.addEventListener('click', () => setSearchOpen(false));
  if (searchClear && search) {
    searchClear.addEventListener('click', () => {
      const input = $('.search__input', search);
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    });
  }

  /* ---------------------------------------------------------
     Личный кабинет: переключение разделов слева
     --------------------------------------------------------- */
  const accountNav = $('[data-account-nav]');
  if (accountNav) {
    const titles = {
      data: 'Мои данные',
      loyalty: 'Программа лояльности',
      orders: 'Мои заказы',
      promocodes: 'Промокоды',
    };

    const showTab = (name) => {
      if (!titles[name]) return;
      $$('[data-account-panel]').forEach((p) => { p.hidden = p.dataset.accountPanel !== name; });
      $$('[data-account-tab]').forEach((b) => b.classList.toggle('is-active', b.dataset.accountTab === name));
      const title = $('[data-account-title]');
      const crumb = $('[data-account-crumb]');
      if (title) title.textContent = titles[name];
      if (crumb) crumb.textContent = titles[name];
      document.title = `${titles[name]} | King-Oil`;
    };

    accountNav.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-account-tab]');
      if (!btn) return;
      showTab(btn.dataset.accountTab);
      history.replaceState(null, '', `#${btn.dataset.accountTab}`);
    });

    // Ссылка «Бонусные баллы» в шапке и подвале ведёт на account.html#loyalty
    const fromHash = location.hash.slice(1);
    if (fromHash) showTab(fromHash);
  }

  /* ---------------------------------------------------------
     «Купить в 1 клик»: сразу на оформление заказа с этим товаром
     --------------------------------------------------------- */
  // TODO: интеграция — на бэкенде по этим параметрам собирается заказ из одной позиции
  $$('[data-buy-now]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const info = link.closest('.product-info') || document;
      const qty = $('.stepper__input', info);
      const volume = $('[data-tabs] .is-active', info);
      const params = new URLSearchParams({ mode: 'buy-now' });
      if (link.dataset.sku) params.set('sku', link.dataset.sku);
      if (volume) params.set('volume', volume.textContent.trim());
      if (qty) params.set('qty', qty.value || '1');
      e.preventDefault();
      location.href = `${link.getAttribute('href')}?${params}`;
    });
  });

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
    closeAllPanels();
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
     Оформление заказа: организации нужны реквизиты для счёта
     --------------------------------------------------------- */
  const recipient = $('[data-recipient]');
  const companyBlock = $('[data-company-block]');
  if (recipient && companyBlock) {
    const syncRecipient = (text) => {
      companyBlock.hidden = !/организац/i.test(text);
    };
    recipient.addEventListener('select:change', (e) => syncRecipient(e.detail.value));
    syncRecipient($('.select__value', recipient).textContent);
  }

  /* ---------------------------------------------------------
     Оформление заказа: под способом получения своя панель уточнений
     (пункт самовывоза / адрес и карта / город и транспортная компания)
     --------------------------------------------------------- */
  const shippingInputs = $$('input[name="shipping"]');
  if (shippingInputs.length) {
    const showShipping = (value) => {
      $$('[data-shipping-panel]').forEach((panel) => {
        panel.hidden = panel.dataset.shippingPanel !== value;
      });
      // карта в скрытой панели считает размеры нулевыми — пересчитываем при показе
      const shown = $('[data-shipping-panel="' + value + '"]');
      const map = shown && $('[data-map]', shown);
      if (map && map._map) map._map.container.fitToViewport();
    };

    shippingInputs.forEach((input) => {
      input.addEventListener('change', () => { if (input.checked) showShipping(input.value); });
    });
    const checked = shippingInputs.find((i) => i.checked) || shippingInputs[0];
    showShipping(checked.value);
  }

  /* ---------------------------------------------------------
     Формы: заглушка отправки + экран успеха
     --------------------------------------------------------- */
  $$('[data-form]').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      // TODO: интеграция — отправка на бэкенд
      // Оформление заказа ведёт на страницу оформленного заказа
      if (form.dataset.formRedirect) {
        window.location.href = form.dataset.formRedirect;
        return;
      }
      const inModal = form.closest('.modal');
      const success = $('[data-form-success]', form.parentElement);

      if (inModal && success) {
        // Внутри модалки подменяем содержимое: заголовок и подзаголовок формы
        // на экране успеха не нужны, у него свой
        form.hidden = true;
        $$('.modal__title, .modal__subtitle', form.parentElement)
          .filter((el) => !success.contains(el))
          .forEach((el) => { el.hidden = true; });
        success.hidden = false;
        return;
      }

      // Форму на странице не трогаем — сообщаем об отправке модалкой
      form.reset();
      openModal('sent');
    });
  });

  /* ---------------------------------------------------------
     Выпадающие списки — свои вместо системного <select>:
     системный список рисует ОС, к макету его не привести
     --------------------------------------------------------- */
  let openSelect = null;

  function closeSelect() {
    if (!openSelect) return;
    $('[data-select-panel]', openSelect).hidden = true;
    $('[data-select-btn]', openSelect).setAttribute('aria-expanded', 'false');
    openSelect = null;
  }

  $$('[data-select]').forEach((root) => {
    const btn = $('[data-select-btn]', root);
    const panel = $('[data-select-panel]', root);
    const value = $('.select__value', root);
    if (!btn || !panel || !value) return;

    const multi = root.hasAttribute('data-select-multi');
    const placeholder = value.textContent;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasOpen = openSelect === root;
      closeSelect();
      if (wasOpen || btn.disabled) return;
      panel.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      openSelect = root;
    });

    if (multi) {
      // Мультивыбор: подпись всегда остаётся названием фильтра — выбранное
      // показывают теги под строкой фильтров (см. «Каталог: фильтры»)
      void placeholder;
    } else {
      panel.addEventListener('click', (e) => {
        const opt = e.target.closest('.select__option');
        if (!opt) return;
        $$('.select__option', panel).forEach((o) => o.classList.toggle('is-active', o === opt));
        value.textContent = opt.textContent.trim();
        value.classList.remove('select__value--muted');
        root.dispatchEvent(new CustomEvent('select:change', { detail: { value: value.textContent } }));
        closeSelect();
      });
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-select]')) closeSelect();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSelect(); });

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

    const foot = $('.carousel-foot', root);

    const update = () => {
      const max = track.scrollWidth - track.clientWidth;
      // Если лента влезает целиком, листать нечего: прячем индикатор и стрелки.
      // На узких экранах позиции перестают помещаться и подвал возвращается
      if (foot) foot.hidden = max <= 1;
      if (max <= 1) return;
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
     Главный слайдер: стрелки + автоперелистывание раз в 10 секунд
     --------------------------------------------------------- */
  const hero = $('[data-hero]');
  if (hero) {
    const slides = $$('[data-hero-slide]', hero);
    if (slides.length > 1) {
      const DELAY = 10000;
      let current = Math.max(0, slides.findIndex((s) => s.classList.contains('is-active')));
      let timer = null;

      const track = $('[data-hero-track]', hero);
      const show = (next) => {
        current = (next + slides.length) % slides.length;
        slides.forEach((s, i) => s.classList.toggle('is-active', i === current));
        if (track) track.style.transform = `translateX(${-current * 100}%)`;
      };
      const stop = () => { clearInterval(timer); timer = null; };
      const play = () => { stop(); timer = setInterval(() => show(current + 1), DELAY); };

      const prev = $('[data-hero-prev]', hero);
      const next = $('[data-hero-next]', hero);
      if (prev) prev.addEventListener('click', () => { show(current - 1); play(); });
      if (next) next.addEventListener('click', () => { show(current + 1); play(); });

      // на наведении и на скрытой вкладке таймер стоит
      hero.addEventListener('mouseenter', stop);
      hero.addEventListener('mouseleave', play);
      document.addEventListener('visibilitychange', () => (document.hidden ? stop() : play()));

      /* Свайп: на мобильном стрелок по макету нет, листать иначе нечем.
         Горизонтальное движение от 40 px считаем перелистыванием, вертикальное
         не перехватываем — иначе страница перестанет скроллиться пальцем */
      let startX = 0, startY = 0, tracking = false;
      hero.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        tracking = true;
        stop();
      }, { passive: true });
      hero.addEventListener('touchend', (e) => {
        if (!tracking) return;
        tracking = false;
        const dx = e.changedTouches[0].clientX - startX;
        const dy = e.changedTouches[0].clientY - startY;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) show(current + (dx < 0 ? 1 : -1));
        play();
      }, { passive: true });

      show(current);
      play();
    }
  }

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
      const chip = e.target.closest('[data-chip-remove]');
      if (chip) {
        const input = $(`input[value="${chip.dataset.chipRemove}"]`, root);
        if (input) input.checked = false;
        renderChips();
        return;
      }
      if (e.target.closest('[data-filters-reset]')) {
        $$('[data-select] input:checked', root).forEach((i) => { i.checked = false; });
        renderChips();
      }
    });

    // Выбранные фильтры — тегами под строкой селектов. «Сбросить» показываем,
    // только когда есть что сбрасывать
    const active = $('[data-filters-active]', root);
    const reset = $('[data-filters-reset]', root);

    function renderChips() {
      if (!active) return;
      const picked = $$('[data-select] input:checked', root).map((i) => i.value);
      active.innerHTML = picked.map((v) =>
        `<button class="chip chip--removable" type="button" data-chip-remove="${v}">`
        + `${v} <svg><use href="#i-close"></use></svg></button>`).join('');
      if (reset) {
        active.appendChild(reset);
        reset.hidden = !picked.length;
      }
      active.hidden = !picked.length;
    }

    root.addEventListener('change', (e) => {
      if (e.target.matches('[data-select] input[type="checkbox"]')) renderChips();
    });
    renderChips();
  });

  /* ---------------------------------------------------------
     Табы-переключатели (выбор объёма в карточке товара)
     --------------------------------------------------------- */
  $$('[data-tabs]').forEach((group) => {
    group.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-tab]');
      if (!tab) return;
      $$('[data-tab]', group).forEach((t) => t.classList.toggle('is-active', t === tab));
      if (tab.dataset.stock !== undefined) applyStock(tab);
    });
  });

  /* Наличие зависит от объёма: у закончившегося варианта строка становится
     серой, «В корзину» и степпер прячутся, вместо них — «Уведомить о поступлении».
     Состояния в макете нет — см. docs/22-stock-states.md */
  function applyStock(tab) {
    const info = tab.closest('.product-info');
    if (!info) return;

    const left    = Number(tab.dataset.stock);
    const inStock = left > 0;
    const line    = $('[data-stock-line]', info);
    const buy     = $('[data-add-to-cart]', info);
    const notify  = $('[data-notify]', info);
    const stepper = $('[data-stepper]', info);
    const oneClick = $('[data-buy-now]', info);

    if (line) {
      line.textContent = inStock
        ? `В наличии — ${left} шт на складе`
        : 'Нет в наличии — привезём под заказ';
      line.classList.toggle('product-info__stock--out', !inStock);
    }
    if (buy) buy.hidden = !inStock;
    if (oneClick) oneClick.hidden = !inStock;
    if (stepper) stepper.hidden = !inStock;
    if (notify) notify.hidden = inStock;

    // Верхнюю границу степпера держим равной остатку
    const qty = stepper && $('.stepper__input', stepper);
    if (qty && inStock) {
      qty.max = String(left);
      if (Number(qty.value) > left) qty.value = String(left);
    }
  }

  const activeVolume = $('[data-tabs] [data-tab].is-active[data-stock]');
  if (activeVolume) applyStock(activeVolume);

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
    const list = $('[data-cart-list]');
    if (!list) return;
    const empty = $('[data-cart-empty]');
    const summary = $('[data-cart-summary]');

    function sync() {
      const left = $$('.cart-row', list).length;
      list.hidden = left === 0;
      if (empty) empty.hidden = left > 0;
      if (summary) summary.hidden = left === 0;
    }

    list.addEventListener('click', (e) => {
      if (e.target.closest('[data-cart-clear]')) {
        $$('.cart-row', list).forEach((row) => row.remove());
        sync();
        return;
      }
      const btn = e.target.closest('[data-cart-remove]');
      if (!btn) return;
      btn.closest('.cart-row').remove();
      sync();
    });

    // TODO: интеграция — проверка промокода на бэкенде
    const promo = $('[data-promo]');
    if (promo) promo.addEventListener('submit', (e) => e.preventDefault());
  })();

  /* ---------------------------------------------------------
     Избранное: сердце убирает карточку, при пустом списке — заглушка.
     Страницы нет в макете — поведение стандартное.
     --------------------------------------------------------- */
  (function () {
    const root = $('[data-wishlist]');
    if (!root) return;
    const grid = $('.catalog-grid', root);
    const empty = $('[data-wishlist-empty]', root);

    root.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-wish-remove]');
      if (!btn) return;
      btn.closest('.product-card').remove();
      if (grid && !$('.product-card', grid)) {
        grid.hidden = true;
        if (empty) empty.hidden = false;
      }
    });
  })();

  /* ---------------------------------------------------------
     Выбор города: подставляет телефон, адрес, часы и точки на карте.
     Данные — с king-oil.ru, координаты точек получены геокодером по адресам.
     --------------------------------------------------------- */
  // Точки самовывоза с king-oil.ru. Координаты получены геокодером по адресам
  // (Енисейская, 1 — под вопросом, см. docs/13-open-questions.md).
  const CITIES = {
    omsk: {
      name: 'Омск',
      dative: 'Омску',
      phone: '8 (3812) 475-777',
      tel: '+73812475777',
      center: [55.02, 73.33],
      zoom: 11,
      points: [
        { address: 'г. Омск, ул. Герцена, 197А',   hours: 'Пн–Сб 9:00–20:00, Вс 10:00–19:00', coords: [55.0176798, 73.3748215], main: true },
        { address: 'г. Омск, ул. Енисейская, 1',    hours: 'Пн–Сб 9:00–20:00, Вс 10:00–19:00', coords: [54.9877034, 73.3313739] },
        { address: 'г. Омск, ул. Энтузиастов, 2/2', hours: 'Пн–Сб 9:00–20:00, Вс 10:00–19:00', coords: [55.0473865, 73.2796678] }
      ]
    },
    tyumen: {
      name: 'Тюмень',
      dative: 'Тюмени',
      phone: '8 (3452) 931-444',
      tel: '+73452931444',
      center: [57.1203743, 65.6285146],
      zoom: 14,
      points: [
        { address: 'г. Тюмень, ул. 50 лет Октября, 211', hours: 'Пн–Пт 9:00–20:00, Сб–Вс 10:00–19:00', coords: [57.1203743, 65.6285146], main: true }
      ]
    }
  };

  const CITY_KEY = 'ko-city';

  function cityMeta(city) {
    const main = city.points.find((p) => p.main) || city.points[0];
    const n = city.points.length;
    const word = n === 1 ? 'точка самовывоза' : (n < 5 ? 'точки самовывоза' : 'точек самовывоза');
    return { address: main.address, hours: main.hours, count: n + ' ' + word };
  }

  function applyCity(key) {
    const city = CITIES[key];
    if (!city) return;
    const meta = cityMeta(city);

    $$('[data-city-label]').forEach((el) => { el.textContent = city.name; });
    $$('[data-city-dative]').forEach((el) => { el.textContent = city.dative; });
    $$('[data-city-phone]').forEach((el) => {
      el.textContent = city.phone;
      el.setAttribute('href', 'tel:' + city.tel);
    });
    $$('[data-city-address]').forEach((el) => { el.textContent = meta.address; });
    // Блок адресов на «Контактах»: перечисляем все точки города, как в макете
    $$('[data-city-addresses]').forEach((el) => {
      el.innerHTML = city.points.map((p) => `<span>${p.address}</span>`).join('');
    });
    // «Пн–Сб 9:00–20:00, Вс 10:00–19:00» разводим по строкам: будни крупно, выходной подписью
    $$('[data-city-hours]').forEach((el) => { el.textContent = meta.hours.split(',')[0].trim(); });
    $$('[data-city-hours-extra]').forEach((el) => {
      const rest = meta.hours.split(',').slice(1).join(',').trim();
      el.textContent = rest ? `Воскресенье — ${rest.replace(/^Вс\s*/, '')}` : 'Воскресенье — выходной';
    });
    $$('[data-city-points-count]').forEach((el) => { el.textContent = meta.count; });
    $$('[data-city-set]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.citySet === key);
    });

    // Списки пунктов самовывоза (оформление заказа) — только точки этого города
    $$('[data-city-points]').forEach((sel) => {
      const panel = $('[data-select-panel]', sel);
      const value = $('.select__value', sel);
      if (!panel || !value) return;
      const label = (p) => p.address.replace(/^г\.\s*/, '');
      panel.innerHTML = city.points.map((p, i) =>
        '<button class="select__option' + (i ? '' : ' is-active') + '" type="button">'
        + label(p) + '</button>').join('');
      value.textContent = label(city.points[0]);
    });

    renderMap(key);
    try { localStorage.setItem(CITY_KEY, key); } catch (err) { /* приватный режим */ }
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-city-set]');
    if (!btn) return;
    applyCity(btn.dataset.citySet);
    // На десктопе город — выпадающий список, на мобильном — модалка
    if (btn.closest('.modal')) closeModal();
    else closePanel();
  });

  /* ---------------------------------------------------------
     Карта точек самовывоза (Яндекс.Карты JS API).
     Метки кликабельны: в балуне адрес, часы и телефон.
     API-ключ подставляется в data-map-key; без него карта не
     грузится — тогда показываем список адресов как запасной вид.
     --------------------------------------------------------- */
  let mapReady = null;
  let mapObj = null;
  let mapMarks = null;

  function loadYmaps(apiKey) {
    if (mapReady) return mapReady;
    mapReady = new Promise((resolve, reject) => {
      if (window.ymaps && window.ymaps.Map) { window.ymaps.ready(() => resolve(window.ymaps)); return; }
      const s = document.createElement('script');
      const key = apiKey ? 'apikey=' + encodeURIComponent(apiKey) + '&' : '';
      s.src = 'https://api-maps.yandex.ru/2.1/?' + key + 'lang=ru_RU';
      s.onload = () => window.ymaps.ready(() => resolve(window.ymaps));
      s.onerror = () => reject(new Error('ymaps load error'));
      document.head.appendChild(s);
    });
    return mapReady;
  }

  function balloon(city, p) {
    return '<div class="map-balloon">'
      + '<strong class="map-balloon__title">' + p.address + '</strong>'
      + '<span class="map-balloon__row">' + p.hours + '</span>'
      + '<a class="map-balloon__row" href="tel:' + city.tel + '">' + city.phone + '</a>'
      + '</div>';
  }

  function renderMap(key) {
    $$('[data-map]').forEach((box) => renderMapBox(box, key));
  }

  function renderMapBox(box, key) {
    const city = CITIES[key];
    // Карта зоны доставки: без меток самовывоза и со своим запасным видом
    if (box.dataset.mapMode === 'delivery') {
      loadYmaps(box.dataset.mapKey || '').then((ymaps) => {
        box.classList.remove('contacts__map--fallback');
        if (!box.dataset.mapInit) {
          box.dataset.mapInit = '1';
          box._map = new ymaps.Map(box, {
            center: city.center, zoom: city.zoom, controls: ['zoomControl']
          }, { suppressMapOpenBlock: true });
        }
        box._map.setCenter(city.center, city.zoom);
      }).catch(() => {
        box.classList.add('contacts__map--fallback');
        box.innerHTML = '<ul class="map-fallback"><li><strong>Доставка по городу ' + city.name
          + '</strong><span>Курьер привезёт заказ на следующий день, время согласуем звонком.</span></li></ul>';
      });
      return;
    }

    loadYmaps(box.dataset.mapKey || '').then((ymaps) => {
      box.classList.remove('contacts__map--fallback');
      if (!mapObj) {
        mapObj = new ymaps.Map(box, {
          center: city.center, zoom: city.zoom, controls: ['zoomControl']
        }, { suppressMapOpenBlock: true });
        mapMarks = new ymaps.GeoObjectCollection();
        mapObj.geoObjects.add(mapMarks);
      }
      mapMarks.removeAll();
      city.points.forEach((p) => {
        mapMarks.add(new ymaps.Placemark(p.coords, {
          balloonContent: balloon(city, p),
          hintContent: p.address
        }, { preset: 'islands#redDotIcon' }));
      });
      mapObj.setCenter(city.center, city.zoom);
      if (city.points.length > 1) {
        mapObj.setBounds(mapMarks.getBounds(), { checkZoomRange: true, zoomMargin: 40 });
      }
    }).catch(() => {
      // Ключа нет или API не загрузился — показываем список адресов
      box.classList.add('contacts__map--fallback');
      box.innerHTML = '<ul class="map-fallback">' + city.points.map((p) =>
        '<li><strong>' + p.address + '</strong><span>' + p.hours + '</span>'
        + '<a href="tel:' + city.tel + '">' + city.phone + '</a></li>').join('') + '</ul>';
    });
  }

  if ($('[data-city]')) {
    let saved = 'omsk';
    try { saved = localStorage.getItem(CITY_KEY) || 'omsk'; } catch (err) { /* приватный режим */ }
    applyCity(CITIES[saved] ? saved : 'omsk');
  }

  /* ---------------------------------------------------------
     Карточка товара: объём и избранное.
     Объём — вариант одного товара, поэтому цена меняется на месте,
     без перехода на другую страницу (решение от 4 сентября).
     --------------------------------------------------------- */
  document.addEventListener('click', (e) => {
    const chip = e.target.closest('.volume');
    if (chip) {
      const row = chip.closest('.product-card__volumes');
      $$('.volume', row).forEach((b) => b.classList.toggle('is-active', b === chip));
      const card = chip.closest('.product-card');
      const price = card && $('.product-card__price', card);
      if (price && chip.dataset.price) {
        // цену держим в первом текстовом узле, чтобы не потерять зачёркнутую старую
        const node = [...price.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
        if (node) node.textContent = chip.dataset.price + ' ';
      }
      return;
    }

    // На странице избранного сердце убирает карточку — обработчик ниже
    const fav = e.target.closest('.product-card__fav:not([data-wish-remove])');
    if (fav) {
      const on = fav.classList.toggle('is-active');
      fav.setAttribute('aria-label', on ? 'Убрать из избранного' : 'В избранное');
    }
  });

  /* ---------------------------------------------------------
     Каталог для поиска.
     Статике неоткуда взять товары, поэтому список зашит здесь:
     названия, цены и картинки — те же, что в разметке каталога.
     При переносе в CS-Cart этот массив заменяется выдачей бэкенда
     (решение от 7 сентября, макета страницы поиска нет — см. docs/21-search.md)
     --------------------------------------------------------- */
  const KO_PRODUCTS = [
    { t: 'CASTROL 5W-30 MAGNATEC AP 4L',                 c: 'Моторные масла',      p: '3 750 ₽', i: 'p14.jpg' },
    { t: 'Castrol Magnatec C3 5W40 4l',                  c: 'Моторные масла',      p: '4 190 ₽', i: 'p15.jpg' },
    { t: 'Castrol Edge 5W-30 LL (синтетика) 4 л',        c: 'Моторные масла',      p: '3 990 ₽', i: 'p16.jpg' },
    { t: 'Castrol Edge 0W-30 A3/B4 (синтетика) 4 л',     c: 'Моторные масла',      p: '3 450 ₽', i: 'p17.jpg' },
    { t: 'Castrol Edge 0W-30 A5/B5 (синтетика) 4 л',     c: 'Моторные масла',      p: '2 690 ₽', i: 'p18.jpg' },
    { t: 'Лукойл Genesis Armortech JP 5w30 (розлив)',    c: 'Моторные масла',      p: '4 850 ₽', i: 'p19.jpg', old: '5 700 ₽' },
    { t: 'Лукойл Genesis Armortech 0w-40 1л (розлив)',   c: 'Моторные масла',      p: '2 350 ₽', i: 'p20.jpg' },
    { t: 'Лукойл Супер 10w40 4L',                        c: 'Моторные масла',      p: '5 490 ₽', i: 'p21.jpg' },
    { t: 'Лукойл Super 5w40 (полусинтетика) 4 л',        c: 'Моторные масла',      p: '3 150 ₽', i: 'p22.jpg' },
    { t: 'Лукойл Люкс П/Синт 10w40 4L',                  c: 'Моторные масла',      p: '2 890 ₽', i: 'p23.jpg' },
    { t: 'Лукойл Люкс П/Синт 5w40 4L',                   c: 'Моторные масла',      p: '3 290 ₽', i: 'p24.jpg' },
    { t: 'Лукойл Genesis Universal П/Синт 10w40 4 л',    c: 'Моторные масла',      p: '4 450 ₽', i: 'p25.jpg' },
    { t: 'ZIC X7 5W-30 SP синтетическое 4 л',            c: 'Моторные масла',      p: '3 640 ₽', i: 'p31.jpg' },
    { t: 'ENEOS Premium Touring 5W-40 4 л',              c: 'Моторные масла',      p: '4 120 ₽', i: 'p36.jpg' },
    { t: 'G-Energy Synthetic Super Start 5W-30 4 л',     c: 'Моторные масла',      p: '3 380 ₽', i: 'p42.jpg' },
    { t: 'Honda HCF-2 (розлив)',                         c: 'Трансмиссионные',     p: '1 190 ₽', i: 'p51.jpg' },
    { t: 'Mazda ATF M-V (розлив)',                       c: 'Трансмиссионные',     p: '1 090 ₽', i: 'p52.jpg' },
    { t: 'Nissan ATF Matic D (розлив)',                  c: 'Трансмиссионные',     p: '1 150 ₽', i: 'p53.jpg' },
    { t: 'Toyota ATF WS (розлив)',                       c: 'Трансмиссионные',     p: '1 240 ₽', i: 'p54.jpg' },
    { t: 'NGN Synth 75W-90 GL-4/5 1 л',                  c: 'Трансмиссионные',     p: '1 480 ₽', i: 'p55.jpg' },
    { t: 'Антифриз Sintec Unlimited G12++ 5 кг',         c: 'Антифриз',            p: '1 690 ₽', i: 'p61.jpg' },
    { t: 'Антифриз Felix Carbox G12 10 кг',              c: 'Антифриз',            p: '2 340 ₽', i: 'p62.jpg' },
    { t: 'Антифриз ЛУКОЙЛ G11 зелёный 5 кг',             c: 'Антифриз',            p: '1 180 ₽', i: 'p63.jpg' },
    { t: 'Аккумулятор Tubor Standart 60 А·ч',            c: 'Аккумуляторы',        p: '6 490 ₽', i: 'p71.jpg' },
    { t: 'Аккумулятор Topla Energy 74 А·ч',              c: 'Аккумуляторы',        p: '9 150 ₽', i: 'p72.jpg' },
    { t: 'Аккумулятор Tyumen Battery Premium 64 А·ч',    c: 'Аккумуляторы',        p: '7 200 ₽', i: 'p73.jpg' },
    { t: 'Фильтр масляный MANN W 914/2',                 c: 'Фильтры',             p: '540 ₽',   i: 'p81.jpg' },
    { t: 'Фильтр воздушный MANN C 25 114/1',             c: 'Фильтры',             p: '820 ₽',   i: 'p82.jpg' },
    { t: 'Фильтр салонный MANN CU 2545',                 c: 'Фильтры',             p: '690 ₽',   i: 'p83.jpg' },
    { t: 'Лампа Osram Night Breaker H4 12V 60/55W',      c: 'Лампы',               p: '1 320 ₽', i: 'p91.jpg' },
    { t: 'Лампа Philips X-tremeVision H7 12V 55W',       c: 'Лампы',               p: '1 480 ₽', i: 'p92.jpg' },
    { t: 'Лампа Osram LEDriving HL H4',                  c: 'Лампы',               p: '3 950 ₽', i: 'p93.jpg' },
  ];

  /* Поиск нестрогий: запрос бьётся на слова, товар подходит,
     если каждое слово встречается в названии или категории.
     У русских слов от пяти букв отбрасываем окончание (но оставляем не меньше
     четырёх): иначе «моторное масло» не находит «Моторные масла».
     Латиницу и цифры не трогаем — там окончаний нет, а обрезка «5w-30»
     до «5w-» сложила бы в выдачу все вязкости подряд */
  const stem = (word) => (/^[а-яё]+$/.test(word) && word.length >= 5
    ? word.slice(0, Math.max(4, word.length - 2))
    : word);

  function searchProducts(query) {
    const words = String(query).toLowerCase().trim().split(/\s+/).filter(Boolean).map(stem);
    if (!words.length) return [];
    return KO_PRODUCTS.filter((prod) => {
      const hay = `${prod.t} ${prod.c}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }

  const escapeHtml = (str) => String(str).replace(/[&<>"]/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]
  ));

  /* ---------------------------------------------------------
     Живой поиск в шапке: по мере ввода панель показывает товары,
     при пустом запросе — историю и популярное, при нуле совпадений —
     состояние «Ничего не найдено»
     --------------------------------------------------------- */
  if (search && searchPanel) {
    const searchInput   = $('.search__input', search);
    const blockDefault  = $('[data-search-default]', searchPanel);
    const blockLive     = $('[data-search-live]', searchPanel);
    const blockEmpty    = $('[data-search-empty]', searchPanel);
    const resultsBox    = $('[data-search-results]', searchPanel);
    const blockSuggest  = $('[data-search-suggest]', searchPanel);
    const groupRecent   = $('[data-search-recent-group]', searchPanel);
    const groupPopular  = $('[data-search-popular]', searchPanel);
    const SEARCH_LIMIT  = 6;

    /* Подсказки-чипсы над результатами: категории и бренды, попавшие в выдачу.
       В макете это варианты уточнения запроса (26886 mobile-search-process) */
    function suggestFor(found) {
      const cats = [...new Set(found.map((p) => p.c))];
      const brands = [...new Set(found.map((p) => p.t.split(/\s+/)[0]))];
      return [...cats, ...brands.filter((x) => !cats.includes(x))].slice(0, 3);
    }

    function renderSearch() {
      const q = searchInput.value.trim();
      const clearBtn = $('[data-search-clear]', search);
      if (clearBtn) clearBtn.hidden = !q;

      if (!q) {
        if (blockDefault) blockDefault.hidden = false;
        if (groupRecent) groupRecent.hidden = false;
        if (groupPopular) groupPopular.hidden = false;
        if (blockLive) blockLive.hidden = true;
        if (blockEmpty) blockEmpty.hidden = true;
        if (blockSuggest) blockSuggest.hidden = true;
        return;
      }

      const found = searchProducts(q);
      // При пустой выдаче история остаётся под плашкой, популярные товары уходят
      if (blockDefault) blockDefault.hidden = found.length > 0;
      if (groupRecent) groupRecent.hidden = false;
      if (groupPopular) groupPopular.hidden = true;
      if (blockEmpty) blockEmpty.hidden = found.length > 0;
      if (blockLive) blockLive.hidden = found.length === 0;

      if (blockSuggest) {
        const chips = found.length ? suggestFor(found) : [];
        blockSuggest.hidden = chips.length === 0;
        blockSuggest.innerHTML = chips.map((c) =>
          `<a class="chip" href="search.html?q=${encodeURIComponent(c)}">${escapeHtml(c)}</a>`).join('');
      }

      if (resultsBox) {
        resultsBox.innerHTML = found.slice(0, SEARCH_LIMIT).map((prod) => `
          <a class="search__product" href="product.html">
            <img src="img/products/${prod.i}" width="40" height="40" alt="" loading="lazy">
            <span><span class="search__product-name">${escapeHtml(prod.t)}</span><br><span class="search__product-cat">${escapeHtml(prod.c)}</span></span>
          </a>`).join('');

        // Больше лимита — ссылка на полную выдачу
        if (found.length > SEARCH_LIMIT) {
          resultsBox.insertAdjacentHTML('beforeend',
            `<a class="search__row" href="search.html?q=${encodeURIComponent(q)}"><span>Показать все ${found.length}</span></a>`);
        }
      }
    }

    searchInput.addEventListener('input', () => {
      searchPanel.hidden = false;
      renderSearch();
    });
    searchInput.addEventListener('focus', renderSearch);

    // Enter и лупа ведут на страницу выдачи; пустой запрос не отправляем
    search.addEventListener('submit', (e) => {
      if (!searchInput.value.trim()) e.preventDefault();
    });

    // «Очистить» убирает историю запросов целиком, крестик — одну строку
    const clearRecent = $('[data-search-clear-recent]', searchPanel);
    if (clearRecent) {
      clearRecent.addEventListener('click', () => {
        $$('[data-search-recent]', searchPanel).forEach((row) => row.remove());
        if (groupRecent) groupRecent.hidden = true;
      });
    }
    searchPanel.addEventListener('click', (e) => {
      const row = e.target.closest('[data-search-recent]');
      if (!row) return;
      e.preventDefault();
      row.remove();
      if (groupRecent && !$('[data-search-recent]', groupRecent)) groupRecent.hidden = true;
    });
  }

  /* ---------------------------------------------------------
     Страница выдачи: тот же список товаров, что в каталоге,
     плюс общее с каталогом пустое состояние
     --------------------------------------------------------- */
  const searchPage = $('[data-search-page]');
  if (searchPage) {
    const query   = new URLSearchParams(window.location.search).get('q') || '';
    const found   = searchProducts(query);
    const grid    = $('[data-search-grid]', searchPage);
    const empty   = $('[data-search-page-empty]', searchPage);
    const countEl = $('[data-search-count]', searchPage);

    // Запрос повторяем под заголовком и в строке поиска шапки
    $$('[data-search-query]', document).forEach((el) => { el.textContent = query; });
    const queryRow = $('[data-search-query-row]', searchPage);
    if (queryRow) queryRow.hidden = !query;
    const headerInput = search && $('.search__input', search);
    if (headerInput && query) headerInput.value = query;

    if (countEl) {
      const plural = (n) => (n % 10 === 1 && n % 100 !== 11 ? 'товар'
        : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'товара' : 'товаров');
      // Без запроса счёт не показываем: «Найдено 0 товаров» читается как отказ
      countEl.textContent = query ? `Найдено ${found.length} ${plural(found.length)}` : '';
    }

    if (grid) {
      grid.hidden = found.length === 0;
      grid.innerHTML = found.map((prod) => `
        <article class="product-card">
          <a class="product-card__media" href="product.html">
            <img src="img/products/${prod.i}" width="560" height="560" alt="${escapeHtml(prod.t)}" loading="lazy">
          </a>
          <button class="product-card__fav" type="button" aria-label="В избранное"><svg><use href="#i-heart"></use></svg></button>
          <div class="product-card__info">
            <div class="product-card__price">${prod.p}${prod.old ? ` <span class="product-card__price-old">${prod.old}</span>` : ''}</div>
            <a class="product-card__title" href="product.html">${escapeHtml(prod.t)}</a>
            <button class="product-card__buy" type="button">В корзину</button>
          </div>
        </article>`).join('');
    }
    if (empty) {
      empty.hidden = found.length > 0;
      // Заход на страницу без запроса — это не «ничего не нашлось»
      const emptyTitle = $('.catalog-empty__title', empty);
      if (emptyTitle && !query) emptyTitle.textContent = 'Введите запрос';
    }
  }

  /* ---------------------------------------------------------
     Год в копирайте
     --------------------------------------------------------- */
  $$('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });
})();
