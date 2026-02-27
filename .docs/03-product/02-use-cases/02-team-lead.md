---
title: Team Lead
status: active
---

# Team Lead

## Persona

A team lead who defines standardized schemas so their team models architecture consistently. Manages the `.carta/schemas/` directory and reviews team members' canvas changes via git.

## Goals

- Define construct schemas that enforce team conventions
- Organize schemas into groups and packages
- Share schemas across projects via the repository (git submodules, monorepo packages, or copy)
- Review team members' specification changes in pull requests
- Onboard new team members with a ready-made workspace

## Workflow

- Sets up the `.carta/` workspace in the team's repository with `carta init`
- Defines schemas in `schemas/schemas.json` — construct types, port schemas, schema groups
- Team members clone the repo and run `carta serve .` to get the full workspace with shared schemas
- Non-technical team members connect to a shared workspace server (see doc03.02.03, Team Workspace)
- Reviews canvas changes in PRs — `.canvas.json` diffs show what constructs and connections changed
- Iterates on schemas as the team's modeling vocabulary evolves

## Features Used

- doc03.01.01.05 (Metamap) — visual schema management
- doc03.01.01.06 (Schema Editor) — creating standardized schemas
- doc03.01.01.07 (Schema Library) — package-based schema distribution
- doc03.01.03.02 (Collaboration) — real-time co-editing via shared server
