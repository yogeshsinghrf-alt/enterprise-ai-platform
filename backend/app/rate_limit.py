import hashlib
import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request


_REQUEST_HISTORY: dict[str, deque[float]] = defaultdict(deque)
_LOCK = threading.Lock()


def _client_identity(request: Request) -> str:
    api_key = request.headers.get("X-API-Key")

    if api_key:
        return hashlib.sha256(
            api_key.encode("utf-8")
        ).hexdigest()

    if request.client:
        return request.client.host

    return "unknown"


def enforce_rate_limit(
    request: Request,
    bucket: str,
    limit: int,
    window_seconds: int,
) -> None:
    now = time.monotonic()

    identity = _client_identity(request)
    key = f"{bucket}:{identity}"

    with _LOCK:
        history = _REQUEST_HISTORY[key]

        cutoff = now - window_seconds

        while history and history[0] <= cutoff:
            history.popleft()

        if len(history) >= limit:
            retry_after = max(
                1,
                int(
                    window_seconds
                    - (now - history[0])
                ),
            )

            raise HTTPException(
                status_code=429,
                detail=(
                    "Rate limit exceeded. "
                    f"Retry after {retry_after} seconds."
                ),
                headers={
                    "Retry-After": str(retry_after),
                },
            )

        history.append(now)
