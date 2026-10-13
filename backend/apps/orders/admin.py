from django.contrib import admin, messages
from django.utils.html import format_html

from apps.customers.notifications import send_order_shipped, send_order_delivered

from .models import Order, OrderItem, ShippingAddress


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    fields = ('product_name', 'product_code', 'size', 'quantity', 'unit_price', 'line_total_display')
    readonly_fields = ('product_name', 'product_code', 'size', 'quantity', 'unit_price', 'line_total_display')
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False

    def line_total_display(self, obj):
        return f'{obj.line_total}'
    line_total_display.short_description = 'Line total'


class ShippingAddressInline(admin.StackedInline):
    model = ShippingAddress
    extra = 0
    can_delete = False


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = (
        'order_number', 'contact_display', 'status_display', 'payment_status_display',
        'total', 'currency', 'created_at',
    )
    list_filter = ('status', 'created_at')
    search_fields = ('order_number', 'guest_email', 'guest_phone', 'customer__email')
    date_hierarchy = 'created_at'
    readonly_fields = ('order_number', 'subtotal', 'total', 'created_at', 'updated_at')
    inlines = [OrderItemInline, ShippingAddressInline]
    actions = ['mark_processing', 'mark_packed', 'mark_shipped', 'mark_delivered', 'mark_cancelled']

    fieldsets = (
        ('Order', {'fields': ('order_number', 'status', 'created_at', 'updated_at')}),
        ('Customer', {'fields': ('customer', 'guest_email', 'guest_phone', 'guest_first_name', 'guest_last_name')}),
        ('Totals', {'fields': ('subtotal', 'shipping_cost', 'total', 'currency')}),
        ('Notes', {'fields': ('notes',)}),
    )

    def contact_display(self, obj):
        return obj.contact_name or obj.contact_email
    contact_display.short_description = 'Customer'

    def status_display(self, obj):
        colors = {
            'NEW': '#8a8a85', 'PAYMENT_PENDING': '#b8860b', 'PAID': '#2e7d32',
            'PROCESSING': '#2e7d32', 'PACKED': '#2e7d32', 'SHIPPED': '#1565c0',
            'DELIVERED': '#1565c0', 'CANCELLED': '#b23c3c', 'REFUNDED': '#b23c3c',
        }
        return format_html('<span style="color:{};font-weight:600;">{}</span>', colors.get(obj.status, '#8a8a85'), obj.get_status_display())
    status_display.short_description = 'Status'

    def payment_status_display(self, obj):
        payment = obj.payments.order_by('-created_at').first()
        return payment.status if payment else '—'
    payment_status_display.short_description = 'Payment'

    @admin.action(description='Mark selected orders as PROCESSING')
    def mark_processing(self, request, queryset):
        updated = queryset.filter(status='PAID').update(status='PROCESSING')
        self.message_user(request, f'{updated} order(s) moved to processing.', messages.SUCCESS)

    @admin.action(description='Mark selected orders as PACKED')
    def mark_packed(self, request, queryset):
        updated = queryset.filter(status='PROCESSING').update(status='PACKED')
        self.message_user(request, f'{updated} order(s) marked packed.', messages.SUCCESS)

    @admin.action(description='Mark selected orders as SHIPPED')
    def mark_shipped(self, request, queryset):
        count = 0
        for order in queryset.filter(status='PACKED'):
            order.status = 'SHIPPED'
            order.save(update_fields=['status'])
            send_order_shipped(order)
            count += 1
        self.message_user(request, f'{count} order(s) marked shipped.', messages.SUCCESS)

    @admin.action(description='Mark selected orders as DELIVERED')
    def mark_delivered(self, request, queryset):
        count = 0
        for order in queryset.filter(status='SHIPPED'):
            order.status = 'DELIVERED'
            order.save(update_fields=['status'])
            send_order_delivered(order)
            count += 1
        self.message_user(request, f'{count} order(s) marked delivered.', messages.SUCCESS)

    @admin.action(description='Cancel selected orders')
    def mark_cancelled(self, request, queryset):
        updated = queryset.exclude(status__in=['SHIPPED', 'DELIVERED']).update(status='CANCELLED')
        self.message_user(request, f'{updated} order(s) cancelled.', messages.SUCCESS)
