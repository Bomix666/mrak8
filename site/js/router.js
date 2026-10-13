// MRAK8 — minimal router.
// Vanilla, dependency-free, real URLs (History API). Django serves the
// same shell for every storefront path, so a hard reload or a shared link
// lands on the right page — and gets the right <title>/Open Graph tags
// server-side (see backend/apps/storefront).
//
// A route resolves to an async render(view, { ...params, query, onLeave })
// exported by a page module. Each navigation renders into a fresh element that is swapped in
// only when ready, so a slow page can never paint over a newer one.

import { BASE } from './config.js';

const routes = [];
let notFoundRender = null;
let container = null;
let loader = null;
let activeCleanups = []; // teardown for the page currently on screen
let navigation = 0;

export function registerRoute(pattern, render) {
  // pattern like '/', '/shop', '/product/:slug'
  const keys = [];
  const regex = new RegExp(
    '^' +
      pattern
        .replace(/\/:[^/]+/g, (m) => {
          keys.push(m.slice(2));
          return '/([^/]+)';
        })
        .replace(/\//g, '\\/') +
      '$'
  );
  routes.push({ regex, keys, render });
}

export function setNotFound(render) {
  notFoundRender = render;
}

export function navigate(path, { replace = false } = {}) {
  if (replace) {
    replaceUrl(path);
  } else {
    // Remember where this page was scrolled to, for the back button.
    history.replaceState({ y: window.scrollY }, '');
    history.pushState(null, '', BASE + path);
  }
  return resolveRoute({ restoreScroll: false });
}

/** Swap the address bar to an app path ('/shop/?sort=…') without navigating. */
export function replaceUrl(path) {
  history.replaceState(history.state, '', BASE + path);
}

// App paths are always written from the root ('/shop/'); BASE is added
// only when they touch the address bar and removed when read back.
const stripBase = (pathname) => (BASE && pathname.startsWith(BASE) ? pathname.slice(BASE.length) || '/' : pathname);

function currentLocation() {
  const path = stripBase(window.location.pathname).replace(/\/+$/, '') || '/';
  const query = Object.fromEntries(new URLSearchParams(window.location.search));
  return { path, query };
}

function match(path) {
  for (const route of routes) {
    const found = path.match(route.regex);
    if (!found) continue;
    const params = {};
    route.keys.forEach((key, i) => (params[key] = decodeURIComponent(found[i + 1])));
    return { render: route.render, params };
  }
  return { render: notFoundRender, params: {} };
}

function renderFailure(view, retry) {
  view.innerHTML = `
    <section class="state" data-theme="dark">
      <p class="mono">Ошибка связи</p>
      <h1>Сервер не отвечает</h1>
      <p>Страница не загрузилась. Проверьте соединение и попробуйте ещё раз.</p>
      <button class="btn btn--ghost" data-retry>Повторить</button>
    </section>`;
  view.querySelector('[data-retry]').addEventListener('click', retry);
}

export async function resolveRoute({ restoreScroll = false, initial = false } = {}) {
  const ticket = ++navigation;
  const { path, query } = currentLocation();
  const { render, params } = match(path);

  loader?.classList.add('is-active');

  const view = document.createElement('div');
  view.className = 'view view-enter';
  // Pages register teardown work (observers, listeners) through onLeave.
  const pageCleanups = [];
  const onLeave = (fn) => pageCleanups.push(fn);

  let meta = null;
  try {
    meta = await render(view, { ...params, query, onLeave });
  } catch (err) {
    console.error(err);
    renderFailure(view, () => resolveRoute());
  }

  if (ticket !== navigation) {
    // A newer navigation started while this one was loading — discard.
    pageCleanups.forEach((fn) => fn());
    return;
  }

  activeCleanups.forEach((fn) => fn());
  activeCleanups = pageCleanups;
  container.replaceChildren(view);
  loader?.classList.remove('is-active');

  if (meta?.title) document.title = meta.title;
  if (meta?.description !== undefined) {
    document.querySelector('meta[name="description"]')?.setAttribute('content', meta.description);
  }

  window.scrollTo(0, restoreScroll ? history.state?.y || 0 : 0);
  if (!initial) container.focus({ preventScroll: true });
  document.dispatchEvent(new CustomEvent('mrak8:navigated', { detail: { path } }));
}

function onLinkClick(e) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const link = e.target.closest('a[href]');
  if (!link || link.target || link.hasAttribute('download') || link.origin !== window.location.origin) return;
  const pathname = stripBase(link.pathname);
  if (/^\/(admin|api|media|static|site|data)(\/|$)/.test(pathname)) return;

  e.preventDefault();
  const next = pathname + link.search;
  if (next === stripBase(window.location.pathname) + window.location.search) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  navigate(next);
}

export function startRouter(root) {
  container = root;
  loader = document.createElement('div');
  loader.className = 'route-loader';
  loader.setAttribute('aria-hidden', 'true');
  document.body.append(loader);

  // Links from the old hash-routed build (#/product/…) keep working.
  if (window.location.hash.startsWith('#/')) {
    history.replaceState(null, '', window.location.hash.slice(1));
  }

  // Published under a folder: give every root-relative link its real
  // address, so "open in new tab" and copied links work too.
  if (BASE) {
    const fix = (root) => root.querySelectorAll?.('a[href^="/"]').forEach((a) => {
      const href = a.getAttribute('href');
      if (!href.startsWith(`${BASE}/`)) a.setAttribute('href', BASE + href);
    });
    fix(document);
    new MutationObserver((records) => records.forEach((r) => r.addedNodes.forEach(fix)))
      .observe(document.body, { childList: true, subtree: true });
  }

  history.scrollRestoration = 'manual';
  document.addEventListener('click', onLinkClick);
  window.addEventListener('popstate', () => resolveRoute({ restoreScroll: true }));
  return resolveRoute({ initial: true });
}
