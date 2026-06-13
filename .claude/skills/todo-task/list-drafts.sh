#!/usr/bin/env bash
set -uo pipefail

# Thin renderer over the reporter: list slugs of untriaged drafts (filed in the
# gitignored inbox, not yet promoted to a spec). These are what `triage` acts on.
# The reporter is the sole fs-walker.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

bash "${SCRIPT_DIR}/report.sh" task | awk -F'\t' '$3=="draft"{print $2}'
