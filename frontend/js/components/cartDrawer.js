import { getCart, setQty, removeFromCart, clearCart, subscribe } from '../state/cart.js';
import { formatPrice, esc } from '../utils/format.js';

let drawerEl = null;
let lastFocus = null;

export function mountCartDrawer(root) {
  root.innerHTML = `
    <div class="cart-drawer" data-cart-drawer>
      <div class="cart-overlay" data-cart-close></div>
      <aside class="cart-panel" data-theme="paper" role="dialog" aria-modal="true" aria-label="Корзина">
        <div class="cart-head">
          <h2>Корзина</h2>
          <button class="nav-btn" data-cart-close>Закрыть</button>
        </div>
        <div class="cart-body" data-cart-body></div>
        <div class="cart-foot" data-cart-foot></div>
      </aside>
    </div>
  `;

  drawerEl = root.querySelector('[data-cart-drawer]');
  drawerEl.inert = true;
  root.querySelectorAll('[data-cart-close]').forEach((el) => el.addEventListener('click', closeCart));

  const body = root.querySelector('[data-cart-body]');
  const foot = root.querySelector('[data-cart-foot]');

  const render = (cart) => {
    // Re-rendering replaces the buttons, so put keyboard focus back on the
    // control that was just used (or the nearest thing left).
    const focused = body.contains(document.activeElement) ? document.activeElement : null;
    const focusKey = focused && {
      index: focused.closest('[data-index]')?.dataset.index,
      control: ['data-qty-up', 'data-qty-down', 'data-remove'].find((attr) => focused.hasAttribute(attr)),
    };
    paint(cart);
    if (!focusKey) return;
    const line = body.querySelector(`[data-index="${focusKey.index}"]`) || body.querySelector('[data-index]');
    const target = line?.querySelector(`[${focusKey.control}]:not(:disabled)`) || line?.querySelector('[data-qty-down]');
    (target || drawerEl.querySelector('.cart-head [data-cart-close]')).focus({ preventScroll: true });
  };

  const paint = ({ items, total, notice }) => {
    const noticeHtml = notice ? `<p class="cart-notice" role="status">${esc(notice)}</p>` : '';

    if (items.length === 0) {
      body.innerHTML = `
        ${noticeHtml}
        <div class="cart-empty">
          <p>Пока<br />пусто</p>
          <a class="link" href="/shop/">В магазин</a>
        </div>`;
      foot.hidden = true;
      return;
    }

    body.innerHTML =
      noticeHtml +
      items
        .map(
          (item, i) => `
      <div class="cart-line" data-index="${i}">
        <a class="cart-line-media" href="/product/${esc(item.slug)}/" tabindex="-1" aria-hidden="true">
          ${item.image ? `<img src="${esc(item.image)}" alt="" loading="lazy" />` : ''}
        </a>
        <div class="cart-line-info">
          <div class="cart-line-top">
            <a href="/product/${esc(item.slug)}/">${esc(item.name)}</a>
            <span class="cart-line-price">${formatPrice(item.price * item.qty)}</span>
          </div>
          <span class="mono">${esc(item.color)} / размер ${esc(item.size)}</span>
          <div class="cart-line-controls">
            <button class="qty-btn" data-qty-down aria-label="Уменьшить количество: ${esc(item.name)}">−</button>
            <span class="qty-value" aria-label="Количество">${item.qty}</span>
            <button class="qty-btn" data-qty-up aria-label="Увеличить количество: ${esc(item.name)}" ${item.qty >= item.limit ? 'disabled' : ''}>+</button>
            <button class="cart-remove mono" data-remove>Удалить</button>
          </div>
        </div>
      </div>`
        )
        .join('');

    body.querySelectorAll('[data-index]').forEach((lineEl) => {
      const item = items[Number(lineEl.dataset.index)];
      lineEl.querySelector('[data-qty-up]').addEventListener('click', () => setQty(item.id, item.size, item.qty + 1));
      lineEl.querySelector('[data-qty-down]').addEventListener('click', () => setQty(item.id, item.size, item.qty - 1));
      lineEl.querySelector('[data-remove]').addEventListener('click', () => removeFromCart(item.id, item.size));
    });

    foot.hidden = false;
    foot.innerHTML = `
      <div class="cart-total">
        <span class="mono">Итого</span>
        <strong>${formatPrice(total)}</strong>
      </div>
      <a class="btn btn--block" href="/checkout/">Оформить заказ</a>
      <div class="cart-foot-row">
        <span class="mono">Доставка — на следующем шаге</span>
        <button class="cart-clear mono" data-clear>Очистить</button>
      </div>
    `;
    foot.querySelector('[data-clear]').addEventListener('click', clearCart);
  };

  render(getCart());
  subscribe(render);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawerEl.classList.contains('is-open')) closeCart();
  });
  // Any in-drawer link (product, shop, checkout) navigates — close behind it.
  document.addEventListener('mrak8:navigated', () => closeCart({ restoreFocus: false }));
}

export function openCart() {
  if (!drawerEl || drawerEl.classList.contains('is-open')) return;
  lastFocus = document.activeElement;
  drawerEl.inert = false;
  drawerEl.classList.add('is-open');
  document.documentElement.classList.add('no-scroll');
  drawerEl.querySelector('.cart-head [data-cart-close]').focus({ preventScroll: true });
}

export function closeCart({ restoreFocus = true } = {}) {
  if (!drawerEl?.classList.contains('is-open')) return;
  drawerEl.classList.remove('is-open');
  drawerEl.inert = true;
  document.documentElement.classList.remove('no-scroll');
  if (restoreFocus) lastFocus?.focus?.({ preventScroll: true });
}
