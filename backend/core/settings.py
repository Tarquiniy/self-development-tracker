import os
from pathlib import Path
from datetime import timedelta
import dj_database_url
from dotenv import load_dotenv

load_dotenv()

# Удобный сокращённый доступ к env
env = os.environ.get

BASE_DIR = Path(__file__).resolve().parent.parent

# ========== SUPABASE / S3 ==========
SUPABASE_USE_PROXY = True
SUPABASE_URL = env("SUPABASE_URL", "").strip() or None
SUPABASE_KEY = env("SUPABASE_KEY", "").strip() or None
SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET", "post_attachments")
SUPABASE_SERVICE_ROLE_KEY = env("SUPABASE_SERVICE_ROLE_KEY", "").strip() or None

AWS_ACCESS_KEY_ID = env("SUPABASE_S3_KEY", "").strip() or None
AWS_SECRET_ACCESS_KEY = env("SUPABASE_S3_SECRET", "").strip() or None
AWS_STORAGE_BUCKET_NAME = "post_attachments"

SUPABASE_PUBLIC_BUCKET = True
AWS_S3_ENDPOINT_URL = os.environ.get("AWS_S3_ENDPOINT_URL", SUPABASE_URL)
AWS_S3_REGION_NAME = env('AWS_S3_REGION_NAME', 'us-east-1')
AWS_S3_SIGNATURE_VERSION = 's3v4'
AWS_S3_ADDRESSING_STYLE = "path"
AWS_DEFAULT_ACL = None
AWS_S3_OBJECT_PARAMETERS = {
    'CacheControl': 'max-age=86400, public',
}

# ========== MEDIA ==========
if SUPABASE_URL and AWS_STORAGE_BUCKET_NAME:
    MEDIA_URL = f"{SUPABASE_URL.rstrip('/')}/storage/v1/object/public/{AWS_STORAGE_BUCKET_NAME}/"
else:
    MEDIA_URL = os.environ.get('MEDIA_URL', '/media/')

MEDIA_ROOT = os.path.join(BASE_DIR, "media")

# ========== ADMIN ==========
GRAPPELLI_ADMIN_TITLE = 'Positive Theta Admin'
GRAPPELLI_SWITCH_USER = True

X_FRAME_OPTIONS = 'SAMEORIGIN'
SUMMERNOTE_CONFIG = {
    'iframe': True,
    'summernote': {
        'width': '100%',
        'height': '480px',
        'toolbar': [
            ['style', ['style']],
            ['font', ['bold', 'italic', 'underline', 'clear']],
            ['fontname', ['fontname']],
            ['color', ['color']],
            ['para', ['ul', 'ol', 'paragraph']],
            ['height', ['height']],
            ['table', ['table']],
            ['insert', ['link', 'picture', 'video']],
            ['view', ['fullscreen', 'codeview', 'help']],
        ],
    },
    'attachment_require_authentication': True,
}

# 🎨 Jazzmin кастомизация
JAZZMIN_SETTINGS = {
    "site_title": "Positive Theta Admin",
    "site_header": "Positive Theta Панель",
    "site_brand": "Positive Theta",
    "welcome_sign": "Добро пожаловать в панель управления",
    "copyright": "Positive Theta © 2025",
    "show_ui_builder": True,
    "icons": {
        "auth": "fas fa-users-cog",
        "blog.Post": "fas fa-newspaper",
        "blog.Category": "fas fa-folder",
        "blog.Tag": "fas fa-tags",
        "blog.Comment": "fas fa-comments",
    },
    "order_with_respect_to": ["blog", "auth"],
    "topmenu_links": [
        {"name": "Главная", "url": "admin:index", "permissions": ["auth.view_user"]},
        {"app": "blog"},
        {"name": "Сайт", "url": "/", "new_window": True},
    ],
}

SECRET_KEY = os.environ.get('SECRET_KEY', 'резервный-секретный-ключ-для-разработки')
DEBUG = os.getenv("DEBUG", "False") == "True"

ALLOWED_HOSTS = os.getenv("ALLOWED_HOSTS", "").split(",") + [
    "localhost",
    "127.0.0.1",
    "self-development-tracker.onrender.com",
    "sdtracker.vercel.app",
    ".vercel.app",
    ".onrender.com",
    "sdracker.onrender.com",
    "cs88500-wordpress-o0a99.tw1.ru",
]

RENDER_EXTERNAL_HOSTNAME = os.environ.get('RENDER_EXTERNAL_HOSTNAME')
if RENDER_EXTERNAL_HOSTNAME:
    ALLOWED_HOSTS.append(RENDER_EXTERNAL_HOSTNAME)

# CSRF / CORS
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://*.vercel.app",
    "https://*.onrender.com",
    "https://*.supabase.co",
    "https://sdracker.onrender.com",
    "https://sdtracker.vercel.app",
    "https://positive-theta.vercel.app",
    "https://cs88500-wordpress-o0a99.tw1.ru",
]

CORS_ALLOWED_ORIGINS = [
    "https://sdtracker.vercel.app",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://cs88500-wordpress-o0a99.tw1.ru",
    "https://sdracker.onrender.com",
    "https://positive-theta.vercel.app",
]

CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_METHODS = ['DELETE', 'GET', 'OPTIONS', 'PATCH', 'POST', 'PUT']
CORS_ALLOW_HEADERS = [
    'accept', 'accept-encoding', 'authorization', 'content-type',
    'dnt', 'origin', 'user-agent', 'x-csrftoken', 'x-requested-with',
]

SESSION_COOKIE_SAMESITE = 'None'
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SAMESITE = 'None'
CSRF_COOKIE_SECURE = True

# ========== STATIC ==========
STATIC_URL = "/static/"
STATIC_ROOT = os.path.join(BASE_DIR, "staticfiles")
#STATICFILES_DIRS = [os.path.join(BASE_DIR, "backend", "static"),]
STATICFILES_DIRS = [
    os.path.join(BASE_DIR, "blog", "static"),
]

STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# ========== DATABASE ==========
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('SUPABASE_DB_NAME', 'postgres'),
        'USER': os.environ.get('SUPABASE_DB_USER', 'postgres'),
        'PASSWORD': os.environ.get('SUPABASE_DB_PASSWORD', ''),
        'HOST': os.environ.get('SUPABASE_DB_HOST', 'db.fjqbhcmsqypevfbpzcxj.supabase.co'),
        'PORT': os.environ.get('SUPABASE_DB_PORT', '5432'),
    }
}
if os.environ.get('DATABASE_URL'):
    DATABASES['default'] = dj_database_url.config(
        default=os.environ.get('DATABASE_URL'),
        conn_max_age=600,
        conn_health_checks=True,
    )

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
    "jazzmin",
    "django_ckeditor_5",
    'grappelli',
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    'django_extensions',

    # Third-party
    "rest_framework",
    "rest_framework.authtoken",
    "corsheaders",
    "whitenoise.runserver_nostatic",
    'django_filters',
    'django_summernote',
    'storages',
    'reversion',
    'adminsortable2',
    'filebrowser',

    # Local apps
    "users",
    "tables",
    "payments",
    "analytics",
    "blog",
]

CKEDITOR_UPLOAD_PATH = "uploads/"
CKEDITOR_ALLOW_NONIMAGE_FILES = False

PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.BCryptSHA256PasswordHasher',
    'django.contrib.auth.hashers.PBKDF2PasswordHasher',
    'django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher',
]

JWT_SECRET = os.environ.get('DJANGO_JWT_SECRET', os.environ.get('SECRET_KEY'))
JWT_ALGORITHM = 'HS256'
JWT_EXP_DELTA_SECONDS = 60 * 60 * 24 * 7

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
                "django.template.context_processors.static",
            ],
        },
    },
]

WSGI_APPLICATION = "core.wsgi.application"

# ========== CACHE ==========
CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": os.getenv("REDIS_URL", "redis://localhost:6379/0"),
        "OPTIONS": {"CLIENT_CLASS": "django_redis.client.DefaultClient"},
    }
}

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

# ========== JWT ==========
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_COOKIE": "access_token",
    "AUTH_COOKIE_SECURE": True,
    "AUTH_COOKIE_HTTP_ONLY": True,
    "AUTH_COOKIE_PATH": "/",
    "AUTH_COOKIE_SAMESITE": "None",
}

AUTH_USER_MODEL = "users.CustomUser"

if not DEBUG:
    SECURE_SSL_REDIRECT = True
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

DEFAULT_FILE_STORAGE = "backend.blog.storages.SupabaseStorage"

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

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {"class": 'logging.StreamHandler'},
        'file': {"class": 'logging.FileHandler', 'filename': 'django.log'},
    },
    'root': {'handlers': ['console', 'file'], 'level': 'INFO'},
}

# ========== CKEDITOR CONFIG ==========
CKEDITOR_5_CONFIGS = {
    'default': {
        'toolbar': [
            'heading', '|',
            'bold', 'italic', 'underline', 'strikethrough', '|',
            'link', 'blockQuote', 'imageUpload', 'mediaEmbed', '|',
            'alignment', 'bulletedList', 'numberedList', '|',
            'codeBlock', 'htmlEmbed', '|',
            'undo', 'redo'
        ],
        'height': 500,
        'width': '100%',
        'language': 'ru',
        'placeholder': 'Начните писать ваш пост здесь...',
    },
    'extends': {
        'blockToolbar': [
            'paragraph', 'heading1', 'heading2', 'heading3', '|',
            'bulletedList', 'numberedList', '|',
            'blockQuote', 'imageUpload', 'mediaEmbed',
        ],
        'toolbar': [
            'heading', '|',
            'outdent', 'indent', '|',
            'bold', 'italic', 'underline', 'strikethrough', '|',
            'link', 'uploadImage', 'blockQuote', 'mediaEmbed', '|',
            'code', 'codeBlock', 'sourceEditing', '|',
            'alignment', 'bulletedList', 'numberedList', 'todoList', '|',
            'fontSize', 'fontFamily', 'fontColor', 'fontBackgroundColor', '|',
            'insertTable', 'tableColumn', 'tableRow', 'mergeTableCells', '|',
            'undo', 'redo'
        ],
        'image': {
            'toolbar': [
                'imageTextAlternative', 'toggleImageCaption', '|',
                'imageStyle:inline', 'imageStyle:block', 'imageStyle:side', '|',
                'linkImage'
            ],
            'upload': {
                'types': ['jpeg', 'jpg', 'png', 'gif', 'bmp', 'webp', 'svg']
            }
        },
        'table': {
            'contentToolbar': [
                'tableColumn', 'tableRow', 'mergeTableCells',
                'tableProperties', 'tableCellProperties'
            ]
        },
        'heading': {
            'options': [
                {'model': 'paragraph', 'title': 'Paragraph', 'class': 'ck-heading_paragraph'},
                {'model': 'heading1', 'view': 'h1', 'title': 'Heading 1', 'class': 'ck-heading_heading1'},
                {'model': 'heading2', 'view': 'h2', 'title': 'Heading 2', 'class': 'ck-heading_heading2'},
                {'model': 'heading3', 'view': 'h3', 'title': 'Heading 3', 'class': 'ck-heading_heading3'},
                {'model': 'heading4', 'view': 'h4', 'title': 'Heading 4', 'class': 'ck-heading_heading4'},
            ]
        },
        'htmlSupport': {
            'allow': [
                {'name': '/.*/', 'attributes': True, 'classes': True, 'styles': True}
            ]
        }
    }
}

CKEDITOR_5_FILE_UPLOAD_PERMISSION = "staff"
CKEDITOR_5_UPLOAD_FILE_TYPES = ['jpeg', 'jpg', 'png', 'gif', 'bmp', 'webp', 'svg']

ADMIN_MEDIA_PREFIX = '/static/admin/'

# Summernote настройки
SUMMERNOTE_THEME = 'bs4'
SUMMERNOTE_CONFIG = {
    'summernote': {
        'width': '100%',
        'height': '480',
        'toolbar': [
            ['style', ['style']],
            ['font', ['bold', 'italic', 'underline', 'clear']],
            ['fontname', ['fontname']],
            ['color', ['color']],
            ['para', ['ul', 'ol', 'paragraph']],
            ['height', ['height']],
            ['table', ['table']],
            ['insert', ['link', 'picture', 'video']],
            ['view', ['fullscreen', 'codeview', 'help']],
        ],
    },
    'attachment_require_authentication': True,
    'attachment_model': 'blog.PostAttachment',
}

# Filebrowser настройки (если используется)
FILEBROWSER_DIRECTORY = ''
FILEBROWSER_EXTENSIONS = {
    'Image': ['.jpg','.jpeg','.gif','.png','.tif','.tiff'],
    'Document': ['.pdf','.doc','.docx','.txt'],
    'Video': ['.mov','.mp4','.m4v','.avi'],
    'Audio': ['.mp3','.wav','.aiff','.midi','.m4p']
}

# Настройки для корректной работы с Supabase
AWS_QUERYSTRING_AUTH = False  # Важно для публичных файлов в Supabase