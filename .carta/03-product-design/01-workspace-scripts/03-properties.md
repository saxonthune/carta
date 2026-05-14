---
title: Property Catalog
summary: PROP-* property statements for the action catalog, each tagged with the actions and invariants they correlate
tags: [properties, testing, invariants, specs]
deps: [doc03.01.02]
---

# Property Catalog

Every property is a statement that holds across all executions of a command (or across any sequence of commands, for PROP-GLOBAL-*). Properties are the load-bearing content of the test suite — per-command unit-style properties, plus one stateful machine that exercises the whole command surface.

## Schema

```yaml
- id: PROP-<CMD>-<NAME>           # e.g. PROP-PUNCH-REF-INVARIANCE
  statement: <one-sentence claim>
  actions: [<command-id>, ...]     # the commands this property constrains
  from_invariants: [INV-*, ...]    # invariants this property derives from (optional)
  test: <pytest/hypothesis fn name>
```

## Classes of property

- **Action-local**: named for one command; holds across any legal invocation of it. `PROP-PUNCH-REF-INVARIANCE` is the archetype.
- **Pairwise**: holds across a composition of two commands, often an inverse relationship. `PROP-PUNCH-FLATTEN-ROUNDTRIP` is the archetype.
- **Global stateful** (`PROP-GLOBAL-*`): an invariant that `RuleBasedStateMachine` checks after every generated command sequence. Each is 1:1 with an `INV-*`.

## Global properties

| ID | Statement | From |
|---|---|---|
| PROP-GLOBAL-REF-UNIQUENESS | INV-1 holds after any sequence of commands | INV-1 |
| PROP-GLOBAL-PREFIX-UNIQUENESS | INV-2 holds after any sequence | INV-2 |
| PROP-GLOBAL-BUNDLE-COHERENCE | INV-3 holds after any sequence | INV-3 |
| PROP-GLOBAL-MANIFEST-DERIVABILITY | INV-4 holds after `regenerate()` | INV-4 |
| PROP-GLOBAL-REF-RESOLVABILITY | INV-5 holds after any sequence | INV-5 |
| PROP-GLOBAL-DIR-INDEX | INV-6 holds after any sequence | INV-6 |

## Action-local properties

Per-command properties live in each command's sidecar YAML under the `properties:` key. See doc03.01.05.01 (punch) for the first populated example.
