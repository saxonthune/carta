---
title: Import a Project
status: draft
---

# Import a Project

## Steps

1. Click "Import" in the header (or drag-and-drop a .carta file)
2. The Import Preview Modal shows all items from the file
3. Items are categorized: schemas, instances, deployables
4. Each item shows status: conflict (amber), new (green), existing (gray)
5. Select which items to import via checkboxes
6. Choose import target:
   - **Replace document**: Clears all existing content and loads the imported file
   - **Into "[Level name]"**: Adds imported content to an existing level
   - **+ New Level**: Creates a new level and imports content into it
7. Click "Import" to apply
8. Selected items are merged or replaced based on the chosen target

## Loading a Seed

Seeds are TypeScript-based starter content (see doc03.01.03.05). Available via the header menu, seeds create pre-configured documents demonstrating features:

1. Click "Seeds" in the header menu
2. Select a seed: `starter`, `saas`, or `kitchen-sink`
3. Choose import target (replace document, into existing level, or new level)
4. Content is generated using `DocumentAdapter` operations

## Features

- doc03.01.02.02 (Import and Export)
