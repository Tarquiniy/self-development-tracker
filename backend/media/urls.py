from django.urls import path
from . import views

urlpatterns = [
    path("api/media/", views.MediaListView.as_view(), name="media-list"),
    path("api/media/upload/", views.MediaUploadView.as_view(), name="media-upload"),
    path("api/media/<uuid:pk>/", views.MediaDeleteView.as_view(), name="media-delete"),
]
