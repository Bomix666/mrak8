"""
JOURNAL — the brand's editorial archive.

An Entry is a page; its Blocks are the page, top to bottom. Everything the
storefront shows under /journal/ comes from here, so shoots, films and
notes are published from the admin without touching the frontend.
"""

import uuid

from django.core.exceptions import ValidationError
from django.core.validators import FileExtensionValidator
from django.db import models
from django.utils import timezone
from django.utils.text import slugify

from apps.catalog.media import build_variants
from apps.catalog.models import Product

MAX_VIDEO_BYTES = 40 * 1024 * 1024
video_extensions = FileExtensionValidator(['mp4', 'webm'])


def validate_video_size(file):
    if file.size > MAX_VIDEO_BYTES:
        raise ValidationError(f'Video is larger than {MAX_VIDEO_BYTES // 1024 // 1024} MB — compress it before uploading.')


class Entry(models.Model):
    KIND_CHOICES = [
        ('film', 'Film'),
        ('shoot', 'Shoot'),
        ('people', 'People'),
        ('object', 'Object'),
        ('note', 'Note'),
    ]
    STATUS_CHOICES = [('draft', 'Draft'), ('published', 'Published')]

    title = models.CharField(max_length=140)
    slug = models.SlugField(max_length=160, unique=True, blank=True)
    kind = models.CharField(max_length=10, choices=KIND_CHOICES, default='shoot')
    excerpt = models.TextField(blank=True, help_text='One or two lines shown in the journal index and in link previews.')

    cover_image = models.ImageField(
        upload_to='journal/%Y/%m/', blank=True, width_field='cover_width', height_field='cover_height',
        help_text='Cover. Also used as the poster frame when a cover video is set.',
    )
    cover_width = models.PositiveIntegerField(null=True, blank=True, editable=False)
    cover_height = models.PositiveIntegerField(null=True, blank=True, editable=False)
    cover_video = models.FileField(
        upload_to='journal/%Y/%m/', blank=True, validators=[video_extensions, validate_video_size],
        help_text='Optional short muted loop (MP4/WebM) played in place of the cover image.',
    )

    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='draft')
    published_at = models.DateTimeField(null=True, blank=True, help_text='Set automatically on first publish.')
    is_featured = models.BooleanField(default=False, help_text='Pin to the homepage film scene.')

    products = models.ManyToManyField(
        Product, blank=True, related_name='journal_entries',
        help_text='Pieces that appear in this entry — linked to the shop at the end of the page.',
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = 'Entries'
        ordering = ['-published_at', '-created_at']

    def __str__(self):
        return self.title

    @property
    def code(self):
        return f'J.{self.pk:03d}'

    def save(self, *args, **kwargs):
        if not self.slug:
            # slugify() drops Cyrillic, so a Russian title can come back empty.
            self.slug = slugify(self.title) or f'entry-{uuid.uuid4().hex[:8]}'
        if self.status == 'published' and not self.published_at:
            self.published_at = timezone.now()
        super().save(*args, **kwargs)
        build_variants(self.cover_image)

    def get_absolute_url(self):
        return f'/journal/{self.slug}/'


class Block(models.Model):
    KIND_CHOICES = [
        ('text', 'Text'),
        ('quote', 'Quote'),
        ('image', 'Image'),
        ('video', 'Video'),
    ]
    LAYOUT_CHOICES = [
        ('wide', 'Wide — inside the page column'),
        ('full', 'Full bleed — edge to edge'),
        ('half', 'Half — neighbouring halves sit side by side (collage)'),
        ('strip', 'Strip — neighbouring strips scroll sideways (gallery)'),
    ]

    entry = models.ForeignKey(Entry, on_delete=models.CASCADE, related_name='blocks')
    order = models.PositiveIntegerField(default=0, help_text='Blocks render top to bottom by this number.')
    kind = models.CharField(max_length=10, choices=KIND_CHOICES, default='image')
    layout = models.CharField(max_length=10, choices=LAYOUT_CHOICES, default='wide', help_text='Image and video blocks only.')

    heading = models.CharField(max_length=140, blank=True)
    text = models.TextField(blank=True)
    image = models.ImageField(
        upload_to='journal/%Y/%m/', blank=True, width_field='image_width', height_field='image_height',
        help_text='The picture — or the poster frame of a video block.',
    )
    image_width = models.PositiveIntegerField(null=True, blank=True, editable=False)
    image_height = models.PositiveIntegerField(null=True, blank=True, editable=False)
    video = models.FileField(upload_to='journal/%Y/%m/', blank=True, validators=[video_extensions, validate_video_size])
    caption = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return f'{self.get_kind_display()} #{self.order}'

    def clean(self):
        required = {'image': 'image', 'video': 'video', 'text': 'text', 'quote': 'text'}[self.kind]
        if not getattr(self, required):
            raise ValidationError({required: f'A {self.get_kind_display().lower()} block needs this field.'})

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        build_variants(self.image)
