from rest_framework.routers import DefaultRouter

from .views import EntryViewSet

router = DefaultRouter()
router.register('journal', EntryViewSet, basename='journal')

urlpatterns = router.urls
