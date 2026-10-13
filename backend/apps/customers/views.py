from rest_framework import permissions, serializers, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.orders.models import Order
from apps.orders.serializers import OrderStatusSerializer


class MyOrdersView(APIView):
    """
    GET /api/account/orders/

    Requires an authenticated session. Guest customers track orders
    instead via GET /api/orders/<order_number>/?email=... (see orders app)
    — nobody is forced to create an account to check out or to see their
    order status.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        customer = getattr(request.user, 'customer_profile', None)
        if not customer:
            return Response([])
        orders = Order.objects.filter(customer=customer).order_by('-created_at')
        return Response(OrderStatusSerializer(orders, many=True).data)
