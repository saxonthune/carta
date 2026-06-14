.PHONY: test check-hydration

test:
	python3 -m pytest tests/ -v

# Fail if any init-hydrated file (codex, AGENTS.md, skills) has drifted from the
# packaged templates/generator. Blocks PRs that edit a hydrated copy without
# updating its source. Run `rhidoc init --rehydrate` to fix drift.
check-hydration:
	rhidoc init --rehydrate --check
