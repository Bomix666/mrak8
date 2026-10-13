import secrets

from django.core.validators import MinValueValidator
from django.db import models

from apps.catalog.models import SIZE_CHOICES, Product
from apps.customers.models import Customer

ORDER_STATUS_CHOICES = [
    ('NEW', 'New'),
    ('PAYMENT_PENDING', 'Payment pending'),
    ('PAID', 'Paid'),
    ('PROCESSING', 'Processing'),
    ('PACKED', 'Packed'),
    ('SHIPPED', 'Shipped'),
    ('DELIVERED', 'Delivered'),
    ('CANCELLED', 'Cancelled'),
    ('REFUNDED', 'Refunded'),
]

# Statuses at or beyond this point mean payment has been confirmed and
# stock has already been decremented — used to guard against double
# decrementing on webhook retries.
PAID_STATUSES = {'PAID', 'PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED'}


def generate_order_number():
    return f'MRAK8-{secrets.token_hex(3).upper()}'


class Order(models.Model):
    order_number = models.CharField(max_length=20, unique=True, default=generate_order_number, editable=False)

    customer = models.ForeignKey(Customer, on_delete=models.SET_NULL, null=True, blank=True, related_name='orders')
    guest_email = models.EmailField(blank=True)
    guest_phone = models.CharField(max_length=32, blank=True)
    guest_first_name = models.CharField(max_length=60, blank=True)
    guest_last_name = models.CharField(max_length=60, blank=True)

    status = models.CharField(max_length=20, choices=ORDER_STATUS_CHOICES, default='NEW')

    subtotal = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    shipping_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    currency = models.CharField(max_length=3, default='USD')

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.order_number

    @property
    def contact_email(self):
        return self.customer.email if self.customer else self.guest_email

    @property
    def contact_name(self):
        if self.customer:
            return f'{self.customer.first_name} {self.customer.last_name}'.strip()
        return f'{self.guest_first_name} {self.guest_last_name}'.strip()

    @property
    def is_paid(self):
        return self.status in PAID_STATUSES

    def recalculate_totals(self, save=True):
        from decimal import Decimal
        self.subtotal = sum((item.line_total for item in self.items.all()), Decimal('0'))
        self.total = self.subtotal + self.shipping_cost
        if save:
            self.save(update_fields=['subtotal', 'total'])


class OrderItem(models.Model):
    """
    Snapshots product name/price/size at the moment of purchase so the
    order record never changes if the product is edited or removed later.
    `product` is kept as a reference for reporting but is never trusted
    for price at checkout time — see orders/serializers.py.
    """

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name='order_items')

    product_name = models.CharField(max_length=120)
    product_code = models.CharField(max_length=20)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])
    size = models.CharField(max_length=3, choices=SIZE_CHOICES)
    quantity = models.PositiveIntegerField(validators=[MinValueValidator(1)])

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f'{self.product_name} / {self.size} x{self.quantity}'

    @property
    def line_total(self):
        return self.unit_price * self.quantity


class ShippingAddress(models.Model):
    order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name='shipping_address')
    first_name = models.CharField(max_length=60)
    last_name = models.CharField(max_length=60)
    city = models.CharField(max_length=80)
    address_line = models.CharField(max_length=200)
    postal_code = models.CharField(max_length=20)
    country = models.CharField(max_length=60, default='Russia')
    phone = models.CharField(max_length=32)

    def __str__(self):
        return f'{self.address_line}, {self.city}'
