#!/usr/bin/env python3
"""Build carta.pyz — a portable zipapp bundling carta_cli + dependencies.

Usage:
    cd packages/cli
    python3 build_zipapp.py          # produces carta.pyz in this directory
"""

import shutil
import subprocess
import sys
import tempfile
import zipapp
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
PACKAGE_DIR = SCRIPT_DIR / "carta_cli"
OUTPUT = SCRIPT_DIR / "carta.pyz"

# Extensions/patterns to include from carta_cli/
INCLUDE_SUFFIXES = {".py", ".md"}


def _copy_package(dest: Path) -> None:
    """Copy carta_cli/ into dest, including .py and data files."""
    pkg_dest = dest / "carta_cli"
    pkg_dest.mkdir()

    for item in PACKAGE_DIR.rglob("*"):
        if item.name == "__pycache__" or "__pycache__" in item.parts:
            continue
        rel = item.relative_to(PACKAGE_DIR)
        target = pkg_dest / rel
        if item.is_dir():
            target.mkdir(parents=True, exist_ok=True)
        elif item.suffix in INCLUDE_SUFFIXES:
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(item, target)


def _vendor_dependencies(dest: Path) -> None:
    """pip-install click and pyyaml into dest."""
    subprocess.check_call(
        [sys.executable, "-m", "pip", "install", "click", "pyyaml",
         "--target", str(dest), "--quiet", "--no-deps"],
    )


def _write_main(dest: Path) -> None:
    """Write __main__.py entry point."""
    (dest / "__main__.py").write_text(
        "from carta_cli.main import cli\ncli()\n",
        encoding="utf-8",
    )


def build() -> Path:
    """Build carta.pyz and return its path."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        _copy_package(tmp)
        _vendor_dependencies(tmp)
        _write_main(tmp)

        zipapp.create_archive(
            source=tmp,
            target=str(OUTPUT),
            interpreter="/usr/bin/env python3",
            compressed=True,
        )

    print(f"Built {OUTPUT} ({OUTPUT.stat().st_size:,} bytes)")
    return OUTPUT


if __name__ == "__main__":
    build()
