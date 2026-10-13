import { getProductBySlug, getRelatedProducts } from '../data/products.js';
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

export async function render(view, ctx) {
  const { slug, query, onLeave } = ctx;
  const product = await getProductBySlug(slug);
  if (!product) return renderNotFound(view, ctx);

  // Secondary content must never block or break the page that sells.
  const [related, stories] = await Promise.all([
    getRelatedProducts(slug).catch(() => []),
    getEntries({ product: slug }).catch(() => []),
  ]);
  const soldOut = product.units <= 0;

  view.innerHTML = `
    <div data-theme="paper">
      <section class="product page-top">
        <div class="product-gallery" data-gallery></div>

        <div class="product-buy">
          <p class="mono">${esc(product.code)} / ${esc(product.color)}</p>
          <h1 class="product-name">${esc(product.name)}</h1>
          <p class="product-price">${priceHtml(product)}</p>
          ${product.description ? `<p class="product-desc">${esc(product.description)}</p>` : ''}

          <form class="product-form" data-buy-form novalidate>
            <div data-size-selector></div>
            <button type="submit" class="btn btn--block" data-add-cart ${soldOut ? 'disabled' : ''}>
              ${soldOut ? 'Нет в наличии' : 'В корзину'}
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
  const sizeSelector = mountSizeSelector(view.querySelector('[data-size-selector]'), {
    sizes: soldOut ? product.sizes.map((s) => ({ ...s, quantity: 0 })) : product.sizes,
    selected: query.size, // arriving from the showroom rail with a size picked
    onChange: () => (errorEl.textContent = ''),
  });

  view.querySelector('[data-buy-form]').addEventListener('submit', (e) => {
    e.preventDefault();
    if (soldOut) return;
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
