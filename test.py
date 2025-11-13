import time
from fastapi import FastAPI, Request
from sqlalchemy.orm import Session
from models import AuditLog
from database import SessionLocal

app = FastAPI()

@app.middleware("http")
async def audit_log_middleware(request: Request, call_next):
    # Only log mutating requests
    if request.method not in ("POST", "PUT", "PATCH", "DELETE"):
        return await call_next(request)

    start_time = time.time()
    response_body = None
    error = None

    try:
        # Read and clone request body (needed since body can be read only once)
        request_body = None
        if request.method in ("POST", "PUT", "PATCH"):
            try:
                request_body = await request.json()
            except Exception:
                request_body = None  # not JSON or empty

        response = await call_next(request)

        # Capture response body (stream it out, then restore it)
        raw_body = b"".join([chunk async for chunk in response.body_iterator])
        response_body = raw_body.decode(errors="ignore")
        response.body_iterator = iter([raw_body])  # restore body for client

    except Exception as e:
        error = str(e)
        raise
    finally:
        duration_ms = int((time.time() - start_time) * 1000)
        try:
            db: Session = SessionLocal()
            log_entry = AuditLog(
                user_id=request.headers.get("X-User-ID"),  # depends on your auth scheme
                method=request.method,
                path=request.url.path,
                status_code=response.status_code if "response" in locals() else 500,
                client_ip=request.client.host if request.client else None,
                request_headers=dict(request.headers),
                request_body=request_body,
                response_body=response_body,
                duration_ms=duration_ms,
                error=error,
            )
            db.add(log_entry)
            db.commit()
        except Exception as e:
            print("Failed to write audit log:", e)
        finally:
            db.close()

    return response

from typing import Mapping, Dict

SENSITIVE_HEADERS = {"authorization", "cookie", "x-api-key", "set-cookie"}

def sanitize_headers(headers: Mapping[str, str]) -> Dict[str, str]:
    """
    Returns a sanitized copy of HTTP headers for logging purposes.
    Sensitive headers like Authorization or Cookie are removed.
    """
    sanitized = {}
    for key, value in headers.items():
        if key.lower() in SENSITIVE_HEADERS:
            sanitized[key] = "***"  # mask sensitive value
        else:
            sanitized[key] = value
    return sanitized
