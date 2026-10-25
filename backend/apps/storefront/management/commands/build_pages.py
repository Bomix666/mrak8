"""
Static export of the storefront for hosts with no server (GitHub Pages).

    python manage.py build_pages --out ../_pages --base /mrak8 --origin https://user.github.io

What comes out is a showcase, not a shop: every page, product and journal
entry as it is in the database right now, with the API answers baked into
JSON files. Nothing can be ordered there (see STATIC_MODE in the frontend),
and nothing from orders, customers or payments is exported.

Re-run it after changing content in the admin, then publish the folder again.
"""

import json
import shutil
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.test import Client, override_settings

from apps.catalog.models import VISIBLE_STATUSES, Product
from apps.journal.models import Entry

PAGES = ['/', '/shop/', '/journal/', '/about/', '/shipping/', '/contact/', '/account/', '/checkout/']


class Command(BaseCommand):
    help = 'Writes a static, order-less copy of the storefront (for GitHub Pages).'

    def add_arguments(self, parser):
        parser.add_argument('--out', required=True, help='Folder to write into (emptied first).')
        parser.add_argument('--base', default='', help="Folder the site is published under, e.g. /mrak8 ('' for a domain root).")
        parser.add_argument('--origin', required=True, help='Public origin, e.g. https://user.github.io')

    def handle(self, *args, out, base, origin, **options):
        out = Path(out).resolve()
        base = base.rstrip('/')
        origin = origin.rstrip('/')
        if out.exists() and any(out.iterdir()) and not (out / '.nojekyll').exists():
            raise CommandError(f'{out} is not empty and is not a previous export — refusing to wipe it.')
        shutil.rmtree(out, ignore_errors=True)
        out.mkdir(parents=True)

        host = origin.split('://', 1)[1]
        # DEBUG off: production shell. Throttling off: this is us, not a visitor.
        rest = {**settings.REST_FRAMEWORK, 'DEFAULT_THROTTLE_CLASSES': []}
        with override_settings(DEBUG=False, ALLOWED_HOSTS=[host.split(':')[0]], STATIC_EXPORT_BASE=base,
                               SECURE_SSL_REDIRECT=False, REST_FRAMEWORK=rest):
            client = Client(HTTP_HOST=host)
            secure = origin.startswith('https')

            def rebase(text):
                # Uploaded files are published under the base folder too.
                return text.replace(f'{origin}/media/', f'{origin}{base}/media/')

            def page(path, target, expect=200):
                response = client.get(path, secure=secure)
                if response.status_code != expect:
                    raise CommandError(f'{path} answered {response.status_code}')
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(rebase(response.content.decode()), encoding='utf-8')

            def data(path, query=None, name=None):
                response = client.get(f'/api{path}', query or {}, secure=secure)
                if response.status_code != 200:
                    raise CommandError(f'/api{path} answered {response.status_code}')
                target = out / 'data' / (name or path).strip('/') / 'index.json'
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(rebase(json.dumps(response.json(), ensure_ascii=False)), encoding='utf-8')

            products = list(Product.objects.filter(status__in=VISIBLE_STATUSES).values_list('slug', flat=True))
            entries = list(Entry.objects.filter(status='published').values_list('slug', flat=True))

            for path in PAGES:
                page(path, out / path.strip('/') / 'index.html')
            for slug in products:
                page(f'/product/{slug}/', out / 'product' / slug / 'index.html')
            for slug in entries:
                page(f'/journal/{slug}/', out / 'journal' / slug / 'index.html')
            # Pages serves this for every unknown address — which is also how
            # an order link or a mistyped URL still gets the app and its 404.
            page('/no-such-page/', out / '404.html', expect=404)

            data('/products/', {'limit': 100})
            data('/categories/')
            data('/journal/', {'limit': 60})
            for slug in products:
                data(f'/products/{slug}/')
                data(f'/products/{slug}/related/')
                data('/journal/', {'product': slug, 'limit': 60}, name=f'/journal/product-{slug}/')
            for slug in entries:
                data(f'/journal/{slug}/')

        shutil.copytree(settings.FRONTEND_DIR, out / 'site', ignore=shutil.ignore_patterns('index.html'))
        if Path(settings.MEDIA_ROOT).exists():
            shutil.copytree(settings.MEDIA_ROOT, out / 'media')
        (out / '.nojekyll').write_text('')  # serve folders as they are

        files = [f for f in out.rglob('*') if f.is_file()]
        size = sum(f.stat().st_size for f in files) / 1024 / 1024
        self.stdout.write(self.style.SUCCESS(
            f'{len(files)} files, {size:.1f} MB → {out}  ({len(products)} products, {len(entries)} journal entries)'
        ))
