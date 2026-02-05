import type { VaultAdapter } from '@carta/domain';
import { config } from '../../config/featureFlags';
import { ServerVaultAdapter } from './ServerVaultAdapter';
import { LocalVaultAdapter } from './LocalVaultAdapter';
import { DesktopVaultAdapter } from './DesktopVaultAdapter';

/**
 * Factory: creates the appropriate vault adapter based on deployment config.
 */
export function createVaultAdapter(): VaultAdapter {
  if (config.isDesktop && window.electronAPI) {
    return new DesktopVaultAdapter(config.serverUrl!, window.electronAPI);
  }
  if (config.hasServer && config.serverUrl) {
    return new ServerVaultAdapter(config.serverUrl);
  }
  return new LocalVaultAdapter();
}
