from django.urls import path

from .views import MyOrdersView

urlpatterns = [
    path('account/orders/', MyOrdersView.as_view(), name='my-orders'),
]
