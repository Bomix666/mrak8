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
  // Before the first tap Chrome refuses vibrate and logs an error for it.
  if (!reduced && navigator.userActivation?.hasBeenActive !== false) navigator.vibrate?.(pattern);
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
      <text x="${w / 2}" y="${sub ? h * 0.6 : h * 0.68}" text-anchor="middle" fill="${color}" stroke="none" font-family="Roboto Condensed Variable, Roboto Condensed, Arial Narrow, sans-serif" font-weight="900" font-size="${sub ? fs * 0.9 : fs}" letter-spacing="2" textLength="${w - 56}" lengthAdjust="spacingAndGlyphs">${esc(text.toUpperCase())}</text>
      ${sub ? `<text x="${w / 2}" y="${h * 0.84}" text-anchor="middle" fill="${color}" stroke="none" font-family="JetBrains Mono Variable, JetBrains Mono, monospace" font-weight="700" font-size="${h * 0.11}" letter-spacing="1.5">${esc(sub)}</text>` : ''}
    </g></svg>`;
}

/** Round office seal for «М.П.»: text along the ring, the two rings of the «8» in the middle. */
export function sealSVG(ring, sub = '', { size = 120, color = 'currentColor' } = {}) {
  const id = `ink${seed++}`;
  const r = size / 2;
  const tr = r - 13;
  const inner = r - 24;
  return `<svg viewBox="0 0 ${size} ${size}" aria-hidden="true"><defs><filter id="${id}" x="-5%" y="-5%" width="110%" height="110%">
    <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="${seed}" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -2.4 0 0 0 1.85" result="m"/>
    <feComposite in="SourceGraphic" in2="m" operator="in" result="k"/>
    <feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves="2" seed="${seed + 7}" result="w"/>
    <feDisplacementMap in="k" in2="w" scale="3" xChannelSelector="R" yChannelSelector="G"/></filter>
    <path id="${id}r" d="M ${r - tr} ${r} a ${tr} ${tr} 0 1 1 ${tr * 2} 0 a ${tr} ${tr} 0 1 1 ${-tr * 2} 0"/></defs>
    <g filter="url(#${id})" fill="none" stroke="${color}">
      <circle cx="${r}" cy="${r}" r="${r - 3}" stroke-width="3"/>
      <circle cx="${r}" cy="${r}" r="${inner}" stroke-width="1.3"/>
      <ellipse cx="${r}" cy="${r - size * 0.07}" rx="${size * 0.165}" ry="${size * 0.054}" stroke-width="${size * 0.03}"/>
      <ellipse cx="${r}" cy="${r + size * 0.05}" rx="${size * 0.2}" ry="${size * 0.066}" stroke-width="${size * 0.03}"/>
      <text fill="${color}" stroke="none" font-family="JetBrains Mono Variable, JetBrains Mono, monospace" font-weight="700" font-size="${size * 0.078}"><textPath href="#${id}r" textLength="${(2 * Math.PI * tr - 6).toFixed(1)}" lengthAdjust="spacing">${esc(ring)}</textPath></text>
      ${sub ? `<text x="${r}" y="${r + inner * 0.78}" text-anchor="middle" fill="${color}" stroke="none" font-family="JetBrains Mono Variable, JetBrains Mono, monospace" font-weight="700" font-size="${size * 0.062}">${esc(sub)}</text>` : ''}
    </g></svg>`;
}

/** A deterministic scribble from the subject's name — their «signature». */
export function signPath(seedStr, w = 240, h = 62) {
  let s = 0;
  for (const c of String(seedStr)) s = (s * 31 + c.charCodeAt(0)) >>> 0;
  const rnd = () => (s = (s * 1103515245 + 12345) >>> 0) / 4294967296;
  let x = 10;
  const y = h * 0.62;
  let d = `M ${x} ${y}`;
  const loops = 5 + (s % 3);
  for (let i = 0; i < loops; i++) {
    const up = h * (0.12 + rnd() * 0.3);
    const dx = (w - 60) / loops;
    d += ` C ${x + dx * 0.2} ${y - up * 1.6} ${x + dx * 0.9} ${y - up * 1.2} ${x + dx * 0.55} ${y + 4}`;
    x += dx;
    d += ` S ${x + dx * 0.1} ${y - up * 0.2} ${x} ${y}`;
  }
  return `${d} C ${x + 14} ${y + 10} ${x - 70} ${y + 14} ${x - 120} ${y + 6}`;
}

/** Draws an SVG path as if by hand. */
export function drawPath(path, duration = 900) {
  const len = path.getTotalLength();
  path.style.strokeDasharray = String(len);
  return done(anim(path, [{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' }), duration + 100);
}

/** Lines appear one by one, like a thermal printer. */
export function printLines(lines, step = 45) {
  lines.forEach((line, i) =>
    anim(line, [{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], {
      duration: 180, delay: i * step, fill: 'backwards', easing: 'steps(3)',
    })
  );
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
