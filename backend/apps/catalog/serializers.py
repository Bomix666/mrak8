from django.conf import settings
from django.utils import timezone
from rest_framework import serializers

from .media import image_payload
from .models import Category, Collection, Inventory, Product, ProductImage


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ('id', 'name', 'slug')


class CollectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Collection
        fields = ('id', 'name', 'slug', 'description', 'launch_date')


class ProductImageSerializer(serializers.ModelSerializer):
    url = serializers.ImageField(source='image', use_url=True)
    srcset = serializers.SerializerMethodField()

    class Meta:
        model = ProductImage
        fields = ('id', 'url', 'angle', 'order', 'alt_text', 'width', 'height', 'srcset')

    def get_srcset(self, obj):
        return image_payload(obj.image, obj.width, obj.height, self.context.get('request'))['srcset']


class InventorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Inventory
        fields = ('size', 'quantity')


class ProductListSerializer(serializers.ModelSerializer):
    """Grid payload — images, per-size stock and the rail cut-outs. Every
    field added since the first version is additive; nothing was renamed."""

    category = serializers.SlugRelatedField(slug_field='slug', read_only=True)
    collection = serializers.SlugRelatedField(slug_field='slug', read_only=True)
    price = serializers.DecimalField(max_digits=10, decimal_places=2, source='current_price', read_only=True)
    original_price = serializers.DecimalField(max_digits=10, decimal_places=2, source='price', read_only=True)
    currency = serializers.SerializerMethodField()
    is_sold_out = serializers.BooleanField(read_only=True)
    images = ProductImageSerializer(many=True, read_only=True)
    inventory = InventorySerializer(many=True, read_only=True)
    cutout_front = serializers.SerializerMethodField()
    cutout_back = serializers.SerializerMethodField()
    drop_state = serializers.CharField(read_only=True)
    # The countdown runs from the server clock, never the visitor's.
    server_time = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = (
            'id', 'name', 'slug', 'code', 'color', 'category', 'collection',
            'price', 'original_price', 'currency', 'is_featured', 'is_new', 'is_sold_out',
            'images', 'inventory', 'cutout_front', 'cutout_back',
            'drop_at', 'drop_state', 'server_time',
        )

    def get_currency(self, obj):
        return settings.SHOP_CURRENCY

    def get_server_time(self, obj):
        return timezone.now().isoformat()

    def get_cutout_front(self, obj):
        return image_payload(obj.cutout_front, obj.cutout_front_width, obj.cutout_front_height, self.context.get('request'))

    def get_cutout_back(self, obj):
        return image_payload(obj.cutout_back, obj.cutout_back_width, obj.cutout_back_height, self.context.get('request'))


class ProductDetailSerializer(ProductListSerializer):
    """Full payload for the product page — copy on top of the grid payload."""

    details = serializers.SlugRelatedField(slug_field='text', many=True, read_only=True)

    class Meta(ProductListSerializer.Meta):
        fields = ProductListSerializer.Meta.fields + (
            'description', 'fit_description', 'shipping_note', 'details', 'measurements',
        )
