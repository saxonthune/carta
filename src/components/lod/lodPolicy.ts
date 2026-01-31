export type LodBand = 'pill' | 'compact' | 'normal';

export interface LodBandConfig {
  band: LodBand;
  minZoom: number; // inclusive
  maxZoom: number; // exclusive
  showFields: boolean; // show showInMinimalDisplay fields
  showHeader: boolean; // show drag handle header bar
}

export const DEFAULT_LOD_POLICY: LodBandConfig[] = [
  { band: 'pill', minZoom: 0, maxZoom: 0.3, showFields: false, showHeader: false },
  { band: 'compact', minZoom: 0.3, maxZoom: 0.6, showFields: false, showHeader: true },
  { band: 'normal', minZoom: 0.6, maxZoom: Infinity, showFields: true, showHeader: true },
];

export function getLodConfig(zoom: number, policy = DEFAULT_LOD_POLICY): LodBandConfig {
  return policy.find((c) => zoom >= c.minZoom && zoom < c.maxZoom) ?? policy[policy.length - 1];
}
