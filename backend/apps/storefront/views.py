"""
Storefront shell.

The frontend is a no-build ES-module app (frontend/). Django serves its
single HTML shell for every storefront URL and fills in what a crawler or
a link preview needs before any JavaScript runs: a real <title>, meta
description, Open Graph tags, product structured data, a <noscript>
summary — and a real 404 status for things that don't exist.

All of it is read from the database. Nothing here invents catalogue data.
"""

import json

from django.conf import settings
from django.shortcuts import render
from django.templatetags.static import static
from django.utils.safestring import mark_safe
from django.utils.text import Truncator
from django.views.static import serve

from apps.catalog.models import VISIBLE_STATUSES, Product
from apps.journal.models import Entry

SITE_NAME = 'MRAK8'

PAGES = {
    'home': {
        'title': 'MRAK8 — НЕ ДИЗАЙНЕР',
        'description': 'MRAK8. Цифровой шоурум, магазин и журнал бренда.',
    },
    'shop': {'title': 'SHOP — MRAK8', 'description': 'Каталог MRAK8: вещи в наличии, размеры и цены.'},
    'journal': {'title': 'JOURNAL — MRAK8', 'description': 'Журнал MRAK8: съёмки, видео и архив бренда.'},
    'about': {'title': 'ABOUT — MRAK8', 'description': 'MRAK8. No emotional contraband. All subjects are monitored.'},
    'shipping': {'title': 'Доставка и возврат — MRAK8', 'description': 'Условия доставки и возврата заказов MRAK8.'},
    'contact': {'title': 'Контакты — MRAK8', 'description': 'Связь с MRAK8 по вопросам заказов.'},
    'account': {'title': 'Мой заказ — MRAK8', 'description': 'Статус заказа MRAK8 по номеру и e-mail.', 'noindex': True},
    'checkout': {'title': 'Оформление заказа — MRAK8', 'description': '', 'noindex': True},
    'order': {'title': 'Заказ — MRAK8', 'description': '', 'noindex': True},
}


def _shell(request, meta, status=200, noscript=None, structured=None):
    base = export_base()
    meta = {
        'image': request.build_absolute_uri(site_prefix() + 'assets/media/group-wide-1400.webp'),
        'type': 'website',
        **meta,
        'url': request.build_absolute_uri(base + request.path),
    }
    if structured is not None:
        # Same escaping Django's json_script uses, so the JSON can't close the tag.
        payload = json.dumps(structured, ensure_ascii=False)
        structured = mark_safe(payload.replace('<', '\\u003C').replace('>', '\\u003E').replace('&', '\\u0026'))
    context = {
        'meta': meta, 'noscript': noscript, 'structured': structured,
        'currency': settings.SHOP_CURRENCY, 'site': site_prefix(),
        'base': base, 'export': bool(base),
    }
    return render(request, 'index.html', context, status=status)


def site_prefix():
    """Where the browser loads frontend files from. In development that is
    /site/ (see site_file below); in production the collected static files."""
    if export_base():
        return f'{export_base()}/site/'
    return '/site/' if settings.DEBUG else static('site/')


def export_base():
    """'/mrak8' while `manage.py build_pages` renders the static export, '' otherwise."""
    return getattr(settings, 'STATIC_EXPORT_BASE', '')


def site_file(request, path):
    """DEV ONLY (routed only when DEBUG). Serves frontend/ with
    `Cache-Control: no-cache`, so the browser revalidates every module and
    an edit is visible on a plain reload — runserver's own static handler
    sends no cache headers, and browsers then keep stale JS for minutes."""
    response = serve(request, path, document_root=settings.FRONTEND_DIR)
    response['Cache-Control'] = 'no-cache'
    return response


def page(request, key):
    return _shell(request, PAGES[key])


def not_found(request, *args, **kwargs):
    return _shell(request, {'title': '404 — MRAK8', 'description': '', 'noindex': True}, status=404)


def product(request, slug):
    item = (
        Product.objects.filter(slug=slug, status__in=VISIBLE_STATUSES)
        .prefetch_related('images', 'inventory')
        .first()
    )
    if item is None:
        return not_found(request)

    images = [request.build_absolute_uri(img.image.url) for img in item.images.all()]
    description = Truncator(item.description).chars(200)
    meta = {
        'title': f'{item.name} — {SITE_NAME}',
        'description': description,
        'type': 'product',
        'price': str(item.current_price),  # str: templates would localise a Decimal to "120,00"
    }
    if images:
        meta['image'] = images[0]
    structured = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        'name': item.name,
        'sku': item.sku,
        'color': item.color,
        'description': item.description,
        'image': images,
        'brand': {'@type': 'Brand', 'name': SITE_NAME},
        'offers': {
            '@type': 'Offer',
            'url': request.build_absolute_uri(export_base() + item.get_absolute_url()),
            'price': str(item.current_price),
            'priceCurrency': settings.SHOP_CURRENCY,
            'availability': (
                'https://schema.org/InStock' if item.drop_state == 'live' else 'https://schema.org/OutOfStock'
            ),
        },
    }
    if item.is_drop_pending and item.drop_at:
        structured['offers']['availabilityStarts'] = item.drop_at.isoformat()
    noscript = {
        'heading': item.name,
        'lines': [item.color, f'{item.current_price} {settings.SHOP_CURRENCY}', item.description],
    }
    return _shell(request, meta, noscript=noscript, structured=structured)


def journal_entry(request, slug):
    entry = Entry.objects.filter(slug=slug).first()
    is_draft = entry is not None and entry.status != 'published'
    if entry is None or (is_draft and not request.user.is_staff):
        return not_found(request)

    meta = {
        'title': f'{entry.title} — {SITE_NAME} JOURNAL',
        'description': Truncator(entry.excerpt).chars(200),
        'type': 'article',
        'noindex': is_draft,
    }
    if entry.cover_image:
        meta['image'] = request.build_absolute_uri(entry.cover_image.url)
    return _shell(request, meta, noscript={'heading': entry.title, 'lines': [entry.excerpt]})
