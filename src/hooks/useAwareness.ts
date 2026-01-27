import { useState, useEffect, useCallback, useRef } from 'react';
import { useDocumentContext } from '../contexts/DocumentContext';

/**
 * User presence information shared via Yjs awareness
 */
export interface UserPresence {
  name: string;
  color: string;
  cursor?: { x: number; y: number };
  selectedNodeIds?: string[];
}

/**
 * Remote user state including their client ID
 */
export interface RemoteUser {
  clientId: number;
  presence: UserPresence;
}

interface UseAwarenessOptions {
  /** User's display name */
  userName?: string;
  /** User's color for presence indicators */
  userColor?: string;
}

interface UseAwarenessReturn {
  /** Local user's presence state */
  localPresence: UserPresence | null;
  /** All remote users' presence states */
  remoteUsers: RemoteUser[];
  /** Update local user's cursor position */
  updateCursor: (x: number, y: number) => void;
  /** Update local user's selected nodes */
  updateSelection: (nodeIds: string[]) => void;
  /** Total number of connected users (including self) */
  userCount: number;
}

// Generate a random color for user presence
function generateUserColor(): string {
  const colors = [
    '#ef4444', // red
    '#f97316', // orange
    '#eab308', // yellow
    '#22c55e', // green
    '#14b8a6', // teal
    '#3b82f6', // blue
    '#8b5cf6', // violet
    '#ec4899', // pink
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Generate a random name for anonymous users
function generateUserName(): string {
  const adjectives = ['Swift', 'Bold', 'Calm', 'Keen', 'Wise', 'Quick', 'Brave'];
  const nouns = ['Fox', 'Owl', 'Bear', 'Wolf', 'Hawk', 'Deer', 'Lion'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adj} ${noun}`;
}

/**
 * Hook for managing user presence and awareness in collaborative mode.
 *
 * Uses the Yjs awareness protocol to share cursor positions,
 * selections, and user names between collaborators.
 */
export function useAwareness(options: UseAwarenessOptions = {}): UseAwarenessReturn {
  const { userName, userColor } = options;
  const { ydoc } = useDocumentContext();

  const [localPresence, setLocalPresence] = useState<UserPresence | null>(null);
  // TODO: populate remoteUsers when full awareness protocol is implemented
  const [remoteUsers] = useState<RemoteUser[]>([]);

  // Initialize local presence when ydoc changes
  // Using refs to avoid the setState-in-effect warning
  const isInitialized = useRef(false);

  useEffect(() => {
    // Initialize local user's presence
    const initialPresence: UserPresence = {
      name: userName || generateUserName(),
      color: userColor || generateUserColor(),
      selectedNodeIds: [],
    };

    setLocalPresence(initialPresence);
    isInitialized.current = true;

    // Note: Full awareness implementation would use y-protocols awareness
    // This is a simplified version that tracks local state
    // Full implementation would require WebsocketProvider.awareness

  }, [ydoc, userName, userColor]);

  // Update cursor position
  const updateCursor = useCallback(
    (x: number, y: number) => {
      if (!localPresence) return;

      setLocalPresence((prev) =>
        prev ? { ...prev, cursor: { x, y } } : null
      );

      // In full implementation, would update awareness state:
      // awareness.setLocalStateField('cursor', { x, y });
    },
    [localPresence]
  );

  // Update selected nodes
  const updateSelection = useCallback(
    (nodeIds: string[]) => {
      if (!localPresence) return;

      setLocalPresence((prev) =>
        prev ? { ...prev, selectedNodeIds: nodeIds } : null
      );

      // In full implementation, would update awareness state:
      // awareness.setLocalStateField('selectedNodeIds', nodeIds);
    },
    [localPresence]
  );

  return {
    localPresence,
    remoteUsers,
    updateCursor,
    updateSelection,
    userCount: remoteUsers.length + (localPresence ? 1 : 0),
  };
}

export default useAwareness;
