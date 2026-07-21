import type { ReactNode } from 'react';

/** Shared max-width editorial container. */
export function EditorialLayout({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-site px-6 md:px-10">{children}</div>;
}
