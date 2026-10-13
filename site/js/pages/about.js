import { asset } from '../config.js';
import { getProducts } from '../data/products.js';
import { loopVideo, mountVideos } from '../utils/media.js';
import { mountReveal, mountProgress } from '../utils/scroll.js';
import { esc } from '../utils/format.js';

// The brand speaks through what is printed on the garment. This page sets
// those lines large and shows where they sit — it states nothing that
// isn't visible in the photographs: no founding story, no production
// claims.
const BACK_LINES = ['MRAK8 central booking & intake center', 'No emotional contraband.', 'All subjects are monitored.'];

export async function render(view, { onLeave }) {
  const products = await getProducts().catch(() => []);
  const piece = products.find((p) => p.cutoutFront) || products[0];

  view.innerHTML = `
    <article class="about">
      <header class="about-hero page-top" data-theme="paper">
        <p class="mono">About / MRAK8</p>
        <h1 class="about-title" data-reveal="clip">Не<br />дизайнер</h1>
        <p class="lede" data-reveal>Всё, что MRAK8 хочет сказать, уже напечатано на вещи. Остальное — фото и видео.</p>
      </header>

      <section class="about-lines" data-theme="dark" data-progress aria-label="Текст на спине">
        <div class="about-lines-visual" aria-hidden="true">
          <img src="${asset('flat-back-1600.webp')}" srcset="${asset('flat-back-800.webp')} 800w, ${asset('flat-back-1600.webp')} 1600w"
            sizes="(max-width: 860px) 120vw, 60vw" width="1600" height="1600" alt="" loading="lazy" decoding="async" />
        </div>
        <ol class="about-lines-list">
          ${BACK_LINES.map((line, i) => `
            <li data-reveal style="--stagger:${i}">
              <span class="mono">Строка 0${i + 1} / спина</span>
              <strong>${esc(line)}</strong>
            </li>`).join('')}
        </ol>
      </section>

      <section class="about-marks" data-theme="paper">
        <figure class="about-figure" data-reveal>
          <img src="${asset('studio-hood.webp')}" width="896" height="1195" loading="lazy" decoding="async"
            alt="Модель в зип-худи «НЕ ДИЗАЙНЕР», капюшон надет" />
        </figure>

        <div class="about-marks-text">
          <h2 class="t-h2" data-reveal="clip">Знаки</h2>
          <dl class="about-facts">
            <div data-reveal><dt class="mono">Грудь</dt><dd>Принт «НЕ ДИЗАЙНЕР»</dd></div>
            <div data-reveal><dt class="mono">Спина</dt><dd>Три строки. Последняя — All subjects are monitored.</dd></div>
            <div data-reveal><dt class="mono">Капюшон</dt><dd>Вышивка Mrak8</dd></div>
            <div data-reveal><dt class="mono">Цвет</dt><dd>Красный на молочном</dd></div>
          </dl>
          <figure class="about-stitch" data-reveal>
            <div class="media">${loopVideo({ src: asset('loop-stitch.mp4'), poster: asset('loop-stitch.jpg'), label: 'Вышивка Mrak8 на капюшоне, крупный план' })}</div>
            <figcaption class="mono">Вышивка / капюшон</figcaption>
          </figure>
        </div>
      </section>

      <section class="about-out" data-theme="dark">
        <a class="about-out-link" href="/shop/"><span class="mono">01</span><span>Shop</span></a>
        ${piece ? `<a class="about-out-link" href="/product/${esc(piece.slug)}/"><span class="mono">02</span><span>${esc(piece.code)}</span></a>` : ''}
        <a class="about-out-link" href="/journal/"><span class="mono">0${piece ? 3 : 2}</span><span>Journal</span></a>
      </section>
    </article>
  `;

  onLeave(mountVideos(view));
  onLeave(mountReveal(view));
  onLeave(mountProgress(view));

  return { title: 'ABOUT — MRAK8', description: 'MRAK8. No emotional contraband. All subjects are monitored.' };
}
