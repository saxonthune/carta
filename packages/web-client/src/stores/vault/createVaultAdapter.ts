import type { VaultAdapter } from '@carta/schema';
import { config } from '../../config/featureFlags';
import { ServerVaultAdapter } from './ServerVaultAdapter';
import { LocalVaultAdapter } from './LocalVaultAdapter';

/**
 * Factory: creates the appropriate vault adapter based on deployment config.
 */
export function createVaultAdapter(): VaultAdapter {
  if (config.hasSync && config.syncUrl) {
    return new ServerVaultAdapter(config.syncUrl);
  }
  return new LocalVaultAdapter();
}
