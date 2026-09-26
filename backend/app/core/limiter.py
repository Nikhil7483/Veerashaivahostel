from slowapi import Limiter
from starlette.requests import Request
import os

def get_real_client_ip(request: Request) -> str:
    # 1. Cloudflare connecting IP
    cf_ip = request.headers.get("cf-connecting-ip")
    if cf_ip:
        return cf_ip.strip()
    # 2. X-Forwarded-For (client IP is first item)
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    # 3. X-Real-IP
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    # 4. Fallback to client host
    if request.client and request.client.host:
        return request.client.host
    return "127.0.0.1"

# Generous limits so all 64 hostel students and staff can work concurrently without being throttled
limiter = Limiter(
    key_func=get_real_client_ip,
    default_limits=["10000/minute"],
    enabled=True
)
