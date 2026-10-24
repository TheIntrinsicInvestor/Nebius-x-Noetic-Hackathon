"""Caps on the endpoints that spend money (open model and Tavily calls) when the app is hosted. Off unless
RATE_LIMIT_HOURLY is set, so local runs and tests are unaffected. Counters are kept in a file in the state folder,
so a restart (or the host putting the app to sleep) does not reset them."""
import json
import os
import threading
import time
from pathlib import Path

from fastapi import HTTPException, Request

HOUR, DAY = 3600, 86400
_lock = threading.Lock()


def visitor(request: Request) -> str:
    # Railway's proxy passes the caller's address in X-Real-IP
    return request.headers.get("x-real-ip") or (request.client.host if request.client else "unknown")


def rate_limit(request: Request, path: Path) -> None:
    """Record one paid call for this visitor, or raise 429 if a cap is reached."""
    hourly = int(os.environ.get("RATE_LIMIT_HOURLY", 0))
    if not hourly:
        return
    daily = int(os.environ.get("RATE_LIMIT_DAILY", 0))
    ip, now = visitor(request), time.time()
    with _lock:
        hits = json.loads(path.read_text(encoding="utf-8")) if path.exists() else []
        hits = [h for h in hits if now - h[0] < DAY]
        if daily and len(hits) >= daily:
            raise HTTPException(429, "This demo has reached its daily limit of model calls. Try again tomorrow.")
        if sum(1 for t, who in hits if who == ip and now - t < HOUR) >= hourly:
            raise HTTPException(429, f"You have reached this demo's limit of {hourly} model calls an hour. "
                                     "Try again later.")
        hits.append([now, ip])
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(hits), encoding="utf-8")
