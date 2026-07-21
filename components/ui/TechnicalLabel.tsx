import type { ReactNode } from 'react';

/**
 * Tracked micro-mono metadata — the "garment tag" voice of the interface.
 * Optional crosshair (+) prefix for an instrument-panel feel.
 */
export function TechnicalLabel({
  children,
  crosshair = false,
  className = '',
}: {
  children: ReactNode;
  crosshair?: boolean;
  className?: string;
}) {
  return (
    <p className={`t-label ${className}`}>
      {crosshair && <span aria-hidden className="mr-2 text-thread">+</span>}
      {children}
    </p>
  );
}
