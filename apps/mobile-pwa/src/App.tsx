import { useEffect } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
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

export function App() {
  const hydrate = useStore((s) => s.hydrate);
  const onboardingDone = useStore((s) => s.onboardingDone);
  const pickedIdea = useStore((s) => s.pickedIdea);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Landing route. If the user has nothing in progress, go to idea pick. If
  // they do, the Resume screen offers continue vs start-new and routes onward.
  const start = !onboardingDone ? '/onboarding' : pickedIdea ? '/resume' : '/idea';

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
