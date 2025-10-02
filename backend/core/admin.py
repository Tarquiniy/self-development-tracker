from django.contrib import admin
from django.urls import path
from django.template.response import TemplateResponse
from blog.models import Post, Category, Comment
from users.models import CustomUser

class CustomAdminSite(admin.AdminSite):
    site_header = "Positive Theta — Админка"
    site_title = "Админка Positive Theta"
    index_title = "Добро пожаловать 👋"

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path("", self.admin_view(self.dashboard), name="index"),
        ]
        return custom_urls + urls

    def dashboard(self, request):
        context = dict(
            self.each_context(request),
            title="Dashboard",
            posts_count=Post.objects.count(),
            categories_count=Category.objects.count(),
            comments_count=Comment.objects.count(),
            users_count=CustomUser.objects.count(),
        )
        return TemplateResponse(request, "admin/dashboard.html", context)

# Регистрируем кастомный сайт
custom_admin_site = CustomAdminSite(name="custom_admin")
