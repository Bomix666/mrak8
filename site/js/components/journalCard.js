import { esc, formatDate } from '../utils/format.js';
import { picture, loopVideo } from '../utils/media.js';

/** Cover of an entry: its muted loop when it has one, else its image. */
export function coverMedia(entry, { sizes = '100vw', eager = false } = {}) {
  if (entry.coverVideo) {
    return loopVideo({ src: entry.coverVideo, poster: entry.cover?.url, label: entry.title });
  }
  if (entry.cover) return picture(entry.cover, { alt: entry.title, sizes, eager });
  return `<div class="no-photo"><span>${esc(entry.code)}</span><strong>${esc(entry.title)}</strong><span>${esc(entry.kindLabel)}</span></div>`;
}

export function coverRatio(entry) {
  const { width, height } = entry.cover || {};
  return width && height ? width / height : 1;
}

export function entryMeta(entry) {
  return [entry.code, entry.kindLabel, formatDate(entry.publishedAt)].filter(Boolean).map(esc).join(' / ');
}

/** Tile for the journal index. Its span follows the cover's own shape, so
 *  a vertical film and a wide group shot don't get forced into one box. */
export function renderJournalCard(entry) {
  const ratio = coverRatio(entry);
  const shape = ratio < 0.85 ? 'tall' : ratio > 1.5 ? 'wide' : 'square';
  return `
    <article class="jcard jcard--${shape}" data-reveal>
      <a class="jcard-media media" href="/journal/${esc(entry.slug)}/" style="aspect-ratio:${ratio.toFixed(3)}" aria-label="${esc(entry.title)}">
        ${coverMedia(entry, { sizes: shape === 'wide' ? '(max-width: 860px) 100vw, 66vw' : '(max-width: 860px) 100vw, 34vw' })}
      </a>
      <div class="jcard-info">
        <span class="mono">${entryMeta(entry)}</span>
        <h2 class="jcard-title"><a href="/journal/${esc(entry.slug)}/">${esc(entry.title)}</a></h2>
        ${entry.excerpt ? `<p>${esc(entry.excerpt)}</p>` : ''}
      </div>
    </article>
  `;
}
