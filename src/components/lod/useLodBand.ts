import { useStore } from '@xyflow/react';
import { getLodConfig, DEFAULT_LOD_POLICY, type LodBandConfig } from './lodPolicy';

// Selector returns discrete band string -> nodes only re-render on threshold crossing
const bandSelector = (state: { transform: [number, number, number] }) =>
  getLodConfig(state.transform[2]).band;

export function useLodBand(): LodBandConfig {
  const band = useStore(bandSelector);
  return DEFAULT_LOD_POLICY.find((c) => c.band === band)!;
}
