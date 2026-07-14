#!/usr/bin/env bash
# ─── Task System Configuration — Rhidoc ──────────────────────────────────────
# Project-specific settings for the todo-task execution system.
# Sourced by execute-plan.sh and status.sh via lib.sh's source_task_config.

# Prefix for agent worktree directories (created alongside the repo root)
WORKTREE_PREFIX="agent"

# Command to install dependencies in a fresh worktree.
# Rhidoc is a pure-Python package; editable install wires the `rhidoc` CLI entry point.
INSTALL_CMD="pip install -e ."

# Build step — Rhidoc has no compile step. compileall validates syntax across
# every module without shell-quoting pitfalls (an earlier attempt using
# `python -c 'import …'` broke when the retry loop re-expanded the var).
BUILD_CMD="python3 -m compileall -q rhidoc"

# Run the test suite. Must exit 0 on success.
TEST_CMD="just test"

# Budget caps for headless Claude sessions (USD)
MAX_BUDGET="5.00"
RETRY_BUDGET="3.00"

# Maximum retry attempts when build/test fails
MAX_RETRIES=4
