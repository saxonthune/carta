# Missing insertion semantics and atomic prefix operations

## What happened

I wanted to move a directory from prefix 01 to prefix 00 in a workspace, keeping
the dir's internal entry names intact. The natural command to reach for was
something like:

```
carta move doc01 doc00
```

This failed: `docNN` only resolves to an entry that already exists, so `doc00`
isn't a valid destination when that slot is empty. There's also no `--order 0`
(position 0 is reserved), and no way to say "put this entry at prefix NN" as a
first-class operation.

The workaround ended up being a manual `mv` plus a long hand-written
`carta rewrite` command listing every sub-ref pair, then `carta regenerate`.
Then a second pass to shift the sibling dirs (02→01, 03→02, 04→03) with
another batched rewrite. It worked, but it's the kind of operation the tool
should own end-to-end.

## Why it matters

Restructuring a workspace is a common operation — especially early on, when
the top-level shape is still being figured out. Right now, the primitives
don't compose to cover it:

- `move` repositions across parents but can't target an empty slot, and
  can't target prefix 0.
- `rename` changes the slug but not the prefix.
- `rewrite` handles refs but is manual and error-prone once the count goes
  past a handful of pairs.
- `flatten` dissolves a directory but hardcodes `new_prefix = idx + 1`, so
  hoisting a prefix-0 directory silently loses the 0 slot and cascades
  everything down by one.

The common missing primitive is "change the prefix of an entry, preserving its
slug and internal structure, updating all references, with or without gap-close
on siblings." Users shouldn't have to drop to `mv` + `rewrite` + `regenerate`
to accomplish it.

## Direction

A couple of shapes that would cover this cleanly, probably as atomic ops that
compose:

- `carta insert <source> <dest-ref>` — move source into the slot named by
  `dest-ref`, bump any existing sibling at that prefix and everything after
  it down, rewrite all affected refs. `dest-ref` accepts `docNN` as an empty
  slot, not just an existing entry.
- `carta renumber <target> <new-prefix>` — change only the prefix of
  `target`, leave siblings alone (allow gaps), rewrite refs to the target
  and its descendants. Different from `move` (no relocation) and `rename`
  (no slug change).

With those two, the flow I just did becomes `carta insert 01-codex doc00` —
one command, fully ref-safe. Also worth fixing the flatten prefix-0 bug in
the same pass, since it's the same family of problem (the renumber formula
doesn't account for where the source actually sat).

More broadly: `docNN` syntax should probably have two resolution modes —
"existing entry at this ref" vs. "positional slot, occupied or not" — and
destination-taking commands should accept the latter.
