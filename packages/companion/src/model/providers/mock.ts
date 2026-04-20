import { createHash } from 'node:crypto';
import type { ModelProvider } from '../provider.js';
import { ProviderError } from '../provider.js';

// Deterministic fixture provider: keyed by sha256(jobType + prompt). Lets us
// develop handlers in-container without Gemini CLI installed. Fixtures live
// inline here so there's no separate fixtures directory to keep in sync; when
// a handler needs a new fixture, add it to the `fixtures` table below.

type Fixture = {
  match: (jobType: string, prompt: string) => boolean;
  reply: (jobType: string, prompt: string) => unknown;
};

function promptContains(jobType: string, needles: string[]): Fixture['match'] {
  return (jt, prompt) => jt === jobType && needles.every((n) => prompt.toLowerCase().includes(n.toLowerCase()));
}

const SEED_IDEAS = [
  {
    id: 'read-tracker',
    title: 'Reading tracker',
    oneLiner: 'Track the books and articles you read, one tap at a time.',
    shape: 'record_tracker' as const,
    capabilities: ['landing', 'nav_shell', 'records', 'list', 'detail', 'create_edit', 'states'],
  },
  {
    id: 'habit-journal',
    title: 'Habit journal',
    oneLiner: 'Log daily habits with a swipe; see streaks at a glance.',
    shape: 'record_tracker' as const,
    capabilities: ['landing', 'nav_shell', 'records', 'dashboard', 'create_edit', 'states'],
  },
  {
    id: 'run-log',
    title: 'Run log',
    oneLiner: 'Record runs with distance and mood; browse the history.',
    shape: 'record_tracker' as const,
    capabilities: ['landing', 'nav_shell', 'records', 'list', 'detail', 'create_edit', 'states'],
  },
  {
    id: 'idea-inbox',
    title: 'Idea inbox',
    oneLiner: 'Capture ideas on the go; review them later.',
    shape: 'journal_checklist' as const,
    capabilities: ['landing', 'nav_shell', 'records', 'journal', 'create_edit', 'states'],
  },
];

const fixtures: Fixture[] = [
  {
    match: (jt) => jt === 'generate_idea_options',
    reply: (_jt, prompt) => {
      const excludeMatch = /"excludeIds":\s*\[([^\]]*)\]/.exec(prompt);
      const excluded = new Set(
        (excludeMatch?.[1] ?? '')
          .split(',')
          .map((s) => s.trim().replace(/"/g, ''))
          .filter(Boolean),
      );
      const countMatch = /"count":\s*(\d+)/.exec(prompt);
      const count = Math.max(1, Math.min(3, Number(countMatch?.[1] ?? 2)));
      const ideas = SEED_IDEAS.filter((idea) => !excluded.has(idea.id))
        .slice(0, count)
        .map((idea) => ({
          ...idea,
          scores: { usefulness: 0.85, buildability: 0.9, companionSafety: 0.95, freeInfraFit: 0.9, sliceability: 0.9 },
        }));
      return { options: ideas };
    },
  },
  {
    match: (jt) => jt === 'normalize_custom_idea',
    reply: (_jt, prompt) => {
      const transcriptMatch = /"transcript":\s*"([^"]+)"/.exec(prompt);
      const transcript = transcriptMatch?.[1] ?? 'an app';
      // Deterministic narrowing: map any custom idea to a record-tracker shape.
      return {
        id: `custom-${createHash('sha256').update(transcript).digest('hex').slice(0, 8)}`,
        title: transcript.split(/\s+/).slice(0, 3).join(' ').slice(0, 40) || 'My app',
        oneLiner: `A simple tracker based on: ${transcript.slice(0, 120)}`,
        shape: 'record_tracker',
        capabilities: ['landing', 'nav_shell', 'records', 'list', 'detail', 'create_edit', 'states'],
        scores: { usefulness: 0.8, buildability: 0.85, companionSafety: 0.9, freeInfraFit: 0.9, sliceability: 0.85 },
        originTranscript: transcript,
      };
    },
  },
  {
    match: (jt) => jt === 'ask_next_clarifying_question',
    reply: (_jt, prompt) => {
      // Progress based on how many questions have already been answered.
      // The PWA appends each answer to `answeredQuestions` but doesn't merge
      // into draftSpec until draft_high_level_spec runs, so tracking progress
      // by the answers array is the only reliable signal.
      const answeredMatch = /"answeredQuestions":\s*\[([\s\S]*?)\]\s*[,}]/.exec(prompt);
      const answered = answeredMatch?.[1] ?? '';
      const numAnswered = (answered.match(/"question"\s*:/g) ?? []).length;
      if (numAnswered < 1) {
        return {
          question: 'What should we call this app?',
          suggestedAnswers: [],
          done: false,
        };
      }
      if (numAnswered < 2) {
        return {
          question: 'What is the main thing you want to track?',
          suggestedAnswers: ['Reads', 'Runs'],
          done: false,
        };
      }
      return { question: '', suggestedAnswers: [], done: true };
    },
  },
  {
    match: (jt) => jt === 'draft_high_level_spec',
    reply: (_jt, prompt) => {
      const nameMatch = /"title":\s*"([^"]+)"/.exec(prompt);
      const name = (nameMatch?.[1] ?? 'My app').slice(0, 40);
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 30) || 'my-app';
      return {
        name,
        slug,
        pitch: `A simple tracker — ${name}.`,
        shape: 'record_tracker',
        capabilities: ['landing', 'nav_shell', 'records', 'list', 'detail', 'create_edit', 'states'],
        entities: [
          {
            name: 'Entry',
            fields: [
              { name: 'title', type: 'text', required: true, label: 'Title' },
              { name: 'notes', type: 'longtext', required: false, label: 'Notes' },
              { name: 'loggedAt', type: 'date', required: true, label: 'Logged at' },
            ],
          },
        ],
        userRoles: ['owner'],
        constraints: [],
      };
    },
  },
  {
    match: (jt) => jt === 'revise_high_level_spec',
    reply: (_jt, prompt) => {
      // Return the previous spec unchanged for determinism.
      const prev = /"previousSpec":\s*(\{[\s\S]*?\})\s*,\s*"revisionTranscript"/.exec(prompt);
      if (prev?.[1]) {
        try {
          return JSON.parse(prev[1]);
        } catch {
          // fall through
        }
      }
      throw new ProviderError('mock revise_high_level_spec could not parse previousSpec');
    },
  },
  {
    match: (jt) => jt === 'draft_slice_plan',
    reply: (_jt) => {
      // Deterministic default plan — handler overrides with slicesForCapabilities.
      return {
        slices: [
          { id: 'slice-foundation', baseSlice: 'foundation', title: 'Foundation', blurb: 'Shell + home', status: 'pending', dependsOn: [] },
          { id: 'slice-data_model', baseSlice: 'data_model', title: 'Data model', blurb: 'Entity', status: 'pending', dependsOn: ['slice-foundation'] },
          { id: 'slice-list_detail', baseSlice: 'list_detail', title: 'List + detail', blurb: 'Browse', status: 'pending', dependsOn: ['slice-data_model'] },
          { id: 'slice-create_edit', baseSlice: 'create_edit', title: 'Create / edit', blurb: 'Add entries', status: 'pending', dependsOn: ['slice-data_model'] },
          { id: 'slice-polish_publish', baseSlice: 'polish_publish', title: 'Polish', blurb: 'States + deploy', status: 'pending', dependsOn: ['slice-foundation'] },
        ],
      };
    },
  },
  {
    match: promptContains('revise_slice_plan', []),
    reply: (_jt, prompt) => {
      const prev = /"previousPlan":\s*(\{[\s\S]*?\})\s*,\s*"revisionTranscript"/.exec(prompt);
      if (prev?.[1]) {
        try {
          return JSON.parse(prev[1]);
        } catch {
          // fall through
        }
      }
      throw new ProviderError('mock revise_slice_plan could not parse previousPlan');
    },
  },
  {
    match: (jt) => jt === 'finalize_app_summary',
    reply: (_jt, prompt) => {
      const nameMatch = /"name":\s*"([^"]+)"/.exec(prompt);
      const name = nameMatch?.[1] ?? 'your app';
      return {
        summary: `${name} is ready. Foundation and the first slice are in place.`,
        whatYouCanDo: ['Open the home screen', 'Browse your entries'],
      };
    },
  },
];

export const mockProvider: ModelProvider = {
  name: 'mock',
  supportsStreaming: false,
  async plan({ jobType, prompt, schema }) {
    const fixture = fixtures.find((f) => f.match(jobType, prompt));
    if (!fixture) {
      throw new ProviderError(`mock provider has no fixture for jobType=${jobType}`);
    }
    const raw = fixture.reply(jobType, prompt);
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      throw new ProviderError(
        `mock provider fixture for ${jobType} did not match schema: ${parsed.error.message}`,
      );
    }
    return parsed.data;
  },
};
