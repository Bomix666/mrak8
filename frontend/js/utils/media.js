// MRAK8 — image and video helpers.
// Images always carry width/height (no layout shift) and a srcset when the
// API provides one. Background loops never load until they are near the
// viewport, never play with sound, and stay a poster frame for visitors
// who asked for reduced motion or data saving.

import { esc } from './format.js';

/** <img> from an API image payload `{url, srcset, width, height}`. */
export function picture(image, { alt = '', sizes = '100vw', cls = '', eager = false } = {}) {
  if (!image?.url) return '';
  return `<img ${cls ? `class="${cls}"` : ''} src="${esc(image.url)}"
    ${image.srcset ? `srcset="${esc(image.srcset)}" sizes="${esc(sizes)}"` : ''}
    ${image.width ? `width="${image.width}" height="${image.height}"` : ''}
    alt="${esc(alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" />`;
}

/** Muted looping background clip. `mountVideos()` gives it a source later. */
export function loopVideo({ src, poster, label = '', cls = '' }) {
  return `<video class="${cls}" data-lazy-video data-src="${esc(src)}" ${poster ? `poster="${esc(poster)}"` : ''}
    muted loop playsinline preload="none" disablepictureinpicture ${label ? `aria-label="${esc(label)}"` : 'aria-hidden="true"'}></video>`;
}

export function mountVideos(root) {
  const videos = [...root.querySelectorAll('[data-lazy-video]')];
  if (videos.length === 0) return () => {};

  // Reduced motion or data saver: these loops are atmosphere, so they stay
  // as their poster frame and are never downloaded. (Films inside a journal
  // entry are separate <video controls> elements the reader starts.)
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches || navigator.connection?.saveData === true;
  if (calm) return () => {};

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(({ target: video, isIntersecting }) => {
        if (!isIntersecting) {
          video.pause();
          return;
        }
        if (!video.src) video.src = video.dataset.src;
        video.play().catch(() => {});
      });
    },
    { rootMargin: '25% 0px' }
  );

  videos.forEach((video) => {
    // A clip that fails to load keeps showing its poster; drop the dead
    // source so the browser doesn't paint an error state over it.
    video.addEventListener('error', () => video.removeAttribute('src'), { once: true });
    observer.observe(video);
  });

  return () => {
    observer.disconnect();
    videos.forEach((video) => video.pause());
  };
}
