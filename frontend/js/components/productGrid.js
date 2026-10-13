import { renderProductCard } from './productCard.js';

/**
 * Editorial grid: the first piece is set large, the rest follow in an
 * even rhythm. With a single product the "grid" is that one large tile.
 */
export function renderProductGrid(products, { empty = 'В этом разделе пока ничего нет.' } = {}) {
  if (products.length === 0) {
    return `<div class="grid-empty"><p class="mono">${empty}</p></div>`;
  }
  return `
    <div class="product-grid" data-count="${Math.min(products.length, 4)}">
      ${products.map((product, i) => renderProductCard(product, { feature: i === 0 })).join('')}
    </div>
  `;
}
