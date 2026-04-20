import { execa, type Options } from 'execa';

export interface ShellResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function run(
  command: string,
  args: string[],
  options: Options = {},
): Promise<ShellResult> {
  const result = await execa(command, args, {
    reject: false,
    timeout: 5 * 60_000,
    ...options,
  });
  return {
    stdout: result.stdout?.toString() ?? '',
    stderr: result.stderr?.toString() ?? '',
    exitCode: result.exitCode ?? 0,
  };
}
