# backend/core/settings.py
import os
from pathlib import Path
from datetime import timedelta
import dj_database_url
from dotenv import load_dotenv

load_dotenv()

env = os.environ.get

BASE_DIR = Path(__file__).resolve().parent.parent

# ========== SUPABASE / S3 ==========
SUPABASE_USE_PROXY = True
SUPABASE_URL = env("SUPABASE_URL", "").strip() or None
SUPABASE_KEY = env("SUPABASE_KEY", "").strip() or None
SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET", "post_attachments")

AWS_ACCESS_KEY_ID = env("SUPABASE_S3_KEY", "").strip() or None
AWS_SECRET_ACCESS_KEY = env("SUPABASE_S3_SECRET", "").strip() or None
AWS_STORAGE_BUCKET_NAME = "post_attachments"
AWS_S3_ENDPOINT_URL = os.environ.get("AWS_S3_ENDPOINT_URL", SUPABASE_URL)
AWS_S3_REGION_NAME = env('AWS_S3_REGION_NAME', 'us-east-1')
AWS_S3_SIGNATURE_VERSION = 's3v4'
AWS_S3_ADDRESSING_STYLE = "path"
AWS_DEFAULT_ACL = None
AWS_S3_OBJECT_PARAMETERS = {
    'CacheControl': 'max-age=86400, public',
}
AWS_QUERYSTRING_AUTH = False

# ========== MEDIA ==========
if SUPABASE_URL and AWS_STORAGE_BUCKET_NAME:
    MEDIA_URL = f"{SUPABASE_URL.rstrip('/')}/storage/v1/object/public/{AWS_STORAGE_BUCKET_NAME}/"
else:
    MEDIA_URL = os.environ.get('MEDIA_URL', '/media/')

MEDIA_ROOT = os.path.join(BASE_DIR, "media")

# ========== GRAPPELLI ==========
GRAPPELLI_ADMIN_TITLE = 'Positive Theta Admin'
GRAPPELLI_CLEAN_INPUT_TYPES = True

SECRET_KEY = os.environ.get('SECRET_KEY', 'резервный-секретный-ключ-для-разработки')
DEBUG = os.getenv("DEBUG", "False") == "True"

ALLOWED_HOSTS = os.getenv("ALLOWED_HOSTS", "").split(",") + [
    "localhost", "127.0.0.1", ".vercel.app", ".onrender.com",
    "cs88500-wordpress-o0a99.tw1.ru", "sdracker.onrender.com"
]

RENDER_EXTERNAL_HOSTNAME = os.environ.get('RENDER_EXTERNAL_HOSTNAME')
if RENDER_EXTERNAL_HOSTNAME:
    ALLOWED_HOSTS.append(RENDER_EXTERNAL_HOSTNAME)

CSRF_TRUSTED_ORIGINS = [
    "http://localhost:3000", "http://127.0.0.1:3000",
    "https://*.vercel.app", "https://*.onrender.com", 
    "https://*.supabase.co", "https://cs88500-wordpress-o0a99.tw1.ru",
    "https://positive-theta.vercel.app"
]

CORS_ALLOWED_ORIGINS = [
    "https://positive-theta.vercel.app", "http://localhost:3000", 
    "http://127.0.0.1:3000", "https://cs88500-wordpress-o0a99.tw1.ru",
    "https://sdracker.onrender.com"
]

CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_METHODS = ['DELETE', 'GET', 'OPTIONS', 'PATCH', 'POST', 'PUT']
CORS_ALLOW_HEADERS = [
    'accept', 'accept-encoding', 'authorization', 'content-type',
    'dnt', 'origin', 'user-agent', 'x-csrftoken', 'x-requested-with',
]

SESSION_COOKIE_SAMESITE = 'None' if not DEBUG else 'Lax'
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SAMESITE = 'None' if not DEBUG else 'Lax'
CSRF_COOKIE_SECURE = not DEBUG

# ========== STATIC ==========
STATIC_URL = "/static/"
STATIC_ROOT = os.path.join(BASE_DIR, "staticfiles")
STATICFILES_DIRS = [BASE_DIR / 'blog' / 'static']
STATICFILES_STORAGE = 'whitenoise.storage.CompressedStaticFilesStorage'

# ========== DATABASE ==========
DATABASES = {
    'default': dj_database_url.config(
        default=os.environ.get('DATABASE_URL'),
        conn_max_age=600,
        conn_health_checks=True,
    )
}

FRONTEND_URL = os.environ.get('FRONTEND_URL', 'https://positive-theta.vercel.app')

# ========== MIDDLEWARE ==========
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# ========== APPS ==========
INSTALLED_APPS = [
    "grappelli",
    
    # Django core apps
    "django.contrib.auth",
    "django.contrib.admin",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    # Local apps
    "users.apps.UsersConfig",
    "tables.apps.TablesConfig",
    "payments.apps.PaymentsConfig",
    "analytics.apps.AnalyticsConfig",
    "blog.apps.BlogConfig",

    # Third-party apps
    'django_ckeditor_5',
    "rest_framework",
    "rest_framework.authtoken",
    "corsheaders",
    "whitenoise.runserver_nostatic",
    'django_filters',
    'django_summernote',
    'storages',
    'reversion',
    'adminsortable2',
    'widget_tweaks',
]

# ========== CKEDITOR 5 ==========
CKEDITOR_5_CONFIGS = {
    'default': {
        'toolbar': [
            'heading', '|', 'bold', 'italic', 'link', 'bulletedList', 
            'numberedList', 'blockQuote', 'imageUpload', '|', 'undo', 'redo'
        ],
    },
    'extends': {
        'blockToolbar': ['paragraph', 'heading1', 'heading2', 'heading3'],
        'toolbar': [
            'heading', '|', 'outdent', 'indent', '|', 'bold', 'italic', 
            'link', 'underline', 'strikethrough', 'code', '|', 'bulletedList', 
            'numberedList', 'todoList', '|', 'blockQuote', 'imageUpload', '|', 
            'fontSize', 'fontFamily', 'fontColor', 'fontBackgroundColor', '|',
            'codeBlock', 'htmlEmbed', '|', 'undo', 'redo'
        ],
        'image': {
            'toolbar': ['imageTextAlternative', 'imageStyle:inline', 'imageStyle:block', 'imageStyle:side']
        }
    }
}

CKEDITOR_5_FILE_UPLOAD_PERMISSION = "staff"

# Summernote настройки
SUMMERNOTE_CONFIG = {
    'summernote': {
        'width': '100%',
        'height': '480',
        'toolbar': [
            ['style', ['style']],
            ['font', ['bold', 'italic', 'underline', 'clear']],
            ['para', ['ul', 'ol', 'paragraph']],
            ['table', ['table']],
            ['insert', ['link', 'picture', 'video']],
            ['view', ['fullscreen', 'codeview']],
        ],
    },
    'attachment_require_authentication': True,
}

ROOT_URLCONF = "core.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [os.path.join(BASE_DIR, "templates")],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
                "django.template.context_processors.request",
            ],
        },
    },
]

WSGI_APPLICATION = "core.wsgi.application"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "ru-ru"
TIME_ZONE = "Europe/Moscow"
USE_I18N = True
USE_TZ = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ========== REST FRAMEWORK ==========
REST_FRAMEWORK = {
    'DEFAULT_FILTER_BACKENDS': ['django_filters.rest_framework.DjangoFilterBackend'],
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
        'rest_framework.authentication.TokenAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.AllowAny'],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 10,
}

# ========== SECURITY ==========
if not DEBUG:
    SECURE_SSL_REDIRECT = True
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

DEFAULT_FILE_STORAGE = "backend.blog.storages.SupabaseStorage"

# Email settings
if not DEBUG:
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
    EMAIL_HOST = os.getenv('EMAIL_HOST')
    EMAIL_PORT = int(os.getenv('EMAIL_PORT', 587))
    EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS', 'True') == 'True'
    EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER')
    EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD')
    DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL')
else:
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

# Logging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {"class": 'logging.StreamHandler'},
    },
    'root': {'handlers': ['console'], 'level': 'INFO' if DEBUG else 'WARNING'},
}