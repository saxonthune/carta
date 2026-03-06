---
name: docs-lookup
description: Answers questions about project documentation. Triggers on references to .carta/, doc references (docXX.YY), or questions about Carta's design, architecture, features, or principles.
---

# docs-lookup

Efficiently navigates `.carta/` to answer questions about Carta's documentation, design decisions, architecture, features, and principles.

## When This Triggers

- "What does .carta/ say about X?"
- "What's the doc for Y?"
- "Look up docXX.YY"
- Questions about Carta's architecture, principles, features, metamodel, design system, etc.

## How to Navigate .carta/

### Step 1: Read the manifest

Always start here — never scan the directory tree:

```
.carta/MANIFEST.md
```

The manifest lists every doc with its ref, file path, and topic keywords. Use it to identify which 1-3 docs are relevant to the question.

### Step 2: Read only the relevant docs

Open only the files identified from the manifest. Most questions can be answered from 1-2 docs.

### Step 3: If the topic spans titles

Some questions cross title boundaries. Common patterns:

| Question type | Look for tags | Then check |
|---------------|--------------|------------|
| "How does X work?" | architecture, components, hooks | features |
| "Why was X designed this way?" | adr, principles | — |
| "What does X mean?" | glossary, terms | — |
| "What are the rules for X?" | principles, design | architecture |
| "What's the UI pattern for X?" | design, ui, styling | — |
| "How are components structured?" | components, architecture | — |

### Step 4: Answer with references

Always cite the doc ref (e.g., "Per docXX.YY, the metamodel uses three levels..."). This lets the user trace your answer back to the source.

## Do NOT

- Read all 42 docs — use the manifest to target
- Guess answers without reading the doc — if the manifest doesn't cover a topic, say so
- Paraphrase loosely — quote or closely reference the doc's actual content
- Modify any docs — this skill is read-only
