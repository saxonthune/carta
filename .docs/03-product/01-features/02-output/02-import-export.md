---
title: Import and Export
status: active
---

# Import and Export

Carta documents can be saved to and loaded from `.carta` files (JSON format, currently version 5).

## Export

1. Click export in the header
2. Export Preview Modal shows what will be included, organized by category: schemas, instances, deployables, port schemas, schema groups
3. Selective export: choose which categories and items to include
4. Preview raw JSON before downloading
5. Downloads as a `.carta` file

## Import

1. Click import in the header or drag-and-drop a `.carta` file
2. File is validated for structure and version compatibility (backwards compatible with v4 and earlier)
3. Import Preview Modal shows:
   - **Conflicts**: existing items with the same ID (amber indicator)
   - **New items**: items not present in current document (green indicator)
   - **Existing items**: already present, unchanged (gray indicator)
4. Selective import: choose which items to include via checkboxes
5. Items are grouped by category: schemas, instances, deployables
6. **Target page picker**: choose where to import content:
   - **Replace document**: Clears all pages and replaces with imported content (destructive)
   - **Into "[Page name]"**: Merges imported content into an existing page (additive)
   - **+ New Page**: Creates a new page with name "Imported: [filename]" and imports into it (additive)

## Examples

Bundled example `.carta` files in the `/examples/` directory are accessible via Settings > Load Example. Loading an example follows the same import flow (preview, then confirm). The current document is cleared before loading.

## File Format

Version 5 includes: title, description, pages (each with nodes/edges/deployables), custom schemas, port schemas, schema groups. The format is self-contained — a `.carta` file contains everything needed to reconstruct the document.
