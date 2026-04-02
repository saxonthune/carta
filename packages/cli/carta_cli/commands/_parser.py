"""carta — argument parser and main entry point."""
import argparse
import sys
from pathlib import Path

from ..__version__ import __version__
from ..errors import CartaError
from ..workspace import find_workspace
from ..ai_skill import cmd_ai_skill
from .structure import cmd_create, cmd_delete, cmd_move, cmd_rename
from .transform import cmd_punch, cmd_flatten, cmd_group, cmd_copy
from .content import cmd_cat, cmd_rewrite, cmd_regenerate
from .setup import cmd_init, cmd_portable, cmd_hydrate


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="carta",
        description="Workspace tools for managing .carta/ documentation.",
    )
    parser.add_argument("--version", action="version", version=f"carta-cli {__version__}")
    parser.add_argument("--workspace", "-w", type=Path, default=None,
                        help="Path to workspace directory. Default: auto-detect.")
    parser.add_argument("--help-ai", action="store_true",
                        help="[Deprecated] Use `carta ai-skill` instead.")

    subparsers = parser.add_subparsers(dest="command", required=False)

    # regenerate
    p_regen = subparsers.add_parser("regenerate", help="Rebuild MANIFEST.md")
    p_regen.add_argument("--dry-run", action="store_true")

    # create
    p_create = subparsers.add_parser("create", help="Create a new doc entry")
    p_create.add_argument("destination")
    p_create.add_argument("slug")
    p_create.add_argument("--order", type=int, default=None)
    p_create.add_argument("--title", default=None)
    p_create.add_argument("--dry-run", action="store_true")

    # delete
    p_delete = subparsers.add_parser("delete", help="Delete entries with gap-closing")
    p_delete.add_argument("targets", nargs="+")
    p_delete.add_argument("--dry-run", action="store_true")
    p_delete.add_argument("--output-mapping", action="store_true")

    # move
    p_move = subparsers.add_parser("move", help="Move/reorder entries")
    p_move.add_argument("source")
    p_move.add_argument("destination")
    p_move.add_argument("--order", type=int, default=None)
    p_move.add_argument("--mkdir", action="store_true")
    p_move.add_argument("--rename", default=None)
    p_move.add_argument("--no-regen", action="store_true", help="Skip MANIFEST regeneration.")
    p_move.add_argument("--dry-run", action="store_true")

    # punch
    p_punch = subparsers.add_parser("punch", help="Expand leaf into directory")
    p_punch.add_argument("target")
    p_punch.add_argument("--as-child", action="store_true",
                          help="Put original content in 01-slug.md, generate skeleton index.")
    p_punch.add_argument("--dry-run", action="store_true")

    # flatten
    p_flatten = subparsers.add_parser("flatten", help="Dissolve directory")
    p_flatten.add_argument("target")
    p_flatten.add_argument("--keep-index", action="store_true")
    p_flatten.add_argument("--force", action="store_true")
    p_flatten.add_argument("--at", dest="at_position", type=int, default=None)
    p_flatten.add_argument("--dry-run", action="store_true")

    # copy
    p_copy = subparsers.add_parser("copy", help="Copy file into workspace")
    p_copy.add_argument("source")
    p_copy.add_argument("destination")
    p_copy.add_argument("--order", type=int, default=None)
    p_copy.add_argument("--rename", dest="rename_slug", default=None)
    p_copy.add_argument("--dry-run", action="store_true")

    # rewrite
    p_rewrite = subparsers.add_parser("rewrite", help="Rewrite doc refs")
    p_rewrite.add_argument("mappings", nargs="+", help="old=new pairs")
    p_rewrite.add_argument("--dry-run", action="store_true")

    # group
    p_group = subparsers.add_parser("group", help="Create a title group directory")
    p_group.add_argument("target", help="Directory path relative to workspace (e.g., 01-product-strategy)")
    p_group.add_argument("--title", default=None, help="Title for the index. Default: derived from slug.")
    p_group.add_argument("--no-regen", action="store_true", help="Skip MANIFEST regeneration.")

    # rename
    p_rename = subparsers.add_parser("rename", help="Rename a directory or file slug")
    p_rename.add_argument("target", help="Target to rename (doc ref or relative path)")
    p_rename.add_argument("new_slug", help="New slug (the part after NN-)")
    p_rename.add_argument("--no-regen", action="store_true", help="Skip MANIFEST regeneration.")

    # init
    p_init = subparsers.add_parser("init", help="Initialize a new workspace")
    p_init.add_argument("--name", default=None, help="Workspace title. Default: parent directory name.")
    p_init.add_argument("--dir", dest="dirname", default=".carta",
                        help="Name of the workspace directory. Default: .carta")
    p_init.add_argument("--portable", action="store_true",
                        help="Dump editable Python scripts into workspace for pip-free usage.")

    # hydrate
    p_hydrate = subparsers.add_parser("hydrate", help="Re-hydrate codex docs and skills from installed carta version")
    p_hydrate.add_argument("--dry-run", action="store_true",
                           help="Show what would be updated without writing.")

    # portable
    p_portable = subparsers.add_parser("portable", help="Dump editable scripts into workspace")

    # ai-skill
    p_ai_skill = subparsers.add_parser("ai-skill", help="Print AI agent reference for all commands")

    # cat
    p_cat = subparsers.add_parser("cat", help="Print document contents by ref")
    p_cat.add_argument("ref", help="Doc ref (e.g., doc02.03) or relative path")

    # Handle per-subcommand --help-ai before parse_args (avoids required-arg errors)
    argv = sys.argv[1:]
    if "--help-ai" in argv:
        # Find the subcommand name: skip flags and their values
        known_subcommands = {
            "regenerate", "create", "delete", "move", "punch", "flatten",
            "copy", "rewrite", "group", "rename", "init", "hydrate",
            "portable", "ai-skill", "cat",
        }
        cmd_candidates = [a for a in argv if a in known_subcommands]
        if cmd_candidates:
            from ..ai_skill import _COMMAND_DOCS
            cmd = cmd_candidates[0]
            doc = _COMMAND_DOCS.get(cmd)
            if doc:
                print(doc.strip())
            else:
                print(f"No AI documentation available for '{cmd}'.")
                print("Run `carta ai-skill` for the full reference.")
            raise SystemExit(0)

    args = parser.parse_args()

    if args.help_ai:
        print("Deprecated: --help-ai is replaced by `carta ai-skill`.")
        print("Run `carta ai-skill` for full semantic documentation.")
        raise SystemExit(0)

    if not args.command:
        parser.print_help()
        raise SystemExit(1)

    try:
        # init and portable don't require a pre-existing workspace
        if args.command == "init":
            cmd_init(args)
            return

        # Resolve workspace
        if args.workspace:
            carta_root = args.workspace.resolve()
        else:
            try:
                carta_root = find_workspace()
            except FileNotFoundError as e:
                raise CartaError(f"Error: {e}")

        if args.command == "portable":
            cmd_portable(args, carta_root)
            return

        if args.command == "hydrate":
            cmd_hydrate(args, carta_root)
            return

        dispatch = {
            "regenerate": cmd_regenerate,
            "create": cmd_create,
            "delete": cmd_delete,
            "move": cmd_move,
            "punch": cmd_punch,
            "flatten": cmd_flatten,
            "copy": cmd_copy,
            "rewrite": cmd_rewrite,
            "group": cmd_group,
            "rename": cmd_rename,
            "ai-skill": cmd_ai_skill,
            "cat": cmd_cat,
        }
        dispatch[args.command](args, carta_root)
    except CartaError as e:
        print(str(e), file=sys.stderr)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
