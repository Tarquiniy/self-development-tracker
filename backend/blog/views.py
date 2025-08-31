from rest_framework.decorators import api_view
from rest_framework.response import Response

@api_view(['GET'])
def blog_test(request):
    return Response({"message": "Blog API is working"})