import { esc } from '../utils/format.js';

// Same slogan as the mini app's tape (mrakapp web/src/components/brand.tsx).
const SLOGAN = 'NO EMOTIONAL CONTRABAND. ALL SUBJECTS ARE MONITORED. НЕ ДИЗАЙНЕР.';

/**
 * Crime-scene tape running between sections. Decorative, so hidden from
 * screen readers; the track is doubled so the loop has no seam.
 *   variant: '' (red) | 'cream' | 'dark'
 */
export function renderTape({ text = SLOGAN, variant = '', speed = 22, rot = 0 } = {}) {
  const run = Array.from({ length: 6 }, () => `<span>${esc(text)}</span>`).join('');
  return `<div class="tape ${variant ? `tape--${variant}` : ''}" aria-hidden="true"
    style="--tape-speed:${speed}s;--tape-rot:${rot}deg"><div class="tape__track">${run}${run}</div></div>`;
}
