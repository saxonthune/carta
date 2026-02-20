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

// Preferences
export { getLastDocumentId, setLastDocumentId } from './preferences';

// Random names
export { generateRandomName } from './randomNames';

// String utilities
export { stripHandlePrefix } from './handlePrefix';

// Node dimensions
export { getNodeDimensions } from './nodeDimensions';

// Edge geometry
export {
  getRectBoundaryPoint,
  waypointsToPath,
  computeBezierPath,
  type EdgeSide,
  type Waypoint,
} from './edgeGeometry.js';
