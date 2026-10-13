from django.contrib import admin

from .models import Customer


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ('__str__', 'email', 'phone', 'user', 'order_count', 'created_at')
    search_fields = ('email', 'phone', 'first_name', 'last_name')
    list_filter = ('created_at',)

    def order_count(self, obj):
        return obj.orders.count()
    order_count.short_description = 'Orders'
