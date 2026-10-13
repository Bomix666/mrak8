import { getEntryBySlug, getEntries } from '../data/journal.js';
import { coverMedia, coverRatio, entryMeta } from '../components/journalCard.js';
import { renderProductCard } from '../components/productCard.js';
import { picture, mountVideos } from '../utils/media.js';
import { mountReveal } from '../utils/scroll.js';
import { esc } from '../utils/format.js';
import { render as renderNotFound } from './notFound.js';

// Blocks arrive in page order. Text, quote and "wide"/"full" media render
// on their own; neighbouring "half" blocks pair up into a collage row and
// neighbouring "strip" blocks become one sideways-scrolling gallery.
const GROUPED = new Set(['half', 'strip']);
const isMedia = (block) => block.kind === 'image' || block.kind === 'video';

function mediaHtml(block, sizes) {
  const caption = block.caption ? `<figcaption class="mono">${esc(block.caption)}</figcaption>` : '';
  if (block.kind === 'video') {
    // An editorial film, not a background loop: muted and paused until the
    // reader presses play, with native controls.
    return `<figure class="block-media">
      <video src="${esc(block.video)}" ${block.image ? `poster="${esc(block.image.url)}"` : ''} controls muted playsinline preload="none"
        ${block.image?.width ? `width="${block.image.width}" height="${block.image.height}"` : ''}></video>${caption}</figure>`;
  }
  return `<figure class="block-media">${picture(block.image, { alt: block.caption || '', sizes })}${caption}</figure>`;
}

function renderBlocks(blocks) {
  const html = [];
  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i];

    if (block.kind === 'text') {
      html.push(`<section class="block block--text" data-reveal>
        ${block.heading ? `<h2 class="t-h3">${esc(block.heading)}</h2>` : ''}
        ${block.text.split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, '<br />')}</p>`).join('')}
      </section>`);
      continue;
    }

    if (block.kind === 'quote') {
      html.push(`<blockquote class="block block--quote" data-reveal>
        <p>${esc(block.text)}</p>
        ${block.caption ? `<footer class="mono">${esc(block.caption)}</footer>` : ''}
      </blockquote>`);
      continue;
    }

    if (isMedia(block) && GROUPED.has(block.layout)) {
      const group = [block];
      while (blocks[i + 1] && isMedia(blocks[i + 1]) && blocks[i + 1].layout === block.layout) {
        group.push(blocks[(i += 1)]);
      }
      const sizes = block.layout === 'half' ? '(max-width: 720px) 100vw, 50vw' : '(max-width: 720px) 84vw, 44vw';
      html.push(`<div class="block block--${block.layout}" data-reveal ${block.layout === 'strip' ? 'tabindex="0" role="group" aria-label="Галерея"' : ''}>
        ${group.map((b) => mediaHtml(b, sizes)).join('')}
      </div>`);
      continue;
    }

    html.push(`<div class="block block--${block.layout === 'full' ? 'full' : 'wide'}" data-reveal>
      ${mediaHtml(block, block.layout === 'full' ? '100vw' : '(max-width: 1240px) 100vw, 1160px')}
    </div>`);
  }
  return html.join('');
}

export async function render(view, ctx) {
  const { slug, onLeave } = ctx;
  const entry = await getEntryBySlug(slug);
  if (!entry) return renderNotFound(view, ctx);

  const all = await getEntries().catch(() => []);
  const position = all.findIndex((e) => e.slug === entry.slug);
  const next = all.length > 1 ? all[(position + 1) % all.length] : null;
  const split = coverRatio(entry) < 1; // vertical cover: title beside it, not over it

  view.innerHTML = `
    <article data-theme="dark" class="entry">
      ${entry.isDraft ? '<p class="entry-draft mono" role="status">Черновик — виден только вам. Опубликуйте в админке, чтобы показать всем.</p>' : ''}

      <header class="entry-hero ${split ? 'entry-hero--split' : 'entry-hero--bleed'}">
        <div class="entry-hero-media media">${coverMedia(entry, { sizes: split ? '(max-width: 860px) 100vw, 46vw' : '100vw', eager: true })}</div>
        <div class="entry-hero-text">
          <p class="mono">${entryMeta(entry)}</p>
          <h1>${esc(entry.title)}</h1>
          ${entry.excerpt ? `<p class="lede">${esc(entry.excerpt)}</p>` : ''}
        </div>
      </header>

      <div class="entry-body">${renderBlocks(entry.blocks)}</div>

      ${entry.products.length ? `
      <section class="entry-products" data-theme="bone" aria-labelledby="entry-products-title">
        <header class="section-head"><h2 id="entry-products-title">Вещи в кадре</h2><a class="link" href="/shop/">Shop</a></header>
        <div class="product-grid" data-count="${Math.min(entry.products.length, 4)}">
          ${entry.products.map((product) => renderProductCard(product)).join('')}
        </div>
      </section>` : ''}

      ${next && next.slug !== entry.slug ? `
      <a class="entry-next" href="/journal/${esc(next.slug)}/">
        <span class="mono">Дальше / ${esc(next.code)}</span>
        <span class="entry-next-title">${esc(next.title)}</span>
      </a>` : ''}
    </article>
  `;

  onLeave(mountVideos(view));
  onLeave(mountReveal(view));

  return { title: `${entry.title} — MRAK8 JOURNAL`, description: entry.excerpt };
}
