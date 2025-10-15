# backend/core/admin.py
from django.contrib import admin
from django.urls import path, reverse
from django.shortcuts import redirect
from django.http import HttpResponse
import types
import logging

logger = logging.getLogger(__name__)


class CustomAdminSite(admin.AdminSite):
    site_header = "Positive Theta Admin"
    site_title = "Positive Theta"
    index_title = "Панель управления Positive Theta"

    def _find_registered_model(self, app_label_hint=None, model_name_hint=None):
        """
        Возвращает кортеж (app_label, model_name) реально зарегистрированной модели,
        максимально соответствующей подсказкам. Иначе None.
        """
        for m in self._registry.keys():
            try:
                ma = m._meta
            except Exception:
                continue
            if model_name_hint and ma.model_name == model_name_hint:
                if app_label_hint:
                    if ma.app_label == app_label_hint:
                        return ma.app_label, ma.model_name
                    else:
                        continue
                return ma.app_label, ma.model_name
            if app_label_hint and ma.app_label == app_label_hint and not model_name_hint:
                return ma.app_label, ma.model_name
        return None

    def _compat_redirect_view(self, app_label_hint=None, model_name_hint=None, action="changelist", fallback="/admin/"):
        def _view(request, *args, **kwargs):
            # Если точно есть модель с такими подсказками, пробуем namespaced URL
            if app_label_hint and model_name_hint:
                cand = f"admin:{app_label_hint}_{model_name_hint}_{action}"
                try:
                    return redirect(reverse(cand))
                except Exception:
                    pass
            # Находим любую зарегистрированную модель, подходящую подсказкам
            res = self._find_registered_model(app_label_hint, model_name_hint)
            if res:
                app_label, model_name = res
                cand = f"admin:{app_label}_{model_name}_{action}"
                try:
                    return redirect(reverse(cand))
                except Exception:
                    pass
            # fallback
            return redirect(fallback)
        return _view

    def get_urls(self):
        """
        Добавляем совместимые маршруты до стандартных admin.urls.
        Они попадут в namespace 'admin' поскольку сайт создаётся с name='admin'
        и в проекте подключается custom_admin_site.urls под 'admin/'.
        """
        urls = super().get_urls()
        custom = [
            path("auth/user/", self.admin_view(self._compat_redirect_view("auth", "user", "changelist")), name="auth_user_changelist"),
            path("blog/comment/", self.admin_view(self._compat_redirect_view("blog", "comment", "changelist")), name="blog_comment_changelist"),
            path("blog/post/add/", self.admin_view(self._compat_redirect_view("blog", "post", "add")), name="blog_post_add"),
            # медиа/другие совместимости можно добавить здесь по аналогии
        ]
        return custom + urls


# Экспортируем экземпляр site, используемый в urls.py
custom_admin_site = CustomAdminSite(name="admin")

# Зарегистрируйте стандартные модели (Group и т.п.) если ещё не зарегистрированы.
# Не удаляем существующие регистрационные соглашения — это best-effort.
try:
    from django.contrib.auth.models import Group as _Group
    from django.contrib.auth.admin import GroupAdmin as DefaultGroupAdmin
    if _Group not in custom_admin_site._registry:
        try:
            custom_admin_site.register(_Group, DefaultGroupAdmin)
        except Exception:
            logger.debug("Could not register Group into custom_admin_site")
except Exception:
    logger.debug("Group registration attempt failed in custom_admin_site")

# Попытка загрузить и зарегистрировать модели из приложений (best-effort)
# Если у вас есть custom registration helper в blog.admin, можно вызвать его.
try:
    from blog import admin as blog_admin_module
    register_fn = getattr(blog_admin_module, "register_admin_models", None)
    if callable(register_fn):
        try:
            register_fn(custom_admin_site)
            logger.info("Registered blog admin models into custom_admin_site via register_admin_models.")
        except Exception:
            logger.exception("register_admin_models exists but failed when called")
except Exception:
    # не критично
    pass


__all__ = ["custom_admin_site", "CustomAdminSite"]
