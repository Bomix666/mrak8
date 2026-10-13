import { getCart, subscribe } from '../state/cart.js';
import { openCart } from './cartDrawer.js';

const PRIMARY = [
  ['/shop/', 'Shop'],
  ['/journal/', 'Journal'],
  ['/about/', 'About'],
];

const SECONDARY = [
  ['/account/', 'Мой заказ'],
  ['/shipping/', 'Доставка и возврат'],
  ['/contact/', 'Контакты'],
];

export function mountHeader(root) {
  root.innerHTML = `
    <header class="site-header">
      <a class="logo" href="/" aria-label="MRAK8 — на главную">Mrak8</a>

      <nav class="nav-main" aria-label="Основная навигация">
        ${PRIMARY.map(([href, label]) => `<a href="${href}" data-nav>${label}</a>`).join('')}
      </nav>

      <div class="nav-side">
        <button class="nav-btn" data-cart-toggle aria-haspopup="dialog">
          Cart <span class="cart-count" data-cart-count aria-live="polite">0</span>
        </button>
        <button class="nav-btn menu-btn" data-menu-open aria-expanded="false" aria-controls="site-menu">Menu</button>
      </div>
    </header>

    <div class="menu" id="site-menu" role="dialog" aria-modal="true" aria-label="Меню" data-menu>
      <button class="nav-btn menu-close" data-menu-close>Close</button>
      <nav class="menu-primary" aria-label="Меню">
        ${PRIMARY.map(
          ([href, label], i) =>
            `<a href="${href}" data-nav style="--i:${i}"><span class="mono">0${i + 1}</span>${label}</a>`
        ).join('')}
      </nav>
      <nav class="menu-secondary mono" aria-label="Сервис">
        ${SECONDARY.map(([href, label]) => `<a href="${href}">${label}</a>`).join('')}
      </nav>
    </div>
  `;

  const menu = root.querySelector('[data-menu]');
  const openBtn = root.querySelector('[data-menu-open]');
  const closeBtn = root.querySelector('[data-menu-close]');

  function setMenu(open) {
    menu.classList.toggle('is-open', open);
    menu.inert = !open;
    openBtn.setAttribute('aria-expanded', String(open));
    document.documentElement.classList.toggle('no-scroll', open);
    (open ? closeBtn : openBtn).focus({ preventScroll: true });
  }
  menu.inert = true;

  openBtn.addEventListener('click', () => setMenu(true));
  closeBtn.addEventListener('click', () => setMenu(false));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.classList.contains('is-open')) setMenu(false);
  });

  root.querySelector('[data-cart-toggle]').addEventListener('click', openCart);

  const countEl = root.querySelector('[data-cart-count]');
  let lastCount = getCart().count;
  const renderCount = ({ count }) => {
    countEl.textContent = count;
    if (count > lastCount) {
      countEl.classList.remove('is-bump');
      void countEl.offsetWidth; // restart the animation
      countEl.classList.add('is-bump');
    }
    lastCount = count;
  };
  renderCount(getCart());
  subscribe(renderCount);

  document.addEventListener('mrak8:navigated', ({ detail }) => {
    if (menu.classList.contains('is-open')) {
      menu.classList.remove('is-open');
      menu.inert = true;
      openBtn.setAttribute('aria-expanded', 'false');
      document.documentElement.classList.remove('no-scroll');
    }
    root.querySelectorAll('[data-nav]').forEach((link) => {
      const section = link.getAttribute('href').replace(/\/$/, '');
      const current = detail.path === section || detail.path.startsWith(`${section}/`);
      if (current) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  });
}
