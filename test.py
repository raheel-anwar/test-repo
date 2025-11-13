# app/middleware/audit_middleware.py
import time
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request
from jose import jwt, JWTError
from app.services.audit import log_audit
from app.core.config import settings  # contains SECRET_KEY and ALGORITHM

class AuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request.state.start_time = time.time()
        auth_header = request.headers.get("Authorization")
        user = None

        # Try to decode JWT
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[len("Bearer "):]
            try:
                payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
                user = {"id": payload.get("sub"), "email": payload.get("email")}
            except JWTError:
                # Invalid token: skip logging
                user = None

        # Only log if user is authenticated
        if user is None:
            return await call_next(request)

        response_body = None
        error = None

        try:
            response = await call_next(request)

            # Read response body
            raw_body = b"".join([chunk async for chunk in response.body_iterator])
            response_body = raw_body.decode(errors="ignore")
            response.body_iterator = iter([raw_body])

        except Exception as e:
            error = str(e)
            raise

        finally:
            await log_audit(
                user=user,
                request=request,
                response=response,
                request_body=(await request.json() if request.method in ("POST", "PUT", "PATCH") else None),
                response_body=response_body,
                error=error
            )

        return response
