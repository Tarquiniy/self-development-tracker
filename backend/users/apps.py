from django.apps import AppConfig

class UsersConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'users'
    verbose_name = "Users"
    
    def ready(self):
        # Import signals here to avoid circular imports
        try:
            import users.signals
        except ImportError:
            pass