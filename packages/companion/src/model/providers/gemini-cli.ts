import { execa } from 'execa';
import type { ModelProvider } from '../provider.js';
import { ProviderError } from '../provider.js';

/**
 * Shells out to the Gemini CLI. Expects CLI to accept prompt on stdin and
 * emit JSON to stdout. Argv is user-configurable (defaults: `gemini --json`).
 * Actual CLI behavior varies by version; adjust `args` via config if needed.
 */
export function makeGeminiCliProvider(options: {
  command: string;
  args: string[];
}): ModelProvider {
  return {
    name: 'gemini-cli',
    supportsStreaming: false,
    async plan({ jobType, prompt, schema }) {
      try {
        const result = await execa(options.command, options.args, {
          input: prompt,
          timeout: 2 * 60_000,
          reject: false,
        });
        if (result.exitCode !== 0) {
          throw new ProviderError(
            `gemini CLI exited ${result.exitCode}: ${result.stderr?.toString() ?? ''}`,
          );
        }
        const stdout = result.stdout?.toString().trim() ?? '';
        const firstBrace = stdout.indexOf('{');
        const lastBrace = stdout.lastIndexOf('}');
        if (firstBrace === -1 || lastBrace === -1) {
          throw new ProviderError(`gemini CLI stdout did not contain JSON: ${stdout.slice(0, 200)}`);
        }
        const json = JSON.parse(stdout.slice(firstBrace, lastBrace + 1));
        const parsed = schema.safeParse(json);
        if (!parsed.success) {
          throw new ProviderError(
            `gemini CLI output did not match ${jobType} schema: ${parsed.error.message}`,
          );
        }
        return parsed.data;
      } catch (err) {
        if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') {
          throw new ProviderError(
            `gemini command not found. Install it and sign in with \`gemini auth login\`.`,
            err,
          );
        }
        if (err instanceof ProviderError) throw err;
        throw new ProviderError(`gemini CLI invocation failed: ${(err as Error).message}`, err);
      }
    },
  };
}
