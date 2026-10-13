from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Block, Entry, video_extensions


class JournalTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.published = Entry.objects.create(title='Published', slug='published', status='published')
        self.draft = Entry.objects.create(title='Черновик', slug='draft', status='draft')
        Block.objects.create(entry=self.published, kind='quote', text='NO EMOTIONAL CONTRABAND.', order=10)
        Block.objects.create(entry=self.published, kind='text', text='second', order=20)

    def test_list_shows_only_published_entries(self):
        response = self.client.get('/api/journal/')
        self.assertEqual([e['slug'] for e in response.data['results']], ['published'])

    def test_draft_is_hidden_from_visitors_but_previewable_by_staff(self):
        self.assertEqual(self.client.get('/api/journal/draft/').status_code, 404)

        staff = get_user_model().objects.create_user('editor', password='x', is_staff=True)
        self.client.force_authenticate(staff)
        response = self.client.get('/api/journal/draft/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'draft')
        # …and still not in the public list, even for staff.
        self.assertEqual(len(self.client.get('/api/journal/').data['results']), 1)

    def test_entry_returns_blocks_in_page_order(self):
        response = self.client.get('/api/journal/published/')
        self.assertEqual([b['kind'] for b in response.data['blocks']], ['quote', 'text'])

    def test_publishing_stamps_the_date_once(self):
        self.assertIsNone(self.draft.published_at)
        self.draft.status = 'published'
        self.draft.save()
        first = self.draft.published_at
        self.assertIsNotNone(first)
        self.draft.save()
        self.assertEqual(self.draft.published_at, first)

    def test_cyrillic_title_still_gets_a_slug(self):
        entry = Entry.objects.create(title='Ночь')
        self.assertTrue(entry.slug)

    def test_block_requires_the_content_for_its_kind(self):
        with self.assertRaises(ValidationError):
            Block(entry=self.published, kind='image').full_clean(exclude=['entry'])

    def test_video_upload_rejects_other_file_types(self):
        with self.assertRaises(ValidationError):
            video_extensions(SimpleUploadedFile('payload.html', b'<script>'))
        video_extensions(SimpleUploadedFile('film.mp4', b'\x00'))
