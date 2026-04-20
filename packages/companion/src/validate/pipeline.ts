import { run } from '../util/shell.js';
import type { Logger } from '../util/logger.js';

export interface ValidationStep {
  name: string;
  command: string;
  args: string[];
  // A step is optional if missing tooling shouldn't fail the slice. We use
  // this for lint (not every template has eslint) and tests (smoke-test
  // templates don't need them).
  optional?: boolean;
}

export interface ValidationReport {
  ok: boolean;
  steps: Array<{ name: string; exitCode: number; stderr: string; stdout: string; skipped?: boolean }>;
}

export async function runValidationPipeline(
  cwd: string,
  logger: Logger,
  steps: ValidationStep[],
): Promise<ValidationReport> {
  const report: ValidationReport = { ok: true, steps: [] };
  for (const step of steps) {
    logger.info({ step: step.name }, 'validate');
    const result = await run(step.command, step.args, { cwd });
    const failed = result.exitCode !== 0;
    report.steps.push({
      name: step.name,
      exitCode: result.exitCode,
      stderr: result.stderr.slice(-2000),
      stdout: result.stdout.slice(-500),
    });
    if (failed && !step.optional) {
      report.ok = false;
      logger.warn({ step: step.name, exitCode: result.exitCode }, 'validation step failed');
      break;
    }
  }
  return report;
}

// Default pipeline for a React/Vite/TS/Tailwind slice.
export function defaultPipeline(): ValidationStep[] {
  return [
    { name: 'install', command: 'npm', args: ['install', '--no-audit', '--no-fund', '--silent'] },
    { name: 'typecheck', command: 'npm', args: ['run', 'typecheck', '--silent'] },
    { name: 'build', command: 'npm', args: ['run', 'build', '--silent'] },
  ];
}

// Pipeline for slices after foundation — node_modules already exists, so we
// skip install and just re-verify.
export function postFoundationPipeline(): ValidationStep[] {
  return [
    { name: 'typecheck', command: 'npm', args: ['run', 'typecheck', '--silent'] },
    { name: 'build', command: 'npm', args: ['run', 'build', '--silent'] },
  ];
}
