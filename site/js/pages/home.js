import { getProducts } from '../data/products.js';
import { getEntries } from '../data/journal.js';
import { asset } from '../config.js';
import { mountRail } from '../components/rail.js';
import { renderTape } from '../components/tape.js';
import { entryMeta } from '../components/journalCard.js';
import { picture, loopVideo, mountVideos } from '../utils/media.js';
import { mountReveal, mountProgress } from '../utils/scroll.js';
import { esc, pad, plural } from '../utils/format.js';

// Three scenes, no more: showroom → the print → the film.
// Every scene reads the catalogue or the journal; when one of them has
// nothing to show (no cut-out, no film, no people entry) the scene is
// simply left out rather than padded with stand-in content.

function showroom(products) {
  const hung = products ? products.filter((p) => p.cutoutFront).length : 0;
  return `
    <section class="showroom" data-theme="dark" data-showroom aria-labelledby="showroom-title">
      <h1 class="sr-only" id="showroom-title">MRAK8 — цифровой шоурум</h1>
      <div class="showroom-word" aria-hidden="true">MRAK8</div>

      <div class="showroom-top mono">
        <span>Mrak8 central booking &amp; intake center</span>
        <span data-clock></span>
        <span class="showroom-top-count">${hung ? `На рейле: ${hung} ${plural(hung, ['вещь', 'вещи', 'вещей'])}` : ''}</span>
      </div>

      <div class="showroom-rail" data-rail-root></div>
    </section>`;
}

function showroomFallback(products) {
  // No cut-outs uploaded (or the catalogue didn't load): a still object
  // instead of the rail, with the way into the shop intact.
  const message = products ? 'Рейл собирается' : 'Каталог сейчас недоступен';
  return `
    <div class="showroom-still">
      <img src="${asset('flat-front-1600.webp')}" srcset="${asset('flat-front-800.webp')} 800w, ${asset('flat-front-1600.webp')} 1600w"
        sizes="(max-width: 720px) 90vw, 50vw" width="1600" height="1600" alt="Зип-худи «НЕ ДИЗАЙНЕР»" fetchpriority="high" />
      <p class="mono">${message}</p>
      <a class="link" href="/shop/">В магазин</a>
    </div>`;
}

function statement(hero) {
  const cutout = hero.cutoutBack || hero.cutoutFront;
  return `
    <section class="statement" data-theme="paper" data-progress aria-label="Не дизайнер">
      <p class="statement-kicker mono">${esc(hero.code)} / ${esc(hero.color)}</p>
      <h2 class="statement-title" aria-hidden="true"><span>Не</span><span>дизайнер</span></h2>

      ${cutout ? `<div class="statement-object">${picture(cutout, { alt: `${hero.name}, вид сзади`, sizes: '(max-width: 860px) 80vw, 44vw' })}</div>` : ''}

      <a class="link statement-link" href="/product/${esc(hero.slug)}/">Смотреть вещь</a>
    </section>`;
}

function film(entry) {
  return `
    <section class="film" data-theme="dark" data-progress="pin" aria-label="${esc(entry.title)}">
      <div class="film-stage">
        <div class="film-panel film-panel--l">
          ${loopVideo({ src: asset('loop-walk.mp4'), poster: asset('loop-walk.jpg') })}
          <span class="film-cam mono">Cam 01</span>
        </div>
        <div class="film-panel film-panel--c">
          ${loopVideo({ src: entry.coverVideo, poster: entry.cover?.url, label: entry.title, cls: 'film-main' })}
          <span class="film-cam mono">Cam 02</span>
        </div>
        <div class="film-panel film-panel--r">
          ${loopVideo({ src: asset('loop-hood.mp4'), poster: asset('loop-hood.jpg') })}
          <span class="film-cam mono">Cam 03</span>
        </div>

        <div class="film-hud mono" aria-hidden="true">
          <span class="film-rec">Rec</span>
          <span data-timecode>00:00:00</span>
        </div>

        <div class="film-title">
          <p class="mono">${entryMeta(entry)}</p>
          <h2>${esc(entry.title)}</h2>
          <a class="link" href="/journal/${esc(entry.slug)}/">Смотреть</a>
        </div>
      </div>
    </section>`;
}

export async function render(view, { onLeave }) {
  // Both are optional for the page to stand: null = that API didn't answer.
  const [products, entries] = await Promise.all([
    getProducts().catch(() => null),
    getEntries().catch(() => []),
  ]);

  const hero = products?.find((p) => p.cutoutFront) || products?.[0] || null;
  const filmEntry = entries.find((e) => e.featured && e.coverVideo) || entries.find((e) => e.coverVideo);

  view.innerHTML = [
    showroom(products),
    hero ? renderTape({ rot: -1.2 }) + statement(hero) : '',
    filmEntry ? renderTape({ variant: 'cream', speed: 28 }) + film(filmEntry) : '',
  ].join('');

  const railRoot = view.querySelector('[data-rail-root]');
  if (!mountRail(railRoot, products || [])) {
    railRoot.innerHTML = showroomFallback(products);
  }

  // Live clock in the showroom header — the intake desk is always on.
  const clock = view.querySelector('[data-clock]');
  const tick = () => (clock.textContent = new Date().toLocaleString('ru-RU'));
  tick();
  const clockTimer = setInterval(tick, 1000);
  onLeave(() => clearInterval(clockTimer));

  // Timecode follows the main film, so the HUD is the clip's real position.
  const main = view.querySelector('.film-main');
  const timecode = view.querySelector('[data-timecode]');
  main?.addEventListener('timeupdate', () => {
    const t = main.currentTime;
    timecode.textContent = `00:${pad(Math.floor(t / 60))}:${pad(Math.floor(t % 60))}`;
  });

  onLeave(mountVideos(view));
  onLeave(mountReveal(view));
  onLeave(mountProgress(view));

  return {
    title: 'MRAK8 — НЕ ДИЗАЙНЕР',
    description: 'MRAK8. Цифровой шоурум, магазин и журнал бренда.',
  };
}
