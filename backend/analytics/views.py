from rest_framework.decorators import api_view
from rest_framework.response import Response

@api_view(['GET'])
def analytics_test(request):
    return Response({"message": "Analytics API is working"})