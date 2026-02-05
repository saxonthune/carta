import type { DocumentAdapter } from '@carta/domain';
import { starter } from './starter';
import { saas } from './saas';
import { kitchenSink } from './kitchen-sink';

export type SeedFn = (adapter: DocumentAdapter) => void;

export const seeds: Record<string, SeedFn> = {
  starter,
  saas,
  'kitchen-sink': kitchenSink,
};
