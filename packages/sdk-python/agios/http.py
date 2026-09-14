"""AGI-OS Python SDK — HTTP Client with retry"""

import time
import json
from typing import Any, Optional
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError


class AGIOSError(Exception):
    def __init__(self, message: str, status_code: int, error_type: str = "api_error"):
        super().__init__(message)
        self.status_code = status_code
        self.error_type = error_type


class HTTPClient:
    def __init__(self, base_url: str, api_key: Optional[str] = None,
                 timeout: int = 30, retries: int = 3):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout
        self.retries = retries

    def request(self, method: str, path: str, body: Optional[dict] = None) -> Any:
        url = f"{self.base_url}{path}"
        headers = {"Content-Type": "application/json"}

        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        data = json.dumps(body).encode() if body else None
        last_error = None

        for attempt in range(self.retries + 1):
            try:
                req = Request(url, data=data, headers=headers, method=method)
                with urlopen(req, timeout=self.timeout) as resp:
                    response_data = json.loads(resp.read().decode())
                    return response_data.get("data", response_data)

            except HTTPError as e:
                error_body = {}
                try:
                    error_body = json.loads(e.read().decode())
                except Exception:
                    pass

                if e.code == 429 or e.code >= 500:
                    if attempt < self.retries:
                        delay = min(1.0 * (2 ** attempt), 10.0)
                        time.sleep(delay)
                        continue

                error_msg = error_body.get("error", {}).get("message", f"HTTP {e.code}")
                raise AGIOSError(error_msg, e.code)

            except URLError as e:
                last_error = e
                if attempt < self.retries:
                    delay = min(1.0 * (2 ** attempt), 10.0)
                    time.sleep(delay)
                    continue

        raise AGIOSError(f"Request failed: {last_error}", 0)

    def get(self, path: str) -> Any:
        return self.request("GET", path)

    def post(self, path: str, body: Optional[dict] = None) -> Any:
        return self.request("POST", path, body)
