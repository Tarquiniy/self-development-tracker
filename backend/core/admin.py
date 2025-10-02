from django.contrib import admin
from django.urls import path
from django.utils import timezone

from blog.models import Post, Comment
from users.models import CustomUser


class CustomAdminSite(admin.AdminSite):
    site_header = "Positive Theta Admin"
    site_title = "Positive Theta"
    index_title = "Добро пожаловать в админку Positive Theta"

    def get_urls(self):
        urls = super().get_urls()
        # можно добавить кастомные урлы при необходимости
        return urls

    def each_context(self, request):
        context = super().each_context(request)

        # Подсчёты для дашборда
        posts = Post.objects.all()
        comments = Comment.objects.all()
        users = CustomUser.objects.all()

        context.update({
            "posts_count": posts.count(),
            "published_count": posts.filter(status="published").count(),
            "draft_count": posts.filter(status="draft").count(),
            "comments_count": comments.count(),
            "pending_comments": comments.filter(approved=False).count(),
            "users_count": users.count(),
            "today_posts": users.filter(date_joined__date=timezone.now().date()).count(),
            "total_views": posts.aggregate(total=admin.models.Sum("views"))["total"] or 0,

            "recent_posts": posts.order_by("-published_at")[:5],
            "recent_comments": comments.order_by("-created_at")[:5],
        })
        return context


custom_admin_site = CustomAdminSite(name="custom_admin")
