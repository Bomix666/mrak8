from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone
from django.utils.text import slugify

from .media import build_variants


SIZE_CHOICES = [
    ('XS', 'XS'),
    ('S', 'S'),
    ('M', 'M'),
    ('L', 'L'),
    ('XL', 'XL'),
    ('OS', 'One size'),
]
APPAREL_SIZES = [size for size, _ in SIZE_CHOICES if size != 'OS']

IMAGE_ANGLE_CHOICES = [
    ('main', 'Main'),
    ('front', 'Front'),
    ('back', 'Back'),
    ('detail', 'Detail'),
    ('campaign', 'Campaign'),
]

PRODUCT_STATUS_CHOICES = [
    ('draft', 'Draft'),
    ('drop', 'Drop soon'),
    ('active', 'Active'),
    ('archived', 'Archived'),
]
# Shown on the site. A 'drop' product is visible with a countdown and
# becomes buyable on its own once drop_at has passed — no cron needed.
VISIBLE_STATUSES = ('drop', 'active')


class Category(models.Model):
    name = models.CharField(max_length=80, unique=True)
    slug = models.SlugField(max_length=90, unique=True, blank=True)
    order = models.PositiveIntegerField(default=0)
    one_size = models.BooleanField(
        default=False,
        help_text='Products in this category get a single One size stock row instead of XS–XL (e.g. beanies).',
    )

    class Meta:
        verbose_name_plural = 'Categories'
        ordering = ['order', 'name']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)


class Collection(models.Model):
    name = models.CharField(max_length=120, unique=True)
    slug = models.SlugField(max_length=140, unique=True, blank=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    launch_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-launch_date', '-created_at']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)


class Product(models.Model):
    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=140, unique=True, blank=True)
    code = models.CharField(max_length=20, unique=True, help_text='Archive code shown on the frontend, e.g. SIG.001')
    sku = models.CharField(max_length=40, unique=True)

    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name='products')
    collection = models.ForeignKey(Collection, on_delete=models.SET_NULL, null=True, blank=True, related_name='products')

    color = models.CharField(max_length=60)
    description = models.TextField(blank=True)
    fit_description = models.TextField(blank=True, help_text='Shown under the FIT accordion on the product page.')
    shipping_note = models.TextField(
        blank=True,
        default='Dispatched within 3–5 days of drop close. Final sale — no restock, no exchange.',
    )

    price = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])
    sale_price = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(0)],
        help_text='Leave blank if the item is not discounted.',
    )

    status = models.CharField(max_length=10, choices=PRODUCT_STATUS_CHOICES, default='draft')
    drop_at = models.DateTimeField(
        null=True, blank=True,
        help_text='Drop soon: sales open at this moment. Empty = «скоро» without a date.',
    )
    measurements = models.JSONField(
        default=dict, blank=True,
        help_text='Flat measurements in cm, e.g. {"circumference_cm": 46, "height_cm": 21}.',
    )
    is_featured = models.BooleanField(default=False)
    is_new = models.BooleanField(default=False)
    sold_out_override = models.BooleanField(
        default=False,
        help_text='Force SOLD OUT regardless of remaining inventory (e.g. discontinued item).',
    )

    # Showroom rail: the garment cut out on a transparent background (PNG or
    # WebP with alpha). A product without a front cut-out simply doesn't
    # hang on the homepage rail — it still sells normally everywhere else.
    cutout_front = models.ImageField(
        upload_to='products/rail/', blank=True,
        width_field='cutout_front_width', height_field='cutout_front_height',
        help_text='Transparent PNG/WebP of the front. Puts this product on the homepage rail.',
    )
    cutout_front_width = models.PositiveIntegerField(null=True, blank=True, editable=False)
    cutout_front_height = models.PositiveIntegerField(null=True, blank=True, editable=False)
    cutout_back = models.ImageField(
        upload_to='products/rail/', blank=True,
        width_field='cutout_back_width', height_field='cutout_back_height',
        help_text='Transparent PNG/WebP of the back. Optional — lets the hanger be turned around.',
    )
    cutout_back_width = models.PositiveIntegerField(null=True, blank=True, editable=False)
    cutout_back_height = models.PositiveIntegerField(null=True, blank=True, editable=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.code} — {self.name}'

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(f'{self.name}-{self.sku}')
        super().save(*args, **kwargs)
        build_variants(self.cutout_front)
        build_variants(self.cutout_back)

    def get_absolute_url(self):
        return f'/product/{self.slug}/'

    @property
    def current_price(self):
        return self.sale_price if self.sale_price is not None else self.price

    @property
    def total_stock(self):
        return sum(row.quantity for row in self.inventory.all())

    @property
    def is_sold_out(self):
        return self.sold_out_override or self.total_stock <= 0

    @property
    def is_drop_pending(self):
        return self.status == 'drop' and (self.drop_at is None or self.drop_at > timezone.now())

    @property
    def drop_state(self):
        """soon / live / soldout — what the storefront shows."""
        if self.is_drop_pending:
            return 'soon'
        return 'soldout' if self.is_sold_out else 'live'

    LOW_STOCK_THRESHOLD = 5

    @property
    def is_low_stock(self):
        return 0 < self.total_stock <= self.LOW_STOCK_THRESHOLD

    def details_list(self):
        return list(self.details.values_list('text', flat=True))


class ProductDetail(models.Model):
    """A single bullet under the DETAILS accordion. Kept as rows, not a
    JSON blob, so the admin can add/reorder/delete them individually."""

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='details')
    text = models.CharField(max_length=160)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return self.text


class ProductImage(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to='products/%Y/%m/', width_field='width', height_field='height')
    width = models.PositiveIntegerField(null=True, blank=True, editable=False)
    height = models.PositiveIntegerField(null=True, blank=True, editable=False)
    angle = models.CharField(max_length=10, choices=IMAGE_ANGLE_CHOICES, default='front')
    order = models.PositiveIntegerField(default=0)
    alt_text = models.CharField(max_length=140, blank=True)

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return f'{self.product.name} — {self.get_angle_display()}'

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        build_variants(self.image)


class Inventory(models.Model):
    """One row per (product, size). Created automatically for every size
    when a product is created — see signals.py — so the admin always sees
    all five rows ready to fill in."""

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='inventory')
    size = models.CharField(max_length=3, choices=SIZE_CHOICES)
    quantity = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name_plural = 'Inventory'
        unique_together = [('product', 'size')]
        ordering = ['product', 'size']

    def __str__(self):
        return f'{self.product.code} / {self.size} — {self.quantity}'
