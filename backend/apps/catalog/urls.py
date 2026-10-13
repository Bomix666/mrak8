from rest_framework.routers import DefaultRouter

from .views import CategoryViewSet, CollectionViewSet, ProductViewSet

router = DefaultRouter()
router.register('products', ProductViewSet, basename='product')
router.register('categories', CategoryViewSet, basename='category')
router.register('collections', CollectionViewSet, basename='collection')

urlpatterns = router.urls
