// Motion primitives shared with the Telegram mini app (mrakapp web/src/lib/fx.ts):
// the same rubber stamp, the same curve, the same 80 ms shake.
// Web Animations API, transform/opacity only; reduced motion lands on the final frame.

import { esc } from './format.js';

export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function anim(el, keyframes, opts) {
  if (!el) return { finished: Promise.resolve() };
  if (reduced) {
    const last = keyframes[keyframes.length - 1];
    if (last && opts.fill === 'forwards') Object.assign(el.style, last);
    return { finished: Promise.resolve() };
  }
  return el.animate(keyframes, opts);
}

/** A paused timeline (hidden tab) must never block a purchase. */
const done = (a, ms) => Promise.race([a.finished.catch(() => {}), wait(ms)]);

/** Short buzz where the device has one — the site's stand-in for Telegram haptics. */
export function buzz(pattern = 12) {
  if (!reduced) navigator.vibrate?.(pattern);
}

export function shake(el, px = 4) {
  anim(el, [
    { transform: 'translate(0,0)' },
    { transform: `translate(${-px}px,${px / 2}px)` },
    { transform: `translate(${px}px,${-px / 2}px)` },
    { transform: `translate(${-px / 2}px,${px / 3}px)` },
    { transform: 'translate(0,0)' },
  ], { duration: 80, easing: 'linear' });
}

let seed = 3;

/** Red rubber stamp: double border, condensed caps, turbulence for uneven ink. */
export function stampSVG(text, sub = '', { w = 320, h = 104, color = 'currentColor', double = true } = {}) {
  const id = `ink${seed++}`;
  const fs = h * 0.56;
  return `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true"><defs><filter id="${id}" x="-5%" y="-10%" width="110%" height="120%">
    <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="${seed}" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -2.6 0 0 0 1.95" result="m"/>
    <feComposite in="SourceGraphic" in2="m" operator="in" result="k"/>
    <feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="2" seed="${seed + 9}" result="w"/>
    <feDisplacementMap in="k" in2="w" scale="5" xChannelSelector="R" yChannelSelector="G"/></filter></defs>
    <g filter="url(#${id})" fill="none" stroke="${color}">
      <rect x="5" y="5" width="${w - 10}" height="${h - 10}" rx="5" stroke-width="5"/>
      ${double ? `<rect x="14" y="14" width="${w - 28}" height="${h - 28}" rx="2" stroke-width="2"/>` : ''}
      <text x="${w / 2}" y="${sub ? h * 0.6 : h * 0.68}" text-anchor="middle" fill="${color}" stroke="none" font-family="Roboto Condensed Variable, Roboto Condensed, Arial Narrow, sans-serif" font-weight="900" font-size="${sub ? fs * 0.9 : fs}" letter-spacing="2" textLength="${w - 56}" lengthAdjust="spacingAndGlyphs">${esc(text)}</text>
      ${sub ? `<text x="${w / 2}" y="${h * 0.84}" text-anchor="middle" fill="${color}" stroke="none" font-family="JetBrains Mono Variable, JetBrains Mono, monospace" font-weight="700" font-size="${h * 0.11}" letter-spacing="1.5">${esc(sub)}</text>` : ''}
    </g></svg>`;
}

/**
 * Stamp hits the paper: scale 1.45 → 1, rotation, 80 ms shake and a buzz.
 * host must be position: relative. Resolves with the stamp element.
 */
export async function slam(host, text, { sub = '', rot = -9, cls = '', shakeEl = host } = {}) {
  const stamp = document.createElement('div');
  stamp.className = `stamp ${cls}`;
  stamp.innerHTML = stampSVG(text, sub);
  host.appendChild(stamp);
  const r = `rotate(${rot}deg)`;
  const a = anim(stamp, [
    { transform: `scale(1.45) ${r} rotate(-4deg)`, opacity: 0 },
    { transform: `scale(1.08) ${r}`, opacity: 1, offset: 0.62 },
    { transform: `scale(.98) ${r}`, offset: 0.82 },
    { transform: `scale(1) ${r}` },
  ], { duration: 300, easing: 'cubic-bezier(.7,0,.84,0)', fill: 'forwards' });
  setTimeout(() => {
    buzz();
    shake(shakeEl);
  }, reduced ? 0 : 190);
  await done(a, 420);
  stamp.style.transform = r;
  return stamp;
}

/** Lift a stamp off after it has been read. */
export async function lift(stamp, delay = 900) {
  await wait(delay);
  await done(anim(stamp, [{ opacity: 1 }, { opacity: 0 }], { duration: 320, easing: 'ease-out', fill: 'forwards' }), 400);
  stamp.remove();
}
