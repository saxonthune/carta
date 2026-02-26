export type PinDirection = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

/**
 * Pin constraint between two organizers.
 * Declares that sourceOrganizerId should be positioned relative to targetOrganizerId.
 */
export interface PinConstraint {
  id: string;
  sourceOrganizerId: string;
  targetOrganizerId: string;
  direction: PinDirection;
  gap?: number;
}
