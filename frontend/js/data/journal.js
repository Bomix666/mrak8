// MRAK8 — journal data source (the only module that talks to /api/journal/).

import { apiFetch } from '../services/apiClient.js';
import { normalizeProduct } from './products.js';

function normalizeEntry(raw) {
  return {
    code: raw.code,
    slug: raw.slug,
    title: raw.title,
    kind: raw.kind,
    kindLabel: raw.kind_label,
    excerpt: raw.excerpt || '',
    cover: raw.cover, // {url, srcset, width, height} | null
    coverVideo: raw.cover_video,
    isDraft: raw.status !== 'published',
    publishedAt: raw.published_at,
    featured: raw.is_featured,
    blocks: raw.blocks || [],
    products: (raw.products || []).map(normalizeProduct),
  };
}

export async function getEntries({ featured, product } = {}) {
  const data = await apiFetch('/journal/', {
    params: { featured: featured ? 'true' : undefined, product, limit: 60 },
  });
  return (data.results || data).map(normalizeEntry);
}

export async function getEntryBySlug(slug) {
  try {
    return normalizeEntry(await apiFetch(`/journal/${encodeURIComponent(slug)}/`));
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}
