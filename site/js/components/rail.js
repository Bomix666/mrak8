// MRAK8 — showroom rail.
// Garments from the live catalogue hang on a rail, seen edge-on; the one
// under the cursor (or the swiped-to one on touch) turns to face you.
//
// What hangs is decided by the catalogue, not by this file:
//   - a product needs a front cut-out (admin → product → "Showroom rail")
//   - with one or two such products the rail is their size run — one hanger
//     per size, an EMPTY hanger where a size is sold out
//   - with more, it is one hanger per product

import { formatPrice, esc } from '../utils/format.js';

const LOW_STOCK = 5;
const SIZE_RUN_MAX_PRODUCTS = 2;

function buildHangers(products) {
  const hung = products.filter((p) => p.cutoutFront);
  if (hung.length > SIZE_RUN_MAX_PRODUCTS) {
    return hung.map((product) => ({
      product,
      size: null,
      qty: product.units,
      href: `/product/${product.slug}/`,
    }));
  }
  return hung.flatMap((product) =>
    product.sizes.map(({ size, quantity }) => ({
      product,
      size,
      qty: product.soldOut ? 0 : quantity,
      href: `/product/${product.slug}/?size=${size}`,
    }))
  );
}

function stockLabel(qty) {
  if (qty <= 0) return 'нет в наличии';
  if (qty <= LOW_STOCK) return `осталось ${qty}`;
  return 'в наличии';
}

function face(image, cls, eager) {
  // The active garment is ~45vw wide at most; the rest are slivers.
  return `<img class="garment-face ${cls}" src="${esc(image.url)}" ${image.srcset ? `srcset="${esc(image.srcset)}"` : ''}
    sizes="(max-width: 720px) 78vw, 36vw" width="${image.width || ''}" height="${image.height || ''}"
    alt="" draggable="false" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" />`;
}

function hangerHtml(item, index) {
  const { product, size, qty } = item;
  const available = qty > 0;
  const label = `${product.name}${size ? `, размер ${size}` : ''} — ${stockLabel(qty)}`;
  const ratio = product.cutoutFront.width && product.cutoutFront.height
    ? `${product.cutoutFront.width} / ${product.cutoutFront.height}`
    : '1 / 1';

  const body = available
    ? `<span class="garment" style="aspect-ratio:${ratio}">
         ${face(product.cutoutFront, 'garment-front', index < 3)}
         ${product.cutoutBack ? face(product.cutoutBack, 'garment-back', false) : ''}
       </span>`
    : `<span class="garment garment--empty" style="aspect-ratio:${ratio}" aria-hidden="true">
         <svg viewBox="0 0 200 70" preserveAspectRatio="none"><path d="M100 2 L196 62 H4 Z" fill="none" stroke="currentColor" stroke-width="1.5" vector-effect="non-scaling-stroke"/></svg>
       </span>`;

  const inner = `
    <span class="hanger-hook" aria-hidden="true"></span>
    ${size ? `<span class="hanger-tag ${available ? '' : 'is-out'}" aria-hidden="true">${esc(size)}</span>` : ''}
    ${body}`;

  return `
    <li class="hanger ${available ? '' : 'is-out'}" data-hanger="${index}" style="--i:${index}">
      ${available
        ? `<a class="hanger-body" href="${esc(item.href)}" aria-label="${esc(label)}">${inner}</a>`
        : `<span class="hanger-body" role="img" aria-label="${esc(label)}">${inner}</span>`}
    </li>`;
}

export function mountRail(root, products) {
  const items = buildHangers(products);
  if (items.length === 0) return false;

  const canFlip = items.some((i) => i.product.cutoutBack);
  const touchHint = 'Свайп — листать. Тап — открыть.';
  const hoverHint = 'Наведи — развернётся. Нажми — откроется.';

  root.innerHTML = `
    <div class="rail" data-rail style="--n:${items.length}">
      <div class="rail-bar" aria-hidden="true"></div>
      <ul class="rail-track" role="list" data-track>
        ${items.map(hangerHtml).join('')}
      </ul>
    </div>

    <div class="rail-foot">
      <div class="rail-caption" aria-live="polite" data-caption></div>
      <div class="rail-controls">
        <button class="rail-btn" data-prev aria-label="Предыдущая вещь">←</button>
        ${canFlip ? '<button class="rail-btn rail-btn--text mono" data-flip aria-pressed="false">Оборот</button>' : ''}
        <button class="rail-btn" data-next aria-label="Следующая вещь">→</button>
      </div>
      <div class="rail-aside">
        <p class="rail-hint mono" data-hint>${hoverHint}</p>
        <a class="link" href="/shop/">В магазин</a>
      </div>
    </div>
  `;

  const track = root.querySelector('[data-track]');
  const hangers = [...root.querySelectorAll('[data-hanger]')];
  const caption = root.querySelector('[data-caption]');
  const flipBtn = root.querySelector('[data-flip]');
  const hoverable = window.matchMedia('(hover: hover) and (pointer: fine)');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!hoverable.matches) root.querySelector('[data-hint]').textContent = touchHint;

  let active = -1;

  function renderCaption(item) {
    const { product, size, qty } = item;
    caption.innerHTML = `
      <span class="mono">${esc(product.code)}</span>
      <strong class="rail-caption-name">${esc(product.name)}</strong>
      <span class="rail-caption-meta mono">
        ${size ? `<span>Размер ${esc(size)}</span>` : ''}
        <span>${formatPrice(product.price)}</span>
        <span class="${qty > 0 && qty > LOW_STOCK ? '' : 'red'}">${stockLabel(qty)}</span>
      </span>`;
  }

  function setActive(index) {
    index = Math.max(0, Math.min(items.length - 1, index));
    if (index === active) return;
    active = index;
    hangers.forEach((el, i) => {
      el.classList.toggle('is-active', i === index);
      el.classList.toggle('is-before', i < index);
      el.classList.toggle('is-after', i > index);
      el.classList.remove('is-flipped');
      el.style.removeProperty('--tilt');
    });
    flipBtn?.setAttribute('aria-pressed', 'false');
    if (flipBtn) flipBtn.disabled = !(items[index].qty > 0 && items[index].product.cutoutBack);
    // Light follows the active hanger (see .showroom::before).
    root.style.setProperty('--ax', `${((index + 0.5) / items.length) * 100}%`);
    renderCaption(items[index]);
  }

  // Start on the middle of the run, or the nearest size that is in stock.
  const middle = Math.floor((items.length - 1) / 2);
  const inStock = items.map((item, i) => (item.qty > 0 ? i : -1)).filter((i) => i >= 0);
  setActive(inStock.length ? inStock.reduce((a, b) => (Math.abs(b - middle) < Math.abs(a - middle) ? b : a)) : middle);

  hangers.forEach((el, index) => {
    el.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'mouse') setActive(index);
    });
    // Keyboard focus only: a tap also focuses the link, and that must not
    // count as the "first tap" below.
    el.addEventListener('focusin', (e) => {
      if (e.target.matches(':focus-visible')) setActive(index);
    });
    // Touch has no hover: the first tap on a hanger's slot turns the
    // garment, the second follows its link (the router picks that up like
    // any other link). Only the facing garment takes pointer events — an
    // edge-on one is a full-width box squeezed flat, and would otherwise
    // steal hovers from its neighbours (see .hanger-body in home.css).
    el.addEventListener('click', (e) => {
      if (index === active) return;
      e.preventDefault();
      setActive(index);
    });

    // The facing garment leans a few degrees toward the cursor.
    el.addEventListener('pointermove', (e) => {
      if (index !== active || e.pointerType !== 'mouse' || reduceMotion.matches) return;
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      el.style.setProperty('--tilt', `${(x * 22).toFixed(1)}deg`);
    });
    el.addEventListener('pointerleave', () => el.style.removeProperty('--tilt'));
  });

  root.querySelector('[data-prev]').addEventListener('click', () => setActive(active - 1));
  root.querySelector('[data-next]').addEventListener('click', () => setActive(active + 1));
  flipBtn?.addEventListener('click', () => {
    const flipped = hangers[active].classList.toggle('is-flipped');
    flipBtn.setAttribute('aria-pressed', String(flipped));
  });

  track.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    setActive(active + (e.key === 'ArrowRight' ? 1 : -1));
    hangers[active].querySelector('a')?.focus();
  });

  // Swipe (touch only — a mouse already has hover).
  let startX = null;
  track.addEventListener('pointerdown', (e) => {
    startX = e.pointerType === 'touch' ? e.clientX : null;
  });
  track.addEventListener('pointerup', (e) => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    startX = null;
    if (Math.abs(dx) > 36) setActive(active + (dx < 0 ? 1 : -1));
  });
  track.addEventListener('pointercancel', () => (startX = null));

  return true;
}
