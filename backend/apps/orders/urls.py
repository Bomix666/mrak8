from django.urls import path

from .views import OrderCreateView, OrderStatusView

urlpatterns = [
    path('orders/', OrderCreateView.as_view(), name='order-create'),
    path('orders/<str:order_number>/', OrderStatusView.as_view(), name='order-status'),
]
