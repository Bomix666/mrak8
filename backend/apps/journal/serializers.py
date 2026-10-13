from rest_framework import serializers

from apps.catalog.media import image_payload
from apps.catalog.serializers import ProductListSerializer

from .models import Block, Entry


class _FileUrlMixin:
    def file_url(self, field_file):
        if not field_file:
            return None
        request = self.context.get('request')
        return request.build_absolute_uri(field_file.url) if request else field_file.url


class BlockSerializer(_FileUrlMixin, serializers.ModelSerializer):
    image = serializers.SerializerMethodField()
    video = serializers.SerializerMethodField()

    class Meta:
        model = Block
        fields = ('id', 'kind', 'layout', 'heading', 'text', 'image', 'video', 'caption')

    def get_image(self, obj):
        return image_payload(obj.image, obj.image_width, obj.image_height, self.context.get('request'))

    def get_video(self, obj):
        return self.file_url(obj.video)


class EntryListSerializer(_FileUrlMixin, serializers.ModelSerializer):
    code = serializers.CharField(read_only=True)
    kind_label = serializers.CharField(source='get_kind_display', read_only=True)
    cover = serializers.SerializerMethodField()
    cover_video = serializers.SerializerMethodField()

    class Meta:
        model = Entry
        fields = (
            'id', 'code', 'title', 'slug', 'kind', 'kind_label', 'excerpt',
            'cover', 'cover_video', 'status', 'published_at', 'is_featured',
        )

    def get_cover(self, obj):
        return image_payload(obj.cover_image, obj.cover_width, obj.cover_height, self.context.get('request'))

    def get_cover_video(self, obj):
        return self.file_url(obj.cover_video)


class EntryDetailSerializer(EntryListSerializer):
    blocks = BlockSerializer(many=True, read_only=True)
    products = serializers.SerializerMethodField()

    class Meta(EntryListSerializer.Meta):
        fields = EntryListSerializer.Meta.fields + ('blocks', 'products')

    def get_products(self, obj):
        # Only pieces that are actually on sale — an archived product
        # shouldn't resurface as a shop link from an old story.
        active = [p for p in obj.products.all() if p.status == 'active']
        return ProductListSerializer(active, many=True, context=self.context).data
