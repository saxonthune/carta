"""Unit tests for carta_cli._glyphs — glyph vocabulary and capability resolver."""
import types

import pytest

from carta_cli._glyphs import ASCII, UNICODE, for_stream, supports_unicode


def _stream(encoding):
    return types.SimpleNamespace(encoding=encoding)


def test_supports_unicode_utf8():
    assert supports_unicode(_stream("utf-8")) is True


def test_supports_unicode_cp1252():
    assert supports_unicode(_stream("cp1252")) is False


def test_supports_unicode_unknown_encoding():
    assert supports_unicode(_stream("not-a-real-codec")) is False


def test_supports_unicode_no_encoding():
    assert supports_unicode(_stream(None)) is False


def test_for_stream_selects_ascii():
    assert for_stream(_stream("cp1252")) is ASCII


def test_for_stream_selects_unicode():
    assert for_stream(_stream("utf-8")) is UNICODE


def test_ascii_set_is_pure_ascii():
    for field_name, value in ASCII.__dataclass_fields__.items():
        field_val = getattr(ASCII, field_name)
        field_val.encode("ascii")  # raises AssertionError if non-ASCII found


def test_no_emdash_anywhere():
    emdash = "—"
    for field_name in UNICODE.__dataclass_fields__:
        assert emdash not in getattr(UNICODE, field_name), \
            f"UNICODE.{field_name} contains an em-dash"
    for field_name in ASCII.__dataclass_fields__:
        assert emdash not in getattr(ASCII, field_name), \
            f"ASCII.{field_name} contains an em-dash"
