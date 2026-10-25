from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import APPAREL_SIZES, Inventory, Product


@receiver(post_save, sender=Product)
def create_inventory_rows(sender, instance, created, **kwargs):
    """Every product gets one Inventory row per size (quantity 0) the
    moment it's created, so the admin always has XS/S/M/L/XL — or a single
    One size row for a one-size category — ready to fill in."""
    if not created:
        return
    sizes = ['OS'] if instance.category.one_size else APPAREL_SIZES
    Inventory.objects.bulk_create(
        [Inventory(product=instance, size=size, quantity=0) for size in sizes],
        ignore_conflicts=True,
    )
