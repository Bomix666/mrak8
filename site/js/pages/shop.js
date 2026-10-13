import { getProducts, getCategories } from '../data/products.js';
import { renderProductGrid } from '../components/productGrid.js';
import { mountReveal } from '../utils/scroll.js';
import { esc, pad, plural } from '../utils/format.js';
import { replaceUrl } from '../router.js';

const SORTS = {
  new: { label: 'Сначала новые', compare: null }, // API order: newest first
  'price-asc': { label: 'Цена: по возрастанию', compare: (a, b) => a.price - b.price },
  'price-desc': { label: 'Цена: по убыванию', compare: (a, b) => b.price - a.price },
};

export async function render(view, { query, onLeave }) {
  // One request for the whole catalogue; filtering and sorting happen here
  // so switching a filter is instant (see CATALOGUE_LIMIT in data/products.js).
  const [products, categories] = await Promise.all([getProducts(), getCategories()]);

  // Only categories that actually have something on sale get a filter.
  const stocked = categories.filter((c) => products.some((p) => p.category === c.slug));
  let category = stocked.some((c) => c.slug === query.category) ? query.category : 'all';
  let sort = SORTS[query.sort] ? query.sort : 'new';

  view.innerHTML = `
    <div data-theme="paper" class="shop">
      <header class="page-head page-top">
        <h1 class="t-h1">Shop</h1>
        <p class="mono" data-shop-count aria-live="polite"></p>
      </header>

      <div class="shop-tools">
        <div class="filter-bar" role="group" aria-label="Категория">
          <button class="chip" data-filter="all">Все</button>
          ${stocked.map((c) => `<button class="chip" data-filter="${esc(c.slug)}">${esc(c.name)}</button>`).join('')}
        </div>
        <label class="sort mono">
          <span>Сортировка</span>
          <select data-sort>
            ${Object.entries(SORTS).map(([key, s]) => `<option value="${key}">${s.label}</option>`).join('')}
          </select>
        </label>
      </div>

      <div class="shop-grid" data-shop-grid></div>
    </div>
  `;

  const grid = view.querySelector('[data-shop-grid]');
  const countEl = view.querySelector('[data-shop-count]');
  const sortEl = view.querySelector('[data-sort]');
  let stopReveal = () => {};
  onLeave(() => stopReveal());

  function paint() {
    const shown = products.filter((p) => category === 'all' || p.category === category);
    if (SORTS[sort].compare) shown.sort(SORTS[sort].compare);

    grid.innerHTML = renderProductGrid(shown, { empty: 'Каталог пока пуст. Новые вещи появятся здесь.' });
    countEl.textContent = `${pad(shown.length)} ${plural(shown.length, ['позиция', 'позиции', 'позиций'])}`;
    view.querySelectorAll('[data-filter]').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.dataset.filter === category));
    });
    sortEl.value = sort;

    stopReveal();
    stopReveal = mountReveal(grid);

    // Keep the URL shareable without adding history entries per click.
    const params = new URLSearchParams();
    if (category !== 'all') params.set('category', category);
    if (sort !== 'new') params.set('sort', sort);
    replaceUrl(`/shop/${params.size ? `?${params}` : ''}`);
  }

  view.querySelectorAll('[data-filter]').forEach((btn) =>
    btn.addEventListener('click', () => {
      category = btn.dataset.filter;
      paint();
    })
  );
  sortEl.addEventListener('change', () => {
    sort = sortEl.value;
    paint();
  });

  paint();

  return { title: 'SHOP — MRAK8', description: 'Каталог MRAK8: вещи в наличии, размеры и цены.' };
}
