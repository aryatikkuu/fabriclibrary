import type { ReactNode } from 'react';

/**
 * Animates its content open and shut (height + fade) by transitioning the grid
 * row from 0fr to 1fr. When shut it is also invisible, so nothing inside can
 * be tabbed to; the visibility change waits for the fade to finish.
 */
export function Reveal({ show, children }: { show: boolean; children: ReactNode }) {
  return (
    <div
      className={`grid transition-all duration-300 ease-out motion-reduce:transition-none ${
        show ? 'visible grid-rows-[1fr] opacity-100' : 'invisible grid-rows-[0fr] opacity-0'
      }`}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
