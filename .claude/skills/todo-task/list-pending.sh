#!/usr/bin/env bash
set -uo pipefail

# Thin renderer over the reporter: list slugs of tasks that are pending
# (spec only, no run-record, no result). The reporter is the sole fs-walker.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

bash "${SCRIPT_DIR}/report.sh" task | awk -F'\t' '$3=="pending"{print $2}'
