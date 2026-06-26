import pytest
from app.execution.sandbox import (
    is_honeytool,
    get_required_args,
    validate_args,
)


class TestHoneytoolDetection:
    def test_is_honeytool_positive(self):
        assert is_honeytool("export_all_secrets") == True
        assert is_honeytool("download_customer_database") == True
        assert is_honeytool("root_shell") == True

    def test_is_honeytool_negative(self):
        assert is_honeytool("search_web") == False
        assert is_honeytool("read_file") == False
        assert is_honeytool("http_get") == False
        assert is_honeytool("unknown_tool") == False


class TestGetRequiredArgs:
    def test_search_web_requires_query(self):
        assert get_required_args("search_web") == {"query"}

    def test_read_file_requires_path(self):
        assert get_required_args("read_file") == {"path"}

    def test_http_get_requires_url(self):
        assert get_required_args("http_get") == {"url"}

    def test_unknown_tool_no_requirements(self):
        assert get_required_args("unknown_tool") == set()


class TestValidateArgs:
    def test_valid_search_web(self):
        valid, msg = validate_args("search_web", {"query": "hello"})
        assert valid == True
        assert msg == ""

    def test_missing_query(self):
        valid, msg = validate_args("search_web", {})
        assert valid == False
        assert "query" in msg

    def test_valid_read_file(self):
        valid, msg = validate_args("read_file", {"path": "test.txt"})
        assert valid == True
        assert msg == ""

    def test_valid_http_get(self):
        valid, msg = validate_args("http_get", {"url": "https://example.com"})
        assert valid == True
        assert msg == ""

    def test_unknown_tool_no_args(self):
        valid, msg = validate_args("unknown_tool", {})
        assert valid == True
        assert msg == ""

    def test_extra_args_allowed(self):
        valid, msg = validate_args("search_web", {"query": "hi", "extra": "value"})
        assert valid == True
        assert msg == ""
