"""
MRAK8 backend settings.

Every secret and environment-specific value is read from the environment
(.env in development, real environment variables in production). Nothing
here is a value you need to change to deploy — you change .env instead.
"""

import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')


def env_bool(name, default=False):
    return os.getenv(name, str(default)).strip().lower() in ('1', 'true', 'yes', 'on')


def env_list(name, default=''):
    raw = os.getenv(name, default)
    return [item.strip() for item in raw.split(',') if item.strip()]


# ---------------------------------------------------------------------------
# Core
# ---------------------------------------------------------------------------
SECRET_KEY = os.getenv('DJANGO_SECRET_KEY')
if not SECRET_KEY:
    # Only ever hit in local dev when .env hasn't been created yet — the app
    # refuses to run this way anywhere DEBUG is off (see check below).
    SECRET_KEY = 'insecure-dev-key-replace-me'

DEBUG = env_bool('DJANGO_DEBUG', True)

ALLOWED_HOSTS = env_list('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1')

if not DEBUG and SECRET_KEY == 'insecure-dev-key-replace-me':
    raise RuntimeError(
        'DJANGO_SECRET_KEY must be set in the environment when DJANGO_DEBUG=False.'
    )

# ---------------------------------------------------------------------------
# Apps
# ---------------------------------------------------------------------------
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    'rest_framework',
    'corsheaders',

    'apps.catalog',
    'apps.orders',
    'apps.payments',
    'apps.customers',
    'apps.dashboard',
    'apps.journal',
    'apps.storefront',
]

# The storefront (frontend/) is a no-build ES-module app. Django serves its
# HTML shell (apps.storefront) and, in development, its files under
# /static/site/ — so the whole site runs from one `runserver`.
FRONTEND_DIR = BASE_DIR.parent / 'frontend'

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'mrak8_backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates', FRONTEND_DIR],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'mrak8_backend.wsgi.application'
ASGI_APPLICATION = 'mrak8_backend.asgi.application'

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------
# Defaults to SQLite for local development. Set DATABASE_URL-style vars (or
# swap this block for `dj-database-url`) to point at PostgreSQL in staging
# and production — the models contain nothing SQLite-specific.
if os.getenv('POSTGRES_DB'):
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.getenv('POSTGRES_DB'),
            'USER': os.getenv('POSTGRES_USER'),
            'PASSWORD': os.getenv('POSTGRES_PASSWORD'),
            'HOST': os.getenv('POSTGRES_HOST', 'localhost'),
            'PORT': os.getenv('POSTGRES_PORT', '5432'),
            'CONN_MAX_AGE': 60,
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

# ---------------------------------------------------------------------------
# Passwords / auth
# ---------------------------------------------------------------------------
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', 'OPTIONS': {'min_length': 10}},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# ---------------------------------------------------------------------------
# I18N
# ---------------------------------------------------------------------------
# Russian: the storefront is Russian-language, and this also makes DRF's
# built-in validation messages ("Обязательное поле.") match it.
LANGUAGE_CODE = 'ru'
TIME_ZONE = os.getenv('DJANGO_TIME_ZONE', 'Europe/Amsterdam')
USE_I18N = True
USE_TZ = True

# ---------------------------------------------------------------------------
# Static / media
# ---------------------------------------------------------------------------
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_DIRS = [BASE_DIR / 'apps' / 'dashboard' / 'static', ('site', FRONTEND_DIR)]

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ---------------------------------------------------------------------------
# CORS / CSRF — the frontend is a separate static app, so it is treated as a
# cross-origin client. Only the origins listed in .env are trusted.
# ---------------------------------------------------------------------------
CORS_ALLOWED_ORIGINS = env_list('CORS_ALLOWED_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5500')
CSRF_TRUSTED_ORIGINS = env_list('CSRF_TRUSTED_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5500')
CORS_ALLOW_CREDENTIALS = True

SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'

if not DEBUG:
    SECURE_SSL_REDIRECT = env_bool('DJANGO_SECURE_SSL_REDIRECT', True)
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True

# ---------------------------------------------------------------------------
# DRF
# ---------------------------------------------------------------------------
REST_FRAMEWORK = {
    'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.AllowAny'],
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_RENDERER_CLASSES': ['rest_framework.renderers.JSONRenderer'],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.LimitOffsetPagination',
    'PAGE_SIZE': 24,
    'DEFAULT_THROTTLE_CLASSES': ['rest_framework.throttling.AnonRateThrottle'],
    'DEFAULT_THROTTLE_RATES': {'anon': '120/minute'},
}

# ---------------------------------------------------------------------------
# Payments — provider-agnostic. See apps/payments/services.py.
# ---------------------------------------------------------------------------
PAYMENT_PROVIDER = os.getenv('PAYMENT_PROVIDER', 'manual_test')
PAYMENT_PROVIDER_CONFIG = {
    'yookassa': {
        'shop_id': os.getenv('YOOKASSA_SHOP_ID', ''),
        'secret_key': os.getenv('YOOKASSA_SECRET_KEY', ''),
    },
    'tbank': {
        'terminal_key': os.getenv('TBANK_TERMINAL_KEY', ''),
        'secret_key': os.getenv('TBANK_SECRET_KEY', ''),
    },
}
FRONTEND_BASE_URL = os.getenv('FRONTEND_BASE_URL', 'http://127.0.0.1:8000')

# One currency for the whole shop (ISO 4217). Prices in the admin are
# entered in this currency; orders and payments are stamped with it.
SHOP_CURRENCY = os.getenv('SHOP_CURRENCY', 'USD')

# ---------------------------------------------------------------------------
# Email — service layer exists (apps/customers/notifications.py); wire a
# real backend here when ready. Defaults to console output in dev.
# ---------------------------------------------------------------------------
EMAIL_BACKEND = os.getenv('DJANGO_EMAIL_BACKEND', 'django.core.mail.backends.console.EmailBackend')
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', 'no-reply@mrak8.com')

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {'console': {'class': 'logging.StreamHandler'}},
    'root': {'handlers': ['console'], 'level': 'INFO'},
    'loggers': {
        'apps.payments': {'handlers': ['console'], 'level': 'INFO', 'propagate': False},
        'apps.orders': {'handlers': ['console'], 'level': 'INFO', 'propagate': False},
    },
}
