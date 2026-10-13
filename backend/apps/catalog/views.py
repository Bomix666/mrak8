from django.db.models import Prefetch
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Category, Collection, Product, ProductImage
from .serializers import (
    CategorySerializer,
    CollectionSerializer,
    ProductDetailSerializer,
    ProductListSerializer,
)


class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    lookup_field = 'slug'


class CollectionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Collection.objects.filter(is_active=True)
    serializer_class = CollectionSerializer
    lookup_field = 'slug'


class ProductViewSet(viewsets.ReadOnlyModelViewSet):
    """
    GET /api/products/                 — active products, filterable
    GET /api/products/?category=jeans
    GET /api/products/?collection=first-signal
    GET /api/products/?featured=true
    GET /api/products/?new=true
    GET /api/products/<slug>/          — full detail payload
    """

    lookup_field = 'slug'

    def get_queryset(self):
        qs = (
            Product.objects.filter(status='active')
            .select_related('category', 'collection')
            .prefetch_related(
                Prefetch('images', queryset=ProductImage.objects.order_by('order')),
                'inventory',
                'details',
            )
        )
        params = self.request.query_params
        if params.get('category'):
            qs = qs.filter(category__slug=params['category'])
        if params.get('collection'):
            qs = qs.filter(collection__slug=params['collection'])
        if params.get('featured') == 'true':
            qs = qs.filter(is_featured=True)
        if params.get('new') == 'true':
            qs = qs.filter(is_new=True)
        return qs

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return ProductDetailSerializer
        return ProductListSerializer

    @action(detail=True, methods=['get'])
    def related(self, request, slug=None):
        product = self.get_object()
        related = self.get_queryset().exclude(pk=product.pk).filter(category=product.category)[:4]
        serializer = ProductListSerializer(related, many=True, context=self.get_serializer_context())
        return Response(serializer.data)
