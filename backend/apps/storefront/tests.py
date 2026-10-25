from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.catalog.models import Category, Product
from apps.journal.models import Entry


class ShellTests(TestCase):
    """The HTML shell: real titles/OG tags for crawlers, real 404s."""

    @classmethod
    def setUpTestData(cls):
        category = Category.objects.create(name='Zip Hoodie')
        cls.product = Product.objects.create(
            name='ZIP HOODIE «TEST»', code='T.001', sku='TEST-01', slug='zip-hoodie-test', category=category,
            color='Молочный', price=Decimal('240.00'), status='active', description='Описание <b>вещи</b>',
        )
        Entry.objects.create(title='Парк', slug='park', status='published', excerpt='Ночь.')
        Entry.objects.create(title='Draft', slug='draft', status='draft')

    def test_static_pages_render(self):
        for path in ('/', '/shop/', '/shop', '/journal/', '/about/', '/checkout/', '/account/', '/order/MRAK8-ABC123/'):
            self.assertEqual(self.client.get(path).status_code, 200, path)

    def test_product_page_carries_its_own_meta_and_structured_data(self):
        html = self.client.get('/product/zip-hoodie-test/').content.decode()
        self.assertIn('<title>ZIP HOODIE «TEST» — MRAK8</title>', html)
        self.assertIn('property="og:type" content="product"', html)
        self.assertIn('"@type": "Product"', html)
        self.assertIn('"price": "240.00"', html)
        # Catalogue text is escaped both in the markup and inside the JSON-LD.
        self.assertNotIn('<b>вещи</b>', html)

    def test_pending_drop_announces_its_date_in_moscow_time(self):
        from datetime import datetime, timezone
        self.product.status = 'drop'
        self.product.drop_at = datetime(2030, 12, 12, 16, 0, tzinfo=timezone.utc)
        self.product.save()
        html = self.client.get('/product/zip-hoodie-test/').content.decode()
        self.assertIn('content="Дроп 12 декабря, 19:00 МСК. Описание', html)
        self.assertIn('property="product:availability" content="preorder"', html)
        self.assertIn('"availabilityStarts": "2030-12-12T16:00:00+00:00"', html)

        self.product.drop_at = None
        self.product.status = 'active'
        self.product.save()
        html = self.client.get('/product/zip-hoodie-test/').content.decode()
        self.assertNotIn('Дроп', html)
        self.assertIn('content="oos"', html)  # no stock rows in this fixture

    def test_unknown_and_unpublished_things_are_real_404s(self):
        for path in ('/product/nope/', '/journal/nope/', '/journal/draft/', '/no/such/page/'):
            self.assertEqual(self.client.get(path).status_code, 404, path)

        self.product.status = 'draft'
        self.product.save()
        self.assertEqual(self.client.get('/product/zip-hoodie-test/').status_code, 404)

    def test_staff_can_preview_a_draft_entry_and_it_is_not_indexed(self):
        self.client.force_login(get_user_model().objects.create_user('editor', password='x', is_staff=True))
        response = self.client.get('/journal/draft/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('name="robots" content="noindex"', response.content.decode())

    def test_shell_does_not_swallow_api_or_admin(self):
        self.assertEqual(self.client.get('/api/products/').status_code, 200)
        self.assertEqual(self.client.get('/api/nope/').status_code, 404)
        self.assertEqual(self.client.get('/admin/').status_code, 302)  # → login
        self.assertEqual(self.client.get('/admin').status_code, 301)   # → /admin/
