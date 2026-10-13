from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path

from apps.storefront.views import site_file

urlpatterns = [
    path('admin/', include('apps.dashboard.urls')),
    path('admin/', admin.site.urls),
    path('api/', include('apps.catalog.urls')),
    path('api/', include('apps.orders.urls')),
    path('api/', include('apps.payments.urls')),
    path('api/', include('apps.customers.urls')),
    path('api/', include('apps.journal.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += [re_path(r'^site/(?P<path>.*)$', site_file)]

# Last: the storefront shell owns every remaining URL (it ends in a catch-all).
urlpatterns += [path('', include('apps.storefront.urls'))]
