import { useMemo } from 'react';

export interface NodeLink {
  id: string;
  leader: string;
  follower: string;
}

export type FollowerDragDecision = 'allow' | 'block' | 'redirect-to-leader';

export interface UseNodeLinksOptions {
  links: NodeLink[];
  onFollowerDragAttempt?: (link: NodeLink, followerId: string) => FollowerDragDecision;
}

export interface UseNodeLinksResult {
  /** Given a node being dragged, get all followers that should receive the same delta */
  getFollowers: (leaderId: string) => string[];
  /** Check if a node is a follower in any link */
  isFollower: (nodeId: string) => boolean;
  /** Get the drag decision for a follower. Returns 'allow' if no callback provided. */
  checkFollowerDrag: (nodeId: string) => FollowerDragDecision;
  /** Get the leader ID for a follower, if any */
  getLeader: (followerId: string) => string | undefined;
}

/**
 * Manages directional movement links between node pairs.
 * Provides lookup utilities for leader-follower relationships.
 * Does NOT intercept drag events or move nodes automatically.
 *
 * @param options - Configuration with links array and optional drag attempt callback
 * @returns Lookup utilities for link relationships
 */
export function useNodeLinks(options: UseNodeLinksOptions): UseNodeLinksResult {
  const { links, onFollowerDragAttempt } = options;

  const linkMaps = useMemo(() => {
    const leaderToFollowers = new Map<string, string[]>();
    const followerToLink = new Map<string, NodeLink>();

    for (const link of links) {
      // Build leader -> followers map
      const followers = leaderToFollowers.get(link.leader) ?? [];
      followers.push(link.follower);
      leaderToFollowers.set(link.leader, followers);

      // Build follower -> link map
      followerToLink.set(link.follower, link);
    }

    return { leaderToFollowers, followerToLink };
  }, [links]);

  const getFollowers = useMemo(
    () => (leaderId: string): string[] => {
      return linkMaps.leaderToFollowers.get(leaderId) ?? [];
    },
    [linkMaps]
  );

  const isFollower = useMemo(
    () => (nodeId: string): boolean => {
      return linkMaps.followerToLink.has(nodeId);
    },
    [linkMaps]
  );

  const checkFollowerDrag = useMemo(
    () => (nodeId: string): FollowerDragDecision => {
      const link = linkMaps.followerToLink.get(nodeId);
      if (!link) {
        return 'allow';
      }

      if (onFollowerDragAttempt) {
        return onFollowerDragAttempt(link, nodeId);
      }

      return 'allow';
    },
    [linkMaps, onFollowerDragAttempt]
  );

  const getLeader = useMemo(
    () => (followerId: string): string | undefined => {
      const link = linkMaps.followerToLink.get(followerId);
      return link?.leader;
    },
    [linkMaps]
  );

  return {
    getFollowers,
    isFollower,
    checkFollowerDrag,
    getLeader,
  };
}
