import { picture } from '../utils/media.js';
import { pad } from '../utils/format.js';
import { noPhoto } from './productCard.js';

/**
 * Product gallery. One piece of markup, two behaviours (see shop.css):
 *   desktop — an asymmetric stack you scroll past while the buy panel stays
 *   mobile  — a native swipe strip (scroll-snap) with a live counter
 * No JS drives the swiping; the counter just watches which frame is in view.
 */
export function mountImageGallery(container, product) {
  const images = product.images;

  if (images.length === 0) {
    container.innerHTML = `<div class="gallery"><figure class="gallery-item gallery-item--lead">${noPhoto(product)}</figure></div>`;
    return () => {};
  }

  container.innerHTML = `
    <div class="gallery" data-gallery tabindex="0" role="group" aria-label="Фотографии: ${images.length}">
      ${images
        .map(
          (image, i) => `
        <figure class="gallery-item ${i === 0 ? 'gallery-item--lead' : ''}" data-frame="${i}"
          style="aspect-ratio:${image.width && image.height ? `${image.width} / ${image.height}` : '1 / 1'}">
          ${picture(image, {
            alt: image.alt,
            sizes: i === 0 ? '(max-width: 980px) 100vw, 58vw' : '(max-width: 980px) 100vw, 29vw',
            eager: i === 0,
          })}
        </figure>`
        )
        .join('')}
    </div>
    <span class="gallery-count mono" data-gallery-count aria-hidden="true">${pad(1)} / ${pad(images.length)}</span>
  `;

  const strip = container.querySelector('[data-gallery]');
  const count = container.querySelector('[data-gallery-count]');
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) count.textContent = `${pad(Number(entry.target.dataset.frame) + 1)} / ${pad(images.length)}`;
      });
    },
    { root: strip, threshold: 0.6 }
  );
  strip.querySelectorAll('[data-frame]').forEach((frame) => observer.observe(frame));
  return () => observer.disconnect();
}
