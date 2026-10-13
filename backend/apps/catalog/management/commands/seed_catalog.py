from django.core.management.base import BaseCommand

from apps.catalog.models import Category, Collection, Inventory, Product, ProductDetail


PRODUCTS = [
    {
        'name': 'ZIP HOODIE', 'sku': 'MRAK8-ZH-01', 'code': 'SIG.001', 'category': 'Zip Hoodie',
        'color': 'RAW BLACK', 'price': '240.00', 'is_new': True,
        'description': 'Heavyweight fleece, cold-dyed to an uneven near-black. Bonded zip track, no branding on face.',
        'fit': 'Cut oversized through the body with a dropped shoulder. Runs one size large — size down for a closer fit.',
        'details': ['480gsm brushed-back fleece', 'Bonded YKK zip, matte pull', 'Raw-cut hem, no ribbing', 'Interior chest stamp, no exterior branding'],
        'stock': {'XS': 3, 'S': 6, 'M': 8, 'L': 6, 'XL': 2},
    },
    {
        'name': 'HOODIE', 'sku': 'MRAK8-HD-01', 'code': 'SIG.002', 'category': 'Hoodie',
        'color': 'ASH GREY', 'price': '195.00', 'is_new': True,
        'description': 'Garment-dyed, stone-washed for an uneven surface. Boxed fit, heavy drape.',
        'fit': 'Boxy through the shoulder, cropped-neutral body length. True to size.',
        'details': ['420gsm loopback cotton', 'Garment-dyed / stone-washed finish', 'Double-needle construction', 'Woven label, no front print'],
        'stock': {'XS': 5, 'S': 10, 'M': 12, 'L': 9, 'XL': 4},
    },
    {
        'name': 'T-SHIRT', 'sku': 'MRAK8-TS-01', 'code': 'SIG.003', 'category': 'T-Shirt',
        'color': 'OFF WHITE', 'price': '85.00', 'is_new': False,
        'description': 'Heavy cotton jersey, single needle. Discharge print sits under the surface, not on top of it.',
        'fit': 'Straight body, standard length. True to size.',
        'details': ['230gsm combed cotton', 'Discharge print, no plastisol', 'Single-needle collar and hem', 'Pre-shrunk'],
        'stock': {'XS': 8, 'S': 14, 'M': 16, 'L': 12, 'XL': 6},
    },
    {
        'name': 'JEANS', 'sku': 'MRAK8-JN-01', 'code': 'SIG.004', 'category': 'Jeans',
        'color': 'RIGID BLACK', 'price': '210.00', 'is_new': False,
        'description': 'Rigid selvedge denim, unwashed. Breaks in over the first month of wear.',
        'fit': 'Straight leg, mid rise. Sizes run true — expect one inch of stretch after break-in.',
        'details': ['14oz rigid selvedge denim', 'Unwashed — will bleed on first contact', 'Hardware in matte black finish', 'Chain-stitched hem'],
        'stock': {'XS': 2, 'S': 6, 'M': 8, 'L': 7, 'XL': 3},
    },
    {
        'name': 'BELT', 'sku': 'MRAK8-BL-01', 'code': 'SIG.005', 'category': 'Belt',
        'color': 'GUNMETAL', 'price': '65.00', 'is_new': False,
        'description': 'Solid-cast buckle, no logo. Full-grain strap, cut long and trimmed to size.',
        'fit': 'Cut long — trim at the tip to fit. One size fits most waists.',
        'details': ['Full-grain leather, 4mm strap', 'Solid-cast gunmetal buckle', 'Untreated edge, will patina', 'One size, adjustable'],
        'stock': {'XS': 0, 'S': 0, 'M': 0, 'L': 0, 'XL': 0},  # one-size item — see note below
    },
]


class Command(BaseCommand):
    help = 'Seeds the catalog with the MRAK8 launch drop (idempotent — safe to re-run).'

    def handle(self, *args, **options):
        collection, _ = Collection.objects.get_or_create(
            slug='first-signal',
            defaults={'name': 'First Signal', 'description': 'Drop 004. Shot over one night at the production site.', 'is_active': True},
        )

        for entry in PRODUCTS:
            category, _ = Category.objects.get_or_create(name=entry['category'])

            product, created = Product.objects.update_or_create(
                sku=entry['sku'],
                defaults={
                    'name': entry['name'],
                    'code': entry['code'],
                    'category': category,
                    'collection': collection,
                    'color': entry['color'],
                    'price': entry['price'],
                    'status': 'active',
                    'is_new': entry['is_new'],
                    'description': entry['description'],
                    'fit_description': entry['fit'],
                },
            )

            if created:
                for i, text in enumerate(entry['details']):
                    ProductDetail.objects.create(product=product, text=text, order=i)

            for size, qty in entry['stock'].items():
                Inventory.objects.update_or_create(product=product, size=size, defaults={'quantity': qty})

            self.stdout.write(self.style.SUCCESS(f'{"Created" if created else "Updated"}: {product.code} {product.name}'))

        self.stdout.write(self.style.WARNING(
            'Reminder: no product photography has been attached. Upload real images per '
            'product in /admin/ — the frontend placeholder system covers anything left blank.'
        ))
