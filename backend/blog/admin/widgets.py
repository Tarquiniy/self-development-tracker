# backend/blog/admin/widgets.py
from django.forms.widgets import TextInput
from django.utils.safestring import mark_safe

class MediaLibraryWidget(TextInput):
    template_name = "admin/widgets/media_library_widget.html"

    class Media:
        css = {
            "all": ("admin/css/media_widget.css",)
        }
        js = ("admin/js/media_widget.js",)
