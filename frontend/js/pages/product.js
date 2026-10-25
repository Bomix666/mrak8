import { getProductBySlug, getRelatedProducts, isDropPending } from '../data/products.js';
import { mountDropCountdown } from '../components/dropCountdown.js';
import { BOT_URL } from '../config.js';
import { getEntries } from '../data/journal.js';
import { mountImageGallery } from '../components/imageGallery.js';
import { mountSizeSelector } from '../components/sizeSelector.js';
import { renderProductGrid } from '../components/productGrid.js';
import { priceHtml } from '../components/productCard.js';
import { renderJournalCard } from '../components/journalCard.js';
import { addToCart } from '../state/cart.js';
import { openCart } from '../components/cartDrawer.js';
import { mountReveal } from '../utils/scroll.js';
import { mountVideos } from '../utils/media.js';
import { esc } from '../utils/format.js';
import { render as renderNotFound } from './notFound.js';

function accordion(title, body, open = false) {
  if (!body) return '';
  return `<details class="accordion" ${open ? 'open' : ''}><summary>${title}</summary><div class="accordion-body">${body}</div></details>`;
}

function buttonLabel(product) {
  if (isDropPending(product)) return 'Дроп скоро';
  return product.units <= 0 ? 'Вещдок изъят другим субъектом' : 'В корзину';
}

export async function render(view, ctx) {
  const { slug, query, onLeave } = ctx;
  let product = await getProductBySlug(slug);
  if (!product) return renderNotFound(view, ctx);

  // Secondary content must never block or break the page that sells.
  const [related, stories] = await Promise.all([
    getRelatedProducts(slug).catch(() => []),
    getEntries({ product: slug }).catch(() => []),
  ]);
  const pending = isDropPending(product);
  let soldOut = !pending && product.units <= 0;

  view.innerHTML = `
    <div data-theme="paper">
      <section class="product page-top">
        <div class="product-gallery" data-gallery></div>

        <div class="product-buy">
          <p class="mono">${esc(product.code)} / ${esc(product.color)}</p>
          <h1 class="product-name">${esc(product.name)}</h1>
          <p class="product-price">${priceHtml(product)}</p>
          ${product.description ? `<p class="product-desc">${esc(product.description)}</p>` : ''}

          ${pending ? `
          <div class="drop-box" data-drop>
            <div data-countdown></div>
            ${product.botId ? `<a class="btn btn--block btn--ghost" href="${BOT_URL}?startapp=drop_${product.botId}"
              target="_blank" rel="noopener">Уведомить меня в Telegram</a>` : ''}
          </div>` : ''}

          <form class="product-form" data-buy-form novalidate>
            <div data-size-selector></div>
            <button type="submit" class="btn btn--block" data-add-cart ${soldOut || pending ? 'disabled' : ''}>
              ${buttonLabel(product)}
            </button>
            <p class="form-error" data-buy-error role="alert"></p>
          </form>

          <div class="accordions">
            ${accordion('Детали', product.details.length ? `<ul>${product.details.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>` : '', true)}
            ${accordion('Посадка', product.fit ? `<p>${esc(product.fit)}</p>` : '')}
            ${accordion('Доставка и возврат', product.shipping
              ? `<p>${esc(product.shipping)}</p><p><a class="text-link" href="/shipping/">Все условия</a></p>` : '')}
          </div>
        </div>
      </section>

      ${stories.length ? `
      <section class="product-stories" aria-labelledby="stories-title">
        <header class="section-head"><h2 id="stories-title">В журнале</h2><a class="link" href="/journal/">Journal</a></header>
        <div class="jgrid jgrid--row">${stories.slice(0, 3).map(renderJournalCard).join('')}</div>
      </section>` : ''}

      ${related.length ? `
      <section class="product-related" aria-labelledby="related-title">
        <header class="section-head"><h2 id="related-title">Ещё в каталоге</h2><a class="link" href="/shop/">Shop</a></header>
        ${renderProductGrid(related)}
      </section>` : ''}
    </div>
  `;

  onLeave(mountImageGallery(view.querySelector('[data-gallery]'), product));
  onLeave(mountReveal(view));
  onLeave(mountVideos(view));

  const errorEl = view.querySelector('[data-buy-error]');
  const addBtn = view.querySelector('[data-add-cart]');
  const mountSizes = () =>
    mountSizeSelector(view.querySelector('[data-size-selector]'), {
      sizes: soldOut || isDropPending(product) ? product.sizes.map((s) => ({ ...s, quantity: 0 })) : product.sizes,
      selected: query.size, // arriving from the showroom rail with a size picked
      onChange: () => (errorEl.textContent = ''),
    });
  let sizeSelector = mountSizes();

  // Drop: count down, then go on sale in place. Stock and the final word
  // come from the server, so refetch at zero (and retry if its clock is
  // a moment behind ours).
  if (pending) {
    const dropBox = view.querySelector('[data-drop]');
    let retry;
    const open = async () => {
      const fresh = await getProductBySlug(slug).catch(() => null);
      if (!fresh || fresh.dropState === 'soon') {
        retry = setTimeout(open, 2000);
        return;
      }
      product = fresh;
      soldOut = product.units <= 0;
      dropBox.classList.add('is-open');
      dropBox.querySelector('[data-countdown]').innerHTML = `<p class="drop-count-label mono">${soldOut ? 'Изъято' : 'В продаже'}</p>`;
      dropBox.querySelector('a')?.remove();
      sizeSelector = mountSizes();
      addBtn.disabled = soldOut;
      addBtn.textContent = buttonLabel(product);
    };
    onLeave(mountDropCountdown(dropBox.querySelector('[data-countdown]'), product, { onOpen: open }));
    onLeave(() => clearTimeout(retry));
  }

  view.querySelector('[data-buy-form]').addEventListener('submit', (e) => {
    e.preventDefault();
    if (soldOut || isDropPending(product)) return;
    const size = sizeSelector.get();
    if (!size) {
      errorEl.textContent = 'Выберите размер.';
      sizeSelector.focus();
      return;
    }
    const added = addToCart({
      id: product.id, // numeric DB id — this is what checkout sends to the backend
      slug: product.slug,
      name: product.name,
      price: product.price,
      color: product.color,
      code: product.code,
      size,
      // smallest variant — the cart shows it at thumbnail size
      image: product.images[0]?.srcset?.split(' ')[0] || product.images[0]?.url || '',
      max: sizeSelector.quantity(),
    });
    if (!added) {
      errorEl.textContent = `В наличии только ${sizeSelector.quantity()} шт. этого размера — они уже в корзине.`;
      return;
    }
    addBtn.textContent = 'Добавлено';
    addBtn.classList.add('is-done');
    setTimeout(() => {
      addBtn.textContent = 'В корзину';
      addBtn.classList.remove('is-done');
    }, 1400);
    openCart();
  });

  return { title: `${product.name} — MRAK8`, description: product.description };
}
