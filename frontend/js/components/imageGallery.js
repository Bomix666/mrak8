import { picture } from '../utils/media.js';
import { pad } from '../utils/format.js';
import { noPhoto } from './productCard.js';
import { reduced } from '../utils/fx.js';

const ZOOM = 3.2;

// Largest file the API offers — the loupe magnifies, so it wants the most pixels.
const largest = (image) => image.srcset?.split(',').pop().trim().split(' ')[0] || image.url;

const ratio = (image) => (image.width && image.height ? `${image.width} / ${image.height}` : '1 / 1');

/**
 * Product gallery. One piece of markup, two behaviours (see shop.css):
 *   desktop — an asymmetric stack you scroll past while the buy panel stays
 *   mobile  — a native swipe strip (scroll-snap) with a live counter
 * No JS drives the swiping; the counter just watches which frame is in view.
 *
 * With a photo marked `back` in the admin, the lead frame is the evidence
 * card from the mini app: ФАС / СПИНА turn it over, and a mouse gets a
 * ×3.2 loupe over the side on show.
 */
export function mountImageGallery(container, product) {
  const images = product.images;

  if (images.length === 0) {
    container.innerHTML = `<div class="gallery"><figure class="gallery-item gallery-item--lead">${noPhoto(product)}</figure></div>`;
    return () => {};
  }

  const back = images.find((image) => image.angle === 'back');
  const face = back && (images.find((image) => image.angle === 'front') || images.find((image) => image !== back));
  const rest = face ? images.filter((image) => image !== face && image !== back) : images;
  const total = rest.length + (face ? 1 : 0);

  const frame = (image, i) => `
        <figure class="gallery-item ${i === 0 ? 'gallery-item--lead' : ''}" data-frame="${i}" style="aspect-ratio:${ratio(image)}">
          ${picture(image, {
            alt: image.alt,
            sizes: i === 0 ? '(max-width: 980px) 100vw, 58vw' : '(max-width: 980px) 100vw, 29vw',
            eager: i === 0,
          })}
        </figure>`;

  const card = face ? `
        <figure class="gallery-item gallery-item--lead evidence" data-frame="0" style="aspect-ratio:${ratio(face)}">
          <div class="evidence-card" data-card>
            <div class="evidence-side">${picture(face, { alt: face.alt, sizes: '(max-width: 980px) 100vw, 58vw', eager: true })}</div>
            <div class="evidence-side evidence-side--back" aria-hidden="true">${picture(back, { alt: back.alt, sizes: '(max-width: 980px) 100vw, 58vw' })}</div>
          </div>
          <span class="evidence-scan" aria-hidden="true"></span>
          <span class="evidence-lens" data-lens aria-hidden="true"></span>
          <div class="evidence-switch mono" role="group" aria-label="Ракурс">
            <button type="button" data-side="front" aria-pressed="true">Фас</button>
            <button type="button" data-side="back" aria-pressed="false">Спина</button>
          </div>
        </figure>` : '';

  container.innerHTML = `
    <div class="gallery" data-gallery tabindex="0" role="group" aria-label="Фотографии: ${total}">
      ${card}${rest.map((image, i) => frame(image, i + (face ? 1 : 0))).join('')}
    </div>
    <span class="gallery-count mono" data-gallery-count aria-hidden="true">${pad(1)} / ${pad(total)}</span>
  `;

  const strip = container.querySelector('[data-gallery]');
  const count = container.querySelector('[data-gallery-count]');
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) count.textContent = `${pad(Number(entry.target.dataset.frame) + 1)} / ${pad(total)}`;
      });
    },
    { root: strip, threshold: 0.6 }
  );
  strip.querySelectorAll('[data-frame]').forEach((el) => observer.observe(el));
  if (face) mountEvidence(container.querySelector('.evidence'), face, back);
  return () => observer.disconnect();
}

function mountEvidence(fig, face, back) {
  const sides = fig.querySelectorAll('.evidence-side');
  const buttons = fig.querySelectorAll('[data-side]');
  const lens = fig.querySelector('[data-lens]');
  let showing = 'front';

  function turn(side) {
    if (side === showing) return;
    showing = side;
    fig.classList.toggle('is-back', side === 'back');
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.side === side)));
    sides.forEach((s, i) => s.setAttribute('aria-hidden', String((i === 1) !== (side === 'back'))));
    lens.style.backgroundImage = `url("${largest(side === 'back' ? back : face)}")`;
    // The scanner passes over the new side once.
    if (!reduced) {
      fig.classList.remove('is-scanning');
      void fig.offsetWidth;
      fig.classList.add('is-scanning');
    }
  }

  buttons.forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    turn(b.dataset.side);
  }));
  fig.querySelector('[data-card]').addEventListener('click', () => turn(showing === 'front' ? 'back' : 'front'));
  if (!reduced) fig.classList.add('is-scanning');
  fig.addEventListener('animationend', () => fig.classList.remove('is-scanning'));

  // Loupe: mouse and pen only — on touch the finger is the swipe.
  lens.style.backgroundImage = `url("${largest(face)}")`;
  fig.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch' || e.target.closest('.evidence-switch')) {
      fig.classList.remove('is-loupe');
      return;
    }
    const r = fig.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const half = lens.offsetWidth / 2;
    lens.style.transform = `translate(${x - half}px, ${y - half}px)`;
    lens.style.backgroundSize = `${r.width * ZOOM}px ${r.height * ZOOM}px`;
    lens.style.backgroundPosition = `${half - x * ZOOM}px ${half - y * ZOOM}px`;
    fig.classList.add('is-loupe');
  });
  fig.addEventListener('pointerleave', () => fig.classList.remove('is-loupe'));
}
