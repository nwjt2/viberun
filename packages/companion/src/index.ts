#!/usr/bin/env node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { randomUUID } from 'node:crypto';
import { loadConfig } from './config.js';
import { makeProvider, usageMeterFor } from './model/index.js';
import { DEFAULT_RATE_LIMITS } from './model/rate-limit.js';
import { makeDeployProvider } from './deploy/index.js';
import { buildRegistry } from './jobs/handlers/index.js';
import { Runner } from './jobs/runner.js';
import { LocalJobQueue } from './queue/local.js';
import { startLocalServer } from './local-server.js';
import { logger } from './util/logger.js';
import { prune } from './prune.js';

async function runCommand() {
  const config = loadConfig();
  const provider = makeProvider(config, logger);
  const deploy = makeDeployProvider(config.deploy);
  const registry = buildRegistry();
  const deviceId = randomUUID();

  if (config.mode === 'local') {
    const queue = new LocalJobQueue();
    const defaults = DEFAULT_RATE_LIMITS[config.provider.kind] ?? null;
    const rateLimit =
      config.provider.kind === 'mock' || config.provider.kind === 'echo'
        ? undefined
        : {
            rpm: config.rateLimit?.rpm ?? defaults?.rpm,
            dailyLimit: config.rateLimit?.dailyLimit ?? defaults?.dailyLimit,
          };
    const usageMeter =
      config.provider.kind === 'mock' || config.provider.kind === 'echo'
        ? undefined
        : usageMeterFor(config);
    const server = startLocalServer({
      queue,
      port: config.localPort,
      workspacesDir: config.workspacesDir,
      logger,
      usageMeter,
      rateLimit,
      providerKind: config.provider.kind,
    });
    const runner = new Runner({ queue, registry, provider, deploy, logger, config, deviceId });
    const shutdown = async () => {
      runner.stop();
      await server.close();
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    await runner.start();
    return;
  }

  // Supabase mode — plumbing lives in packages/companion/src/queue/supabase.ts
  // but magic-link pairing lands in a later iteration. Use local mode with a
  // tunnel today; see docs/build_companion_setup.md.
  logger.error('supabase mode is wired but not yet active. Use VIBERUN_MODE=local + a tunnel. See docs/build_companion_setup.md');
  process.exit(1);
}

async function doctor() {
  const config = loadConfig();
  logger.info(
    { mode: config.mode, provider: config.provider.kind, deploy: config.deploy.kind, workspacesDir: config.workspacesDir },
    'config',
  );
  logger.info({ localPort: config.localPort }, 'listen port');
  if (config.provider.kind !== 'mock' && config.provider.kind !== 'echo') {
    const defaults = DEFAULT_RATE_LIMITS[config.provider.kind] ?? { rpm: 10, dailyLimit: 500 };
    const rpm = config.rateLimit?.rpm ?? defaults.rpm;
    const dailyLimit = config.rateLimit?.dailyLimit ?? defaults.dailyLimit;
    logger.info({ rpm, dailyLimit }, 'rate limits');
    try {
      const state = await usageMeterFor(config).snapshot();
      logger.info(
        { today: state.date, requests: state.count, cap: dailyLimit, remaining: Math.max(0, dailyLimit - state.count) },
        'usage today',
      );
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'could not read usage meter');
    }
  }
  if (config.provider.kind === 'gemini-cli') {
    logger.info({ command: config.provider.command }, 'checking gemini CLI');
    try {
      const { execa } = await import('execa');
      const result = await execa(config.provider.command, ['--help'], { reject: false });
      logger.info({ exitCode: result.exitCode }, 'gemini CLI present');
    } catch (err) {
      logger.error({ err: (err as Error).message }, 'gemini CLI not runnable');
    }
  }
  if (config.deploy.kind === 'firebase') {
    logger.info({ command: config.deploy.command, projectId: config.deploy.projectId }, 'checking firebase CLI');
    try {
      const { execa } = await import('execa');
      const result = await execa(config.deploy.command, ['--version'], { reject: false });
      logger.info({ exitCode: result.exitCode, version: result.stdout?.toString().trim() }, 'firebase CLI present');
    } catch (err) {
      logger.error({ err: (err as Error).message }, 'firebase CLI not runnable');
    }
  }
}

async function pruneCommand(argv: { days?: number; 'keep-failed'?: boolean }) {
  const config = loadConfig();
  const report = await prune(config, logger, {
    olderThanDays: argv.days ?? 14,
    keepFailed: argv['keep-failed'] ?? true,
  });
  logger.info(report, 'prune complete');
}

async function main() {
  await yargs(hideBin(process.argv))
    .scriptName('viberun-companion')
    .command('run', 'Start the companion daemon', {}, runCommand)
    .command('doctor', 'Print config + runtime diagnostics', {}, doctor)
    .command(
      'prune',
      'Delete old Supabase jobs/events (free-tier hygiene)',
      (y) =>
        y
          .option('days', { type: 'number', default: 14, describe: 'cutoff age in days' })
          .option('keep-failed', { type: 'boolean', default: true, describe: 'keep failed jobs' }),
      (argv) => pruneCommand(argv as { days?: number; 'keep-failed'?: boolean }),
    )
    .demandCommand(1)
    .strict()
    .help()
    .parseAsync();
}

main().catch((err) => {
  logger.error({ err: err instanceof Error ? err.stack : err }, 'fatal');
  process.exit(1);
});
