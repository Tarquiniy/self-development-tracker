# backend/blog/admin.py
import logging
from importlib import import_module

from django import forms
from django.contrib import admin
from django.contrib.admin.sites import AlreadyRegistered
from django.utils.safestring import mark_safe
from django.forms.models import modelform_factory

logger = logging.getLogger(__name__)


class PostAdminFormBase(forms.ModelForm):
    class Meta:
        fields = '__all__'
        widgets = {
            'excerpt': forms.Textarea(attrs={'rows': 3}),
            'meta_description': forms.Textarea(attrs={'rows': 2}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if 'title' in self.fields:
            self.fields['title'].widget.attrs.update({'placeholder': 'Введите заголовок'})
        if 'slug' in self.fields:
            self.fields['slug'].widget.attrs.update({'placeholder': 'slug'})


class BasePostAdmin(admin.ModelAdmin):
    form = None  # будет назначен динамически
    list_display = ("__str__",)
    search_fields = ("title", "excerpt", "content")


def register_blog_admin(site_obj):
    """
    Динамически импортируем blog.models и регистрируем админ-классы.
    Вызывать из BlogConfig.ready().
    """
    tried = []
    blog_models = None

    # Попробуем стандартные варианты импорта
    for modname in ('backend.blog.models', 'blog.models'):
        try:
            blog_models = import_module(modname)
            tried.append(modname)
            break
        except Exception as exc:
            tried.append(f"{modname}: {exc}")

    if blog_models is None:
        logger.error("Could not import backend.blog.models; tried: %s", tried)
        return False

    Post = getattr(blog_models, 'Post', None)
    Category = getattr(blog_models, 'Category', None)
    Tag = getattr(blog_models, 'Tag', None)
    Comment = getattr(blog_models, 'Comment', None)
    MediaLibrary = getattr(blog_models, 'MediaLibrary', None)
    PostRevision = getattr(blog_models, 'PostRevision', None)

    # Register Post with a dynamic form/admin
    if Post is not None:
        try:
            PostForm = None
            try:
                PostForm = modelform_factory(Post, form=PostAdminFormBase, fields='__all__')
            except Exception as e:
                logger.debug("Could not build Post ModelForm: %s", e)
                PostForm = None

            attrs = {}
            if PostForm is not None:
                attrs['form'] = PostForm
            # задаём некоторые опции как строчки — Django сам проигнорирует отсутствующие поля
            attrs.setdefault('list_display', ("title", "status", "author") if hasattr(Post, 'title') else ("__str__",))
            attrs.setdefault('search_fields', ("title", "excerpt") if hasattr(Post, 'title') else ("__str__",))

            PostAdmin = type('PostAdmin', (BasePostAdmin,), attrs)

            try:
                site_obj.register(Post, PostAdmin)
                logger.info("Registered Post admin")
            except AlreadyRegistered:
                logger.info("Post already registered")
            except Exception as e:
                logger.exception("Failed to register Post admin: %s", e)
        except Exception:
            logger.exception("Unexpected error registering Post admin")

    # Остальные модели — простая регистрация с обработкой ошибок
    def safe_register(model, admin_cls=None):
        if model is None:
            return
        try:
            site_obj.register(model, admin_cls) if admin_cls else site_obj.register(model)
        except AlreadyRegistered:
            pass
        except Exception as e:
            logger.exception("Failed to register %s: %s", getattr(model, '__name__', model), e)

    safe_register(Category)
    safe_register(Tag)
    safe_register(Comment)
    safe_register(MediaLibrary)
    safe_register(PostRevision)

    return True

