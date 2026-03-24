// Re-export geometry functions for backwards compat
export { computeBounds, isPointInRect } from '@carta/geometry';
export type { Rect, ComputeBoundsOptions } from '@carta/geometry';

/**
 * Hit-test for drop targets using DOM data attributes.
 * Looks for elements with data-drop-target="true" and data-container-id.
 *
 * @param screenX - Screen X coordinate
 * @param screenY - Screen Y coordinate
 * @returns Container ID if found, null otherwise
 */
export function findContainerAt(screenX: number, screenY: number): string | null {
  const elements = document.elementsFromPoint(screenX, screenY);
  const targetElement = elements.find((el) =>
    el.hasAttribute('data-drop-target') && el.getAttribute('data-drop-target') === 'true'
  ) as HTMLElement | undefined;

  if (targetElement) {
    const containerId = targetElement.getAttribute('data-container-id');
    return containerId;
  }

  return null;
}
