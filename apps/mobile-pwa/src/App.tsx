import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useStore } from './state/store';
import { Onboarding } from './screens/Onboarding';
import { Resume } from './screens/Resume';
import { IdeaPick } from './screens/IdeaPick';
import { FollowUp } from './screens/FollowUp';
import { SpecReview } from './screens/SpecReview';
import { SlicePlanReview } from './screens/SlicePlanReview';
import { SliceBuild } from './screens/SliceBuild';
import { SliceQuestions } from './screens/SliceQuestions';
import { SliceReview } from './screens/SliceReview';
import { CompanionStatus } from './screens/CompanionStatus';
import { SpeakerToggle } from './components/SpeakerToggle';
import { companionAlive } from './lib/jobs';
import { localMode } from './lib/supabase';

// Routes that require the companion to be reachable before they can do
// anything useful (they enqueue jobs or poll results). Onboarding, Resume,
// and the Status screen itself don't need it.
const NEEDS_COMPANION = /^\/(idea|followup|spec|plan|build|slice|questions)(\/|$)/;

export function App() {
  const hydrate = useStore((s) => s.hydrate);
  const onboardingDone = useStore((s) => s.onboardingDone);
  const pickedIdea = useStore((s) => s.pickedIdea);
  const location = useLocation();
  const [companionReachable, setCompanionReachable] = useState<boolean | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    let cancelled = false;
    if (!localMode) {
      setCompanionReachable(true); // supabase mode: auth handles reachability differently
      return;
    }
    void companionAlive().then((ok) => {
      if (!cancelled) setCompanionReachable(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  const start = !onboardingDone ? '/onboarding' : pickedIdea ? '/resume' : '/idea';

  // Gate: if the target route requires the companion but it's unreachable,
  // bounce to /status with a returnTo so the user can configure it and come
  // back seamlessly.
  const needs = NEEDS_COMPANION.test(location.pathname);
  if (localMode && needs && companionReachable === false) {
    return (
      <Navigate
        to={`/status?returnTo=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    );
  }

  return (
    <div className="min-h-dvh flex flex-col">
      <Header />
      <main className="flex-1 w-full max-w-xl mx-auto px-5 py-6 space-y-6">
        <Routes>
          <Route path="/" element={<Navigate to={start} replace />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/resume" element={<Resume />} />
          <Route path="/idea" element={<IdeaPick />} />
          <Route path="/followup" element={<FollowUp />} />
          <Route path="/spec" element={<SpecReview />} />
          <Route path="/plan" element={<SlicePlanReview />} />
          <Route path="/questions/:baseSlice" element={<SliceQuestions />} />
          <Route path="/build/:baseSlice" element={<SliceBuild />} />
          <Route path="/slice" element={<SliceReview />} />
          <Route path="/status" element={<CompanionStatus />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}

function Header() {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
      <div className="max-w-xl mx-auto flex items-center gap-3 px-5 py-3">
        <button onClick={() => navigate('/status')} className="text-lg font-semibold">
          Viberun
        </button>
        <div className="ml-auto">
          <SpeakerToggle />
        </div>
      </div>
    </header>
  );
}

function NotFound() {
  return <p className="text-slate-400">Not found.</p>;
}
