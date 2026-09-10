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

  /* Идентификатор позиции: название + объём. Разные объёмы одного
     товара — разные позиции корзины (решение №37 от 4 сентября) */
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
     Избранное — только идентификаторы, карточки рисует страница
     --------------------------------------------------------- */
  const fav = {
    ids: () => read(KEY.fav, null) || [],
    seed(ids) {
      if (read(KEY.fav, null) !== null) return false;
      write(KEY.fav, ids);
      return true;
    },
    has: (id) => fav.ids().indexOf(id) !== -1,
    toggle(id) {
      const ids = fav.ids();
      const at = ids.indexOf(id);
      if (at === -1) ids.push(id); else ids.splice(at, 1);
      write(KEY.fav, ids);
      emit('fav');
      return at === -1;
    },
    remove(id) {
      write(KEY.fav, fav.ids().filter((x) => x !== id));
      emit('fav');
    },
    count: () => fav.ids().length,
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
     TODO: интеграция — блок удаляется целиком, состав приходит с бэкенда
     --------------------------------------------------------- */
  const DEMO_CART = [
    { id: 'лукойл супер 10w40 4l', title: 'Лукойл Супер 10w40 4L', volume: '',
      sku: '15C9C3', price: '2 990 ₽', old: '', img: 'img/products/p21.jpg',
      href: 'product.html', stock: 'В наличии', stockLow: false, max: 18, qty: 2 },
    { id: 'лукойл super 5w40 (полусинтетика) 4л.', title: 'Лукойл Super 5w40 (полусинтетика) 4л.', volume: '',
      sku: '44A1B7', price: '1 340 ₽', old: '', img: 'img/products/p22.jpg',
      href: 'product.html', stock: 'В наличии', stockLow: false, max: 24, qty: 1 },
    { id: 'лукойл люкс п/синт 10w40 4l', title: 'Лукойл Люкс П/Синт 10w40 4L', volume: '',
      sku: '08F2D5', price: '690 ₽', old: '', img: 'img/products/p23.jpg',
      href: 'product.html', stock: 'Осталось 3 шт.', stockLow: true, max: 3, qty: 1 },
  ];

  const DEMO_FAV = [
    'тосол felix 5кг. | 3 л',
    'антифриз aga l40 сине-зеленый 5кг. | 3 л',
    'антифриз aga l42 зеленый 5кг. | 3 л',
    'антифриз aga l40 красный 5кг. | 3 л',
  ];

  const DEMO_RECENT = ['Моторное масло 5W-30', 'Castrol EDGE', 'Антифриз G12'];

  cart.seed(DEMO_CART);
  fav.seed(DEMO_FAV);
  recent.seed(DEMO_RECENT);

  return { money, plural, productId, cart, fav, recent };
})();
