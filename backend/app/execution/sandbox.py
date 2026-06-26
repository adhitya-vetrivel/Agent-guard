import time
import ipaddress
import socket
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx

from app.execution.types import ToolExecutionResult


HONEYTOOLS = frozenset({
    "export_all_secrets",
    "download_customer_database",
    "root_shell",
})

ALLOWED_HTTP_DOMAINS = [
    "example.com",
    "httpbin.org",
    "jsonplaceholder.typicode.com",
    "api.github.com",
    "wikipedia.org",
    "en.wikipedia.org",
    "news.ycombinator.com",
    "httpbin.org",
    "postman-echo.com",
]

SANDBOX_BASE = Path("sandbox").resolve()


def is_honeytool(tool_name: str) -> bool:
    return tool_name in HONEYTOOLS


def get_required_args(tool_name: str) -> set[str]:
    mapping = {
        "search_web": {"query"},
        "read_file": {"path"},
        "http_get": {"url"},
    }
    return mapping.get(tool_name, set())


def validate_args(tool_name: str, tool_args: dict[str, Any]) -> tuple[bool, str]:
    required = get_required_args(tool_name)
    missing = required - set(tool_args.keys())
    if missing:
        return False, f"Missing required arguments: {', '.join(missing)}"
    return True, ""


def _is_private_host(hostname: str) -> bool:
    try:
        ip = ipaddress.ip_address(hostname)
        return ip.is_private or ip.is_loopback or ip.is_link_local
    except ValueError:
        pass
    try:
        addrs = socket.getaddrinfo(hostname, 80)
        for addr in addrs:
            ip = ipaddress.ip_address(addr[4][0])
            if ip.is_private or ip.is_loopback or ip.is_link_local:
                return True
    except Exception:
        pass
    return False


async def execute_search_web(query: str) -> ToolExecutionResult:
    start = time.time()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://api.duckduckgo.com/",
                params={"q": query, "format": "json", "no_html": 1, "skip_disambig": 1},
            )
            data = resp.json()
            results = []
            for topic in data.get("RelatedTopics", []):
                if "Text" in topic:
                    results.append({
                        "title": topic.get("Text", ""),
                        "url": topic.get("FirstURL", ""),
                    })
                elif "Topics" in topic:
                    for sub in topic["Topics"]:
                        results.append({
                            "title": sub.get("Text", ""),
                            "url": sub.get("FirstURL", ""),
                        })
            abstract = data.get("Abstract", "")
            if abstract:
                results.insert(0, {
                    "title": data.get("AbstractSource", ""),
                    "url": data.get("AbstractURL", ""),
                    "abstract": abstract,
                })
            elapsed = (time.time() - start) * 1000
            return ToolExecutionResult(
                success=True,
                output={"query": query, "results": results[:10], "total": len(results)},
                execution_time_ms=round(elapsed, 2),
            )
    except Exception as e:
        elapsed = (time.time() - start) * 1000
        return ToolExecutionResult(
            success=True,
            output={
                "query": query,
                "results": [
                    {
                        "title": f"Mock result for '{query}'",
                        "url": f"https://example.com/search?q={query}",
                        "snippet": f"This is a simulated search result for: {query}",
                    }
                ],
                "total": 1,
                "_source": "mock",
            },
            execution_time_ms=round(elapsed, 2),
        )


async def execute_read_file(path: str) -> ToolExecutionResult:
    start = time.time()
    path = path.strip().replace("\\", "/")

    if path.startswith("/") or (len(path) > 1 and path[1] == ":"):
        return ToolExecutionResult(
            success=False,
            error="Absolute paths are not allowed. Use paths relative to sandbox/",
            execution_time_ms=round((time.time() - start) * 1000, 2),
        )

    if not path.startswith("sandbox/"):
        return ToolExecutionResult(
            success=False,
            error="Access denied: can only read files from the sandbox/ directory",
            execution_time_ms=round((time.time() - start) * 1000, 2),
        )

    resolved = (SANDBOX_BASE.parent / path).resolve()
    sandbox_abs = SANDBOX_BASE.resolve()

    try:
        resolved.relative_to(sandbox_abs)
    except ValueError:
        return ToolExecutionResult(
            success=False,
            error="Path traversal detected: access denied",
            execution_time_ms=round((time.time() - start) * 1000, 2),
        )

    if not resolved.exists():
        return ToolExecutionResult(
            success=False,
            error=f"File not found: {path}",
            execution_time_ms=round((time.time() - start) * 1000, 2),
        )

    if not resolved.is_file():
        return ToolExecutionResult(
            success=False,
            error=f"Not a file: {path}",
            execution_time_ms=round((time.time() - start) * 1000, 2),
        )

    try:
        content = resolved.read_text(encoding="utf-8")
        elapsed = (time.time() - start) * 1000
        return ToolExecutionResult(
            success=True,
            output={"path": path, "content": content, "size_bytes": len(content)},
            execution_time_ms=round(elapsed, 2),
        )
    except Exception as e:
        elapsed = (time.time() - start) * 1000
        return ToolExecutionResult(
            success=False,
            error=f"Failed to read file: {str(e)}",
            execution_time_ms=round(elapsed, 2),
        )


async def execute_http_get(url: str) -> ToolExecutionResult:
    start = time.time()

    parsed = urlparse(url)
    if not parsed.netloc:
        return ToolExecutionResult(
            success=False,
            error=f"Invalid URL: {url}",
            execution_time_ms=round((time.time() - start) * 1000, 2),
        )

    hostname = parsed.hostname or parsed.netloc

    if hostname in ("localhost", "127.0.0.1", "::1", "0.0.0.0"):
        return ToolExecutionResult(
            success=False,
            error="Access denied: localhost is not allowed",
            execution_time_ms=round((time.time() - start) * 1000, 2),
        )

    if _is_private_host(hostname):
        return ToolExecutionResult(
            success=False,
            error="Access denied: private/internal IP addresses are not allowed",
            execution_time_ms=round((time.time() - start) * 1000, 2),
        )

    domain = hostname.lower()
    allowed = any(
        domain == d.lower() or domain.endswith("." + d.lower())
        for d in ALLOWED_HTTP_DOMAINS
    )
    if not allowed:
        return ToolExecutionResult(
            success=False,
            error=f"Access denied: domain '{hostname}' is not in the allowed list",
            execution_time_ms=round((time.time() - start) * 1000, 2),
        )

    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(url, headers={"User-Agent": "AgentGuard/1.0"})
            content_type = resp.headers.get("content-type", "")
            is_text = (
                "text/" in content_type
                or "application/json" in content_type
                or "application/xml" in content_type
            )
            body = resp.text if is_text else f"<binary content> ({len(resp.content)} bytes)"
            elapsed = (time.time() - start) * 1000
            return ToolExecutionResult(
                success=True,
                output={
                    "url": url,
                    "status_code": resp.status_code,
                    "headers": dict(resp.headers),
                    "body": body[:10000],
                },
                execution_time_ms=round(elapsed, 2),
            )
    except Exception as e:
        elapsed = (time.time() - start) * 1000
        return ToolExecutionResult(
            success=False,
            error=f"HTTP request failed: {str(e)}",
            execution_time_ms=round(elapsed, 2),
        )


TOOL_EXECUTORS = {
    "search_web": execute_search_web,
    "read_file": execute_read_file,
    "http_get": execute_http_get,
}
