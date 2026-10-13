from django.contrib import admin, messages

from .models import Payment
from .services import PaymentService


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ('order', 'provider', 'status', 'amount', 'currency', 'created_at')
    list_filter = ('provider', 'status')
    search_fields = ('order__order_number', 'provider_payment_id')
    readonly_fields = ('raw_webhook_payload', 'created_at', 'updated_at')
    actions = ['verify_selected_payments']

    @admin.action(description='Verify selected payments with provider')
    def verify_selected_payments(self, request, queryset):
        """
        Staff-only fallback for when a webhook is missed or delayed: asks
        the provider directly for the current status rather than trusting
        anything the admin user types in. This is the one place a human
        can push a payment to CONFIRMED without a webhook — restricted to
        staff by Django admin permissions.
        """
        confirmed = 0
        for payment in queryset:
            provider = PaymentService.get_provider()
            try:
                result = provider.verify_payment(payment)
            except NotImplementedError as exc:
                self.message_user(request, str(exc), messages.WARNING)
                continue
            if result == 'CONFIRMED' and payment.status != 'CONFIRMED':
                PaymentService.confirm_payment(payment)
                confirmed += 1
        self.message_user(request, f'{confirmed} payment(s) confirmed.', messages.SUCCESS)
