export function ErrorState({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div className="rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-200">
      Something went wrong: {message}
    </div>
  );
}
