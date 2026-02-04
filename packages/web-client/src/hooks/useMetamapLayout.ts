import { useState, useMemo, useCallback } from 'react';
import { computeMetamapLayout } from '../utils/metamapLayout';
import type { ConstructSchema, SchemaGroup } from '@carta/domain';

/**
 * Hook wrapper around the pure computeMetamapLayout function.
 * Provides memoization and a reLayout callback for forcing recalculation.
 */
export function useMetamapLayout(
  schemas: ConstructSchema[],
  schemaGroups: SchemaGroup[],
  expandedSchemas?: Set<string>,
  expandedGroups?: Set<string>,
) {
  const [layoutVersion, setLayoutVersion] = useState(0);

  const reLayout = useCallback(() => {
    setLayoutVersion(v => v + 1);
  }, []);

  const { nodes, edges, schemaToCollapsedGroup } = useMemo(() => {
    void layoutVersion; // Force recalculation when version changes
    return computeMetamapLayout({ schemas, schemaGroups, expandedSchemas, expandedGroups });
  }, [schemas, schemaGroups, expandedSchemas, expandedGroups, layoutVersion]);

  return { nodes, edges, reLayout, schemaToCollapsedGroup };
}
