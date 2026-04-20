import { JobSchemas, type JobType } from '@viberun/shared';
import type { z } from 'zod';
import type { ModelProvider } from '../model/provider.js';
import type { DeployProvider } from '../deploy/provider.js';
import type { Logger } from '../util/logger.js';
import type { CompanionConfig } from '../config.js';

export interface JobContext {
  provider: ModelProvider;
  deploy: DeployProvider;
  logger: Logger;
  config: CompanionConfig;
  heartbeat: () => Promise<void>;
}

export type JobInput<T extends JobType> = z.infer<(typeof JobSchemas)[T]['input']>;
export type JobOutput<T extends JobType> = z.infer<(typeof JobSchemas)[T]['output']>;

export interface JobHandler<T extends JobType> {
  type: T;
  run(input: JobInput<T>, ctx: JobContext): Promise<JobOutput<T>>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHandler = JobHandler<any>;

export class Registry {
  private readonly handlers = new Map<JobType, AnyHandler>();

  register<T extends JobType>(handler: JobHandler<T>) {
    this.handlers.set(handler.type, handler);
  }

  get<T extends JobType>(type: T): JobHandler<T> | undefined {
    return this.handlers.get(type) as JobHandler<T> | undefined;
  }

  has(type: JobType): boolean {
    return this.handlers.has(type);
  }
}
