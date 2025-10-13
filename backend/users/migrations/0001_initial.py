from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):
    """
    Initial migration for the users app.
    This migration creates the CustomUser and UserProfile models as
    Django migrations' initial node. If your database already contains
    the corresponding tables (from a previous manual setup), mark this
    migration as applied with --fake (instructions below).
    """

    initial = True

    dependencies = [
        # no external dependency required; auth/contenttypes handled separately
    ]

    operations = [
        migrations.CreateModel(
            name='CustomUser',
            fields=[
                ('id', models.BigAutoField(primary_key=True, serialize=False)),
                ('password', models.CharField(max_length=128)),
                ('last_login', models.DateTimeField(blank=True, null=True)),
                ('is_superuser', models.BooleanField(default=False)),
                ('username', models.CharField(unique=True, max_length=150)),
                ('first_name', models.CharField(max_length=150)),
                ('last_name', models.CharField(max_length=150)),
                ('is_staff', models.BooleanField(default=False)),
                ('is_active', models.BooleanField(default=True)),
                ('date_joined', models.DateTimeField(default=django.utils.timezone.now)),
                ('email', models.EmailField(unique=True, max_length=254)),
                # Note: we do NOT add supabase_uid here — that's added in 0002
            ],
            options={
                'db_table': 'users_customuser',
                'verbose_name': 'Custom User',
                'verbose_name_plural': 'Custom Users',
            },
        ),
        migrations.CreateModel(
            name='UserProfile',
            fields=[
                ('id', models.BigAutoField(primary_key=True, serialize=False)),
                ('subscription_active', models.BooleanField(default=False)),
                ('subscription_expires', models.DateTimeField(null=True, blank=True)),
                ('tables_limit', models.IntegerField(default=1)),
                ('user', models.OneToOneField(
                    to='users.CustomUser',
                    on_delete=models.CASCADE,
                    related_name='profile'
                )),
            ],
            options={
                'db_table': 'users_userprofile',
                'verbose_name': 'User Profile',
                'verbose_name_plural': 'User Profiles',
            },
        ),
    ]
