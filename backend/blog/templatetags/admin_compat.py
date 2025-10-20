from django import template
from django.urls import reverse, NoReverseMatch

register = template.Library()

@register.simple_tag
def admin_changelist_or_app_list(app_label: str, model_name: str) -> str:
    """
    Попытаться вернуть URL для 'admin:app_model_changelist'.
    Если такого имени URL нет, вернуть URL админского списка приложения 'admin:app_list'.
    Использование в шаблонах:
      {% load admin_compat %}
      <a href="{% admin_changelist_or_app_list 'blog' 'comment' %}">Комментарии</a>
    """
    try:
        return reverse(f'admin:{app_label}_{model_name}_changelist')
    except NoReverseMatch:
        return reverse('admin:app_list', args=(app_label,))
