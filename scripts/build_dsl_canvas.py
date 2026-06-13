#!/usr/bin/env python3
"""Build the carta-dsl Luminous canvas from the action-catalog YAML sidecars.

Reads every NN-<cmd>.yaml under .carta/.../05-actions/ and emits a per-command
tree: a `carta` root -> one node per command -> one node per argument the
command takes. Argument nodes are private to each command (per-command tree
model), so re-running is a deterministic, diffable update.

Run:  python3 scripts/build_dsl_canvas.py
Out:  .luminous/generated/carta-dsl.graph.json   (pack: carta-dsl.pack.json, hand-authored)
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import yaml

REPO = Path(__file__).resolve().parent.parent
ACTIONS_DIR = REPO / ".carta" / "03-product-design" / "01-workspace-scripts" / "05-actions"
OUT = REPO / ".luminous" / "generated" / "carta-dsl.graph.json"
PACK = "carta-dsl"


def load_sidecars() -> list[dict]:
    """Parse every action sidecar, skipping the index. Sorted by filename."""
    cards = []
    for path in sorted(ACTIONS_DIR.glob("*.yaml")):
        data = yaml.safe_load(path.read_text())
        if data and data.get("id") and data.get("inputs"):
            cards.append(data)
    return cards


def classify_arg(name: str, cli: str) -> tuple[bool, str | None]:
    """Return (is_flag, flag_spelling). An input is a flag if its dashed form
    appears as --x in the cli signature; otherwise it is positional."""
    dashed = "--" + name.replace("_", "-")
    if dashed in cli:
        return True, dashed
    return False, None


def command_node(card: dict) -> dict:
    return {
        "id": f"cmd.{card['id']}",
        "kind": "carta.command",
        "props": {
            "name": card["id"],
            "summary": card.get("summary", ""),
            "cli": card.get("cli", ""),
        },
        "tags": [],
    }


def arg_nodes_and_edges(card: dict) -> tuple[list[dict], list[dict]]:
    cli = card.get("cli", "")
    cmd = card["id"]
    nodes, edges = [], []
    for name, spec in card["inputs"].items():
        spec = spec or {}
        is_flag, flag = classify_arg(name, cli)
        required = bool(spec.get("required", False))
        node_id = f"arg.{cmd}.{name}"
        props = {
            "name": name,
            "type": spec.get("type", "") or "",
            "required": required,
            "form": "flag" if is_flag else "positional",
        }
        if flag:
            props["flag"] = flag
        if "description" in spec and spec["description"]:
            props["description"] = spec["description"]
        if "default" in spec and spec["default"] is not None:
            props["default"] = str(spec["default"])
        nodes.append({"id": node_id, "kind": "carta.arg", "props": props, "tags": []})
        edges.append({
            "id": f"edge.takes.cmd.{cmd}.{node_id}",
            "kind": "carta.takes",
            "from": f"cmd.{cmd}",
            "to": node_id,
            "props": {},
            "tags": [],
        })
    return nodes, edges


def build() -> dict:
    cards = load_sidecars()
    nodes = [{"id": "carta", "kind": "carta.root", "props": {"name": "carta"}, "tags": []}]
    edges = []
    for card in cards:
        nodes.append(command_node(card))
        edges.append({
            "id": f"edge.has-command.carta.cmd.{card['id']}",
            "kind": "carta.has-command",
            "from": "carta",
            "to": f"cmd.{card['id']}",
            "props": {},
            "tags": [],
        })
        anodes, aedges = arg_nodes_and_edges(card)
        nodes.extend(anodes)
        edges.extend(aedges)

    nodes.sort(key=lambda n: n["id"])
    edges.sort(key=lambda e: e["id"])
    return {
        "version": 3,
        "pack": PACK,
        "nodes": nodes,
        "edges": edges,
        "defaultView": "command-tree",
    }


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    graph = build()
    OUT.write_text(json.dumps(graph, indent=2) + "\n")
    print(f"wrote {OUT.relative_to(REPO)}: {len(graph['nodes'])} nodes, {len(graph['edges'])} edges")


if __name__ == "__main__":
    main()
