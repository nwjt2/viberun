import type { DeployConfig, DeployProvider } from './provider.js';
import { makeLocalDeployProvider } from './providers/local.js';
import { makeFirebaseDeployProvider } from './providers/firebase.js';

export function makeDeployProvider(config: DeployConfig): DeployProvider {
  switch (config.kind) {
    case 'local':
      return makeLocalDeployProvider({ publicBaseUrl: config.publicBaseUrl });
    case 'firebase':
      return makeFirebaseDeployProvider({
        command: config.command,
        projectId: config.projectId,
        channelPrefix: config.channelPrefix,
        channelExpires: config.channelExpires,
      });
  }
}

export type { DeployProvider, DeployConfig, DeployResult } from './provider.js';
export { DeployError } from './provider.js';
