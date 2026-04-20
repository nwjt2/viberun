import { JobSchemas, type BaseSliceId } from '@viberun/shared';
import type { JobHandler } from '../registry.js';

// Each slice has at most a few specific follow-up questions. Keep them
// pre-defined and deterministic — the mobile UX wants 1–3-word answers, not
// free-form model questions.

type QuestionDef = { question: string; suggestedAnswers: string[] };

const SLICE_QUESTIONS: Partial<Record<BaseSliceId, QuestionDef[]>> = {
  foundation: [],
  data_model: [],
  core_screen: [],
  list_detail: [
    { question: 'Sort the list how?', suggestedAnswers: ['Newest first', 'Oldest first'] },
  ],
  create_edit: [],
  filter_search_favorites: [
    { question: 'Add favorites?', suggestedAnswers: ['Yes', 'No'] },
  ],
  owner_admin: [],
  polish_publish: [
    { question: 'Keep the dark theme?', suggestedAnswers: ['Yes', 'Go lighter'] },
  ],
};

export const askSliceSpecificQuestion: JobHandler<'ask_slice_specific_question'> = {
  type: 'ask_slice_specific_question',
  async run(input) {
    const questions = SLICE_QUESTIONS[input.baseSlice] ?? [];
    const answered = new Set(input.answeredQuestions.map((a) => a.question));
    const next = questions.find((q) => !answered.has(q.question));
    if (!next) {
      return JobSchemas.ask_slice_specific_question.output.parse({
        question: '',
        suggestedAnswers: [],
        done: true,
      });
    }
    return JobSchemas.ask_slice_specific_question.output.parse({
      question: next.question,
      suggestedAnswers: next.suggestedAnswers,
      done: false,
    });
  },
};
