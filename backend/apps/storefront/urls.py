from django.urls import path, re_path

from . import views

# Trailing slashes are optional on purpose: these URLs get typed, shared
# and pasted, and the shell is the same either way.
urlpatterns = [
    path('', views.page, {'key': 'home'}),
    re_path(r'^product/(?P<slug>[-\w]+)/?$', views.product),
    re_path(r'^journal/(?P<slug>[-\w]+)/?$', views.journal_entry),
    re_path(r'^order/[-\w]+/?$', views.page, {'key': 'order'}),
    re_path(r'^(?P<key>shop|journal|about|shipping|contact|account|checkout)/?$', views.page),
    # Anything else that isn't the API, the admin or a file is a real 404.
    re_path(r'^(?!api/|admin|media/|static/|site/).*$', views.not_found),
]
