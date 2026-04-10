# Carta

A CLI for managing `.carta/` workspaces — structured documentation directories that keep specifications synchronized with code.

Carta gives AI agents (and humans) deterministic tools for creating, moving, deleting, and reorganizing docs within a hierarchical workspace. See [WORKSPACE.md](WORKSPACE.md) for the format description.

## Install

Requires Python 3.10+.

```bash
pip install carta-cli
```

Or install from source:

```bash
pip install -e .
```

## Usage

```bash
carta init              # create a new .carta/ workspace
carta create doc01.03   # add a doc entry
carta move doc01.03 doc02.01
carta regenerate        # rebuild MANIFEST.md
carta tree              # print workspace structure
carta ai-skill          # print full command reference for AI agents
```

Run `carta --help` for the complete command list.

## Tests

```bash
make test
```

## License

AGPL-3.0
