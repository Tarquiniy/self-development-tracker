# backend/users/admin.py
from django.contrib import admin
from django.contrib.auth import get_user_model
from django.utils.translation import gettext_lazy as _
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

# Попытка зарегистрировать в кастомной админ-сайте, если он есть
try:
    from core.admin import custom_admin_site as site  # path to your custom admin site
except Exception:
    site = admin.site

User = get_user_model()

def _has_attr_or_field(model, name):
    """Возвращает True, если model имеет атрибут/свойство/field с таким именем."""
    # Проверка атрибута / метода
    if hasattr(model, name):
        return True
    # Поля модели хранятся в _meta
    try:
        return any(f.name == name for f in model._meta.get_fields())
    except Exception:
        return False

# Базовые наборы желаемых колонок, фильтров и readonly полей.
DESIRED_LIST_DISPLAY = [
    "id", "email", "username", "is_staff", "is_superuser", "is_active",
    "date_joined", "last_login", "created_at", "updated_at",
]
DESIRED_LIST_FILTER = [
    "is_staff", "is_superuser", "is_active", "is_verified", "email_verified", "date_joined"
]
DESIRED_READONLY = ["date_joined", "last_login", "created_at", "updated_at"]
DESIRED_ORDERING = ["-created_at", "-date_joined", "-id"]

# Фильтруем желаемые значения оставляя только те, что реально есть в модели
list_display = [n for n in DESIRED_LIST_DISPLAY if _has_attr_or_field(User, n)]
if not list_display:
    # гарантия — минимальный набор
    list_display = ["id", "email"]

list_filter = [n for n in DESIRED_LIST_FILTER if _has_attr_or_field(User, n)]
readonly_fields = [n for n in DESIRED_READONLY if _has_attr_or_field(User, n)]

# Определяем ordering — первое существующее поле из списка DESIRED_ORDERING
ordering = None
for candidate in DESIRED_ORDERING:
    # strip leading '-' для проверки наличия поля
    name = candidate.lstrip("-")
    if _has_attr_or_field(User, name):
        ordering = [candidate]
        break
if ordering is None:
    ordering = ["-id"]

# Создаём кастомный UserAdmin, переиспользуя поведение Django's UserAdmin
class CustomUserAdmin(BaseUserAdmin):
    model = User
    list_display = list_display
    list_filter = list_filter
    readonly_fields = readonly_fields
    ordering = ordering

    # Динамически соберём fieldsets: возьмём стандартный из BaseUserAdmin, но если поле
    # отсутствует — не включаем его в поля.
    def _filter_fieldset_fields(self, fieldset):
        label, options = fieldset
        fields = options.get("fields", ())
        if isinstance(fields, (list, tuple)):
            filtered = tuple(f for f in fields if _has_attr_or_field(self.model, f))
            new_options = dict(options)
            new_options["fields"] = filtered
            return (label, new_options)
        return fieldset

    def get_fieldsets(self, request, obj=None):
        try:
            base = super().get_fieldsets(request, obj)
            return tuple(self._filter_fieldset_fields(fs) for fs in base)
        except Exception:
            # в случае ошибке — просто вернуть минимальный fieldset
            return (
                (None, {"fields": ("email", "password")}),
            )

    # Безопасная реализация get_readonly_fields на случай, если readonly_fields включает несуществующие
    def get_readonly_fields(self, request, obj=None):
        base = list(super().get_readonly_fields(request, obj))
        # добавить наши readonly_fields если они есть
        for f in readonly_fields:
            if f not in base and _has_attr_or_field(self.model, f):
                base.append(f)
        return base

# Регистрируем в кастомной админ-сайте (если есть) или в стандартной
try:
    site.register(User, CustomUserAdmin)
except admin.sites.AlreadyRegistered:
    # если уже зарегистрирован — перерегистрируем (удалим и зарегистрируем заново)
    try:
        site.unregister(User)
    except Exception:
        pass
    site.register(User, CustomUserAdmin)
