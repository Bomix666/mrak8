"""
Loads the real MRAK8 material into the CMS (idempotent — safe to re-run).

    python manage.py seed_mrak8

What it does, and what it deliberately does not:
  * On its first run, rewrites the copy of the zip hoodie (sku MRAK8-ZH-01)
    so it describes the actual garment in the photographs, and attaches the
    real photos and the rail cut-outs produced by tools/build_media.py.
    Later runs leave the product alone.
  * Leaves that product's PRICE and STOCK exactly as they are in the
    database — those are the owner's numbers, not something to guess.
  * Moves the four launch-seed placeholders that have no photography
    (hoodie / t-shirt / jeans / belt) to DRAFT so the shop doesn't sell
    items nobody has confirmed exist. Nothing is deleted: re-activate them
    in the admin with "Mark selected products as ACTIVE".
  * Creates the first JOURNAL entries from the shoot material. Entries that
    already exist are left alone, so editing them in the admin is safe.
"""

from datetime import timedelta
from pathlib import Path

from django.conf import settings
from django.core.files import File
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.catalog.models import Product, ProductDetail, ProductImage
from apps.journal.models import Block, Entry

SEED = Path(settings.BASE_DIR) / 'seed_media'

HOODIE_SKU = 'MRAK8-ZH-01'
PLACEHOLDER_SKUS = ['MRAK8-HD-01', 'MRAK8-TS-01', 'MRAK8-JN-01', 'MRAK8-BL-01']

BACK_PRINT = 'MRAK8 CENTRAL BOOKING & INTAKE CENTER. NO EMOTIONAL CONTRABAND. ALL SUBJECTS ARE MONITORED.'

# Only what can be seen on the garment in the photographs — no fabric
# weights, compositions or production claims.
HOODIE = {
    'name': 'ZIP HOODIE «НЕ ДИЗАЙНЕР»',
    'color': 'Молочный',
    'description': (
        'Зип-худи молочного цвета. На груди — красный принт «НЕ ДИЗАЙНЕР», '
        'на спине — три строки: MRAK8 CENTRAL BOOKING & INTAKE CENTER. '
        'На капюшоне — красная вышивка Mrak8.'
    ),
    'fit_description': (
        'Свободный силуэт со спущенной линией плеча. В рукавах — прорези: '
        'руки можно вывести наружу и оставить рукава свободными.'
    ),
    'shipping_note': 'Отправка в течение 3–5 дней после закрытия дропа. Финальная продажа: без рестока и обмена.',
    'details': [
        'Принт на груди: «НЕ ДИЗАЙНЕР»',
        f'Принт на спине: {BACK_PRINT}',
        'Вышивка Mrak8 на капюшоне',
        'Прорези в рукавах',
        'Молния по всей длине, карман-кенгуру',
        'Манжеты и низ на резинке',
    ],
    # (file, angle, alt)
    'images': [
        ('flat-front.webp', 'front', 'Зип-худи «НЕ ДИЗАЙНЕР», вид спереди'),
        ('flat-back.webp', 'back', 'Зип-худи «НЕ ДИЗАЙНЕР», вид сзади: текст на спине'),
        ('studio-frame.webp', 'campaign', 'Модель в зип-худи «НЕ ДИЗАЙНЕР» держит портрет в раме'),
        ('studio-hood.webp', 'campaign', 'Модель в зип-худи «НЕ ДИЗАЙНЕР», капюшон надет'),
    ],
}

# slug -> entry. Blocks: (kind, layout, {fields}); 'image'/'video' name files in seed_media/.
ENTRIES = [
    {
        'slug': 'park-night', 'kind': 'film', 'title': 'ПАРК. НОЧЬ.', 'is_featured': True,
        'excerpt': 'Ночной парк, фонарь, скамейка. Двое в «НЕ ДИЗАЙНЕР».',
        'cover_image': 'journal/film-park.jpg', 'cover_video': 'journal/film-park.mp4',
        'blocks': [
            ('video', 'full', {'video': 'journal/film-park.mp4', 'image': 'journal/film-park.jpg', 'caption': 'FILM 01'}),
            ('quote', 'wide', {'text': 'ALL SUBJECTS ARE MONITORED.', 'caption': 'Третья строка на спине худи'}),
            ('image', 'half', {'image': 'journal/group-detail-hood.webp', 'caption': 'Капюшон'}),
            ('image', 'half', {'image': 'journal/group-detail-print.webp', 'caption': 'Принт'}),
        ],
    },
    {
        'slug': 'subjects', 'kind': 'people', 'title': 'SUBJECTS',
        'excerpt': 'Трое. Ночь. Вспышка.',
        'cover_image': 'journal/group-wide.webp',
        'blocks': [
            ('image', 'full', {'image': 'journal/group-full.webp'}),
            ('quote', 'wide', {'text': 'NO EMOTIONAL CONTRABAND.', 'caption': 'Вторая строка на спине худи'}),
            ('image', 'half', {'image': 'journal/group-detail-hood.webp'}),
            ('image', 'half', {'image': 'journal/group-detail-print.webp'}),
            ('image', 'wide', {'image': 'journal/group-alt.webp', 'caption': 'Дубль'}),
        ],
    },
    {
        'slug': 'meet', 'kind': 'film', 'title': 'ВСТРЕЧА',
        'excerpt': 'Семь секунд: рукопожатие и вышивка на капюшоне.',
        'cover_image': 'journal/film-meet.jpg', 'cover_video': 'journal/film-meet.mp4',
        'blocks': [
            ('video', 'wide', {'video': 'journal/film-meet.mp4', 'image': 'journal/film-meet.jpg', 'caption': 'FILM 02'}),
        ],
    },
    {
        'slug': 'white-room', 'kind': 'shoot', 'title': 'БЕЛЫЙ ФОН',
        'excerpt': 'Студия. Худи, капюшон, портрет в раме.',
        'cover_image': 'product/studio-frame.webp',
        'blocks': [
            ('image', 'half', {'image': 'product/studio-frame.webp'}),
            ('image', 'half', {'image': 'product/studio-hood.webp'}),
            ('quote', 'wide', {'text': 'НЕ ДИЗАЙНЕР', 'caption': 'Принт на груди'}),
        ],
    },
    {
        'slug': 'object', 'kind': 'object', 'title': 'ОБЪЕКТ',
        'excerpt': 'Вещь без человека: лицо и спина.',
        'cover_image': 'product/flat-front.webp',
        'blocks': [
            ('image', 'strip', {'image': 'product/flat-front.webp', 'caption': 'Лицо'}),
            ('image', 'strip', {'image': 'product/flat-back.webp', 'caption': 'Спина'}),
            ('text', 'wide', {'heading': 'Текст на спине', 'text': BACK_PRINT.replace('. ', '.\n')}),
        ],
    },
]


_stored = {}  # (upload_to, seed file) -> stored name, so one film isn't copied per use


def attach(instance, field_name, relative):
    """Copy seed_media/<relative> into a File/ImageField (skips if already set)."""
    field = getattr(instance, field_name)
    if field:
        return
    key = (field.field.upload_to, relative)
    if key in _stored:
        setattr(instance, field_name, _stored[key])
        return
    path = SEED / relative
    with path.open('rb') as fh:
        field.save(path.name, File(fh), save=False)
    _stored[key] = field.name


class Command(BaseCommand):
    help = 'Loads the real MRAK8 product photography and the first journal entries.'

    def handle(self, *args, **options):
        if not SEED.exists():
            raise CommandError(f'{SEED} not found — run tools/build_media.py first.')

        hoodie = self.seed_hoodie()
        self.hide_placeholders()
        self.seed_journal(hoodie)

    def seed_hoodie(self):
        try:
            hoodie = Product.objects.get(sku=HOODIE_SKU)
        except Product.DoesNotExist:
            raise CommandError(f'Product {HOODIE_SKU} not found — run `manage.py seed_catalog` first.')

        seeded_names = {name.rsplit('.', 1)[0] for name, _, _ in HOODIE['images']}
        already_seeded = any(Path(img.image.name).stem.split('_')[0] in seeded_names for img in hoodie.images.all())
        if already_seeded:
            # Everything below is first-run only, so copy and photos edited
            # in the admin afterwards are never overwritten by a re-run.
            self.stdout.write(f'Product: {hoodie.name} already set up — left as is.')
            return hoodie

        for field in ('name', 'color', 'description', 'fit_description', 'shipping_note'):
            setattr(hoodie, field, HOODIE[field])
        hoodie.is_featured = True
        attach(hoodie, 'cutout_front', 'product/cutout-front.webp')
        attach(hoodie, 'cutout_back', 'product/cutout-back.webp')
        hoodie.save()

        hoodie.details.all().delete()
        ProductDetail.objects.bulk_create(
            [ProductDetail(product=hoodie, text=text, order=i) for i, text in enumerate(HOODIE['details'])]
        )

        # The two pre-production mock-ups (navy print) don't match the
        # produced garment (red print) — drop the rows, keep the files on disk.
        hoodie.images.all().delete()
        for order, (name, angle, alt) in enumerate(HOODIE['images']):
            image = ProductImage(product=hoodie, angle=angle, order=order, alt_text=alt)
            attach(image, 'image', f'product/{name}')
            image.save()
        self.stdout.write(self.style.SUCCESS(
            f'Product: {hoodie.name} — price {hoodie.current_price} {settings.SHOP_CURRENCY} and stock left as they were.'
        ))
        return hoodie

    def hide_placeholders(self):
        hidden = []
        for product in Product.objects.filter(sku__in=PLACEHOLDER_SKUS, status='active'):
            if product.images.exists():
                continue  # the owner gave it real photos — it's a real product now
            product.status = 'draft'
            product.save(update_fields=['status', 'updated_at'])
            hidden.append(product.code)
        if hidden:
            self.stdout.write(self.style.WARNING(
                f'Moved to DRAFT (no photography, unconfirmed): {", ".join(hidden)}. Re-activate in /admin/ if they are real.'
            ))

    def seed_journal(self, hoodie):
        now = timezone.now()
        for index, spec in enumerate(ENTRIES):
            if Entry.objects.filter(slug=spec['slug']).exists():
                self.stdout.write(f'Journal: {spec["slug"]} exists — left as is.')
                continue
            entry = Entry(
                slug=spec['slug'], title=spec['title'], kind=spec['kind'], excerpt=spec['excerpt'],
                is_featured=spec.get('is_featured', False),
                status='published', published_at=now - timedelta(minutes=index),
            )
            attach(entry, 'cover_image', spec['cover_image'])
            if spec.get('cover_video'):
                attach(entry, 'cover_video', spec['cover_video'])
            entry.save()
            entry.products.add(hoodie)

            for order, (kind, layout, fields) in enumerate(spec['blocks']):
                files = {k: fields[k] for k in ('image', 'video') if k in fields}
                block = Block(entry=entry, order=(order + 1) * 10, kind=kind, layout=layout,
                              **{k: v for k, v in fields.items() if k not in files})
                for field_name, relative in files.items():
                    attach(block, field_name, relative)
                block.full_clean(exclude=['entry'])
                block.save()
            self.stdout.write(self.style.SUCCESS(f'Journal: created {entry.code} {entry.title}'))
