# backend/blog/admin.py
import logging
from django.contrib import admin
from django.contrib.admin.sites import AlreadyRegistered

logger = logging.getLogger(__name__)

# Регистрируем модели блог-приложения безопасно (в момент импорта admin.py)
try:
    from . import models as blog_models
except Exception as e:
    blog_models = None
    logger.warning("Could not import backend.blog.models: %s", e)

if blog_models:
    def safe_register(model, admin_class=None):
        if model is None:
            return
        try:
            if admin_class:
                admin.site.register(model, admin_class)
            else:
                admin.site.register(model)
            logger.info("Registered admin for %s", model.__name__)
        except AlreadyRegistered:
            logger.info("%s already registered; skipping", model.__name__)
        except Exception as e:
            logger.exception("Failed to register %s: %s", getattr(model, "__name__", str(model)), e)

    # Примитивные admin-классы — можно расширить при необходимости
    class BasicAdmin(admin.ModelAdmin):
        list_display = ("__str__",)
        search_fields = ("__str__",)

    safe_register(getattr(blog_models, "Post", None), BasicAdmin)
    safe_register(getattr(blog_models, "Category", None), BasicAdmin)
    safe_register(getattr(blog_models, "Tag", None), BasicAdmin)
    safe_register(getattr(blog_models, "Comment", None), BasicAdmin)
    safe_register(getattr(blog_models, "PostReaction", None), BasicAdmin)
    safe_register(getattr(blog_models, "PostView", None), BasicAdmin)
    safe_register(getattr(blog_models, "PostRevision", None), BasicAdmin)
    safe_register(getattr(blog_models, "PostAttachment", None), BasicAdmin)
    safe_register(getattr(blog_models, "MediaLibrary", None), BasicAdmin)
else:
    logger.debug("backend.blog.models not available; skipping blog admin registration")
