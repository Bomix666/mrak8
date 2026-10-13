from django.urls import path

from .views import PaymentWebhookView, TestConfirmPaymentView

urlpatterns = [
    path('payments/webhook/', PaymentWebhookView.as_view(), name='payment-webhook'),
    path('payments/test-confirm/<int:payment_id>/', TestConfirmPaymentView.as_view(), name='payment-test-confirm'),
]
