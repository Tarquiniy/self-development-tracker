# backend/core/admin.py
from django.contrib import admin

class CustomAdminSite(admin.AdminSite):
    site_header = "Positive Theta Admin"
    site_title = "Positive Theta"
    index_title = "Добро пожаловать в админку Positive Theta"

# Экземпляр, который будем импортировать в blog.admin и urls
custom_admin_site = CustomAdminSite(name="custom_admin")
