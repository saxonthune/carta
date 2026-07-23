# Rhidoc

Rhidoc is a CLI for agentic documentation management. Rhidoc is short for **rhi**zomatic **doc**umentation, a single body of context growing in all directions. A docs workspace managed by rhidoc can accelerate spec-driven development and eliminate the ambiguity between project requirements and source code that leads to hallucinations.

## Quick start

```bash
pip install rhidoc
rhidoc init
```

`rhidoc init` creates the docs workspace structure, with instructions for agents provided by the docs themselves as well as optional skills.

## Rhidoc at a Glance

Here's a snippet of rhidoc's own docs structure:

```
$ rhidoc tree
.rhidoc
├── 00-handbook -- Handbook
│   ├── 00-index -- Handbook
│   ├── 01-about -- About This Workspace
│   ├── 02-maintenance -- Maintenance
│   ├── 03-conventions -- Conventions
│   ├── 04-plain-language -- Plain Language
│   └── 05-controlled-vocabulary -- Controlled Vocabulary
├── 02-architecture -- Architecture
│   ├── 00-index -- Architecture
│   ├── 01-script-pipeline -- Reconciliation Architecture
│   └── 02-design-patterns -- Design Patterns
│       ├── 00-index -- Design Patterns
│       └── 01-python-for-ai -- Python for AI Agents
├── 03-product-design -- Product Design
│   ├── 00-index -- Product Design
│   ├── 01-workspace-scripts -- Workspace Scripts
│   │   ├── 00-index -- Workspace Scripts
│   │   ├── 01-workspace-scripts -- Rhidoc Docs API — Design
│   │   ├── 02-invariants -- Workspace Invariants
│   │   ├── 03-properties -- Property Catalog
│   │   └── 04-errors -- Error Catalog
│   ├── 02-cli-user-flow -- CLI User Flow
```

The key part is a `DocRef`; for example, `doc03.01.03` resolves to the path `.rhidoc/03-product-design/01-workspace-scripts/03-properties.md`. The format is readable for humans, gives context to an LLM, and enables deterministic operations.

### Doc development loop

- Ahead of code generation, a human starts a session with a coding agent to make necessary docs.
- The agent loads rhidoc skills and `MANIFEST.md` into its context, which lets it cheaply locate relevant docs.
- The agent briefs the human on the status of relevant docs.
- The human inputs design decisions in natural language to the agent.
- The agent updates the docs with deterministic `rhidoc` commands.
- Finally, the agent `rhidoc regenerate` updates `MANIFEST.md` for the next session.

### Sidecars

Some context is highly structured and is an awkward fit in a prosaic markdown file. Rhidoc provides *sidecars*. You can write scripts that verify your sidecar specs. For example, you can write inventory of screens in a mobile app in `doc02.01-screens`, a [concept inventory](https://essenceofsoftware.com/tutorials/concept-basics/sw-as-concepts/) in `doc01.03-concepts`, and then a script that verifies that every concept-action has an affordance somewhere in your app. Through this, design flaws are surfaced early, and coding agents have access to verified, unambiguous context.

More information at [WORKSPACE.md](WORKSPACE.md) (WIP).

## Installation

Requires Python 3.10+. Install via pip:

```bash
pip install rhidoc
```

Or install for development:

```bash
pip install -e .
```

## Usage

```bash
rhidoc init              # create a new .rhidoc/ workspace
rhidoc create doc01.03   # add a doc entry
rhidoc move doc01.03 doc02.01
rhidoc regenerate        # rebuild MANIFEST.md
rhidoc tree              # print workspace structure
rhidoc ai-skill          # print full command reference for AI agents
```

Run `rhidoc --help` for the complete command list.

## Tests

```bash
just test
```

## License

AGPL-3.0
