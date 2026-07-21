export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-stone" role="status">
      <span className="h-2 w-2 animate-pulse rounded-full bg-stone" aria-hidden />
      <span className="font-mono text-xs uppercase tracking-label">{label}</span>
    </div>
  );
}
