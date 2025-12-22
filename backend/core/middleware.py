# backend/core/middleware.py
import logging
import traceback
from django.http import JsonResponse
from django.utils.deprecation import MiddlewareMixin

logger = logging.getLogger(__name__)

class AdminExceptionDebugMiddleware(MiddlewareMixin):
    """
    Temporary middleware to catch exceptions, log full traceback and return
    detailed JSON for admin post operations when the requester is staff.

    INSTALLATION (temporary):
      - add 'core.middleware.AdminExceptionDebugMiddleware' to MIDDLEWARE near the top.
      - restart the server, reproduce the failing admin POST (create/update/delete).
      - inspect Network response (JSON) and server logs; paste the traceback here.
      - remove this middleware when debugging is done.
    """

    def process_exception(self, request, exception):
        try:
            tb = traceback.format_exc()
            logger.error("Unhandled exception (AdminExceptionDebugMiddleware): %s\n%s", exception, tb)
        except Exception:
            tb = "traceback unavailable"

        # If this is an admin post (or admin path) and a staff user, return JSON with error details
        try:
            path = (request.path or "").lower()
            is_admin_post = request.method == "POST" and (path.startswith("/admin/") or "/admin/blog/post" in path)
            user_is_staff = getattr(getattr(request, "user", None), "is_staff", False)
        except Exception:
            is_admin_post = False
            user_is_staff = False

        if is_admin_post and user_is_staff:
            # return JSON with limited info; show traceback to staff only
            payload = {
                "success": False,
                "error": str(exception),
                "traceback": tb,
                "path": request.path,
                "method": request.method,
            }
            return JsonResponse(payload, status=500)

        # for non-admin or non-staff requests, do not alter default behavior — let normal error handler show 500
        return None
