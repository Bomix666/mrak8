// MRAK8 — cart store.
// Lives in the browser (localStorage), so it survives a reload. It is a
// convenience, never a source of truth: checkout sends only
// {product_id, size, quantity} and the server re-reads price and stock.
// What is shown here is refreshed from the API by syncCart() so a stale
// tab doesn't keep displaying an old price.

import { getProductBySlug } from '../data/products.js';

const STORAGE_KEY = 'mrak8.cart.v1';
const MAX_PER_LINE = 10; // mirrors the server's per-line limit

// { id, slug, name, price, color, size, qty, code, image, max }
const state = { items: load(), notice: '' };
const listeners = new Set();

function load() {
  try {
    const items = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(items) ? items.filter((i) => i && i.id && i.size && i.qty > 0) : [];
  } catch {
    return []; // storage blocked or corrupted — start with an empty cart
  }
}

function commit() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
  } catch {
    /* private mode: the cart still works for this tab */
  }
  const snapshot = getCart();
  listeners.forEach((fn) => fn(snapshot));
}

const sameLine = (a, id, size) => a.id === id && a.size === size;
const lineLimit = (item) => Math.min(MAX_PER_LINE, item.max ?? MAX_PER_LINE);

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getCart() {
  return {
    items: state.items.map((i) => ({ ...i, limit: lineLimit(i) })),
    count: state.items.reduce((sum, i) => sum + i.qty, 0),
    total: state.items.reduce((sum, i) => sum + i.qty * i.price, 0),
    notice: state.notice,
  };
}

/** Returns false when the line is already at its stock limit. */
export function addToCart(item) {
  const existing = state.items.find((i) => sameLine(i, item.id, item.size));
  if (existing) {
    Object.assign(existing, item, { qty: existing.qty });
    if (existing.qty >= lineLimit(existing)) {
      commit();
      return false;
    }
    existing.qty += 1;
  } else {
    state.items.push({ ...item, qty: 1 });
  }
  state.notice = '';
  commit();
  return true;
}

export function setQty(id, size, qty) {
  const item = state.items.find((i) => sameLine(i, id, size));
  if (!item) return;
  if (qty <= 0) {
    state.items = state.items.filter((i) => !sameLine(i, id, size));
  } else {
    item.qty = Math.min(qty, lineLimit(item));
  }
  commit();
}

export function removeFromCart(id, size) {
  state.items = state.items.filter((i) => !sameLine(i, id, size));
  commit();
}

export function clearCart() {
  state.items = [];
  state.notice = '';
  commit();
}

/**
 * Re-read every product in the cart and bring lines in step with the
 * catalogue: current price, current stock, and removal of anything that
 * is gone. Tells the shopper when something changed.
 */
export async function syncCart() {
  if (state.items.length === 0) return;
  const slugs = [...new Set(state.items.map((i) => i.slug))];
  const fresh = new Map();
  try {
    await Promise.all(slugs.map(async (slug) => fresh.set(slug, await getProductBySlug(slug))));
  } catch {
    return; // offline — keep the cart as it is; checkout re-validates anyway
  }

  const changes = [];
  state.items = state.items.filter((item) => {
    const product = fresh.get(item.slug);
    const stock = product?.soldOut ? 0 : product?.sizes.find((s) => s.size === item.size)?.quantity ?? 0;
    if (!product || stock <= 0) {
      changes.push(`${item.name} (${item.size}) больше нет в наличии — убрали из корзины.`);
      return false;
    }
    if (product.price !== item.price) changes.push(`Цена на ${product.name} изменилась.`);
    Object.assign(item, { id: product.id, name: product.name, price: product.price, color: product.color, max: stock });
    if (item.qty > lineLimit(item)) {
      item.qty = lineLimit(item);
      changes.push(`${product.name} (${item.size}): в наличии только ${item.qty}.`);
    }
    return true;
  });

  state.notice = [...new Set(changes)].join(' ');
  commit();
}
