from rest_framework.decorators import api_view
from rest_framework.response import Response

@api_view(['GET'])
def payment_test(request):
    return Response({"message": "Payments API is working"})