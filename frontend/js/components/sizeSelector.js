import { esc } from '../utils/format.js';

const LOW_STOCK = 5;
const LABEL = { OS: 'One size' };

/**
 * Size picker driven by real per-size inventory.
 *   sizes:    [{ size, quantity }] from the API
 *   selected: optional size to preselect (e.g. arriving from the rail)
 * Sizes at zero stay visible but disabled, so the full run is readable.
 */
export function mountSizeSelector(container, { sizes = [], selected = null, onChange } = {}) {
  container.innerHTML = `
    <fieldset class="size-selector">
      <legend class="mono">Размер</legend>
      <div class="size-grid">
        ${sizes
          .map(({ size, quantity }) => {
            const out = quantity <= 0;
            return `<label class="size-option ${out ? 'is-out' : ''}">
              <input type="radio" name="size" value="${esc(size)}" ${out ? 'disabled' : ''} />
              <span>${esc(LABEL[size] || size)}</span>
            </label>`;
          })
          .join('')}
      </div>
      <p class="size-status mono" data-size-status aria-live="polite">&nbsp;</p>
    </fieldset>
  `;

  const status = container.querySelector('[data-size-status]');
  const stock = new Map(sizes.map((s) => [s.size, s.quantity]));
  let value = null;

  function describe(size) {
    const quantity = stock.get(size) || 0;
    const name = LABEL[size] || `Размер ${size}`;
    status.textContent = quantity <= LOW_STOCK ? `${name}: осталось ${quantity}` : `${name}: в наличии`;
    status.classList.toggle('red', quantity <= LOW_STOCK);
  }

  container.querySelectorAll('input[name="size"]').forEach((input) => {
    input.addEventListener('change', () => {
      value = input.value;
      describe(value);
      onChange?.(value);
    });
  });

  // A single size (one size) has nothing to choose — take it.
  if (!selected && sizes.length === 1) selected = sizes[0].size;
  if (selected && (stock.get(selected) || 0) > 0) {
    const input = container.querySelector(`input[value="${CSS.escape(selected)}"]`);
    input.checked = true;
    value = selected;
    describe(value);
  }

  return {
    get: () => value,
    quantity: () => (value ? stock.get(value) || 0 : 0),
    focus: () => container.querySelector('input:not(:disabled)')?.focus(),
  };
}
