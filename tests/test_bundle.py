"""Tests for carta_cli/bundle.py — pure filesystem bundle resolver."""
import sys
from pathlib import Path

import pytest

_CLI_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_CLI_DIR))

from carta_cli.bundle import (
    Bundle,
    bundle_members,
    detect_orphans,
    find_bundle,
    list_bundles,
    slug_collision,
    slug_matched_attachments,
)
from carta_cli.errors import CartaError


# ---------------------------------------------------------------------------
# list_bundles
# ---------------------------------------------------------------------------

def test_list_bundles_empty(tmp_path):
    assert list_bundles(tmp_path) == []


def test_list_bundles_root_only(tmp_path):
    (tmp_path / "01-intro.md").touch()
    bundles = list_bundles(tmp_path)
    assert len(bundles) == 1
    b = bundles[0]
    assert b.prefix == 1
    assert b.root == tmp_path / "01-intro.md"
    assert b.attachments == []
    assert not b.is_orphan
    assert not b.is_directory_bundle
    assert b.slug == "intro"


def test_list_bundles_root_with_attachments(tmp_path):
    (tmp_path / "03-overview.md").touch()
    (tmp_path / "03-overview.png").touch()
    (tmp_path / "03-overview.json").touch()
    bundles = list_bundles(tmp_path)
    assert len(bundles) == 1
    b = bundles[0]
    assert b.prefix == 3
    assert b.root == tmp_path / "03-overview.md"
    assert b.attachments == [
        tmp_path / "03-overview.json",
        tmp_path / "03-overview.png",
    ]
    assert not b.is_orphan


def test_list_bundles_orphan_no_md(tmp_path):
    (tmp_path / "02-data.json").touch()
    (tmp_path / "02-data.csv").touch()
    bundles = list_bundles(tmp_path)
    assert len(bundles) == 1
    b = bundles[0]
    assert b.prefix == 2
    assert b.root is None
    assert b.is_orphan
    assert not b.is_directory_bundle
    assert b.slug is None
    assert b.attachments == [
        tmp_path / "02-data.csv",
        tmp_path / "02-data.json",
    ]


def test_list_bundles_directory_bundle_and_orphan(tmp_path):
    dir_entry = tmp_path / "01-foo"
    dir_entry.mkdir()
    (tmp_path / "01-foo.json").touch()

    bundles = list_bundles(tmp_path)
    assert len(bundles) == 2

    dir_bundle = next(b for b in bundles if b.is_directory_bundle)
    orphan_bundle = next(b for b in bundles if b.is_orphan)

    assert dir_bundle.prefix == 1
    assert dir_bundle.root is None
    assert dir_bundle.attachments == [dir_entry]
    assert not dir_bundle.is_orphan

    assert orphan_bundle.prefix == 1
    assert orphan_bundle.root is None
    assert orphan_bundle.attachments == [tmp_path / "01-foo.json"]
    assert orphan_bundle.is_orphan


def test_list_bundles_directory_bundle_alone(tmp_path):
    (tmp_path / "05-section").mkdir()
    bundles = list_bundles(tmp_path)
    assert len(bundles) == 1
    b = bundles[0]
    assert b.is_directory_bundle
    assert not b.is_orphan


def test_list_bundles_raises_on_duplicate_md(tmp_path):
    (tmp_path / "04-alpha.md").touch()
    (tmp_path / "04-beta.md").touch()
    with pytest.raises(CartaError, match="multiple root candidates"):
        list_bundles(tmp_path)


def test_list_bundles_non_numbered_ignored(tmp_path):
    (tmp_path / "README.md").touch()
    (tmp_path / "foo.json").touch()
    (tmp_path / "01-real.md").touch()
    bundles = list_bundles(tmp_path)
    assert len(bundles) == 1
    assert bundles[0].root == tmp_path / "01-real.md"


def test_list_bundles_sorted_by_prefix(tmp_path):
    (tmp_path / "03-third.md").touch()
    (tmp_path / "01-first.md").touch()
    (tmp_path / "02-second.md").touch()
    bundles = list_bundles(tmp_path)
    assert [b.prefix for b in bundles] == [1, 2, 3]


# ---------------------------------------------------------------------------
# find_bundle
# ---------------------------------------------------------------------------

def test_find_bundle_valid(tmp_path):
    md = tmp_path / "02-guide.md"
    md.touch()
    (tmp_path / "02-guide.png").touch()

    b = find_bundle(md)
    assert b is not None
    assert b.root == md
    assert b.attachments == [tmp_path / "02-guide.png"]


def test_find_bundle_non_numbered(tmp_path):
    md = tmp_path / "README.md"
    md.touch()
    assert find_bundle(md) is None


def test_find_bundle_non_md_numbered(tmp_path):
    f = tmp_path / "01-data.json"
    f.touch()
    assert find_bundle(f) is None


def test_find_bundle_returns_none_for_attachment(tmp_path):
    (tmp_path / "01-guide.md").touch()
    att = tmp_path / "01-guide.png"
    att.touch()
    # Attachment is not a .md with numeric prefix matching a root
    assert find_bundle(att) is None


# ---------------------------------------------------------------------------
# bundle_members
# ---------------------------------------------------------------------------

def test_bundle_members_order(tmp_path):
    md = tmp_path / "05-notes.md"
    md.touch()
    (tmp_path / "05-notes.zip").touch()
    (tmp_path / "05-notes.csv").touch()

    members = bundle_members(md)
    assert members[0] == md
    assert members[1:] == [
        tmp_path / "05-notes.csv",
        tmp_path / "05-notes.zip",
    ]


def test_bundle_members_no_attachments(tmp_path):
    md = tmp_path / "01-solo.md"
    md.touch()
    assert bundle_members(md) == [md]


def test_bundle_members_non_numbered(tmp_path):
    md = tmp_path / "README.md"
    md.touch()
    # Returns [md_path] since find_bundle returns None
    assert bundle_members(md) == [md]


# ---------------------------------------------------------------------------
# slug_matched_attachments
# ---------------------------------------------------------------------------

def test_slug_matched_attachments_selects_correct(tmp_path):
    md = tmp_path / "03-report.md"
    md.touch()
    match1 = tmp_path / "03-report.png"
    match2 = tmp_path / "03-report.csv"
    non_match = tmp_path / "03-other.png"
    for f in (match1, match2, non_match):
        f.touch()

    bundles = list_bundles(tmp_path)
    assert len(bundles) == 1
    b = bundles[0]
    matched = slug_matched_attachments(b, "report")
    assert set(matched) == {match1, match2}
    assert non_match not in matched


def test_slug_matched_attachments_empty(tmp_path):
    md = tmp_path / "01-intro.md"
    md.touch()
    b = list_bundles(tmp_path)[0]
    assert slug_matched_attachments(b, "intro") == []


def test_slug_matched_attachments_prefix_not_confused(tmp_path):
    # 03-report-extra.png starts with "03-report" but slug is "report", so "03-report."
    # must match exactly — "03-report-extra.png" starts with "03-report-" not "03-report."
    md = tmp_path / "03-report.md"
    md.touch()
    (tmp_path / "03-report.png").touch()
    (tmp_path / "03-report-extra.png").touch()

    b = list_bundles(tmp_path)[0]
    matched = slug_matched_attachments(b, "report")
    assert matched == [tmp_path / "03-report.png"]


# ---------------------------------------------------------------------------
# detect_orphans
# ---------------------------------------------------------------------------

def test_detect_orphans_none(tmp_path):
    (tmp_path / "01-intro.md").touch()
    assert detect_orphans(tmp_path) == []


def test_detect_orphans_finds_orphan(tmp_path):
    (tmp_path / "01-intro.md").touch()
    (tmp_path / "02-data.json").touch()

    orphans = detect_orphans(tmp_path)
    assert len(orphans) == 1
    assert orphans[0].prefix == 2
    assert orphans[0].is_orphan


def test_detect_orphans_excludes_directory_bundles(tmp_path):
    (tmp_path / "01-section").mkdir()
    orphans = detect_orphans(tmp_path)
    assert orphans == []


def test_detect_orphans_mixed(tmp_path):
    (tmp_path / "01-intro.md").touch()       # normal bundle
    (tmp_path / "02-section").mkdir()         # directory bundle
    (tmp_path / "03-lost.json").touch()       # orphan

    orphans = detect_orphans(tmp_path)
    assert len(orphans) == 1
    assert orphans[0].prefix == 3


# ---------------------------------------------------------------------------
# slug_collision
# ---------------------------------------------------------------------------

def test_slug_collision_no_attachments(tmp_path):
    md = tmp_path / "01-intro.md"
    md.touch()
    b = list_bundles(tmp_path)[0]
    assert slug_collision(b, "intro") is None


def test_slug_collision_no_match(tmp_path):
    (tmp_path / "02-guide.md").touch()
    (tmp_path / "02-guide.png").touch()
    b = list_bundles(tmp_path)[0]
    assert slug_collision(b, "diagram") is None


def test_slug_collision_different_extension(tmp_path):
    (tmp_path / "03-report.md").touch()
    png = tmp_path / "03-report.png"
    png.touch()
    b = list_bundles(tmp_path)[0]
    result = slug_collision(b, "report")
    assert result == png


def test_slug_collision_returns_first_match(tmp_path):
    (tmp_path / "04-notes.md").touch()
    csv = tmp_path / "04-notes.csv"
    json_ = tmp_path / "04-notes.json"
    csv.touch()
    json_.touch()
    b = list_bundles(tmp_path)[0]
    result = slug_collision(b, "notes")
    # Returns first alphabetically (sorted in bundle.attachments)
    assert result in (csv, json_)


def test_slug_collision_ignores_different_slug(tmp_path):
    (tmp_path / "05-overview.md").touch()
    (tmp_path / "05-overview.png").touch()
    b = list_bundles(tmp_path)[0]
    assert slug_collision(b, "overview-extra") is None
