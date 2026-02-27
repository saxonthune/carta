---
title: Import and Export
status: active
---

# Import and Export

Carta documents can be saved to and loaded from `.carta` files (JSON format, currently version 8).

## Export

1. Click export in the header
2. Export Preview Modal shows what will be included, organized by category: schemas, instances, port schemas, schema groups
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
5. Items are grouped by category: schemas, instances
6. **Target page picker**: choose where to import content:
   - **Replace document**: Clears all pages and replaces with imported content (destructive)
   - **Into "[Page name]"**: Merges imported content into an existing page (additive)
   - **+ New Page**: Creates a new page with name "Imported: [filename]" and imports into it (additive)

## Examples

Bundled example `.carta` files in the `/examples/` directory are accessible via Settings > Load Example. Loading an example follows the same import flow (preview, then confirm). The current document is cleared before loading.

## File Format

The `.carta` file format includes: title, description, pages (each with nodes/edges), custom schemas (ALL schemas including package schemas), port schemas, schema groups, schema packages, and package manifest entries.

### Self-contained principle

A `.carta` file contains everything needed to reconstruct the document. **All schemas are exported, including standard library package schemas.** The export path does not filter out built-in types — the file must survive a round-trip (export → import) without data loss. The package manifest and content hash system (see doc03.01.01.07) handles drift detection independently; the export path should not second-guess it.

### Desktop persistence

The desktop server uses `extractCartaFile` → JSON → `hydrateYDocFromCartaFile` for save/load cycles. The self-contained principle ensures no data is lost across these cycles.
