import type { ModelProvider } from '../provider.js';
import { ProviderError } from '../provider.js';

/**
 * Trivial smoke-test provider. Does not satisfy most job types. Useful only
 * for verifying wiring (claim → dispatch → complete) without model logic.
 */
export const echoProvider: ModelProvider = {
  name: 'echo',
  supportsStreaming: false,
  async plan() {
    throw new ProviderError(
      'echo provider cannot serve structured planning — pick mock or gemini-cli',
    );
  },
};
