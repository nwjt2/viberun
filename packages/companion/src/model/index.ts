import { join } from 'node:path';
import type { CompanionConfig, ProviderConfig } from '../config.js';
import type { ModelProvider } from './provider.js';
import { mockProvider } from './providers/mock.js';
import { echoProvider } from './providers/echo.js';
import { makeGeminiCliProvider } from './providers/gemini-cli.js';
import {
  makeRateLimitedProvider,
  DEFAULT_RATE_LIMITS,
  UsageMeter,
} from './rate-limit.js';
import type { Logger } from '../util/logger.js';

function makeInnerProvider(config: ProviderConfig): ModelProvider {
  switch (config.kind) {
    case 'mock':
      return mockProvider;
    case 'echo':
      return echoProvider;
    case 'gemini-cli':
      return makeGeminiCliProvider({ command: config.command, args: config.args });
  }
}

/**
 * Factory that wraps the inner provider with rate-limit + quota guardrails
 * when it targets a real metered API (today: gemini-cli only). mock/echo
 * skip the wrap since they have no external quota.
 */
export function makeProvider(companion: CompanionConfig, logger: Logger): ModelProvider {
  const inner = makeInnerProvider(companion.provider);
  const kind = companion.provider.kind;
  if (kind === 'mock' || kind === 'echo') return inner;

  const defaults = DEFAULT_RATE_LIMITS[kind] ?? { rpm: 10, dailyLimit: 500 };
  const rpm = companion.rateLimit?.rpm ?? defaults.rpm;
  const dailyLimit = companion.rateLimit?.dailyLimit ?? defaults.dailyLimit;
  const meterPath = companion.rateLimit?.meterPath ?? join(companion.workspacesDir, '..', 'usage.json');

  return makeRateLimitedProvider(
    inner,
    { rpm, dailyLimit, meterPath },
    logger,
  );
}

export function usageMeterFor(companion: CompanionConfig): UsageMeter {
  const meterPath = companion.rateLimit?.meterPath ?? join(companion.workspacesDir, '..', 'usage.json');
  return new UsageMeter(meterPath);
}

export type { ModelProvider } from './provider.js';
