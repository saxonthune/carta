---
title: Script Pipeline
status: draft
summary: Architecture of the five-stage reconciliation script pipeline
tags: [scripts, reconciliation, pipeline, architecture]
deps: [doc01.02.02]
---

# Script Pipeline

Architecture of the reconciliation scripts that keep `.carta/` specifications synchronized with code.

## Five-Stage Pipeline

```
Code Artifacts          .carta/ Specs
     |                       |
     v                       v
  Extract               Read Specs
     |                       |
     v                       v
  Intermediate -----> Compare <----- Shape Files
                        |
                        v
                     Propose
                        |
                   +----+----+
                   v         v
              Apply to    Apply to
                Code       Specs
                   |         |
                   v         v
                  Verify  Verify
```

### Stage 1: Extract

Parse code artifacts into a normalized intermediate representation. Each extractor is language/framework-specific (TypeScript modules, React components, database schemas).

### Stage 2: Compare

Diff the intermediate representation against spec shape files. Produces a structured diff: added, removed, modified, and unchanged items.

### Stage 3: Propose

Generate patches from the diff. Two directions:
- **Spec->Code**: Generate code changes to match specs
- **Code->Spec**: Generate spec updates to match code

### Stage 4: Apply

Write proposed changes. Code patches go through standard file editing. Spec patches use the `carta` CLI for structural changes or direct file writes for content changes.

### Stage 5: Verify

Confirm consistency after application. Re-run extract+compare to verify zero diff.

## Script Configuration

Scripts are configured in `workspace.json` under the `scripts` key. Each script declares its extractor, target spec directory, and comparison strategy.
