"""
Checkout integrity: the things a browser must never be able to decide.

    python manage.py test
"""

from decimal import Decimal

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.catalog.models import Category, Inventory, Product
from apps.orders.models import Order
from apps.payments.models import Payment
from apps.payments.services import PaymentService


def checkout_payload(product, **overrides):
    payload = {
        'email': 'buyer@example.com',
        'phone': '+7 900 000-00-00',
        'first_name': 'Иван',
        'last_name': 'Иванов',
        'shipping': {
            'first_name': 'Иван', 'last_name': 'Иванов', 'city': 'Москва',
            'address_line': 'ул. Примерная, 1', 'postal_code': '101000',
            'country': 'Россия', 'phone': '+7 900 000-00-00',
        },
        'items': [{'product_id': product.id, 'size': 'M', 'quantity': 1}],
    }
    payload.update(overrides)
    return payload


@override_settings(DEBUG=True, PAYMENT_PROVIDER='manual_test')
class CheckoutTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        category = Category.objects.create(name='Zip Hoodie')
        self.product = Product.objects.create(
            name='ZIP HOODIE', code='T.001', sku='TEST-01', category=category,
            color='Молочный', price=Decimal('240.00'), sale_price=Decimal('120.00'), status='active',
        )
        Inventory.objects.filter(product=self.product, size='M').update(quantity=2)

    def stock(self, size='M'):
        return Inventory.objects.get(product=self.product, size=size).quantity

    def test_price_comes_from_the_database_not_the_request(self):
        payload = checkout_payload(self.product)
        payload['items'][0].update({'price': '0.01', 'unit_price': '0.01'})
        payload['total'] = '0.01'

        response = self.client.post('/api/orders/', payload, format='json')

        self.assertEqual(response.status_code, 201)
        self.assertEqual(Decimal(response.data['order']['total']), Decimal('120.00'))
        self.assertEqual(Order.objects.get().items.get().unit_price, Decimal('120.00'))

    def test_cannot_order_more_than_is_in_stock(self):
        payload = checkout_payload(self.product)
        payload['items'][0]['quantity'] = 3

        response = self.client.post('/api/orders/', payload, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertIn('items', response.data)
        self.assertEqual(Order.objects.count(), 0)

    def test_sold_out_size_draft_product_and_unknown_product_are_rejected(self):
        sold_out_size = checkout_payload(self.product)
        sold_out_size['items'][0]['size'] = 'XL'  # inventory row exists, quantity 0
        unknown = checkout_payload(self.product)
        unknown['items'][0]['product_id'] = 999999

        self.assertEqual(self.client.post('/api/orders/', sold_out_size, format='json').status_code, 400)
        self.assertEqual(self.client.post('/api/orders/', unknown, format='json').status_code, 400)

        self.product.status = 'draft'
        self.product.save()
        self.assertEqual(self.client.post('/api/orders/', checkout_payload(self.product), format='json').status_code, 400)
        self.assertEqual(Order.objects.count(), 0)

    def test_invalid_input_is_rejected_with_field_errors(self):
        cases = {
            'email': checkout_payload(self.product, email='not-an-email'),
            'phone': checkout_payload(self.product, phone='<script>alert(1)</script>'),
            'items': checkout_payload(self.product, items=[]),
        }
        bad_size = checkout_payload(self.product)
        bad_size['items'][0]['size'] = 'XXXL'
        cases['items '] = bad_size
        negative = checkout_payload(self.product)
        negative['items'][0]['quantity'] = -1
        cases['items  '] = negative

        for field, payload in cases.items():
            response = self.client.post('/api/orders/', payload, format='json')
            self.assertEqual(response.status_code, 400, field)
            self.assertIn(field.strip(), response.data)
        self.assertEqual(Order.objects.count(), 0)

    def test_stock_is_decremented_once_on_confirmed_payment(self):
        response = self.client.post('/api/orders/', checkout_payload(self.product), format='json')
        self.assertEqual(self.stock(), 2, 'placing an order must not touch stock')

        payment_id = response.data['payment']['payment_id']
        confirm = self.client.post(f'/api/payments/test-confirm/{payment_id}/')
        self.assertEqual(confirm.status_code, 200)
        self.assertEqual(self.stock(), 1)
        self.assertEqual(Order.objects.get().status, 'PAID')

        # A retried confirmation (duplicate webhook) must not decrement again.
        PaymentService.confirm_payment(Payment.objects.get(pk=payment_id))
        self.assertEqual(self.stock(), 1)

    def test_test_confirm_endpoint_is_dead_outside_debug(self):
        response = self.client.post('/api/orders/', checkout_payload(self.product), format='json')
        payment_id = response.data['payment']['payment_id']

        with override_settings(DEBUG=False):
            confirm = self.client.post(f'/api/payments/test-confirm/{payment_id}/')

        self.assertEqual(confirm.status_code, 404)
        self.assertEqual(Order.objects.get().status, 'PAYMENT_PENDING')

    def test_order_lookup_needs_the_matching_email(self):
        response = self.client.post('/api/orders/', checkout_payload(self.product), format='json')
        number = response.data['order']['order_number']

        self.assertEqual(self.client.get(f'/api/orders/{number}/').status_code, 404)
        self.assertEqual(self.client.get(f'/api/orders/{number}/', {'email': 'other@example.com'}).status_code, 404)
        self.assertEqual(self.client.get(f'/api/orders/{number}/', {'email': 'BUYER@example.com'}).status_code, 200)

    def test_order_is_stamped_with_the_shop_currency(self):
        with override_settings(SHOP_CURRENCY='RUB'):
            response = self.client.post('/api/orders/', checkout_payload(self.product), format='json')
        self.assertEqual(response.data['order']['currency'], 'RUB')
        self.assertEqual(Payment.objects.get().currency, 'RUB')
