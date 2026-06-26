import time
from collections import defaultdict
from fastapi import Request, HTTPException
from app.config.settings import settings


class RateLimiter:
    def __init__(self):
        self.requests: dict[str, list[float]] = defaultdict(list)

    async def check(self, request: Request):
        client_ip = request.client.host if request.client else "unknown"
        now = time.time()
        window = 60.0
        self.requests[client_ip] = [t for t in self.requests[client_ip] if now - t < window]
        if len(self.requests[client_ip]) >= settings.RATE_LIMIT_PER_MINUTE:
            raise HTTPException(status_code=429, detail="Rate limit exceeded")
        self.requests[client_ip].append(now)


rate_limiter = RateLimiter()
