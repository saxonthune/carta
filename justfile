# Repoint the editable install at THIS repo.
# Fixes the breakage where `pip install -e .` was last run from a now-deleted
# worktree, leaving the global install's .pth pointing at a dead path.
# justfile_directory() pins the install to the repo owning this justfile,
# so running it from a worktree still repoints to the canonical checkout.
reinstall:
    python3 -m pip install -e "{{justfile_directory()}}"

test:
    python3 -m pytest tests/ -v

# Fail if any init-hydrated file (codex, AGENTS.md, skills) has drifted from the
# packaged templates/generator. Blocks PRs that edit a hydrated copy without
# updating its source. Run `rhidoc init --rehydrate` to fix drift.
check-hydration:
    rhidoc init --rehydrate --check
