---
title: Contributing
status: draft
---

# Contributing

## Code Organization

Consult doc02.01 for architecture overview. Key principle: the three layers (visual editor, document adapter, compiler) are decoupled. Changes to one layer should not require changes to another.

## Adding a Feature

1. Identify which layer(s) the feature touches
2. Add to the appropriate package or directory
3. If it's a new user-facing capability, add a feature doc in `.docs/03-product/features/`
4. Run tests (`npm run test`, `npm run test:e2e`)
5. Update relevant documentation using cross-references (doc00.03)

## Documentation Conventions

See doc00.03 for cross-reference syntax, front matter, and file naming. Every concept has exactly one canonical document — reference it rather than re-explaining.

## Claude Code Skills

Carta includes Claude Code skills for automated auditing:

- `/documentation-nag` — updates docs after code changes
- `/style-nag` — audits UI styling for violations
- `/frontend-architecture-nag` — audits component layering

See CLAUDE.md for full skill and agent documentation.
