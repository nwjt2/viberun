import { JobSchemas } from '@viberun/shared';
import type { JobQueue } from '../queue/types.js';
import type { Registry } from './registry.js';
import type { Logger } from '../util/logger.js';
import type { ModelProvider } from '../model/provider.js';
import type { DeployProvider } from '../deploy/provider.js';
import type { CompanionConfig } from '../config.js';

export interface RunnerOptions {
  queue: JobQueue;
  registry: Registry;
  provider: ModelProvider;
  deploy: DeployProvider;
  logger: Logger;
  config: CompanionConfig;
  deviceId: string;
  pollIntervalMs?: number;
}

export class Runner {
  private shutdown = false;

  constructor(private readonly opts: RunnerOptions) {}

  stop() {
    this.shutdown = true;
  }

  async start(): Promise<void> {
    const { queue, registry, provider, deploy, logger, config, deviceId, pollIntervalMs = 500 } = this.opts;
    logger.info({ deviceId, mode: config.mode, provider: provider.name, deploy: deploy.name }, 'runner started');
    while (!this.shutdown) {
      const job = await queue.claimNext(deviceId);
      if (!job) {
        await new Promise((r) => setTimeout(r, pollIntervalMs));
        continue;
      }
      logger.info({ jobId: job.id, type: job.type }, 'claimed job');
      const handler = registry.get(job.type);
      if (!handler) {
        await queue.fail(job.id, `no handler registered for type=${job.type}`);
        continue;
      }
      const heartbeat = async () => {
        await queue.heartbeat(job.id).catch((err) => logger.warn({ err }, 'heartbeat failed'));
      };
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const input = JobSchemas[job.type].input.parse(job.payload) as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw = await (handler.run as any)(input, { provider, deploy, logger, config, heartbeat });
        const output = JobSchemas[job.type].output.parse(raw);
        await queue.complete(job.id, output);
        logger.info({ jobId: job.id, type: job.type }, 'job done');
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (job.retries < 1 && isRetryable(err)) {
          logger.warn({ jobId: job.id, err: message }, 'retryable error, requeueing');
          await queue.requeue(job.id, message);
        } else {
          logger.error({ jobId: job.id, err: message }, 'job failed');
          await queue.fail(job.id, message);
        }
      }
    }
    logger.info('runner shutdown complete');
  }
}

function isRetryable(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  // Timeouts + transient network errors — not validation/NotImplementedError.
  return msg.includes('timeout') || msg.includes('econnreset') || msg.includes('fetch failed');
}
