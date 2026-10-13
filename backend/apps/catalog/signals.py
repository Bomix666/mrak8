from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Inventory, Product, SIZE_CHOICES


@receiver(post_save, sender=Product)
def create_inventory_rows(sender, instance, created, **kwargs):
    """Every product gets one Inventory row per size (quantity 0) the
    moment it's created, so the admin always has XS/S/M/L/XL ready to
    fill in rather than having to add rows manually."""
    if not created:
        return
    Inventory.objects.bulk_create(
        [Inventory(product=instance, size=size, quantity=0) for size, _ in SIZE_CHOICES],
        ignore_conflicts=True,
    )
