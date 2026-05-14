---
title: Error Catalog
summary: ERR-* error codes — one per guard failure, mapped to exception classes and CLI exit behavior
tags: [errors, guards, specs]
deps: [doc03.01.02]
---

# Error Catalog

Every guard failure across the action catalog surfaces as a named `ERR-*` code. The catalog is the contract between guards (in command sidecars), exception classes (in `carta_cli/errors.py`), and CLI exit messages.

## Schema

```yaml
- id: ERR-<CMD>-<NAME>            # e.g. ERR-PUNCH-IS-DIR
  guard: G-<CMD>-<N>               # the guard whose failure raises this error
  exception: <ExceptionClassName>
  exit_code: <int>
  message: <user-facing message template>
```

## Classes

- **Not-found**: target ref/path does not resolve. `ERR-*-NOT-FOUND`.
- **Precondition violation**: target exists but is in the wrong shape (wrong kind, already transformed, etc.). `ERR-*-IS-DIR`, `ERR-*-IS-INDEX`, `ERR-*-UNNUMBERED`.
- **Collision**: target destination already occupied. `ERR-*-COLLISION`.
- **Input validation**: malformed arguments. `ERR-*-BAD-SLUG`, `ERR-*-BAD-ORDER`.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Success (including `--dry-run`) |
| 1 | Guard failure — user error recoverable by fixing arguments |
| 2 | Workspace invariant violation detected mid-operation (abort) |
| 3 | Unexpected internal error |

## Contract

Each command sidecar lists `error_modes: [ERR-*, ...]`. Every ERR listed must appear in this catalog and have a 1:1 map to a guard `G-*` in the same command.
