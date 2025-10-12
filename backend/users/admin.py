from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import CustomUser, UserProfile

@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    list_display = ('email', 'username', 'supabase_uid', 'registration_method', 'is_staff')
    list_filter = ('registration_method', 'is_staff', 'is_superuser')
    search_fields = ('email', 'username', 'supabase_uid')
    
    fieldsets = UserAdmin.fieldsets + (
        ('Additional Info', {
            'fields': ('supabase_uid', 'registration_method'),
        }),
    )

@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'subscription_active', 'subscription_expires', 'tables_limit')
    search_fields = ('user__email', 'user__username')