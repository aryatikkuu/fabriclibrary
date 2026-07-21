export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="border border-reject/30 bg-reject/5 px-8 py-12 text-center">
      <p className="font-mono text-xs uppercase tracking-label text-reject">Something went wrong</p>
      <p className="mt-2 text-sm text-graphite">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 border border-ink px-4 py-2 text-xs uppercase tracking-label hover:bg-ink hover:text-paper"
        >
          Try again
        </button>
      )}
    </div>
  );
}
