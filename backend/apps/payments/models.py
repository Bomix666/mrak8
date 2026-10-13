from django.db import models

from apps.orders.models import Order

PAYMENT_STATUS_CHOICES = [
    ('PENDING', 'Pending'),
    ('CONFIRMED', 'Confirmed'),
    ('FAILED', 'Failed'),
    ('REFUNDED', 'Refunded'),
]

PROVIDER_CHOICES = [
    ('manual_test', 'Manual (dev/test only)'),
    ('yookassa', 'YooKassa'),
    ('tbank', 'T-Bank'),
]


class Payment(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='payments')
    provider = models.CharField(max_length=20, choices=PROVIDER_CHOICES)
    provider_payment_id = models.CharField(max_length=120, blank=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default='USD')
    status = models.CharField(max_length=12, choices=PAYMENT_STATUS_CHOICES, default='PENDING')
    raw_webhook_payload = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.order.order_number} / {self.provider} / {self.status}'
