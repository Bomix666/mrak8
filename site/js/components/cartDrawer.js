import { getCart, setQty, removeFromCart, clearCart, subscribe } from '../state/cart.js';
import { formatPrice, esc, pad } from '../utils/format.js';
import { navigate } from '../router.js';
import { reduced, buzz } from '../utils/fx.js';

let drawerEl = null;
let lastFocus = null;

export function mountCartDrawer(root) {
  root.innerHTML = `
    <div class="cart-drawer" data-cart-drawer>
      <div class="cart-overlay" data-cart-close></div>
      <aside class="cart-panel" data-theme="paper" role="dialog" aria-modal="true" aria-label="Пакет для улик">
        <div class="cart-head">
          <div>
            <span class="mono cart-kicker">Personal property · опись</span>
            <h2>Пакет</h2>
          </div>
          <button class="nav-btn" data-cart-close>Закрыть</button>
        </div>
        <div class="zip" aria-hidden="true"><div class="zip__teeth"></div><div class="zip__pull" data-zip-pull></div></div>
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
          <span class="cart-empty-bag mono" aria-hidden="true">Evidence</span>
          <p>Изъятых вещей нет.</p>
          <span class="cart-empty-sub">Подозрительно.</span>
          <a class="link" href="/shop/">К вещдокам</a>
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
            <a href="/product/${esc(item.slug)}/"><span class="cart-line-n mono">${pad(i + 1)}.</span> ${esc(item.name)}</a>
            <span class="cart-line-price">${formatPrice(item.price * item.qty)}</span>
          </div>
          <span class="mono">Вещдок ${esc(item.code || '')} · ${esc(item.color)} · ${item.size === 'OS' ? 'one size' : `размер ${esc(item.size)}`}</span>
          <div class="cart-line-controls">
            <button class="qty-btn" data-qty-down aria-label="Уменьшить количество: ${esc(item.name)}">−</button>
            <span class="qty-value" aria-label="Количество">${item.qty}</span>
            <button class="qty-btn" data-qty-up aria-label="Увеличить количество: ${esc(item.name)}" ${item.qty >= item.limit ? 'disabled' : ''}>+</button>
            <button class="cart-remove mono" data-remove aria-label="Вернуть субъекту: ${esc(item.name)}">Вернуть</button>
          </div>
        </div>
      </div>`
        )
        .join('');

    body.querySelectorAll('[data-index]').forEach((lineEl) => {
      const item = items[Number(lineEl.dataset.index)];
      lineEl.querySelector('[data-qty-up]').addEventListener('click', () => setQty(item.id, item.size, item.qty + 1));
      lineEl.querySelector('[data-qty-down]').addEventListener('click', () => setQty(item.id, item.size, item.qty - 1));
      // Struck through in red marker first, then returned.
      lineEl.querySelector('[data-remove]').addEventListener('click', () => {
        lineEl.classList.add('is-struck');
        buzz(8);
        setTimeout(() => removeFromCart(item.id, item.size), reduced ? 0 : 520);
      });
    });

    foot.hidden = false;
    foot.innerHTML = `
      <div class="cart-total">
        <span class="mono">Итого · предметов ${items.reduce((n, item) => n + item.qty, 0)}</span>
        <strong>${formatPrice(total)}</strong>
      </div>
      <a class="btn btn--block" href="/checkout/" data-seal>Оформить протокол</a>
      <div class="cart-foot-row">
        <span class="mono">Доставка — на следующем шаге</span>
        <button class="cart-clear mono" data-clear>Очистить</button>
      </div>
    `;
    foot.querySelector('[data-clear]').addEventListener('click', clearCart);
    // The zipper pulls the bag shut, then the protocol opens.
    foot.querySelector('[data-seal]').addEventListener('click', (e) => {
      if (reduced || e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault(); // the router skips prevented clicks
      drawerEl.classList.add('is-sealed');
      buzz(16);
      setTimeout(() => navigate('/checkout/'), 540);
    });
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
  drawerEl.classList.remove('is-open', 'is-sealed');
  drawerEl.inert = true;
  document.documentElement.classList.remove('no-scroll');
  if (restoreFocus) lastFocus?.focus?.({ preventScroll: true });
}
