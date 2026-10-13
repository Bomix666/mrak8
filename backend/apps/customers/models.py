from django.conf import settings
from django.db import models


class Customer(models.Model):
    """
    A Customer is created the first time someone checks out — as a guest
    record (user=None) or linked to a Django auth User if they're logged
    in / sign up after purchase. Guest checkout never requires this to be
    linked to a User.
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='customer_profile'
    )
    email = models.EmailField()
    phone = models.CharField(max_length=32, blank=True)
    first_name = models.CharField(max_length=60, blank=True)
    last_name = models.CharField(max_length=60, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        name = f'{self.first_name} {self.last_name}'.strip()
        return name or self.email
