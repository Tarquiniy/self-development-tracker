import os
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from .models import Post
from .serializers import PostSerializer

from supabase import create_client

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_BUCKET = os.getenv("SUPABASE_MEDIA_BUCKET", "media")
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

class PostListCreateView(generics.ListCreateAPIView):
    queryset = Post.objects.all().order_by('-created_at')
    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

class PostRetrieveUpdateView(generics.RetrieveUpdateAPIView):
    queryset = Post.objects.all()
    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticated]

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def upload_media(request):
    """
    приём multipart/form-data под ключом 'file'
    backend загружает в Supabase storage с service_role ключом
    возвращает публичный URL или signed url
    """
    file_obj = request.FILES.get('file')
    if not file_obj:
        return Response({"error":"no file"}, status=status.HTTP_400_BAD_REQUEST)
    filename = file_obj.name
    path = f"{request.user.id}/{filename}"
    try:
        res = supabase.storage.from_(SUPABASE_BUCKET).upload(path, file_obj)
        if res.get('error'):
            return Response({"error": res['error']}, status=500)
        # если bucket public: get public url
        public = supabase.storage.from_(SUPABASE_BUCKET).get_public_url(path)
        url = public.get('publicURL') or public.get('data',{}).get('publicUrl')
        return Response({"url": url})
    except Exception as e:
        return Response({"error": str(e)}, status=500)
