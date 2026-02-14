import { DRAWER_HANDLE_PREFIX } from '../components/canvas/PortDrawer';
import { DROPZONE_HANDLE_PREFIX } from '../components/canvas/IndexBasedDropZones';

/**
 * Strip `drawer:` or `dropzone:` prefix from a handle ID,
 * returning the clean port ID that persistent edges reference.
 */
export function stripHandlePrefix(handleId: string): string {
  if (handleId.startsWith(DRAWER_HANDLE_PREFIX)) {
    return handleId.slice(DRAWER_HANDLE_PREFIX.length);
  }
  if (handleId.startsWith(DROPZONE_HANDLE_PREFIX)) {
    return handleId.slice(DROPZONE_HANDLE_PREFIX.length);
  }
  return handleId;
}
