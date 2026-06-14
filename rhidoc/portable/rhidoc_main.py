#!/usr/bin/env python3
"""rhidoc — portable workspace tools. No pip required.

Edit freely — these are your scripts.

Usage: python3 rhidoc.py <command> [options]
"""
import sys
from pathlib import Path

# Add parent dir to path so _scripts/ is importable
sys.path.insert(0, str(Path(__file__).resolve().parent))

from _scripts.commands import main

if __name__ == "__main__":
    main()
