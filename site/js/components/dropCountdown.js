import { msToDrop } from '../data/products.js';

const pad = (n) => String(n).padStart(2, '0');

/**
 * Countdown to a drop, in mono digits, by the server's clock.
 * Calls onOpen once when it reaches zero. Returns a cleanup function.
 */
export function mountDropCountdown(container, product, { onOpen } = {}) {
  if (product.dropAt == null) {
    container.innerHTML = `<p class="drop-count-label mono">Дроп скоро. Дата — в боте.</p>`;
    return () => {};
  }

  container.innerHTML = `
    <p class="drop-count-label mono">До дропа</p>
    <p class="drop-count" role="timer">
      ${[['d', 'дн'], ['h', 'ч'], ['m', 'мин'], ['s', 'сек']]
        .map(([unit, label]) => `<span class="drop-seg"><b data-unit="${unit}">00</b><small aria-hidden="true">${label}</small></span>`)
        .join('<i aria-hidden="true">:</i>')}
    </p>
  `;
  const timer = container.querySelector('.drop-count');
  const units = Object.fromEntries([...container.querySelectorAll('[data-unit]')].map((el) => [el.dataset.unit, el]));
  let handle;

  function tick() {
    const left = msToDrop(product);
    if (left <= 0) {
      onOpen?.();
      return;
    }
    const total = Math.floor(left / 1000);
    const d = Math.floor(total / 86400);
    const h = Math.floor(total / 3600) % 24;
    const m = Math.floor(total / 60) % 60;
    units.d.textContent = pad(d);
    units.h.textContent = pad(h);
    units.m.textContent = pad(m);
    units.s.textContent = pad(total % 60);
    // Screen readers get minutes, not a value that changes every second.
    timer.setAttribute('aria-label', `До дропа ${d} дн ${h} ч ${m} мин`);
    handle = setTimeout(tick, left % 1000 || 1000);
  }

  tick();
  return () => clearTimeout(handle);
}
