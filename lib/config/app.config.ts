/**
 * Application-level configuration. Branding and global behaviour live here —
 * never inside components or services.
 */
export const appConfig = {
  name: process.env.NEXT_PUBLIC_APP_NAME ?? 'Digital Textile Library',
  /** 'ivory' (warm cream, default) or 'midnight' (dark archive). */
  theme: process.env.NEXT_PUBLIC_THEME ?? 'ivory',
  tagline: 'A working archive of mill fabrics — read, indexed and searchable.',
  company: {
    name: 'Digital Textile Library',
    logoPath: '/logo.svg',
  },
  /** Records below this AI confidence (0–100) are flagged for human review. */
  aiConfidenceThreshold: Number(process.env.AI_CONFIDENCE_THRESHOLD ?? 75),
  storage: {
    bucket: process.env.STORAGE_BUCKET_NAME ?? 'textile-library',
  },
  /**
   * "Request swatches / price" (components/fabrics/RequestSwatches.tsx):
   * the buyer's email app opens a pre-filled draft to this address, and the
   * request is also saved as a lead (analytics page).
   */
  leads: {
    email: 'pashantikku@gmail.com',
    /** Requests one visitor can save per rolling 24 hours (spam guard). */
    perVisitorPerDay: 10,
  },
  pagination: {
    defaultPageSize: 24,
    maxPageSize: 100,
  },
} as const;
