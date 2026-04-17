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
from .content import cmd_cat, cmd_tree, cmd_rewrite, cmd_regenerate, cmd_attach
from .setup import cmd_init, cmd_portable, cmd_init_rehydrate


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
    p_create.add_argument("--summary", default=None)
    p_create.add_argument("--tags", default=None, help="Comma-separated tags")
    p_create.add_argument("--deps", default=None, help="Comma-separated deps")
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
    p_move.add_argument("--no-gap-close", action="store_true",
                        help="Skip gap-closing of source siblings. Use for batch moves.")
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

    # attach
    p_attach = subparsers.add_parser(
        "attach",
        help="Copy an external file into a doc's bundle as an attachment. "
             "Bundles are sets of files sharing a numeric prefix; `attach` aligns "
             "the copied file with the target doc's prefix.",
    )
    p_attach.add_argument("target", help="Doc ref or workspace path of the target NN-<slug>.md")
    p_attach.add_argument("source", help="Path to an external file (may be outside the workspace)")
    p_attach.add_argument("--rename", default=None, metavar="SLUG",
                          help="Override the attachment's slug segment. Default: source filename stem.")
    p_attach.add_argument("--dry-run", action="store_true",
                          help="Print planned operation without executing.")

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
    p_init.add_argument("--rehydrate", action="store_true",
                        help="Refresh codex templates and skill files in an existing workspace. "
                             "Preserves workspace.json and user-authored docs.")
    p_init.add_argument("--dry-run", action="store_true",
                        help="With --rehydrate, show what would be updated without writing.")

    # portable
    p_portable = subparsers.add_parser("portable", help="Dump editable scripts into workspace")

    # ai-skill
    p_ai_skill = subparsers.add_parser("ai-skill", help="Print AI agent reference for all commands")

    # cat
    p_cat = subparsers.add_parser("cat", help="Print document contents by ref")
    p_cat.add_argument("ref", help="Doc ref (e.g., doc02.03) or relative path")

    # tree
    p_tree = subparsers.add_parser("tree", help="Print workspace structure as a tree")
    p_tree.add_argument("target", nargs="?", default=None,
                        help="Directory to tree (doc ref or path). Default: workspace root.")
    p_tree.add_argument("--refs", action="store_true",
                        help="Show docXX.YY refs next to entries.")
    p_tree.add_argument("--no-title", action="store_true",
                        help="Show filenames instead of frontmatter titles.")

    # Handle per-subcommand --help-ai before parse_args (avoids required-arg errors)
    argv = sys.argv[1:]
    if "--help-ai" in argv:
        # Find the subcommand name: skip flags and their values
        known_subcommands = {
            "regenerate", "create", "delete", "move", "punch", "flatten",
            "copy", "attach", "rewrite", "group", "rename", "init",
            "portable", "ai-skill", "cat", "tree",
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
            if args.rehydrate:
                try:
                    carta_root = find_workspace()
                except FileNotFoundError as e:
                    raise CartaError(f"Error: {e}\nHint: run `carta init` first to scaffold a workspace.")
                cmd_init_rehydrate(args, carta_root)
            else:
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

        dispatch = {
            "regenerate": cmd_regenerate,
            "create": cmd_create,
            "delete": cmd_delete,
            "move": cmd_move,
            "punch": cmd_punch,
            "flatten": cmd_flatten,
            "copy": cmd_copy,
            "attach": cmd_attach,
            "rewrite": cmd_rewrite,
            "group": cmd_group,
            "rename": cmd_rename,
            "ai-skill": cmd_ai_skill,
            "cat": cmd_cat,
            "tree": cmd_tree,
        }
        dispatch[args.command](args, carta_root)
    except CartaError as e:
        print(str(e), file=sys.stderr)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
