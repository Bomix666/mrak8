from datetime import timedelta

from django.conf import settings
from django.contrib.admin.views.decorators import staff_member_required
from django.db.models import Sum
from django.shortcuts import render
from django.utils import timezone

from apps.catalog.models import Product
from apps.orders.models import PAID_STATUSES, Order


@staff_member_required
def dashboard_view(request):
    paid_orders = Order.objects.filter(status__in=PAID_STATUSES)

    total_sales = paid_orders.aggregate(total=Sum('total'))['total'] or 0
    orders_count = Order.objects.count()
    pending_orders = Order.objects.filter(status='PAYMENT_PENDING').count()
    paid_orders_count = paid_orders.count()

    products = Product.objects.all()
    products_count = products.count()
    low_stock = [p for p in products if p.is_low_stock]
    sold_out = [p for p in products if p.is_sold_out]

    recent_orders = Order.objects.select_related().order_by('-created_at')[:8]

    # Last 14 days of paid-order revenue for the sparkline chart.
    today = timezone.now().date()
    days = [today - timedelta(days=i) for i in range(13, -1, -1)]
    daily_totals = []
    for day in days:
        total = paid_orders.filter(created_at__date=day).aggregate(total=Sum('total'))['total'] or 0
        daily_totals.append(float(total))

    context = {
        'total_sales': total_sales,
        'currency': settings.SHOP_CURRENCY,
        'orders_count': orders_count,
        'pending_orders': pending_orders,
        'paid_orders_count': paid_orders_count,
        'products_count': products_count,
        'low_stock': low_stock,
        'sold_out': sold_out,
        'recent_orders': recent_orders,
        'chart_labels': [d.strftime('%d %b') for d in days],
        'chart_values': daily_totals,
    }
    return render(request, 'dashboard/dashboard.html', context)
