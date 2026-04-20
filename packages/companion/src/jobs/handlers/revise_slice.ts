import type { SliceArtifacts } from '@viberun/shared';
import { join } from 'node:path';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { run } from '../../util/shell.js';
import { commitSlice } from '../../workspaces/edit.js';
import { postFoundationPipeline, runValidationPipeline } from '../../validate/pipeline.js';
import type { JobHandler } from '../registry.js';

// revise_slice is a minimal first pass: given a revision transcript, record
// the user's feedback in a git-tracked notes file and commit. The user can
// inspect the note in the workspace and subsequent slice runs can reference
// it. Richer behavior (re-run the slice handler with transcript-derived
// parameters) lands when slice handlers consume sliceAnswers more fully.

export const reviseSlice: JobHandler<'revise_slice'> = {
  type: 'revise_slice',
  async run(input, ctx) {
    const workspaceDir = join(ctx.config.workspacesDir, input.projectId);
    try {
      await access(workspaceDir, constants.F_OK);
    } catch {
      throw new Error(`project workspace ${workspaceDir} not found — was the slice ever built?`);
    }

    const noteFile = `REVISIONS-${input.baseSlice}.md`;
    const timestamp = new Date().toISOString();
    const appendCmd = await run('bash', ['-lc', `cat >> ${noteFile}`], {
      cwd: workspaceDir,
      input: `\n## ${timestamp}\n\n${input.revisionTranscript}\n`,
    });
    if (appendCmd.exitCode !== 0) {
      throw new Error(`could not write revision note: ${appendCmd.stderr}`);
    }

    const sha = await commitSlice(
      workspaceDir,
      input.baseSlice,
      `revision note from user`,
    );

    await ctx.heartbeat();
    // Re-verify after the change (no-op for a pure doc append, but makes the
    // retry path uniform once we start actually mutating code on revise).
    const report = await runValidationPipeline(workspaceDir, ctx.logger, postFoundationPipeline());

    const artifacts: SliceArtifacts = {
      commitSha: sha ?? input.previousArtifacts.commitSha,
      filesWritten: [noteFile],
      summary: report.ok
        ? `Logged your feedback on ${input.baseSlice}. The full revise flow (auto-regenerate code from feedback) lands in iteration 3.`
        : `Logged your feedback but validation failed on "${report.steps.at(-1)?.name ?? 'unknown'}" — inspect ${noteFile}.`,
      whatYouCanDo: [`Open ${noteFile} in the workspace to see captured feedback`],
      whatRemains: input.previousArtifacts.whatRemains,
    };
    return artifacts;
  },
};
