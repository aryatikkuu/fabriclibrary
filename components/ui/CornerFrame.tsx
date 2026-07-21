import type { ReactNode } from 'react';

/**
 * Frames content with four corner marks, like registration marks on a
 * blueprint or the brackets on a spec sheet.
 *
 *   marks="bracket" — thin L-shaped corners (default)
 *   marks="cross"   — small + crosshairs
 */
export function CornerFrame({
  children,
  marks = 'bracket',
  className = '',
}: {
  children: ReactNode;
  marks?: 'bracket' | 'cross';
  className?: string;
}) {
  const corners = [
    'left-0 top-0 border-l border-t',
    'right-0 top-0 border-r border-t',
    'bottom-0 left-0 border-b border-l',
    'bottom-0 right-0 border-b border-r',
  ];
  const crossPositions = [
    '-left-1.5 -top-2.5',
    '-right-1.5 -top-2.5',
    '-bottom-2.5 -left-1.5',
    '-bottom-2.5 -right-1.5',
  ];

  return (
    <div className={`relative ${className}`}>
      {marks === 'bracket'
        ? corners.map((pos) => (
            <span key={pos} aria-hidden className={`absolute h-3.5 w-3.5 border-ink ${pos}`} />
          ))
        : crossPositions.map((pos) => (
            <span key={pos} aria-hidden className={`absolute select-none font-mono text-xs text-stone ${pos}`}>
              +
            </span>
          ))}
      {children}
    </div>
  );
}
