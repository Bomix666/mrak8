import { STATIC_URL } from '../config.js';

export function mountFooter(root) {
  const year = new Date().getFullYear();
  root.innerHTML = `
    <footer class="site-footer" data-theme="dark">
      <div class="footer-grid">
        <p class="footer-statement">No emotional<br />contraband.</p>

        <nav class="footer-col" aria-label="Разделы">
          <span class="mono">Разделы</span>
          <a href="/shop/">Shop</a>
          <a href="/journal/">Journal</a>
          <a href="/about/">About</a>
        </nav>

        <nav class="footer-col" aria-label="Покупателю">
          <span class="mono">Покупателю</span>
          <a href="/account/">Мой заказ</a>
          <a href="/shipping/">Доставка и возврат</a>
          <a href="/contact/">Контакты</a>
        </nav>
      </div>

      <img class="footer-word" src="${STATIC_URL}assets/mrak8-logo-white-1600.webp" width="1600" height="804"
        alt="" loading="lazy" decoding="async" />

      <div class="footer-base mono">
        <span>© ${year} MRAK8. All subjects are monitored.</span>
        <span>Не дизайнер.</span>
      </div>
    </footer>
  `;
}
