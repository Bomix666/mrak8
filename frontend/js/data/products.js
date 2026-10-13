// MRAK8 — product data source.
// Talks to the Django API. No component elsewhere imports fetch or the
// API client directly — this module is the only seam, so if the payload
// shape ever changes on the backend, this is the only file that needs
// to change with it.

import { apiFetch } from '../services/apiClient.js';

export { formatPrice } from '../utils/format.js';

const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL'];

function centsFromDecimalString(value) {
  return Math.round(parseFloat(value) * 100);
}

export function normalizeProduct(raw) {
  const sizes = (raw.inventory || [])
    .map((row) => ({ size: row.size, quantity: row.quantity }))
    .sort((a, b) => SIZE_ORDER.indexOf(a.size) - SIZE_ORDER.indexOf(b.size));
  const totalStock = sizes.reduce((sum, row) => sum + row.quantity, 0);
  const price = centsFromDecimalString(raw.price);
  const listPrice = centsFromDecimalString(raw.original_price);

  return {
    id: raw.id,
    slug: raw.slug,
    name: raw.name,
    category: raw.category,
    color: raw.color,
    price,
    // Only set when the product is genuinely marked down in the admin.
    originalPrice: listPrice > price ? listPrice : null,
    code: raw.code,
    units: raw.is_sold_out ? 0 : totalStock,
    soldOut: raw.is_sold_out,
    new: raw.is_new,
    featured: raw.is_featured,
    description: raw.description || '',
    details: raw.details || [],
    fit: raw.fit_description || '',
    shipping: raw.shipping_note || '',
    // [{url, srcset, width, height, angle, alt}] — empty when no photography
    // has been uploaded; components then render the typographic fallback.
    images: (raw.images || []).map((img) => ({
      url: img.url,
      srcset: img.srcset,
      width: img.width,
      height: img.height,
      angle: img.angle,
      alt: img.alt_text || raw.name,
    })),
    sizes,
    cutoutFront: raw.cutout_front,
    cutoutBack: raw.cutout_back,
  };
}

function list(data) {
  return (data.results || data).map(normalizeProduct);
}

let categoriesCache = null;

export async function getCategories() {
  if (categoriesCache) return categoriesCache;
  const data = await apiFetch('/categories/');
  categoriesCache = (data.results || data).map((c) => ({ name: c.name, slug: c.slug }));
  return categoriesCache;
}

// ponytail: one request, sorted in the browser — fine up to this limit;
// move sorting/paging to the API when the catalogue outgrows it.
const CATALOGUE_LIMIT = 100;

export async function getProducts({ category, featured } = {}) {
  const data = await apiFetch('/products/', {
    params: { category, featured: featured ? 'true' : undefined, limit: CATALOGUE_LIMIT },
  });
  return list(data);
}

export async function getNewProducts() {
  return list(await apiFetch('/products/', { params: { new: 'true' } }));
}

export async function getProductBySlug(slug) {
  try {
    return normalizeProduct(await apiFetch(`/products/${encodeURIComponent(slug)}/`));
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

export async function getRelatedProducts(slug, limit = 3) {
  const data = await apiFetch(`/products/${encodeURIComponent(slug)}/related/`);
  return list(data).slice(0, limit);
}
