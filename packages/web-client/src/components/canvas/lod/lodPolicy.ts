export type LodBand = 'pill' | 'normal';

export interface LodBandConfig {
  band: LodBand;
  minZoom: number; // inclusive
  maxZoom: number; // exclusive
}

export const DEFAULT_LOD_POLICY: LodBandConfig[] = [
  { band: 'pill', minZoom: 0, maxZoom: 0.5 },
  { band: 'normal', minZoom: 0.5, maxZoom: Infinity },
];

export function getLodConfig(zoom: number, policy = DEFAULT_LOD_POLICY): LodBandConfig {
  return policy.find((c) => zoom >= c.minZoom && zoom < c.maxZoom) ?? policy[policy.length - 1];
}
