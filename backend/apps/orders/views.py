from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.customers.notifications import send_order_confirmation
from apps.payments.services import PaymentService

from .models import Order
from .serializers import OrderCreateSerializer, OrderStatusSerializer


class OrderCreateView(APIView):
    """
    POST /api/orders/

    Creates the order (guest checkout is fully supported — no account
    required), then asks PaymentService to open a payment with whichever
    provider is configured, and returns the order + where to send the
    shopper to pay. Stock is validated here but only decremented once the
    payment provider confirms payment (webhook) — see apps.payments.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = OrderCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = serializer.save()

        send_order_confirmation(order)

        payment_result = PaymentService.get_provider().create_payment(order)

        return Response(
            {
                'order': OrderStatusSerializer(order).data,
                'payment': payment_result,
            },
            status=status.HTTP_201_CREATED,
        )


class OrderStatusView(APIView):
    """
    GET /api/orders/<order_number>/?email=<email used at checkout>

    No login required (guest checkout support), but the requester must
    know both the order number AND the email used at checkout — this is
    the ownership check that stops order numbers from being enumerable.
    """

    permission_classes = [AllowAny]

    def get(self, request, order_number):
        order = get_object_or_404(Order, order_number=order_number)
        email = request.query_params.get('email', '')

        is_owner = request.user.is_authenticated and getattr(order.customer, 'user_id', None) == request.user.id
        if not is_owner and email.lower() != (order.contact_email or '').lower():
            return Response({'detail': 'Заказ не найден.'}, status=status.HTTP_404_NOT_FOUND)

        return Response(OrderStatusSerializer(order).data)
