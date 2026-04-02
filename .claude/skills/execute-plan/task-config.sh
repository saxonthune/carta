#!/usr/bin/env bash
# ─── Task System Configuration ───────────────────────────────────────────────
# Project-specific settings for the todo-task execution system.
# Sourced by execute-plan.sh and status.sh.
#
# To port the todo-task system to another project, copy the .claude/skills/
# directories (todo-task, execute-plan, feature-implementor) and edit this file.

# Prefix for agent worktree directories (created alongside the repo root)
WORKTREE_PREFIX="carta-agent"

# Command to install dependencies in a fresh worktree
INSTALL_CMD="pnpm install"

# Command to verify the implementation (must exit 0 on success)
BUILD_CMD="pnpm build"
TEST_CMD="pnpm test"

# Budget caps for headless Claude sessions (USD)
MAX_BUDGET="5.00"
RETRY_BUDGET="3.00"

# Maximum retry attempts when build/test fails
MAX_RETRIES=4
