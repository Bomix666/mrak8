from django.conf import settings
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Payment
from .services import PaymentService


class PaymentWebhookView(APIView):
    """
    POST /api/payments/webhook/

    Receives push notifications from whichever provider is configured.
    The provider implementation is responsible for verifying the request
    is genuinely from them (signature / IP allowlist / secret token, per
    that provider's docs) BEFORE this ever calls PaymentService.confirm_payment
    — see the TODOs in apps/payments/services.py. Nothing here trusts the
    payload on its face.
    """

    permission_classes = [AllowAny]

    @csrf_exempt
    def dispatch(self, *args, **kwargs):
        return super().dispatch(*args, **kwargs)

    def post(self, request):
        provider = PaymentService.get_provider()
        try:
            payment = provider.handle_webhook(request)
        except NotImplementedError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_501_NOT_IMPLEMENTED)
        except Payment.DoesNotExist:
            return Response({'detail': 'Unknown payment.'}, status=status.HTTP_404_NOT_FOUND)

        if payment.status == 'CONFIRMED':
            PaymentService.confirm_payment(payment)
        return Response({'received': True})


class TestConfirmPaymentView(APIView):
    """
    POST /api/payments/test-confirm/<payment_id>/

    DEV ONLY. Lets you exercise the full ORDER -> PAID flow locally
    without real payment credentials. Hard-disabled outside DEBUG so it
    can never ship as a real "pay" button — see the settings.DEBUG guard
    below, which 404s the endpoint in production regardless of routing.
    """

    permission_classes = [AllowAny]

    def post(self, request, payment_id):
        if not settings.DEBUG:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        payment = get_object_or_404(Payment, id=payment_id, provider='manual_test')
        PaymentService.confirm_payment(payment)
        return Response({'status': payment.status, 'order_status': payment.order.status})
