from rest_framework import viewsets

from .models import Entry
from .serializers import EntryDetailSerializer, EntryListSerializer


class EntryViewSet(viewsets.ReadOnlyModelViewSet):
    """
    GET /api/journal/                 — published entries, newest first
    GET /api/journal/?featured=true
    GET /api/journal/?product=<slug>  — entries a given piece appears in
    GET /api/journal/<slug>/          — entry with its blocks and linked pieces

    Drafts never appear in the list. A signed-in staff user can open a
    draft by its slug, which is what the admin's “View on site” relies on
    for previewing before publishing.
    """

    lookup_field = 'slug'

    def get_queryset(self):
        qs = Entry.objects.prefetch_related(
            'blocks', 'products__images', 'products__inventory', 'products__category', 'products__collection',
        )
        is_preview = self.action == 'retrieve' and self.request.user.is_staff
        if not is_preview:
            qs = qs.filter(status='published')
        params = self.request.query_params
        if params.get('featured') == 'true':
            qs = qs.filter(is_featured=True)
        if params.get('product'):
            qs = qs.filter(products__slug=params['product'])
        return qs

    def get_serializer_class(self):
        return EntryDetailSerializer if self.action == 'retrieve' else EntryListSerializer
