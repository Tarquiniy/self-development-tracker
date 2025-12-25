from django.contrib import admin
from django.urls import path
from django.shortcuts import render, redirect
from django.utils.html import format_html
from .models import MediaFile

@admin.register(MediaFile)
class MediaFileAdmin(admin.ModelAdmin):
    list_display = ("thumb_tag", "original_filename", "size", "content_type", "uploaded_by", "created_at")
    readonly_fields = ("supabase_url", "thumbnail_url")

    def thumb_tag(self, obj):
        if obj.thumbnail_url:
            return format_html('<img src="{}" style="max-height:60px;max-width:120px;object-fit:cover;border-radius:4px" />', obj.thumbnail_url)
        return "-"
    thumb_tag.short_description = "Preview"

    # Добавляем пункт в admin sidebar — Media Library
    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path("media-library/", self.admin_site.admin_view(self.media_library_view), name="media-library"),
        ]
        return custom_urls + urls

    def media_library_view(self, request):
        # простая страница, использующая шаблон из templates/admin/media_library.html
        return render(request, "admin/media_library.html", {})

