#!/usr/bin/env python3
"""Build the carta-dsl Luminous canvas by introspecting the carta argument parser.

The parser (carta_cli.commands._parser.build_parser) is the single source of truth for
the CLI surface — it is the code that actually runs — so the canvas can never drift from
the real commands the way a hand-maintained spec mirror does.

Emits a per-command tree: a `carta` root -> one node per subcommand -> one node per
argument the subcommand takes. Argument nodes are private to each command (per-command
tree model), so re-running is a deterministic, diffable update.

Run:  python3 scripts/build_dsl_canvas.py
Out:  .luminous/generated/carta-dsl.graph.json   (pack: carta-dsl.pack.json, hand-authored)
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO))

from carta_cli.commands._parser import build_parser  # noqa: E402

OUT = REPO / ".luminous" / "generated" / "carta-dsl.graph.json"
PACK = "carta-dsl"


def _subparsers_action(parser: argparse.ArgumentParser) -> argparse._SubParsersAction:
    for action in parser._actions:
        if isinstance(action, argparse._SubParsersAction):
            return action
    raise SystemExit("no subparsers found on the carta parser")


def _clean_usage(subparser: argparse.ArgumentParser) -> str:
    """Normalize a subparser's usage string into a one-line `carta <cmd> ...` signature."""
    usage = re.sub(r"\s+", " ", subparser.format_usage()).strip()
    if usage.lower().startswith("usage:"):
        usage = usage[len("usage:"):].strip()
    # Drop the implicit -h/--help flag — it's noise on every command.
    usage = usage.replace("[-h] ", "").replace(" [-h]", "").replace("[-h]", "").strip()
    return usage


def _arg_type(action: argparse.Action) -> str:
    if isinstance(action, (argparse._StoreTrueAction, argparse._StoreFalseAction)):
        return "bool"
    t = action.type
    if t is None:
        return "str"
    return getattr(t, "__name__", str(t))


def _is_required(action: argparse.Action) -> bool:
    if action.option_strings:  # optional / flag
        return bool(action.required)
    # positional: required unless nargs makes it elidable
    return action.nargs not in ("?", "*")


def command_card(name: str, subparser: argparse.ArgumentParser, summary: str) -> dict:
    inputs: list[dict] = []
    for action in subparser._actions:
        if isinstance(action, argparse._HelpAction) or action.dest in ("help", argparse.SUPPRESS):
            continue
        opts = action.option_strings
        form = "flag" if opts else "positional"
        props = {
            "name": action.dest,
            "type": _arg_type(action),
            "required": _is_required(action),
            "form": form,
        }
        if opts:
            longs = [o for o in opts if o.startswith("--")]
            props["flag"] = longs[0] if longs else opts[0]
        if action.help:
            props["description"] = action.help
        is_bool_flag = isinstance(action, (argparse._StoreTrueAction, argparse._StoreFalseAction))
        if not is_bool_flag and action.default is not None and action.default is not argparse.SUPPRESS:
            props["default"] = str(action.default)
        inputs.append(props)
    return {"id": name, "summary": summary, "cli": _clean_usage(subparser), "inputs": inputs}


def load_cards() -> list[dict]:
    parser = build_parser()
    sub = _subparsers_action(parser)
    help_by_name = {ca.dest: (ca.help or "") for ca in sub._choices_actions}
    return [
        command_card(name, subparser, help_by_name.get(name, ""))
        for name, subparser in sub.choices.items()
    ]


def command_node(card: dict) -> dict:
    return {
        "id": f"cmd.{card['id']}",
        "kind": "carta.command",
        "props": {"name": card["id"], "summary": card["summary"], "cli": card["cli"]},
        "tags": [],
    }


def arg_nodes_and_edges(card: dict) -> tuple[list[dict], list[dict]]:
    cmd = card["id"]
    nodes, edges = [], []
    for props in card["inputs"]:
        node_id = f"arg.{cmd}.{props['name']}"
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
    cards = load_cards()
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
