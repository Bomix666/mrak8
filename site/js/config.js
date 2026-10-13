// MRAK8 — frontend configuration.
// The shell (index.html) is rendered by Django, which stamps the static
// prefix and the shop currency onto <body>. The API lives on the same
// origin; set window.MRAK8_API_BASE_URL before app.js loads to point at
// another host.
const { dataset } = document.body;

export const API_BASE_URL = window.MRAK8_API_BASE_URL || dataset.api || '/api';

// Static export (GitHub Pages, see `manage.py build_pages`): no server
// behind the site. BASE is the folder it is published under ('/mrak8'),
// the "API" is a tree of pre-rendered JSON files, and ordering is off.
export const BASE = dataset.base || '';
export const STATIC_MODE = dataset.mode === 'static';
export const STATIC_URL = dataset.static || '/site/';
export const CURRENCY = dataset.currency || 'USD';

/** URL of a fixed brand asset built by tools/build_media.py. */
export const asset = (file) => `${STATIC_URL}assets/media/${file}`;
