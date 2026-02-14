import type { DocumentAdapter } from '@carta/domain';
import { starter } from './starter';
import { saas } from './saas';
import { kitchenSink } from './kitchen-sink';
import { perf150 } from './perf-150';

export type SeedFn = (adapter: DocumentAdapter) => void;

export const seeds: Record<string, SeedFn> = {
  starter,
  saas,
  'kitchen-sink': kitchenSink,
  'perf-150': perf150,
};
