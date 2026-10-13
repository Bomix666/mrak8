from django.contrib import admin, messages
from django.utils import timezone
from django.utils.html import format_html

from .models import Block, Entry


class BlockInline(admin.StackedInline):
    model = Block
    extra = 0
    ordering = ('order', 'id')
    fields = (('order', 'kind', 'layout'), 'heading', 'text', ('image', 'video'), 'caption')


@admin.register(Entry)
class EntryAdmin(admin.ModelAdmin):
    list_display = ('title', 'kind', 'status', 'published_at', 'is_featured', 'cover_preview')
    list_filter = ('status', 'kind', 'is_featured')
    search_fields = ('title', 'excerpt')
    prepopulated_fields = {'slug': ('title',)}
    filter_horizontal = ('products',)
    inlines = [BlockInline]
    actions = ['publish', 'unpublish']
    save_on_top = True

    fieldsets = (
        (None, {'fields': ('title', 'slug', 'kind', 'excerpt')}),
        ('Cover', {'fields': ('cover_image', 'cover_video')}),
        ('Publishing', {
            'fields': ('status', 'published_at', 'is_featured'),
            'description': 'Drafts are visible only to signed-in staff — use “View on site” to preview before publishing.',
        }),
        ('Pieces in this entry', {'fields': ('products',)}),
    )

    def cover_preview(self, obj):
        if obj.cover_image:
            return format_html('<img src="{}" style="height:44px;object-fit:cover;" />', obj.cover_image.url)
        return '—'
    cover_preview.short_description = 'Cover'

    @admin.action(description='Publish selected entries')
    def publish(self, request, queryset):
        # Per-row save() so published_at is stamped on first publish.
        for entry in queryset.exclude(status='published'):
            entry.status = 'published'
            entry.published_at = entry.published_at or timezone.now()
            entry.save(update_fields=['status', 'published_at', 'updated_at'])
        self.message_user(request, 'Selected entries are published.', messages.SUCCESS)

    @admin.action(description='Unpublish selected entries (back to draft)')
    def unpublish(self, request, queryset):
        updated = queryset.update(status='draft')
        self.message_user(request, f'{updated} entr{"y" if updated == 1 else "ies"} moved back to draft.', messages.SUCCESS)
