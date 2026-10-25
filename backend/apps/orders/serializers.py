from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.db.models import F
from rest_framework import serializers

from apps.catalog.models import SIZE_CHOICES, VISIBLE_STATUSES, Inventory, Product

from .models import Order, OrderItem, ShippingAddress
from .validators import validate_phone, validate_postal_code

# Flat shipping rate used for the estimate shown in checkout. In a real
# deployment this would come from a shipping-rate service keyed on
# destination/weight — kept simple and centralised here on purpose so
# there is exactly one place to change it.
FLAT_SHIPPING_COST = Decimal('0.00')


class CheckoutItemSerializer(serializers.Serializer):
    """
    Only `product_id`, `size`, and `quantity` are accepted from the client.
    Price is never accepted here — it is always re-read from the database
    in OrderCreateSerializer.create(), so editing the request body in
    DevTools cannot change what gets charged.
    """

    product_id = serializers.IntegerField()
    size = serializers.ChoiceField(choices=[size for size, _ in SIZE_CHOICES])
    quantity = serializers.IntegerField(min_value=1, max_value=10)


class ShippingAddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShippingAddress
        fields = ('first_name', 'last_name', 'city', 'address_line', 'postal_code', 'country', 'phone')

    def validate_phone(self, value):
        return validate_phone(value)

    def validate_postal_code(self, value):
        return validate_postal_code(value)


class OrderCreateSerializer(serializers.Serializer):
    """
    POST /api/orders/

    Validates and creates an order. Nothing about price or stock is taken
    on faith from the client:
      - product price is re-read from Product.current_price
      - stock is checked (and locked) against Inventory inside a DB
        transaction, so two simultaneous checkouts can't both succeed
        for the last unit
      - stock is NOT decremented here — only once payment is confirmed
        (see apps.payments.services) — an order created here is a
        reservation of intent, not a guarantee of stock until paid
    """

    email = serializers.EmailField()
    phone = serializers.CharField()
    first_name = serializers.CharField(max_length=60)
    last_name = serializers.CharField(max_length=60)
    shipping = ShippingAddressSerializer()
    items = CheckoutItemSerializer(many=True)
    notes = serializers.CharField(required=False, allow_blank=True, max_length=500)

    def validate_phone(self, value):
        return validate_phone(value)

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError('Корзина пуста.')
        return items

    def validate(self, attrs):
        # Re-validate every item against the database: does the product
        # exist, is it active, and is there enough stock in that size?
        errors = []
        resolved = []
        for item in attrs['items']:
            try:
                product = Product.objects.get(pk=item['product_id'], status__in=VISIBLE_STATUSES)
            except Product.DoesNotExist:
                errors.append('Один из товаров больше недоступен. Обновите корзину.')
                continue

            if product.is_drop_pending:
                errors.append(f'{product.name}: дроп ещё не начался.')
                continue

            try:
                inventory = Inventory.objects.get(product=product, size=item['size'])
            except Inventory.DoesNotExist:
                errors.append(f"{product.name}: размера {item['size']} нет.")
                continue

            if product.sold_out_override or inventory.quantity < item['quantity']:
                errors.append(f"{product.name} ({item['size']}): в наличии меньше, чем в корзине.")
                continue

            resolved.append({'product': product, 'inventory': inventory, 'quantity': item['quantity'], 'size': item['size']})

        if errors:
            raise serializers.ValidationError({'items': errors})

        attrs['resolved_items'] = resolved
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        resolved_items = validated_data['resolved_items']

        # Lock the inventory rows involved for the duration of this
        # transaction so a concurrent checkout can't oversell the last unit.
        product_ids = [i['product'].id for i in resolved_items]
        locked_inventory = {
            (row.product_id, row.size): row
            for row in Inventory.objects.select_for_update().filter(product_id__in=product_ids)
        }

        for item in resolved_items:
            row = locked_inventory[(item['product'].id, item['size'])]
            if row.quantity < item['quantity']:
                raise serializers.ValidationError({
                    'items': [f"{item['product'].name} ({item['size']}): закончился, пока оформлялся заказ."]
                })

        order = Order.objects.create(
            guest_email=validated_data['email'],
            guest_phone=validated_data['phone'],
            guest_first_name=validated_data['first_name'],
            guest_last_name=validated_data['last_name'],
            shipping_cost=FLAT_SHIPPING_COST,
            currency=settings.SHOP_CURRENCY,
            status='NEW',
        )

        ShippingAddress.objects.create(order=order, **validated_data['shipping'])

        for item in resolved_items:
            product = item['product']
            OrderItem.objects.create(
                order=order,
                product=product,
                product_name=product.name,
                product_code=product.code,
                unit_price=product.current_price,  # server price, never the client's
                size=item['size'],
                quantity=item['quantity'],
            )

        order.recalculate_totals()
        order.status = 'PAYMENT_PENDING'
        order.save(update_fields=['status'])
        return order


class OrderItemStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = ('product_name', 'product_code', 'size', 'quantity', 'unit_price', 'line_total')


class OrderStatusSerializer(serializers.ModelSerializer):
    """Read-only status payload shown on the order confirmation / lookup
    page. Deliberately excludes internal fields (customer FK id, raw
    payment payloads, etc.) — only what the shopper needs to see."""

    items = OrderItemStatusSerializer(many=True, read_only=True)
    shipping_address = ShippingAddressSerializer(read_only=True)
    payment_status = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = (
            'order_number', 'status', 'payment_status', 'items',
            'subtotal', 'shipping_cost', 'total', 'currency',
            'shipping_address', 'created_at',
        )

    def get_payment_status(self, obj):
        payment = obj.payments.order_by('-created_at').first()
        return payment.status if payment else 'PENDING'
