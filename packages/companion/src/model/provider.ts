import type { z } from 'zod';

// The primary paid-upgrade seam. Adding a new provider (Claude, OpenAI,
// Ollama) is a new file in providers/ + an entry in index.ts. Handlers only
// depend on this interface.
export interface ModelProvider {
  readonly name: string;
  readonly supportsStreaming: boolean;
  /**
   * Generates a structured JSON response and parses it against the given
   * schema. Throws if the model output cannot be parsed.
   */
  plan<T>(args: {
    jobType: string;
    prompt: string;
    schema: z.ZodType<T>;
  }): Promise<T>;
}

export class ProviderError extends Error {
  readonly originalError?: unknown;
  constructor(message: string, originalError?: unknown) {
    super(message);
    this.name = 'ProviderError';
    this.originalError = originalError;
  }
}
