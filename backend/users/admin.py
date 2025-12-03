# your_app/admin.py
from django.contrib import admin
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django import forms
from django.apps import apps
from django.core.exceptions import ValidationError

User = get_user_model()

# Попытка найти модель профиля в приложении "users" — если у вас другое имя app, замените 'users'.
# Код устойчив — если модель не найдена, inline не будет зарегистрирован.
ProfileModel = None
PROFILE_MODEL_CANDIDATES = [
    ("users", "UserProfile"),
    ("users", "Userprofile"),
    ("accounts", "UserProfile"),
    ("accounts", "Userprofile"),
    ("your_app", "UserProfile"),  # запасной вариант — замените if needed
]

for app_label, model_name in PROFILE_MODEL_CANDIDATES:
    try:
        ProfileModel = apps.get_model(app_label, model_name)
        if ProfileModel is not None:
            break
    except LookupError:
        ProfileModel = None

# Utility: проверить, есть ли у модели поле с именем
def model_has_field(model, field_name):
    try:
        return field_name in {f.name for f in model._meta.get_fields()}
    except Exception:
        return False


# Inline form для профиля, с валидацией max_tables (если поле есть)
class UserProfileInlineForm(forms.ModelForm):
    class Meta:
        model = ProfileModel
        fields = "__all__"

    def clean(self):
        cleaned = super().clean()
        # Если поле max_tables есть — проверяем на целое >= 0
        if ProfileModel and model_has_field(ProfileModel, "max_tables"):
            val = cleaned.get("max_tables")
            if val is None:
                # допускаем пустое (если поле nullable) — но если вы хотите запрещать, раскомментируйте:
                # raise ValidationError({"max_tables": "Поле обязательно."})
                pass
            else:
                try:
                    ival = int(val)
                except (TypeError, ValueError):
                    raise ValidationError({"max_tables": "Должно быть целым числом."})
                if ival < 0:
                    raise ValidationError({"max_tables": "Должно быть >= 0."})
        return cleaned


# Inline для админа — отображаем профиль рядом с юзером
class UserProfileInline(admin.StackedInline):
    model = ProfileModel
    form = UserProfileInlineForm
    extra = 0
    can_delete = False
    verbose_name = "Профиль"
    verbose_name_plural = "Профиль"

    # Сформируем поля inline динамически — безопасно
    def get_fields(self, request, obj=None):
        if not ProfileModel:
            return []
        names = [f.name for f in ProfileModel._meta.get_fields() if getattr(f, "editable", False)]
        # Порядок: avatar_url, about, birthday, use_gravatar, max_tables, consent_given, consent_at, others...
        preferred = ["avatar_url", "about", "birthday", "use_gravatar", "max_tables", "consent_given", "consent_at"]
        fields = [n for n in preferred if n in names]
        # добавим остальные editable поля (кроме внутренних FK)
        for n in names:
            if n not in fields and n not in ("id", "user", "user_id"):
                fields.append(n)
        return fields


# Соберём дополнительные поля для UserAdmin: если max_tables в User — добавим в поля редактирования
extra_user_fields = []
if model_has_field(User, "max_tables"):
    extra_user_fields.append("max_tables")

# Определяем новые fieldsets: аккуратно показываем важные разделы и добавляем readonly для supabase_uid и email_verified, если есть
user_readonly = []
if model_has_field(User, "supabase_uid"):
    user_readonly.append("supabase_uid")
if model_has_field(User, "email_verified"):
    user_readonly.append("email_verified")
if model_has_field(User, "date_joined"):
    user_readonly.append("date_joined")

# Составляем новый UserAdmin
@admin.register(User)
class CustomUserAdmin(DjangoUserAdmin):
    # Поля, которые показываем в списке
    list_display = ("id", "email", "username", "is_staff", "is_active")
    if model_has_field(User, "supabase_uid"):
        list_display = tuple(list(list_display) + ["supabase_uid"])
    list_display_links = ("email", "username")
    search_fields = ("email", "username", "first_name", "last_name")
    ordering = ("-date_joined",) if model_has_field(User, "date_joined") else ("id",)

    # Добавляем фильтры
    list_filter = ("is_staff", "is_superuser", "is_active")

    # Включаем inline профиля, если модель есть
    inlines = [UserProfileInline] if ProfileModel is not None else []

    # Поля, которые можно редактировать на форме редактирования пользователя
    # Берём стандартные fieldsets и аккуратно добавляем раздел "Дополнительно" с extra_user_fields
    fieldsets = list(DjangoUserAdmin.fieldsets)
    # Добавляем секцию "Дополнительные поля" (внизу) если есть дополнительные поля
    if extra_user_fields:
        fieldsets.append(("Дополнительно", {"fields": tuple(extra_user_fields)}))

    # readonly fields (например, supabase_uid / email_verified)
    readonly_fields = tuple(user_readonly)

    # Добавим безопасную форму валидации для max_tables, если поле лежит в User
    def get_form(self, request, obj=None, **kwargs):
        form = super().get_form(request, obj, **kwargs)
        # если User содержит max_tables — обернём clean
        if model_has_field(User, "max_tables"):
            # создаём динамический clean в форме
            orig_clean = form.clean

            def clean_inner(self_form):
                data = orig_clean(self_form)
                val = data.get("max_tables")
                if val is not None:
                    try:
                        ival = int(val)
                    except (TypeError, ValueError):
                        raise ValidationError({"max_tables": "Должно быть целым числом."})
                    if ival < 0:
                        raise ValidationError({"max_tables": "Должно быть >= 0."})
                return data

            form.clean = clean_inner
        return form

    # Улучшаем список полей, которые отображаются в форме создания
    add_fieldsets = DjangoUserAdmin.add_fieldsets

    # Настройки отображения в changelist
    def get_list_display(self, request):
        return self.list_display

    # Если нужно, можно показать дополнительные поля в списке — добавляются выше.

    # Безопасная регистрация — если пользователь уже зарегистрирован другим админом, inline просто отобразится.


# Если профиль не найден — предупреждение в логах (не критично)
if ProfileModel is None:
    import logging
    logger = logging.getLogger(__name__)
    logger.info("UserProfile model not found by admin helper — ProfileInline will not be registered. If your profile model lives in another app, add it to PROFILE_MODEL_CANDIDATES or register manually.")
