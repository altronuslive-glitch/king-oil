/* ============================================================
   main.js — шапка, модалки, карусели, аккордеон, формы
   Без зависимостей.
   ============================================================ */

(function () {
  'use strict';

  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  // Экранирование для строк, которые попадают в innerHTML (названия товаров, запросы)
  const escapeHtml = (str) => String(str).replace(/[&<>"]/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]
  ));

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
    // Полноэкранная панель поиска начинается под шапкой, а её высота зависит
    // от состояния: отдаём число в CSS переменной
    document.documentElement.style.setProperty('--ko-search-top', `${header.offsetHeight}px`);
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
    // Кнопка «назад» в браузере тоже должна переключать раздел
    window.addEventListener('hashchange', () => showTab(location.hash.slice(1)));
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
      const sku = (volume && volume.dataset.sku) || link.dataset.sku;
      if (sku) params.set('sku', sku);
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
  let modalOpener = null;

  function closeModal() {
    if (!openModalEl) return;
    openModalEl.hidden = true;
    openModalEl = null;
    document.body.classList.remove('no-scroll');
    // Фокус возвращаем на кнопку, которая открыла окно: иначе после Esc он
    // оказывается в начале страницы и клавиатурой приходится идти заново
    if (modalOpener && document.contains(modalOpener)) modalOpener.focus({ preventScroll: true });
    modalOpener = null;
  }

  function openModal(name) {
    const el = $(`[data-modal="${name}"]`);
    if (!el) return;
    const opener = modalOpener;
    closeModal();
    modalOpener = opener;
    closeAllPanels();
    el.hidden = false;
    openModalEl = el;
    document.body.classList.add('no-scroll');

    // После отправки в окне остаётся экран успеха. При повторном открытии
    // (например подписка на второй товар) возвращаем форму
    const doneForm = $('[data-form]', el);
    const doneScreen = $('[data-form-success]', el);
    if (doneForm && doneScreen && !doneScreen.hidden) {
      doneScreen.hidden = true;
      doneForm.hidden = false;
      doneForm.reset();
      $$('.modal__title, .modal__subtitle', el)
        .filter((node) => !doneScreen.contains(node))
        .forEach((node) => { node.hidden = false; });
    }
    // Первое поле, а не «Закрыть»: крестик стоит в разметке раньше, и общий
    // селектор наводил фокус на него
    const first = $('input:not([type="hidden"]), textarea, select', el) || $('button', el);
    if (first) first.focus({ preventScroll: true });
  }

  /* Фокус не уходит за пределы открытого окна: Tab с последнего элемента
     возвращается на первый, Shift+Tab с первого — на последний */
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' || !openModalEl) return;
    const items = $$('a[href], button:not([disabled]), input:not([type="hidden"]), textarea, select', openModalEl)
      .filter((el) => !el.closest('[hidden]') && el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  });

  document.addEventListener('click', (e) => {
    const opener = e.target.closest('[data-modal-open]');
    if (opener) {
      e.preventDefault();
      // Внутри уже открытого окна (например «Забыли пароль?») исходную
      // кнопку не перезаписываем — возвращаться нужно к ней
      if (!openModalEl) modalOpener = opener;
      openModal(opener.dataset.modalOpen);
      return;
    }
    // клик по подложке модалки
    if (openModalEl && e.target === openModalEl) closeModal();
  });

  /* Показать/скрыть пароль. Вместе с типом поля меняется и сама иконка:
     открытый пароль — перечёркнутый глаз (макет 2099:53466) */
  document.addEventListener('click', (e) => {
    const eye = e.target.closest('[data-toggle-password]');
    if (!eye) return;
    const input = $('input', eye.parentElement);
    if (!input) return;
    const shown = input.type === 'text';
    input.type = shown ? 'password' : 'text';
    eye.setAttribute('aria-label', shown ? 'Показать пароль' : 'Скрыть пароль');
    const use = $('use', eye);
    if (use) use.setAttribute('href', shown ? '#i-eye' : '#i-eye-off');
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
     Телефон: маска +7 XXX XXX XX XX.
     В макете это плейсхолдер «+7 ___ ___ __ __», но поле принимало
     что угодно — теперь ввод приводится к формату по мере набора
     --------------------------------------------------------- */
  const PHONE_LEN = 10; // цифр после +7

  function phoneDigits(value) {
    let digits = String(value).replace(/\D/g, '');
    // 8 и 7 в начале — это код страны, а не первая цифра номера
    if (digits[0] === '8' || digits[0] === '7') digits = digits.slice(1);
    return digits.slice(0, PHONE_LEN);
  }

  function phoneFormat(value) {
    const d = phoneDigits(value);
    if (!d) return '';
    const parts = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 8), d.slice(8, 10)].filter(Boolean);
    return '+7 ' + parts.join(' ');
  }

  $$('input[type="tel"]').forEach((input) => {
    const reformat = () => {
      // Курсор держим в конце: маска дописывает пробелы, и вставлять его
      // в середину пришлось бы пересчитывать на каждый символ
      input.value = phoneFormat(input.value);
    };
    input.addEventListener('input', reformat);
    input.addEventListener('blur', reformat);
  });

  /* ---------------------------------------------------------
     Проверка форм.
     Браузерные пузыри рисует ОС, к макету их не привести, поэтому
     формы помечены novalidate, а ошибки показываем сами:
     подсветка поля (.input--error) и подпись под ним (.field__error)
     --------------------------------------------------------- */
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function fieldError(control, message) {
    /* У чекбокса подписи нет: он стоит в сетке «квадрат + текст», и подпись
       попадала в 18-пиксельную колонку, где текст ломался по букве.
       Незаполненное согласие показываем красной рамкой самого квадрата */
    if (control.type === 'checkbox') {
      control.classList.toggle('is-error', !!message);
      return;
    }

    const field = control.closest('.field') || control.parentElement;
    if (!field) return;
    let note = $('.field__error', field);
    if (message) {
      if (!note) {
        note = document.createElement('span');
        note.className = 'field__error';
        field.appendChild(note);
      }
      note.textContent = message;
      note.hidden = false;
    } else if (note) {
      note.hidden = true;
    }
    control.classList.toggle('input--error', !!message);
  }

  function validateControl(control) {
    // Поля в скрытых блоках (реквизиты компании, панели доставки) не проверяем
    if (control.disabled || control.closest('[hidden]')) return '';

    const value = String(control.value || '').trim();

    if (control.type === 'checkbox') {
      return control.required && !control.checked ? 'Отметьте согласие, чтобы продолжить' : '';
    }
    if (control.required && !value) return 'Заполните поле';
    if (!value) return '';
    if (control.type === 'email' && !EMAIL_RE.test(value)) return 'Проверьте адрес: нужен вид mail@example.com';
    if (control.type === 'tel' && phoneDigits(value).length < PHONE_LEN) return 'Номер из 10 цифр после +7';
    if (control.minLength > 0 && value.length < control.minLength) {
      return 'Не короче ' + control.minLength + ' символов';
    }
    if (control.hasAttribute('data-confirm-password')) {
      const first = $$('input[type="password"]', control.form).find((i) => i !== control);
      if (first && first.value !== value) return 'Пароли не совпадают';
    }
    return '';
  }

  function validateForm(form) {
    const controls = $$('input, textarea, select', form)
      .filter((c) => c.type !== 'hidden' && c.type !== 'submit' && c.type !== 'button');
    let firstBad = null;
    controls.forEach((control) => {
      const message = validateControl(control);
      fieldError(control, message);
      if (message && !firstBad) firstBad = control;
    });
    if (firstBad) firstBad.focus({ preventScroll: false });
    return !firstBad;
  }

  /* ---------------------------------------------------------
     Формы: проверка, заглушка отправки и экран успеха
     --------------------------------------------------------- */
  $$('[data-form]').forEach((form) => {
    form.setAttribute('novalidate', '');

    // Ошибку снимаем, как только поле поправили: держать подсветку до
    // повторной отправки — раздражает
    form.addEventListener('input', (e) => {
      if (e.target.matches('input, textarea, select') && e.target.classList.contains('input--error')) {
        fieldError(e.target, validateControl(e.target));
      }
    });
    form.addEventListener('change', (e) => {
      if (e.target.type === 'checkbox') fieldError(e.target, validateControl(e.target));
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!validateForm(form)) return;

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
      $$('.input--error', form).forEach((el) => fieldError(el, ''));
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
     Каталог: фильтры, сортировка и страницы.
     Всё считается в браузере по разметке карточек — статике неоткуда
     взять выдачу. TODO: интеграция — CS-Cart отдаёт готовую страницу,
     этот блок заменяется штатным списком товаров с Searchanise.
     --------------------------------------------------------- */
  // Пустое состояние есть только у каталога — по нему и опознаём страницу
  // (сетка .catalog-grid стоит ещё и в избранном, её трогать нельзя)
  const catalogEmpty = $('[data-catalog-empty]');
  const catalogGrid = catalogEmpty ? $('.catalog-grid') : null;

  // Состояние выдачи общее для фильтров, сортировки и страниц
  const catalog = {
    cards: [],
    page: 1,
    perPage: 8,
    sort: 'default',
    filters: {},
  };

  /* Цена карточки — у выбранного объёма: чипсы меняют её на месте */
  function cardPrice(card) {
    const active = $('.product-card__volumes .volume.is-active', card);
    if (active && active.dataset.price) return KO.money.parse(active.dataset.price);
    const box = $('.product-card__price', card);
    return box ? KO.money.parse(box.textContent) : 0;
  }

  /* Объёмы карточки — из чипсов, отдельного атрибута для них не нужно */
  function cardVolumes(card) {
    return $$('.product-card__volumes .volume', card).map((v) => v.textContent.trim());
  }

  function matchesFilters(card) {
    return Object.keys(catalog.filters).every((group) => {
      const picked = catalog.filters[group];
      if (!picked.length) return true;
      // Внутри группы — «или», между группами — «и»
      if (group === 'volume') {
        const volumes = cardVolumes(card);
        return picked.some((v) => volumes.indexOf(v) !== -1);
      }
      return picked.indexOf(card.dataset[group] || '') !== -1;
    });
  }

  function renderCatalog() {
    if (!catalogGrid) return;

    const found = catalog.cards.filter(matchesFilters);

    const sorted = found.slice();
    if (catalog.sort === 'price') sorted.sort((a, b) => cardPrice(a) - cardPrice(b));
    // Даты поступления в статике нет: новизна — обратный порядок каталога.
    // TODO: интеграция — сортировка уходит на бэкенд вместе с запросом выдачи
    if (catalog.sort === 'new') sorted.reverse();

    const shown = sorted.slice((catalog.page - 1) * catalog.perPage, catalog.page * catalog.perPage);

    catalog.cards.forEach((card) => { card.hidden = true; });
    shown.forEach((card, i) => {
      card.hidden = false;
      card.style.order = String(i);
    });

    catalogGrid.hidden = found.length === 0;
    if (catalogEmpty) catalogEmpty.hidden = found.length > 0;

    $$('[data-catalog-count]').forEach((el) => {
      el.textContent = found.length
        ? 'Найдено ' + found.length + ' ' + KO.plural(found.length, ['товар', 'товара', 'товаров'])
        : '';
    });

    renderPagination(found.length);
    renderBuyState();
    renderFavState();
  }

  /* Пагинация рисуется из реального числа страниц: длинный ряд с многоточием
     из макета появится, когда выдачу начнёт отдавать бэкенд */
  function renderPagination(total) {
    const nav = $('[data-pagination]');
    const row = $('[data-pagination-row]');
    const more = $('[data-catalog-more]');
    if (!nav) return;

    const pages = Math.ceil(total / catalog.perPage);
    if (more) more.hidden = catalog.page >= pages;
    if (row) row.hidden = pages <= 1;
    if (pages <= 1) { nav.innerHTML = ''; return; }

    // Больше семи страниц — прячем середину под многоточие, как в макете
    let list = [];
    if (pages <= 7) {
      for (let i = 1; i <= pages; i += 1) list.push(i);
    } else if (catalog.page <= 4) {
      list = [1, 2, 3, 4, 5, '…', pages];
    } else if (catalog.page >= pages - 3) {
      list = [1, '…', pages - 4, pages - 3, pages - 2, pages - 1, pages];
    } else {
      list = [1, '…', catalog.page - 1, catalog.page, catalog.page + 1, '…', pages];
    }

    const items = list.map((n) => (n === '…'
      ? '<span class="pagination__item pagination__dots">…</span>'
      : '<button class="pagination__item' + (n === catalog.page ? ' is-active' : '')
        + '" type="button" data-page="' + n + '"'
        + (n === catalog.page ? ' aria-current="page"' : '') + '>' + n + '</button>'));

    if (catalog.page < pages) {
      items.push('<button class="pagination__item pagination__next" type="button" data-page="'
        + (catalog.page + 1) + '">Дальше →</button>');
    }
    nav.innerHTML = items.join('');
  }

  function goToPage(page) {
    catalog.page = page;
    renderCatalog();
    // Возврат к началу сетки, а не к началу страницы: шапка и фильтры остаются в кадре
    if (catalogGrid) {
      const top = catalogGrid.getBoundingClientRect().top + window.scrollY - 160;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  }

  if (catalogGrid) {
    catalog.cards = $$('.product-card', catalogGrid);

    const nav = $('[data-pagination]');
    if (nav) {
      nav.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-page]');
        if (btn) goToPage(Number(btn.dataset.page));
      });
    }

    // «Показать ещё» досыпает следующую страницу, а не открывает её отдельно
    const more = $('[data-catalog-more]');
    if (more) {
      more.addEventListener('click', () => {
        catalog.perPage += 8;
        catalog.page = 1;
        renderCatalog();
      });
    }
  }

  /* ---------------------------------------------------------
     Каталог: строка фильтров и шторка на мобильном
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
      const chip = e.target.closest('[data-chip-remove]');
      if (chip) {
        const input = $(`input[value="${chip.dataset.chipRemove}"]`, root);
        if (input) input.checked = false;
        applyFilters();
        return;
      }
      if (e.target.closest('[data-filters-reset]')) {
        $$('[data-select] input:checked', root).forEach((i) => { i.checked = false; });
        applyFilters();
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
        `<button class="chip chip--removable" type="button" data-chip-remove="${escapeHtml(v)}">`
        + `${escapeHtml(v)} <svg><use href="#i-close"></use></svg></button>`).join('');
      if (reset) {
        active.appendChild(reset);
        reset.hidden = !picked.length;
      }
      active.hidden = !picked.length;
    }

    // Отмеченные чекбоксы → состояние выдачи. Смена набора возвращает на первую страницу
    function applyFilters() {
      const next = {};
      $$('[data-filter]', root).forEach((group) => {
        next[group.dataset.filter] = $$('input:checked', group).map((i) => i.value);
      });
      catalog.filters = next;
      catalog.page = 1;
      renderChips();
      renderCatalog();
    }

    root.addEventListener('change', (e) => {
      if (e.target.matches('[data-select] input[type="checkbox"]')) applyFilters();
    });
    applyFilters();
  });

  /* ---------------------------------------------------------
     Каталог: дропдаун сортировки
     --------------------------------------------------------- */
  $$('[data-sort]').forEach((root) => {
    const btn = $('[data-sort-btn]', root);
    const panelEl = $('[data-sort-panel]', root);
    if (!btn || !panelEl) return;

    const label = $('[data-sort-label]', btn) || btn;

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
      // Выбранный вариант выносим в подпись кнопки: иначе текущую сортировку
      // видно только с открытой панелью
      label.textContent = option.textContent.trim();
      catalog.sort = option.dataset.sort || 'default';
      catalog.page = 1;
      renderCatalog();
      close();
    });

    document.addEventListener('click', (e) => { if (!e.target.closest('[data-sort]')) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
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

  /* Цена, старая цена, скидка, артикул и единица — свои у каждого объёма */
  function applyVolumePrice(tab, info) {
    const volume = tab.textContent.trim();
    const now = tab.dataset.price;
    const old = tab.dataset.old;

    const nowEl   = $('.product-info__price-now', info);
    const oldEl   = $('.product-info__price-old', info);
    const unitEl  = $('.product-info__price-unit', info);
    const badgeEl = $('[data-sale-badge]', info);
    const skuEl   = $('[data-sku-value]', info);
    const tagEl   = $('[data-volume-tag]', info);

    if (nowEl && now) nowEl.textContent = now;
    if (unitEl) unitEl.textContent = '/ ' + volume;
    if (tagEl) tagEl.textContent = volume.toUpperCase();
    if (skuEl && tab.dataset.sku) skuEl.textContent = tab.dataset.sku;

    if (oldEl) {
      oldEl.textContent = old || '';
      oldEl.hidden = !old;
    }
    // Процент считаем, а не храним: иначе он разъедется с ценами варианта
    if (badgeEl) {
      const nowValue = KO.money.parse(now);
      const oldValue = KO.money.parse(old);
      const off = oldValue > nowValue ? Math.round((oldValue - nowValue) / oldValue * 100) : 0;
      badgeEl.hidden = off === 0;
      if (off) badgeEl.textContent = '−' + off + ' %';
    }
  }

  /* Объём — вариант одного товара: клик меняет цену, артикул, единицу и наличие
     на месте, без перехода на другую страницу (решение №37 от 4 сентября).
     У закончившегося варианта строка наличия становится серой, «В корзину»
     и степпер прячутся, вместо них — «Уведомить о поступлении».
     Состояния «нет в наличии» в макете нет — см. docs/22-stock-states.md */
  function applyStock(tab) {
    const info = tab.closest('.product-info');
    if (!info) return;

    applyVolumePrice(tab, info);

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
  /* Функцией, а не разовым проходом: строки корзины перерисовываются
     из состояния, и новым степперам тоже нужны обработчики.
     О смене количества сообщаем событием ko:qty — его слушает корзина */
  function initSteppers(ctx) {
    $$('[data-stepper]', ctx || document).forEach((root) => {
      if (root.dataset.stepperReady) return;
      root.dataset.stepperReady = '1';

      const input = $('input', root);
      if (!input) return;

      const min = Number(input.min) || 1;
      const max = Number(input.max) || Infinity;

      const clamp = (notify) => {
        const before = input.value;
        const value = Math.min(max, Math.max(min, Number(input.value) || min));
        input.value = String(value);
        $$('[data-step]', root).forEach((btn) => {
          const next = value + Number(btn.dataset.step);
          btn.disabled = next < min || next > max;
        });
        if (notify) {
          root.dispatchEvent(new CustomEvent('ko:qty', { bubbles: true, detail: { value } }));
        }
        return before;
      };

      root.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-step]');
        if (!btn || btn.disabled) return;
        input.value = String(Number(input.value) + Number(btn.dataset.step));
        clamp(true);
      });
      input.addEventListener('change', () => clamp(true));
      clamp(false);
    });
  }

  initSteppers(document);

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
     Магазин: корзина и избранное.
     Состояние живёт в js/store.js (localStorage) — при переносе
     в CS-Cart этот слой заменяется корзиной движка, разметка
     и обработчики остаются те же.
     Страниц корзины и избранного в макете нет, поведение стандартное.
     --------------------------------------------------------- */

  // Цифры взяты со страницы «Доставка» (delivery.html), чтобы корзина
  // и раздел доставки не расходились
  const COURIER_PRICE = 200;   // курьер по городу
  const TK_PRICE = 300;        // ТК до порога: на странице «300–1000 ₽», берём нижнюю границу
  const FREE_FROM = 5000;      // от этой суммы отправка ТК бесплатна

  /* Промокоды: статике проверять негде, поэтому таблица зашита здесь.
     TODO: интеграция — код уходит на проверку бэкенду, скидка приходит ответом */
  const PROMO_CODES = {
    KINGOIL10: { percent: 10, label: 'Промокод применён: −10% на заказ' },
    OIL500:    { amount: 500, label: 'Промокод применён: −500 ₽' },
  };
  const PROMO_KEY = 'ko-promo';

  function readPromo() {
    try { return JSON.parse(localStorage.getItem(PROMO_KEY)) || null; } catch (err) { return null; }
  }
  function writePromo(value) {
    try {
      if (value) localStorage.setItem(PROMO_KEY, JSON.stringify(value));
      else localStorage.removeItem(PROMO_KEY);
    } catch (err) { /* приватный режим */ }
  }

  /* Карточка товара в разметке → позиция корзины.
     Читаем из DOM, а не из data-атрибутов: карточка одна и та же
     на главной, в каталоге, в избранном и в «похожих» */
  function cardData(card) {
    const titleEl = $('.product-card__title', card);
    const title = (titleEl ? titleEl.textContent : '').trim();
    const img = $('.product-card__media img', card);
    const activeVolume = $('.product-card__volumes .volume.is-active', card);
    const volume = activeVolume ? activeVolume.textContent.trim() : '';
    const priceBox = $('.product-card__price', card);
    // Цена лежит первым текстовым узлом: рядом может стоять зачёркнутая старая
    const priceNode = priceBox && [...priceBox.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
    const old = priceBox && $('.product-card__price-old', priceBox);
    return {
      id: KO.productId(title, volume),
      title,
      volume,
      // Чипсы объёма нужны, чтобы карточку можно было нарисовать заново
      // на странице избранного
      volumes: $$('.product-card__volumes .volume', card)
        .map((v) => ({ label: v.textContent.trim(), price: v.dataset.price || '' })),
      price: priceNode ? priceNode.textContent.trim() : (priceBox ? priceBox.textContent.trim() : '0'),
      old: old ? old.textContent.trim() : '',
      img: img ? img.getAttribute('src') : '',
      href: titleEl ? titleEl.getAttribute('href') : 'product.html',
      qty: 1,
    };
  }

  /* Разметка карточки для страницы избранного: сердце здесь убирает товар,
     поэтому у него data-wish-remove и класс is-active */
  function favCardHtml(item) {
    const href = escapeHtml(item.href || 'product.html');
    const volumes = (item.volumes || []).map((v) =>
      '<button class="volume' + (v.label === item.volume ? ' is-active' : '') + '" type="button"'
      + (v.price ? ' data-price="' + escapeHtml(v.price) + '"' : '') + '>'
      + escapeHtml(v.label) + '</button>').join('');
    return '<article class="product-card" data-fav-id="' + escapeHtml(item.id) + '">'
      + '<a class="product-card__media" href="' + href + '">'
      + '<img src="' + escapeHtml(item.img) + '" width="560" height="560" alt="'
      + escapeHtml(item.title) + '" loading="lazy"></a>'
      + '<button class="product-card__fav is-active" type="button" data-wish-remove'
      + ' aria-label="Убрать из избранного"><svg><use href="#i-heart"></use></svg></button>'
      + '<div class="product-card__info">'
      + '<div class="product-card__price">' + escapeHtml(item.price)
      + (item.old ? ' <span class="product-card__price-old">' + escapeHtml(item.old) + '</span>' : '')
      + '</div>'
      + '<a class="product-card__title" href="' + href + '">' + escapeHtml(item.title) + '</a>'
      + (volumes ? '<div class="product-card__volumes">' + volumes + '</div>' : '')
      + '<button class="product-card__buy" type="button">В корзину</button>'
      + '</div></article>';
  }

  /* Счётчики на иконках шапки и таббара. Ноль не показываем —
     по макету бейдж появляется только при непустой корзине */
  function renderBadges() {
    const inCart = KO.cart.count();
    const inFav = KO.fav.count();
    $$('[data-cart-count]').forEach((el) => { el.textContent = String(inCart); el.hidden = inCart === 0; });
    $$('[data-fav-count]').forEach((el) => { el.textContent = String(inFav); el.hidden = inFav === 0; });
    // Пустая корзина в шапке серая, как остальные иконки (вариант Add=Yes в макете)
    $$('[data-cart-link]').forEach((el) => el.classList.toggle('is-filled', inCart > 0));
  }

  /* Сердце в карточке подсвечено, если товар уже в избранном */
  function renderFavState() {
    $$('.product-card').forEach((card) => {
      const btn = $('.product-card__fav', card);
      if (!btn || btn.hasAttribute('data-wish-remove')) return;
      const on = KO.fav.has(cardData(card).id);
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-label', on ? 'Убрать из избранного' : 'В избранное');
    });
  }

  /* Кнопка «В корзину» показывает, что товар уже добавлен.
     У закончившегося товара на её месте «Уведомить о поступлении» —
     такую кнопку не трогаем, иначе подпись затрётся на «В корзину» */
  function renderBuyState() {
    $$('.product-card').forEach((card) => {
      const btn = $('.product-card__buy:not(.product-card__buy--out)', card);
      if (!btn) return;
      const inCart = KO.cart.has(cardData(card).id);
      btn.classList.toggle('is-added', inCart);
      btn.textContent = inCart ? 'В корзине' : 'В корзину';
    });
  }

  /* Клик по «В корзину» и по сердцу — общий обработчик на документе:
     карточки появляются динамически (выдача поиска, фильтры каталога) */
  document.addEventListener('click', (e) => {
    const buy = e.target.closest('.product-card__buy:not(.product-card__buy--out)');
    if (buy) {
      const card = buy.closest('.product-card');
      if (!card) return;
      const item = cardData(card);
      // Повторный клик по уже добавленному товару ведёт в корзину
      if (KO.cart.has(item.id)) { window.location.href = 'cart.html'; return; }
      KO.cart.add(item);
      return;
    }

    // На странице избранного у сердца своя роль — убрать карточку
    const fav = e.target.closest('.product-card__fav:not([data-wish-remove])');
    if (fav) {
      const card = fav.closest('.product-card');
      if (card) KO.fav.toggle(cardData(card));
    }
  });

  /* Подписка на поступление: в форму подставляем товар, ради которого её открыли */
  document.addEventListener('click', (e) => {
    const opener = e.target.closest('[data-modal-open="notify"]');
    if (!opener) return;

    const card = opener.closest('.product-card');
    const info = opener.closest('.product-info');
    let name = '';
    if (card) {
      const title = $('.product-card__title', card);
      const volume = $('.product-card__volumes .volume.is-active', card);
      name = (title ? title.textContent.trim() : '') + (volume ? ', ' + volume.textContent.trim() : '');
    } else if (info) {
      const heading = $('h1');
      const tab = $('[data-tabs] [data-tab].is-active', info);
      name = (heading ? heading.textContent.trim() : '') + (tab ? ', ' + tab.textContent.trim() : '');
    }
    $$('[data-notify-product]').forEach((el) => { el.textContent = name || 'товар'; });
  });

  /* Карточка товара: «В корзину» берёт выбранный объём и количество */
  const productAdd = $('[data-add-to-cart]');
  if (productAdd) {
    productAdd.addEventListener('click', () => {
      const info = productAdd.closest('.product-info') || document;
      const tab = $('[data-tabs] [data-tab].is-active', info);
      const qty = $('.stepper__input', info);
      const priceNow = $('.product-info__price-now', info);
      const priceOld = $('.product-info__price-old', info);
      const heading = $('h1');
      const img = $('.gallery__main img');
      const oneClick = $('[data-buy-now]', info);
      const title = (heading ? heading.textContent : '').trim();
      const item = {
        id: KO.productId(title, tab ? tab.textContent.trim() : ''),
        title,
        volume: tab ? tab.textContent.trim() : '',
        sku: (tab && tab.dataset.sku) || (oneClick && oneClick.dataset.sku) || '',
        price: priceNow ? priceNow.textContent.trim() : '0',
        old: priceOld ? priceOld.textContent.trim() : '',
        img: img ? img.getAttribute('src') : '',
        href: 'product.html',
        max: tab && tab.dataset.stock ? Number(tab.dataset.stock) : 99,
        qty: qty ? Number(qty.value) || 1 : 1,
      };
      KO.cart.add(item);
      productAdd.textContent = 'В корзине';
      productAdd.classList.add('is-added');
    });
  }

  /* ---------------------------------------------------------
     Страница корзины: список рисуется из состояния
     --------------------------------------------------------- */
  const cartList = $('[data-cart-list]');
  if (cartList) {
    const cartEmpty = $('[data-cart-empty]');
    const cartSummary = $('[data-cart-summary]');

    const cartRowHtml = (item) => {
      const sum = KO.money.format(KO.money.parse(item.price) * item.qty);
      const stockClass = item.stockLow ? ' cart-row__stock--low' : '';
      const name = item.title + (item.volume ? ', ' + item.volume : '');
      const href = escapeHtml(item.href || 'product.html');
      return '<article class="cart-row" data-cart-id="' + escapeHtml(item.id) + '">'
        + '<a class="cart-row__media" href="' + href + '"><img src="' + escapeHtml(item.img)
        + '" width="560" height="560" alt="' + escapeHtml(name) + '" loading="lazy"></a>'
        + '<div class="cart-row__info">'
        + '<a class="cart-row__title" href="' + href + '">' + escapeHtml(name) + '</a>'
        + '<p class="cart-row__meta">' + (item.sku ? 'Артикул ' + escapeHtml(item.sku) : '') + '</p>'
        + '<p class="cart-row__stock' + stockClass + '">' + escapeHtml(item.stock || 'В наличии') + '</p>'
        + '</div>'
        + '<p class="cart-row__unit"><span class="cart-row__label">Цена</span>' + escapeHtml(item.price) + '</p>'
        + '<div class="stepper stepper--sm" data-stepper>'
        + '<button class="stepper__btn" type="button" data-step="-1" aria-label="Меньше"><svg><use href="#i-minus"></use></svg></button>'
        + '<input class="stepper__input" type="number" value="' + item.qty + '" min="1" max="' + (item.max || 99) + '" aria-label="Количество">'
        + '<button class="stepper__btn stepper__btn--plus" type="button" data-step="1" aria-label="Больше"><svg><use href="#i-plus"></use></svg></button>'
        + '</div>'
        + '<p class="cart-row__price"><span class="cart-row__label">Сумма</span>' + sum + '</p>'
        + '<button class="cart-row__remove" type="button" data-cart-remove aria-label="Убрать из корзины"><svg><use href="#i-close"></use></svg></button>'
        + '</article>';
    };

    const renderCart = () => {
      const items = KO.cart.items();
      $$('.cart-row', cartList).forEach((row) => row.remove());
      const head = $('.cart-head', cartList);
      const html = items.map(cartRowHtml).join('');
      if (head) head.insertAdjacentHTML('afterend', html);
      else cartList.insertAdjacentHTML('afterbegin', html);

      cartList.hidden = items.length === 0;
      if (cartEmpty) cartEmpty.hidden = items.length > 0;
      if (cartSummary) cartSummary.hidden = items.length === 0;
      initSteppers(cartList);
    };

    cartList.addEventListener('click', (e) => {
      if (e.target.closest('[data-cart-clear]')) { KO.cart.clear(); return; }
      const btn = e.target.closest('[data-cart-remove]');
      if (!btn) return;
      const row = btn.closest('[data-cart-id]');
      if (row) KO.cart.remove(row.dataset.cartId);
    });

    // Степпер строки правит количество в состоянии, а не только в поле
    cartList.addEventListener('ko:qty', (e) => {
      const row = e.target.closest('[data-cart-id]');
      if (row) KO.cart.setQty(row.dataset.cartId, e.detail.value);
    });

    document.addEventListener('ko:cart', renderCart);
    renderCart();
  }

  /* ---------------------------------------------------------
     Итоги заказа — общие для корзины и оформления
     --------------------------------------------------------- */
  function shippingCost() {
    const picked = $$('input[name="shipping"]').find((i) => i.checked);
    const method = picked ? picked.value : 'courier';
    if (method === 'pickup') return 0;
    if (method === 'tk') return KO.cart.total() >= FREE_FROM ? 0 : TK_PRICE;
    return COURIER_PRICE;
  }

  function promoDiscount(subtotal) {
    const promo = readPromo();
    const rule = promo && PROMO_CODES[promo.code];
    if (!rule) return 0;
    return rule.percent ? Math.round(subtotal * rule.percent / 100) : Math.min(rule.amount, subtotal);
  }

  function renderTotals() {
    const items = KO.cart.items();
    const units = KO.cart.units();
    const subtotal = KO.cart.total();
    const discount = KO.cart.discount() + promoDiscount(subtotal);
    const shipping = shippingCost();

    $$('[data-total-items-label]').forEach((el) => {
      el.textContent = 'Товары, ' + units + ' шт.';
    });
    $$('[data-total-items]').forEach((el) => { el.textContent = KO.money.format(subtotal); });
    $$('[data-total-discount-row]').forEach((el) => { el.hidden = discount === 0; });
    $$('[data-total-discount]').forEach((el) => { el.textContent = '−' + KO.money.format(discount); });
    $$('[data-total-shipping]').forEach((el) => {
      el.textContent = shipping === 0 ? 'бесплатно' : KO.money.format(shipping);
    });
    $$('[data-total-grand]').forEach((el) => {
      el.textContent = KO.money.format(Math.max(0, subtotal - discount) + shipping);
    });

    // Плашка про бесплатную отправку в регионы: считаем, сколько не хватает
    $$('[data-free-shipping-note]').forEach((el) => {
      const left = FREE_FROM - subtotal;
      el.innerHTML = left > 0
        ? 'До бесплатной доставки в регионы не хватает <b>' + KO.money.format(left) + '</b> по маслам и фильтрам.'
        : 'Отправка транспортной компанией в регионы для этого заказа <b>бесплатна</b>.';
    });

    // Состав заказа на оформлении
    $$('[data-cart-items]').forEach((box) => {
      box.innerHTML = items.map((i) => {
        const name = i.title + (i.volume ? ', ' + i.volume : '');
        return '<li><span>' + escapeHtml(name) + ' × ' + i.qty + '</span>'
          + '<span>' + KO.money.format(KO.money.parse(i.price) * i.qty) + '</span></li>';
      }).join('');
    });
  }

  /* Промокод */
  const promoForm = $('[data-promo]');
  if (promoForm) {
    const promoNote = $('[data-promo-note]');
    const promoInput = $('input', promoForm);
    const savedPromo = readPromo();

    const showPromoNote = (text, ok) => {
      if (!promoNote) return;
      promoNote.hidden = !text;
      promoNote.textContent = text;
      promoNote.classList.toggle('cart__promo-note--ok', !!ok);
    };

    if (savedPromo && PROMO_CODES[savedPromo.code]) {
      if (promoInput) promoInput.value = savedPromo.code;
      showPromoNote(PROMO_CODES[savedPromo.code].label, true);
    }

    promoForm.addEventListener('submit', (e) => {
      e.preventDefault();
      // TODO: интеграция — код проверяет бэкенд, здесь зашитая таблица
      const code = (promoInput.value || '').trim().toUpperCase();
      const rule = PROMO_CODES[code];
      if (!code) {
        writePromo(null);
        promoInput.classList.remove('input--error');
        showPromoNote('', false);
      } else if (rule) {
        writePromo({ code });
        promoInput.classList.remove('input--error');
        showPromoNote(rule.label, true);
      } else {
        writePromo(null);
        promoInput.classList.add('input--error');
        showPromoNote('Промокод не найден или больше не действует', false);
      }
      renderTotals();
    });
  }

  document.addEventListener('ko:cart', () => { renderTotals(); renderBadges(); renderBuyState(); });
  document.addEventListener('ko:fav', () => { renderBadges(); renderFavState(); });
  $$('input[name="shipping"]').forEach((i) => i.addEventListener('change', renderTotals));

  /* Пустая корзина и пустое избранное открывают мини-модалку вместо перехода
     (docs/02-header.md, «Пустая корзина / пустое избранное») */
  document.addEventListener('click', (e) => {
    const cartLink = e.target.closest('[data-cart-link]');
    if (cartLink && KO.cart.count() === 0 && panels['cart-empty']) {
      e.preventDefault();
      togglePanel('cart-empty');
      return;
    }
    const favLink = e.target.closest('[data-fav-link]');
    if (favLink && KO.fav.count() === 0 && panels['fav-empty']) {
      e.preventDefault();
      togglePanel('fav-empty');
    }
  });

  /* ---------------------------------------------------------
     Страница избранного: карточки берутся из состояния
     --------------------------------------------------------- */
  const wishlist = $('[data-wishlist]');
  if (wishlist) {
    const wishGrid = $('.catalog-grid', wishlist);
    const wishEmpty = $('[data-wishlist-empty]', wishlist);

    /* Сетку рисуем из состояния, а не прячем свёрстанные карточки: иначе
       товар, добавленный с главной или из каталога, показать нечем —
       счётчик в шапке показывал число, а страница оставалась пустой */
    const renderWishlist = () => {
      if (!wishGrid) return;
      const items = KO.fav.items();
      wishGrid.innerHTML = items.map((item) => favCardHtml(item)).join('');
      wishGrid.hidden = items.length === 0;
      if (wishEmpty) wishEmpty.hidden = items.length > 0;
      renderBuyState();
    };

    wishlist.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-wish-remove]');
      if (!btn) return;
      const card = btn.closest('.product-card');
      if (card) KO.fav.remove(card.dataset.favId);
    });

    document.addEventListener('ko:fav', renderWishlist);
    renderWishlist();
  }

  renderTotals();
  renderBadges();
  renderFavState();
  renderBuyState();

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
    return { address: main.address, hours: main.hours };
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
     Чипсы объёма в плитке каталога.
     Объём — вариант одного товара, поэтому цена меняется на месте,
     без перехода на другую страницу (решение от 4 сентября).
     --------------------------------------------------------- */
  document.addEventListener('click', (e) => {
    const chip = e.target.closest('.volume');
    if (!chip) return;
    const row = chip.closest('.product-card__volumes');
    $$('.volume', row).forEach((b) => b.classList.toggle('is-active', b === chip));
    const card = chip.closest('.product-card');
    const price = card && $('.product-card__price', card);
    if (price && chip.dataset.price) {
      // цену держим в первом текстовом узле, чтобы не потерять зачёркнутую старую
      const node = [...price.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
      if (node) node.textContent = chip.dataset.price + ' ';
    }
    // У каждого объёма своя позиция в корзине и своё избранное — пересобираем состояния
    renderBuyState();
    renderFavState();
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
        if (groupRecent) groupRecent.hidden = KO.recent.list().length === 0;
        if (groupPopular) groupPopular.hidden = false;
        if (blockLive) blockLive.hidden = true;
        if (blockEmpty) blockEmpty.hidden = true;
        if (blockSuggest) blockSuggest.hidden = true;
        return;
      }

      const found = searchProducts(q);
      // При пустой выдаче история остаётся под плашкой, популярные товары уходят
      if (blockDefault) blockDefault.hidden = found.length > 0;
      if (groupRecent) groupRecent.hidden = KO.recent.list().length === 0;
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

    // Enter и лупа ведут на страницу выдачи; пустой запрос не отправляем,
    // отправленный — попадает в историю
    search.addEventListener('submit', (e) => {
      const q = searchInput.value.trim();
      if (!q) { e.preventDefault(); return; }
      KO.recent.push(q);
    });

    /* История запросов — из состояния, а не из разметки: раньше три строки
       стояли в HTML и «удаление» не переживало перезагрузку страницы */
    const recentList = $('[data-search-recent-list]', searchPanel);

    function renderRecent() {
      if (!recentList) return;
      const list = KO.recent.list();
      recentList.innerHTML = list.map((q) =>
        '<span class="search__row" data-search-recent>'
        + '<a href="search.html?q=' + encodeURIComponent(q) + '">' + escapeHtml(q) + '</a>'
        + '<button type="button" data-search-forget="' + escapeHtml(q) + '" aria-label="Убрать запрос из истории">'
        + '<svg><use href="#i-close"></use></svg></button></span>').join('');
      if (groupRecent) groupRecent.hidden = list.length === 0;
    }

    // «Очистить» убирает историю целиком, крестик — одну строку
    const clearRecent = $('[data-search-clear-recent]', searchPanel);
    if (clearRecent) clearRecent.addEventListener('click', () => KO.recent.clear());

    searchPanel.addEventListener('click', (e) => {
      const forget = e.target.closest('[data-search-forget]');
      if (!forget) return;
      e.preventDefault();
      KO.recent.remove(forget.dataset.searchForget);
    });

    document.addEventListener('ko:recent', () => { renderRecent(); renderSearch(); });
    renderRecent();
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

  /* Дата заказа. TODO: интеграция — приходит с заказом, здесь ставим сегодняшнюю,
     чтобы страница подтверждения не показывала прошлогоднее число */
  const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  $$('[data-order-date]').forEach((el) => {
    const d = new Date();
    el.textContent = d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  });
})();
