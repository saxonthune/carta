#!/usr/bin/env bash
#
# Create a demo workspace in .demo/ for manual testing of product design canvases.
# Run from the repo root: bash scripts/create-demo-workspace.sh
#
# Flags:
#   --force   Remove existing .demo/ and recreate from scratch
#
set -euo pipefail

DEMO_DIR="$(cd "$(dirname "$0")/.." && pwd)/.demo"
FORCE=false

for arg in "$@"; do
  case "$arg" in
    --force) FORCE=true ;;
    *) echo "Unknown flag: $arg"; echo "Usage: $0 [--force]"; exit 1 ;;
  esac
done

if [ -d "$DEMO_DIR" ]; then
  if [ "$FORCE" = true ]; then
    echo "Removing existing .demo/ (--force) ..."
    rm -rf "$DEMO_DIR"
  else
    echo "Error: .demo/ already exists. Use --force to delete and recreate."
    exit 1
  fi
fi

mkdir -p "$DEMO_DIR"
echo "Creating demo workspace in $DEMO_DIR"

# Initialize .carta/ workspace
cd "$DEMO_DIR"
carta init --name "Demo Workspace"

# --- Source docs with carta code blocks ---

mkdir -p specs

cat > specs/employee-types.md << 'MARKDOWN'
# Employee Types

Enumerations for classifying employees in the HR domain.

```carta
name: Employment Type
type: enumeration
---
kind: nominal
values:
  - key: full-time
  - key: part-time
  - key: contractor
    remark: External workers on fixed-term agreements
  - key: seasonal
    remark: Hired for peak periods only
```

```carta
name: Department
type: enumeration
---
kind: nominal
values:
  - key: engineering
  - key: sales
  - key: marketing
  - key: operations
  - key: hr
    remark: Human Resources
```
MARKDOWN

cat > specs/priorities.md << 'MARKDOWN'
# Priority Levels

Ordinal enumeration for task prioritization.

```carta
name: Priority
type: enumeration
---
kind: ordinal
values:
  - key: low
    remark: Triaged but not urgent
  - key: medium
  - key: high
    remark: Needs attention this sprint
  - key: critical
    remark: Drop everything
```
MARKDOWN

cat > specs/order-status.md << 'MARKDOWN'
# Order Status

Tracks the lifecycle of a customer order.

```carta
name: Order Status
type: enumeration
---
kind: ordinal
values:
  - key: draft
    remark: Not yet submitted
  - key: pending
    remark: Awaiting payment
  - key: confirmed
  - key: shipped
  - key: delivered
  - key: cancelled
    remark: Cancelled by customer or system
```
MARKDOWN

# --- Design canvases ---

cat > specs/hr-domain.carta-canvas.json << 'JSON'
{
  "type": "carta-canvas",
  "version": 1,
  "sources": [
    "employee-types.md",
    "priorities.md"
  ],
  "layout": [
    { "filename": "employee-types.md", "x": 100, "y": 100 },
    { "filename": "priorities.md", "x": 600, "y": 100 }
  ]
}
JSON

cat > specs/order-domain.carta-canvas.json << 'JSON'
{
  "type": "carta-canvas",
  "version": 1,
  "sources": [
    "order-status.md",
    "priorities.md"
  ],
  "layout": [
    { "filename": "order-status.md", "x": 100, "y": 100 },
    { "filename": "priorities.md", "x": 600, "y": 100 }
  ]
}
JSON

echo ""
echo "Demo workspace created at $DEMO_DIR"
echo ""
echo "Contents:"
find "$DEMO_DIR" -type f | sort | sed "s|$DEMO_DIR/|  |"
echo "== Dev mode (hot reload) =="
echo "  Best for iterating on the web client. Changes to React components"
echo "  appear instantly without rebuilding. Uses Vite dev server via iframe."
echo ""
echo "  1. Set carta.devMode: true in VS Code settings"
echo "  2. Run: pnpm demo          (starts Vite dev server on :5173)"
echo "  3. Press F5 in VS Code      (launches Extension Development Host)"
echo "  4. Open .demo/ folder in the new VS Code window"
echo "  5. Open specs/hr-domain.carta-canvas.json"
echo ""
echo "== Bundled mode (mimics production) =="
echo "  Tests the real build: extension bundles the web client and serves"
echo "  it directly in the WebView. No Vite, no iframe. Use this to verify"
echo "  the full pipeline before shipping."
echo ""
echo "  1. Run: pnpm vscode         (builds web-client + extension)"
echo "  2. Press F5 in VS Code      (launches Extension Development Host)"
echo "  3. Open .demo/ folder in the new VS Code window"
echo "  4. Open specs/hr-domain.carta-canvas.json"
