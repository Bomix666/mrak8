import { formatPrice, esc } from '../utils/format.js';
import { picture } from '../utils/media.js';
import { isDropPending } from '../data/products.js';

/** Typographic tile for a product with no photography uploaded yet. */
export function noPhoto(product) {
  return `<div class="no-photo"><span>${esc(product.code)}</span><strong>${esc(product.name)}</strong><span>Фото готовится</span></div>`;
}

export function priceHtml(product) {
  return `${formatPrice(product.price)}${
    product.originalPrice ? ` <s class="price-was">${formatPrice(product.originalPrice)}</s>` : ''
  }`;
}

export function renderProductCard(product, { sizes = '(max-width: 720px) 100vw, 50vw', feature = false } = {}) {
  const [front, back] = product.images;
  const pending = isDropPending(product);
  const soldOut = !pending && product.units <= 0;

  return `
    <article class="product-card ${feature ? 'product-card--feature' : ''}" data-reveal>
      <a class="product-card-media media" href="/product/${esc(product.slug)}/" aria-label="${esc(product.name)}">
        ${front ? picture(front, { alt: front.alt, sizes, cls: 'product-card-img is-front' }) : noPhoto(product)}
        ${back ? picture(back, { alt: '', sizes, cls: 'product-card-img is-back' }) : ''}
        <span class="product-card-tags mono">
          ${product.new ? '<span class="tag">New</span>' : ''}
          ${pending ? '<span class="tag tag--drop">Дроп скоро</span>' : ''}
          ${soldOut ? '<span class="tag tag--out">Sold out</span>' : ''}
        </span>
      </a>
      <div class="product-card-info">
        <div class="product-card-row">
          <h3 class="product-card-name"><a href="/product/${esc(product.slug)}/">${esc(product.name)}</a></h3>
          <span class="product-card-price">${priceHtml(product)}</span>
        </div>
        <div class="product-card-row mono">
          <span>${esc(product.code)} / ${esc(product.color)}</span>
          <span class="size-run" aria-label="Размеры в наличии">
            ${product.sizes
              .map((s) => `<span class="${!soldOut && s.quantity > 0 ? '' : 'is-out'}">${esc(s.size)}</span>`)
              .join('')}
          </span>
        </div>
      </div>
    </article>
  `;
}
