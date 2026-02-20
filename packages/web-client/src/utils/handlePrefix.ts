// V1-era constants, inlined after PortDrawer and IndexBasedDropZones were deleted
const DRAWER_HANDLE_PREFIX = 'drawer:';
const DROPZONE_HANDLE_PREFIX = 'dropzone:';

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
