import { createClient } from '@supabase/supabase-js';
import type { CompanionConfig } from './config.js';
import type { Logger } from './util/logger.js';

// Supabase free tier includes 500MB of database. A busy Viberun user could
// accumulate thousands of done/failed jobs and conversation events over
// months. Prune keeps the tables small without manual SQL. Always run by
// the authenticated user; RLS scopes deletes to that user's own rows.

export interface PruneReport {
  jobsDeleted: number;
  eventsDeleted: number;
  slicesDeleted: number;
}

export interface PruneOptions {
  olderThanDays?: number;   // default 14
  keepFailed?: boolean;     // default true — keep failures for debugging
}

export async function prune(
  config: CompanionConfig,
  logger: Logger,
  opts: PruneOptions = {},
): Promise<PruneReport> {
  const olderThanDays = opts.olderThanDays ?? 14;
  const keepFailed = opts.keepFailed ?? true;

  if (config.mode !== 'supabase' || !config.supabase) {
    throw new Error('prune requires VIBERUN_MODE=supabase (the local queue is in-memory; no pruning needed).');
  }
  const supabase = createClient(config.supabase.url, config.supabase.anonKey);
  if (config.supabase.refreshToken) {
    // supabase-js v2: refresh the session before querying so auth.uid() works.
    const { error } = await supabase.auth.refreshSession({ refresh_token: config.supabase.refreshToken });
    if (error) throw new Error(`auth refresh failed: ${error.message}`);
  }

  const cutoff = new Date(Date.now() - olderThanDays * 86_400_000).toISOString();

  const jobs = await supabase
    .from('jobs')
    .delete({ count: 'exact' })
    .lt('created_at', cutoff)
    .in('status', keepFailed ? ['done'] : ['done', 'failed']);
  if (jobs.error) throw new Error(`prune jobs failed: ${jobs.error.message}`);

  const events = await supabase
    .from('conversation_events')
    .delete({ count: 'exact' })
    .lt('created_at', cutoff);
  if (events.error) throw new Error(`prune conversation_events failed: ${events.error.message}`);

  // Archived projects we leave alone unless the user has explicitly set a
  // longer cutoff; their slices/specs live under CASCADE.
  const slices = await supabase
    .from('slices')
    .delete({ count: 'exact' })
    .lt('updated_at', cutoff)
    .eq('status', 'failed');
  if (slices.error) throw new Error(`prune slices failed: ${slices.error.message}`);

  const report: PruneReport = {
    jobsDeleted: jobs.count ?? 0,
    eventsDeleted: events.count ?? 0,
    slicesDeleted: slices.count ?? 0,
  };
  logger.info(report, 'pruned');
  return report;
}
