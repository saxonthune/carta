# Repoint the editable install at THIS repo.
# Fixes the breakage where `pip install -e .` was last run from a now-deleted
# worktree, leaving the global install's .pth pointing at a dead path.
# justfile_directory() pins the install to the repo owning this justfile,
# so running it from a worktree still repoints to the canonical checkout.
reinstall:
    python3 -m pip install -e "{{justfile_directory()}}"
