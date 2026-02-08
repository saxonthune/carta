// File format
export type { CartaFile, CartaFilePage } from '@carta/document';
export { exportProject } from './cartaFile';

// Document import/export
export { importDocument, type ImportConfig } from './documentImporter';
export {
  analyzeImport,
  defaultImportOptions,
  type ItemStatus,
  type CategorySummary,
  type AnalyzedSchema,
  type AnalyzedNode,
  type AnalyzedCategory,
  type ImportAnalysis,
  type ImportOptions,
} from './importAnalyzer';
export {
  analyzeExport,
  defaultExportOptions,
  type ExportCategory,
  type ExportAnalysis,
  type ExportOptions,
} from './exportAnalyzer';

// Metamap layout
export {
  computeMetamapLayout,
  estimateSchemaNodeHeight,
  SCHEMA_NODE_WIDTH,
  GROUP_PADDING_X,
  GROUP_PADDING_TOP,
  GROUP_PADDING_BOTTOM,
  COMPACT_HEIGHT,
  COLLAPSED_GROUP_WIDTH,
  COLLAPSED_GROUP_HEIGHT,
  type MetamapLayoutInput,
  type MetamapLayoutOutput,
} from './metamapLayout';

// Preferences
export { getLastDocumentId, setLastDocumentId } from './preferences';

// Random names
export { generateRandomName } from './randomNames';

// Seeds
export { seeds, type SeedFn } from './seeds';

// String utilities
export { stripHandlePrefix } from './handlePrefix';
