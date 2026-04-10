---
title: Python for AI Agents
status: active
summary: File structure, typing, naming, testability patterns for AI-maintained Python
tags: [python, patterns, ai, conventions, testing, typing]
deps: [doc01.01.02]
---

# Python for AI Agents

Patterns that make Python code easier for AI agents to read, modify, and extend. Each rule includes a **Why** explaining the AI-specific reason — not just "clean code" but what specifically helps or hinders an agent working in a context window.

Read this doc when working on Python code in this project (currently `carta_cli/`).

## File & Module Structure

**Keep files under ~500 lines.** Files over 500 lines force agents to read in chunks, re-read sections, and waste tokens navigating. A 1500-line file costs 3x the tokens of three 500-line files — and the agent can only load the ones it needs.

**One concept per file.** A file should map to one class, one closely related group of functions, or one logical concern. Why: agents discover code by grepping file names. `payment_validation.py` is findable; a `validate_payment` function buried in `utils.py` is not.

**Use explicit barrel exports.** A top-level `__init__.py` that re-exports the public API tells the agent exactly what a package exposes without scanning every file. Keep internal helpers unexported.

**Prefer flat directory structures.** Two levels of nesting is the sweet spot. Deep package hierarchies force agents to chase through multiple `__init__.py` files to resolve imports.

## Naming

**Use fully explicit names; never abbreviate.** `calculate_monthly_revenue` not `calc_mo_rev`. Agents tokenize names and match them against natural language in prompts. Abbreviated names break this mapping.

**Name files after what they contain.** `ref_convert.py` not `converters.py`. `frontmatter.py` not `parsing.py`. Agents find files by name before reading them — a precise filename eliminates a search step.

**Use consistent verb conventions project-wide.** If you use `create_X`, `update_X`, `delete_X` in one module, use the same verbs everywhere. Agents generalize patterns across files. Inconsistent verbs force re-reading to confirm behavior.

**Function names should describe their full contract.** `fetch_user_by_email_or_raise` is better than `get_user` because it communicates error handling without reading the body. The agent can generate correct call sites from the name alone.

## Types & Data Models

**Type all function signatures.** Fully annotated signatures let agents understand interfaces without reading function bodies. This includes return types — especially `-> None`. Research shows LLMs generate significantly more accurate code when working with typed codebases (arxiv 2508.00422).

**Use dataclasses or TypedDict over raw dicts.** `dict[str, Any]` tells the agent nothing. A `@dataclass` with typed fields tells it everything. The agent can generate correct field access from the class definition alone.

**Use Protocol for interfaces.** Protocols are structural — the agent understands the contract from the type definition without chasing inheritance hierarchies.

**Annotate return types explicitly.** Agents use return type annotations to chain function calls. An unannotated function forces the agent to read the body and trace all return paths.

## Functions

**Keep functions under ~50 lines.** Agents reason about code linearly within a context window. A 200-line function forces the agent to hold the entire thing in working memory to understand any part of it. Three 40-line functions with clear names are cheaper to reason about.

**Prefer flat call graphs over deep nesting.** Target 2 levels of indirection, not n-levels. Deep call chains force agents to chase through multiple files to understand behavior. A function that calls 3 helpers is cheaper to reason about than a 5-level call stack.

**Return structured objects, not print.** Functions that return values are composable and testable. Functions that print and call `sys.exit()` can only be tested via subprocess. An agent can inspect a return value; it cannot easily parse captured stdout.

**Separate validation, logic, and I/O.** A function that validates args, performs business logic, writes files, and prints output is untestable in parts. Split into: validate (pure) -> compute (pure) -> execute (I/O). Agents can then modify the logic layer without understanding the I/O layer.

## Searchability

**Use string literals for important identifiers.** `"user.created"` not `f"user.{action}"`. Agents discover code paths by grepping for string values. Computed strings are invisible to search.

**Keep imports explicit.** `from auth.tokens import create_jwt` is grepable. `from auth import *` forces the agent to resolve what's actually available by reading `__init__.py`.

**Avoid heavy metaprogramming and dynamic dispatch.** `getattr(obj, method_name)()` is invisible to grep. A direct method call or explicit dispatch dict is findable. If you must use dynamic dispatch, keep the mapping in one visible place (a dict literal, not runtime registration).

**Use consistent exception class names.** `class RefResolutionError(FileNotFoundError)` in a file called `exceptions.py` is instantly discoverable. Agents grep for exception types when understanding error handling.

## Error Handling

**Use structured errors, not SystemExit.** A function that raises `RefNotFoundError` can be caught, tested, and composed. A function that calls `sys.exit(1)` can only be tested via subprocess. Reserve `SystemExit` for the outermost CLI entry point.

**Make error messages descriptive and actionable.** Include what went wrong, what was expected, and what to do about it. Agents parse error messages when tests fail — a message like `"Cannot resolve segment '99' in /path: no entry starting with '99-'"` gives the agent recovery information.

**Put error strings inline.** Don't factor error messages into constants or i18n tables for internal tools. The agent needs to see the message at the raise site to understand the error path.

## Testing

**Name tests after the scenario, not the function.** `test_delete_with_orphaned_refs_warns` is better than `test_delete_3`. Agents run tests selectively with `pytest -k "orphaned"` — descriptive names make this work.

**Make assertions verbose.** `assert result.status == "active", f"Expected active but got {result.status} for user {user.id}"` gives the agent actionable information when a test fails. Silent `assert x == y` failures require re-reading the test to understand what went wrong.

**Design functions for direct testing.** If a function can only be tested via subprocess (because it prints and exits), it's too coupled to I/O. Extract the logic into a testable function that returns a result, and make the CLI handler a thin wrapper.

**Co-locate test names with source names.** `test_ref_convert.py` tests `ref_convert.py`. Agents find tests by name substitution. If the mapping is inconsistent, the agent must search.

## Anti-Patterns

**God files.** A 1500-line file with 13 command handlers, argument parsing, helper functions, and documentation generation. Split by concern — the agent only needs to load the file relevant to its task.

**Validation-logic-IO sandwich.** A function that validates arguments on lines 1-20, does business logic on lines 21-80, writes to disk on lines 81-100, and prints results on lines 101-120. The agent can't modify the logic without understanding the I/O. Split into layers.

**getattr for known attributes.** `getattr(args, 'rename_slug', None)` instead of accessing `args.rename_slug` directly. This hides the attribute name from grep and type checkers. Use direct attribute access; if the attribute is conditionally present, restructure the argparse setup.

**Duplicated boilerplate across commands.** When 8 commands each have their own resolve-validate-display-dryrun scaffolding, an agent modifying the pattern must find and update all 8 copies. Extract shared patterns into helpers.

**Dead modules.** Unused files that appear in `import` searches but lead nowhere. Agents waste tokens reading them. Delete unused code — version control remembers it.

## Sources

- Willison, S. "Setting up a codebase for working with coding agents" (2025)
- Osmani, A. "How to write a good spec for AI agents" (2025)
- JetBrains. "Coding Guidelines for Your AI Agents" (2025)
- arxiv 2508.00422. "Automated Type Annotation in Python Using Large Language Models"
- arxiv 2508.13666. "The Hidden Cost of Readability: How Code Formatting Silently Consumes Your LLM Budget"
