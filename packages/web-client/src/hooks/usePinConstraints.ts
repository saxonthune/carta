import { useState, useEffect, useCallback } from 'react';
import { useDocumentContext } from '../contexts/DocumentContext';
import { usePages } from './usePages';
import {
  addPinConstraint,
  removePinConstraint,
  listPinConstraints,
} from '@carta/document';
import type { PinConstraint, PinDirection } from '@carta/schema';

export function usePinConstraints() {
  const { ydoc } = useDocumentContext();
  const { activePage } = usePages();

  const [constraints, setConstraints] = useState<PinConstraint[]>([]);

  // Subscribe to the pin-constraints Y.Array for reactive updates
  useEffect(() => {
    if (!activePage) return;
    const yarray = ydoc.getArray(`pin-constraints-${activePage}`);
    const handler = () => {
      setConstraints(listPinConstraints(ydoc, activePage));
    };
    handler(); // initial read
    yarray.observe(handler);
    return () => yarray.unobserve(handler);
  }, [ydoc, activePage]);

  const addConstraint = useCallback(
    (sourceOrganizerId: string, targetOrganizerId: string, direction: PinDirection) => {
      if (!activePage) return;
      addPinConstraint(ydoc, activePage, { sourceOrganizerId, targetOrganizerId, direction });
    },
    [ydoc, activePage]
  );

  const removeConstraint = useCallback(
    (constraintId: string) => {
      if (!activePage) return;
      removePinConstraint(ydoc, activePage, constraintId);
    },
    [ydoc, activePage]
  );

  return { constraints, addConstraint, removeConstraint };
}
