import os
from django.conf import settings
from rest_framework import generics, status, permissions
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import MediaFile
from .serializers import MediaFileSerializer

# Ограничения:
MAX_UPLOAD_SIZE = int(os.environ.get("MEDIA_MAX_UPLOAD_SIZE", getattr(settings, "MEDIA_MAX_UPLOAD_SIZE", 5 * 1024 * 1024)))
ALLOWED_MIME_PREFIXES = ("image/",)

class MediaListView(generics.ListAPIView):
    queryset = MediaFile.objects.all()
    serializer_class = MediaFileSerializer
    permission_classes = [permissions.IsAuthenticated]  # подберите права под проект
    pagination_class = None  # при желании добавить пагинацию

class MediaUploadView(APIView):
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request, *args, **kwargs):
        """
        Принимает multipart/form-data с полем file
        """
        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            return Response({"detail": "file is required"}, status=status.HTTP_400_BAD_REQUEST)

        if uploaded_file.size > MAX_UPLOAD_SIZE:
            return Response({"detail": "File too large"}, status=status.HTTP_400_BAD_REQUEST)

        content_type = uploaded_file.content_type
        if not any(content_type.startswith(p) for p in ALLOWED_MIME_PREFIXES):
            return Response({"detail": "Unsupported file type"}, status=status.HTTP_400_BAD_REQUEST)

        raw = uploaded_file.read()
        try:
            obj = MediaFile.create_from_bytes(raw, uploaded_file.name, content_type, uploaded_by=request.user)
        except Exception as e:
            return Response({"detail": f"Upload failed: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        serializer = MediaFileSerializer(obj, context={"request": request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

class MediaDeleteView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def delete(self, request, pk, *args, **kwargs):
        try:
            obj = MediaFile.objects.get(pk=pk)
        except MediaFile.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        # при желании ограничить удаление только владельцем/админом
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
