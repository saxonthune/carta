#!/usr/bin/env bash
# ─── Task System Configuration ───────────────────────────────────────────────
# Project-specific settings for the todo-task execution system.
# Sourced by execute-plan.sh and status.sh.
#
# Copy this file to your project:
#   .todo-tasks/task-config.sh
# Then edit the values below to match your project.

# Prefix for agent worktree directories (created alongside the repo root)
WORKTREE_PREFIX="agent"

# Command to install dependencies in a fresh worktree
INSTALL_CMD="npm install"

# Command to verify the implementation (must exit 0 on success)
BUILD_CMD="npm run build"
TEST_CMD="npm test"

# Budget caps for headless Claude sessions (USD)
MAX_BUDGET="5.00"
RETRY_BUDGET="3.00"

# Maximum retry attempts when build/test fails
MAX_RETRIES=4
