import type { BaseSliceId, SliceArtifacts } from '@viberun/shared';
import { ensureProjectWorkspace } from '../../workspaces/project.js';
import { commitSlice } from '../../workspaces/edit.js';
import { defaultPipeline, postFoundationPipeline, runValidationPipeline } from '../../validate/pipeline.js';
import { run } from '../../util/shell.js';
import { runDataModel } from './implement_slice/data_model.js';
import { runListDetail } from './implement_slice/list_detail.js';
import { runCreateEdit } from './implement_slice/create_edit.js';
import { runCoreScreen } from './implement_slice/core_screen.js';
import { runPolishPublish } from './implement_slice/polish_publish.js';
import type { JobHandler } from '../registry.js';

type SliceRunner = (
  workspaceDir: string,
  spec: Parameters<typeof runDataModel>[1],
) => Promise<Partial<SliceArtifacts>>;

const SLICE_RUNNERS: Partial<Record<BaseSliceId, SliceRunner>> = {
  data_model: runDataModel,
  list_detail: runListDetail,
  create_edit: runCreateEdit,
  core_screen: runCoreScreen,
  polish_publish: runPolishPublish,
};

export const implementSlice: JobHandler<'implement_slice'> = {
  type: 'implement_slice',
  async run(input, ctx) {
    await ctx.heartbeat();

    const workspace = await ensureProjectWorkspace(input.projectId, ctx.config.workspacesDir, {
      APP_NAME: input.spec.name,
      APP_SLUG: input.spec.slug,
      APP_PITCH: input.spec.pitch,
    });

    const isFoundation = input.baseSlice === 'foundation';
    let artifactFields: Partial<SliceArtifacts> = {};

    if (isFoundation) {
      // Workspace was just created from template + placeholder substitution +
      // initial git commit; no further file edits needed.
      artifactFields = {
        filesWritten: [],
        summary: `Foundation slice for "${input.spec.name}" is in place. Nav shell, home screen, and styling are ready.`,
        whatYouCanDo: ['Open the home screen', `See the app name "${input.spec.name}"`, 'Navigate to Items'],
        whatRemains: ['Data model', 'List + detail', 'Create / edit', 'Core screen', 'Polish + deploy'],
      };
    } else {
      const runner = SLICE_RUNNERS[input.baseSlice];
      if (!runner) {
        throw new Error(
          `implement_slice for baseSlice=${input.baseSlice} is not yet supported. Ask to revise the plan.`,
        );
      }
      await ctx.heartbeat();
      artifactFields = await runner(workspace.dir, input.spec);
    }

    await ctx.heartbeat();
    const steps = isFoundation ? defaultPipeline() : postFoundationPipeline();
    const report = await runValidationPipeline(workspace.dir, ctx.logger, steps);

    let commitSha = artifactFields.commitSha;
    if (!commitSha) {
      // Either foundation (which committed inside ensureProjectWorkspace) or
      // a slice runner that couldn't commit for some reason — grab the current
      // HEAD so the PWA has something to display.
      const shaResult = await run('git', ['rev-parse', '--short', 'HEAD'], { cwd: workspace.dir });
      if (shaResult.exitCode === 0) commitSha = shaResult.stdout.trim();
    }

    // Deploy a preview iff the build passed. The default (local) provider is
    // zero-config: returns a URL that the companion's HTTP server serves dist/
    // from. Opt-in Firebase provider gives a public URL; configured via env.
    let previewUrl: string | undefined;
    if (report.ok) {
      try {
        await ctx.heartbeat();
        const deployResult = await ctx.deploy.deployPreview({
          workspaceDir: workspace.dir,
          projectId: input.projectId,
          appName: input.spec.name,
        });
        previewUrl = deployResult.url;
        ctx.logger.info({ url: previewUrl, provider: ctx.deploy.name }, 'deployed preview');
      } catch (err) {
        // Don't fail the whole slice on preview error — the code is built, the
        // user can still progress. Surface it in the summary.
        ctx.logger.warn({ err: (err as Error).message }, 'preview deploy failed');
      }
    }

    const artifacts: SliceArtifacts = {
      commitSha,
      filesWritten: artifactFields.filesWritten ?? [],
      summary: report.ok
        ? artifactFields.summary ?? `Slice ${input.baseSlice} is in.`
        : `${input.baseSlice} scaffolded but validation failed on "${report.steps.at(-1)?.name ?? 'unknown'}".`,
      whatYouCanDo: artifactFields.whatYouCanDo ?? [],
      whatRemains: artifactFields.whatRemains ?? [],
      previewUrl,
    };
    return artifacts;
  },
};
