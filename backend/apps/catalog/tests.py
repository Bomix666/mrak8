"""
Drop mechanics: a 'drop' product is shown with a countdown, can't be bought
before drop_at, and opens on its own once the moment has passed.

    python manage.py test
"""

import json
from datetime import timedelta
from decimal import Decimal

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.catalog.models import Category, Collection, Inventory, Product
from apps.orders.tests import checkout_payload


@override_settings(DEBUG=True, PAYMENT_PROVIDER='manual_test')
class DropTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.beanies = Category.objects.create(name='Beanie', one_size=True)
        self.winter = Collection.objects.create(name='Winter', slug='winter')
        self.beanie = Product.objects.create(
            name='MRAK BLACK', code='W.001', sku='WIN-01', category=self.beanies, collection=self.winter,
            color='Чёрный', price=Decimal('100.00'), status='drop',
            drop_at=timezone.now() + timedelta(hours=1),
            measurements={'circumference_cm': 46, 'height_cm': 21},
        )
        Inventory.objects.filter(product=self.beanie, size='OS').update(quantity=5)

    def order(self):
        return self.client.post(
            '/api/orders/',
            checkout_payload(self.beanie, items=[{'product_id': self.beanie.id, 'size': 'OS', 'quantity': 1}]),
            format='json',
        )

    def test_one_size_category_gets_a_single_stock_row(self):
        self.assertEqual(list(self.beanie.inventory.values_list('size', flat=True)), ['OS'])

    def test_drop_soon_is_listed_with_server_clock(self):
        data = self.client.get('/api/products/?collection=winter').json()
        items = data['results'] if isinstance(data, dict) else data
        self.assertEqual([p['slug'] for p in items], [self.beanie.slug])
        self.assertEqual(items[0]['drop_state'], 'soon')
        self.assertIn('server_time', items[0])
        self.assertIsNotNone(items[0]['drop_at'])

    def test_measurements_in_detail(self):
        data = self.client.get(f'/api/products/{self.beanie.slug}/').json()
        self.assertEqual(data['measurements'], {'circumference_cm': 46, 'height_cm': 21})

    def test_order_before_drop_is_rejected(self):
        response = self.order()
        self.assertEqual(response.status_code, 400)
        self.assertIn('дроп ещё не начался', json.dumps(response.json(), ensure_ascii=False))
        self.assertEqual(Inventory.objects.get(product=self.beanie, size='OS').quantity, 5)

    def test_drop_opens_by_itself_when_time_passes(self):
        Product.objects.filter(pk=self.beanie.pk).update(drop_at=timezone.now() - timedelta(seconds=1))
        self.beanie.refresh_from_db()
        self.assertEqual(self.beanie.drop_state, 'live')
        self.assertEqual(self.order().status_code, 201)

    def test_drop_without_date_stays_soon(self):
        Product.objects.filter(pk=self.beanie.pk).update(drop_at=None)
        self.beanie.refresh_from_db()
        self.assertEqual(self.beanie.drop_state, 'soon')

    def test_product_page_announces_the_drop_start(self):
        html = self.client.get(self.beanie.get_absolute_url()).content.decode()
        self.assertIn('availabilityStarts', html)
        self.assertIn('OutOfStock', html)
