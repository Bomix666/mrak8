import { getEntries } from '../data/journal.js';
import { renderJournalCard } from '../components/journalCard.js';
import { mountReveal } from '../utils/scroll.js';
import { mountVideos } from '../utils/media.js';
import { esc, pad, plural } from '../utils/format.js';
import { replaceUrl } from '../router.js';

export async function render(view, { query, onLeave }) {
  const entries = await getEntries();
  const kinds = [...new Map(entries.map((e) => [e.kind, e.kindLabel])).entries()];
  let kind = kinds.some(([k]) => k === query.kind) ? query.kind : 'all';

  view.innerHTML = `
    <div data-theme="dark" class="journal">
      <header class="page-head page-top">
        <h1 class="t-h1">Journal</h1>
        <p class="mono" data-count aria-live="polite"></p>
      </header>

      ${kinds.length > 1 ? `
      <div class="shop-tools">
        <div class="filter-bar" role="group" aria-label="Тип материала">
          <button class="chip" data-kind="all">Все</button>
          ${kinds.map(([k, label]) => `<button class="chip" data-kind="${esc(k)}">${esc(label)}</button>`).join('')}
        </div>
      </div>` : ''}

      <div class="jgrid" data-grid></div>
    </div>
  `;

  const grid = view.querySelector('[data-grid]');
  const countEl = view.querySelector('[data-count]');
  let stop = () => {};
  onLeave(() => stop());

  function paint() {
    const shown = entries.filter((e) => kind === 'all' || e.kind === kind);
    grid.innerHTML = shown.length
      ? shown.map(renderJournalCard).join('')
      : '<div class="grid-empty"><p class="mono">Архив пока пуст.</p></div>';
    countEl.textContent = `${pad(shown.length)} ${plural(shown.length, ['материал', 'материала', 'материалов'])}`;
    view.querySelectorAll('[data-kind]').forEach((btn) => btn.setAttribute('aria-pressed', String(btn.dataset.kind === kind)));

    stop();
    const stopReveal = mountReveal(grid);
    const stopVideos = mountVideos(grid);
    stop = () => {
      stopReveal();
      stopVideos();
    };
    replaceUrl(`/journal/${kind === 'all' ? '' : `?kind=${encodeURIComponent(kind)}`}`);
  }

  view.querySelectorAll('[data-kind]').forEach((btn) =>
    btn.addEventListener('click', () => {
      kind = btn.dataset.kind;
      paint();
    })
  );
  paint();

  return { title: 'JOURNAL — MRAK8', description: 'Журнал MRAK8: съёмки, видео и архив бренда.' };
}
