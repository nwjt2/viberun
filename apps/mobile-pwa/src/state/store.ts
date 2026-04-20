import { create } from 'zustand';
import type { BaseSliceId, Idea, Spec, SlicePlan, SliceArtifacts } from '@viberun/shared';
import { loadProgress, saveProgress, clearProgress } from '../lib/progress';

export interface OnboardingHint {
  background: string;
  appInterests: string[];
}

export type QAPair = { question: string; answer: string };

export interface AppState {
  onboarding: OnboardingHint;
  onboardingDone: boolean;
  projectId: string | null;
  pickedIdea: Idea | null;
  answers: QAPair[];
  draftSpec: Spec | null;
  acceptedSpec: Spec | null;
  slicePlan: SlicePlan | null;
  acceptedSlicePlan: SlicePlan | null;
  completedSliceIds: string[];
  lastSliceArtifacts: SliceArtifacts | null;
  // Slice-specific Q&A history, keyed by base slice id. Populated by
  // SliceQuestions and consumed by SliceBuild (implement_slice payload).
  sliceAnswersByBase: Partial<Record<BaseSliceId, QAPair[]>>;
  muted: boolean;
}

const initialState: AppState = {
  onboarding: { background: '', appInterests: [] },
  onboardingDone: false,
  projectId: null,
  pickedIdea: null,
  answers: [],
  draftSpec: null,
  acceptedSpec: null,
  slicePlan: null,
  acceptedSlicePlan: null,
  completedSliceIds: [],
  lastSliceArtifacts: null,
  sliceAnswersByBase: {},
  muted: false,
};

interface StoreActions {
  hydrate(): void;
  reset(): void;
  setOnboarding(next: OnboardingHint, done: boolean): void;
  setIdea(idea: Idea, projectId: string): void;
  addAnswer(question: string, answer: string): void;
  setDraftSpec(spec: Spec): void;
  acceptSpec(): void;
  setSlicePlan(plan: SlicePlan): void;
  acceptSlicePlan(): void;
  markSliceDone(sliceId: string, artifacts: SliceArtifacts): void;
  setSliceAnswer(baseSlice: BaseSliceId, question: string, answer: string): void;
  setMuted(muted: boolean): void;
}

export const useStore = create<AppState & StoreActions>((set, get) => ({
  ...initialState,
  hydrate() {
    const saved = loadProgress<Partial<AppState>>();
    if (saved) set({ ...initialState, ...saved });
  },
  reset() {
    clearProgress();
    set({ ...initialState });
  },
  setOnboarding(onboarding, done) {
    set({ onboarding, onboardingDone: done });
    saveProgress(get());
  },
  setIdea(idea, projectId) {
    set({ pickedIdea: idea, projectId, answers: [] });
    saveProgress(get());
  },
  addAnswer(question, answer) {
    set({ answers: [...get().answers, { question, answer }] });
    saveProgress(get());
  },
  setDraftSpec(spec) {
    set({ draftSpec: spec });
    saveProgress(get());
  },
  acceptSpec() {
    const draft = get().draftSpec;
    if (!draft) return;
    set({ acceptedSpec: draft });
    saveProgress(get());
  },
  setSlicePlan(plan) {
    set({ slicePlan: plan });
    saveProgress(get());
  },
  acceptSlicePlan() {
    const plan = get().slicePlan;
    if (!plan) return;
    set({ acceptedSlicePlan: plan });
    saveProgress(get());
  },
  markSliceDone(sliceId, artifacts) {
    set({
      completedSliceIds: [...get().completedSliceIds, sliceId],
      lastSliceArtifacts: artifacts,
    });
    saveProgress(get());
  },
  setSliceAnswer(baseSlice, question, answer) {
    const existing = get().sliceAnswersByBase[baseSlice] ?? [];
    const next = [...existing, { question, answer }];
    set({ sliceAnswersByBase: { ...get().sliceAnswersByBase, [baseSlice]: next } });
    saveProgress(get());
  },
  setMuted(muted) {
    set({ muted });
    saveProgress(get());
  },
}));
