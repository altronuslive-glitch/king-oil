/* ============================================================
   store.js — состояние магазина на стороне браузера:
   корзина, избранное, история поиска.

   Статике неоткуда взять корзину и избранное, поэтому они живут
   в localStorage. Слой намеренно вынесен отдельным файлом: при
   переносе в CS-Cart он выбрасывается целиком, а main.js получает
   те же методы от бэкенда (см. docs/25-cscart-integration.md).

   Первый заход засевается демо-набором ниже, чтобы сайт открывался
   с наполненной корзиной, как в макете, но дальше жил по-настоящему.
   Набор повторяет разметку cart.html и wishlist.html.
   ============================================================ */

window.KO = (function () {
  'use strict';

  const KEY = { cart: 'ko-cart', fav: 'ko-fav', recent: 'ko-recent' };

  /* localStorage недоступен в приватном режиме — тогда работаем
     на памяти: в пределах страницы всё живое, между страницами нет */
  const memory = {};

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return key in memory ? memory[key] : fallback;
      return JSON.parse(raw);
    } catch (err) {
      return key in memory ? memory[key] : fallback;
    }
  }

  function write(key, value) {
    memory[key] = value;
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (err) { /* приватный режим */ }
  }

  function emit(name) {
    document.dispatchEvent(new CustomEvent('ko:' + name));
  }

  /* ---------------------------------------------------------
     Деньги. В разметке разряды разделены обычным пробелом
     («3 750 ₽»), toLocaleString ставит неразрывный — форматируем сами
     --------------------------------------------------------- */
  const money = {
    parse: (str) => Number(String(str).replace(/[^\d]/g, '')) || 0,
    format: (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' \u20bd',
  };

  /* «1 товар / 2 товара / 5 товаров» */
  function plural(n, forms) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return forms[0];
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
    return forms[2];
  }

  /* Запасной идентификатор позиции: название + объём. Основной — product_id
     CS-Cart из data-product-id (11.09.2026): каждый объём в каталоге — отдельный
     товар, поэтому разные объёмы и так разные позиции. Сюда попадают только
     карточки без ID */
  function productId(title, volume) {
    const base = String(title || '').toLowerCase().replace(/\s+/g, ' ').trim();
    return (volume ? base + ' | ' + String(volume).toLowerCase().trim() : base);
  }

  /* ---------------------------------------------------------
     Корзина
     --------------------------------------------------------- */
  const cart = {
    items: () => read(KEY.cart, null) || [],

    // Разметка страницы попадает в хранилище один раз, при первом заходе
    seed(items) {
      if (read(KEY.cart, null) !== null) return false;
      write(KEY.cart, items);
      return true;
    },

    add(item) {
      const items = cart.items();
      const found = items.find((i) => i.id === item.id);
      const max = Number(item.max) || Infinity;
      if (found) found.qty = Math.min(max, found.qty + (Number(item.qty) || 1));
      else items.push(Object.assign({}, item, { qty: Math.min(max, Number(item.qty) || 1) }));
      write(KEY.cart, items);
      emit('cart');
      return items;
    },

    setQty(id, qty) {
      const items = cart.items();
      const found = items.find((i) => i.id === id);
      if (!found) return items;
      const max = Number(found.max) || Infinity;
      found.qty = Math.max(1, Math.min(max, Number(qty) || 1));
      write(KEY.cart, items);
      emit('cart');
      return items;
    },

    remove(id) {
      write(KEY.cart, cart.items().filter((i) => i.id !== id));
      emit('cart');
    },

    clear() {
      write(KEY.cart, []);
      emit('cart');
    },

    has: (id) => cart.items().some((i) => i.id === id),

    // Счётчик на иконке — количество позиций, а не штук: так в макете
    count: () => cart.items().length,
    units: () => cart.items().reduce((sum, i) => sum + (Number(i.qty) || 0), 0),
    total: () => cart.items().reduce((sum, i) => sum + money.parse(i.price) * (Number(i.qty) || 0), 0),
    discount: () => cart.items().reduce((sum, i) => {
      const old = i.old ? money.parse(i.old) : 0;
      return sum + (old ? (old - money.parse(i.price)) * (Number(i.qty) || 0) : 0);
    }, 0),
  };

  /* ---------------------------------------------------------
     Избранное. Храним карточку целиком, а не один идентификатор:
     страница избранного рисуется из состояния, и товар, добавленный
     с главной или из каталога, должен на ней появиться
     --------------------------------------------------------- */
  const fav = {
    items: () => read(KEY.fav, null) || [],
    ids: () => fav.items().map((i) => i.id),

    seed(items) {
      if (read(KEY.fav, null) !== null) return false;
      write(KEY.fav, items);
      return true;
    },

    has: (id) => fav.items().some((i) => i.id === id),

    add(item) {
      const items = fav.items();
      if (!items.some((i) => i.id === item.id)) items.push(item);
      write(KEY.fav, items);
      emit('fav');
    },

    // Возвращает true, если товар добавлен, и false, если убран
    toggle(item) {
      if (fav.has(item.id)) { fav.remove(item.id); return false; }
      fav.add(item);
      return true;
    },

    remove(id) {
      write(KEY.fav, fav.items().filter((i) => i.id !== id));
      emit('fav');
    },

    count: () => fav.items().length,
  };

  /* ---------------------------------------------------------
     История поиска. В макете это блок «Вы искали» с крестиками
     --------------------------------------------------------- */
  const RECENT_LIMIT = 5;

  const recent = {
    list: () => read(KEY.recent, null) || [],
    seed(list) {
      if (read(KEY.recent, null) !== null) return false;
      write(KEY.recent, list);
      return true;
    },
    push(query) {
      const q = String(query || '').trim();
      if (!q) return;
      // Повтор запроса поднимает его наверх, а не задваивает строку
      const list = recent.list().filter((x) => x.toLowerCase() !== q.toLowerCase());
      list.unshift(q);
      write(KEY.recent, list.slice(0, RECENT_LIMIT));
      emit('recent');
    },
    remove(query) {
      write(KEY.recent, recent.list().filter((x) => x !== query));
      emit('recent');
    },
    clear() {
      write(KEY.recent, []);
      emit('recent');
    },
  };

  /* ---------------------------------------------------------
     Демо-набор для первого захода.
     Раньше корзина засевалась разметкой cart.html, а избранное —
     разметкой wishlist.html: пока туда не зайдёшь, счётчик в шапке
     на остальных страницах показывал пустоту. Теперь набор один
     и не зависит от точки входа.
     Товары — реальные позиции витрины «Омск»: id — product_id CS-Cart, названия
     и цены — из снимка docs/data/ (11.09.2026). Артикулов в каталоге нет, остаток —
     признак «есть / нет», поэтому строк «Артикул» и «Осталось N шт.» больше нет.
     TODO: интеграция — блок удаляется целиком, состав приходит с бэкенда
     --------------------------------------------------------- */
  const DEMO_CART = [
    { id: '3812', title: 'Лукойл Супер 10w40 4L', volume: '4 л',
      price: '1 490 ₽', old: '', img: 'img/products/p21.jpg',
      href: 'product.html', stock: 'В наличии', stockLow: false, max: 99, qty: 2 },
    { id: '3197', title: 'Лукойл Super 5w40 (полусинтетика) 4л.', volume: '4 л',
      price: '1 590 ₽', old: '', img: 'img/products/p22.jpg',
      href: 'product.html', stock: 'В наличии', stockLow: false, max: 99, qty: 1 },
    { id: '3810', title: 'Лукойл Люкс П/Синт 10w40 4L', volume: '4 л',
      price: '1 590 ₽', old: '', img: 'img/products/p23.jpg',
      href: 'product.html', stock: 'В наличии', stockLow: false, max: 99, qty: 1 },
  ];

  /* Чипсы объёма — соседние товары: у чужого объёма хранится его product_id,
     на странице избранного из него рисуется ссылка (js/main.js → favCardHtml) */
  const DEMO_FAV = [
    { id: '3306', title: 'Тосол FELIX 5кг.', volume: '5 кг',
      price: '890 \u20bd', old: '', img: 'img/products/p54.jpg', href: 'product.html',
      volumes: [{ label: '5 кг', id: '' }, { label: '10 кг', id: '3307' }] },
    { id: '3296', title: 'Антифриз AGA L40 сине-зеленый 5кг.', volume: '5 кг',
      price: '990 \u20bd', old: '', img: 'img/products/p55.jpg', href: 'product.html',
      volumes: [{ label: '5 кг', id: '' }] },
    { id: '3297', title: 'Антифриз AGA L42 зеленый 5кг.', volume: '5 кг',
      price: '1 050 \u20bd', old: '', img: 'img/products/p56.jpg', href: 'product.html',
      volumes: [{ label: '5 кг', id: '' }] },
    { id: '3298', title: 'Антифриз AGA L40 красный 5кг.', volume: '5 кг',
      price: '1 050 \u20bd', old: '', img: 'img/products/p57.jpg', href: 'product.html',
      volumes: [{ label: '5 кг', id: '' }] },
  ];

  const DEMO_RECENT = ['Моторное масло 5W-30', 'Castrol Magnatec', 'Антифриз G12'];

  /* ---------------------------------------------------------
     Профиль покупателя. Своей авторизации в статике нет: прототип
     везде показывает вошедшего пользователя, поэтому отдаём тот же
     набор данных, что нарисован в личном кабинете. Нужен оформлению
     заказа — контакты подставляются сами (просьба заказчика от
     10 сентября 2026, см. docs/27-pass-10-sep.md).
     TODO: интеграция — здесь встаёт текущий пользователь CS-Cart,
     у гостя метод возвращает null и поля остаются пустыми
     --------------------------------------------------------- */
  const DEMO_USER = {
    name: 'Евгений Раскудаев',
    phone: '+7 (913) 000-00-00',
    email: 'e.raskudaev@gmail.com',
    recipient: 'Организация',
    company: 'ООО «Сибавтотрейд»',
    inn: '5503193478',
  };

  const user = { get: () => DEMO_USER };

  /* Формат хранилища менялся дважды: сначала избранное хранило одни идентификаторы
     (по ним карточку не нарисовать), потом ключом позиции стал product_id CS-Cart
     вместо «название + объём» (11.09.2026). Записи старого формата сбрасываем —
     вернётся демо-набор, иначе одна и та же позиция задваивалась бы под двумя ключами */
  const outdated = (list) => Array.isArray(list)
    && list.some((x) => typeof x === 'string' || !/^\d+$/.test(String(x && x.id)));
  [KEY.cart, KEY.fav].forEach((key) => {
    if (!outdated(read(key, null))) return;
    delete memory[key];
    try { localStorage.removeItem(key); } catch (err) { /* приватный режим */ }
  });

  cart.seed(DEMO_CART);
  fav.seed(DEMO_FAV);
  recent.seed(DEMO_RECENT);

  return { money, plural, productId, cart, fav, recent, user };
})();
