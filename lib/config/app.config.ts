/**
 * Application-level configuration. Branding and global behaviour live here —
 * never inside components or services.
 */
export const appConfig = {
  /** Browser tab, login button and emails. */
  name: 'TMS Textile Library',
  /** Header wordmark: the brand, then what the site is. */
  brand: { mark: 'TMS', product: 'Textile Library' },
  /** 'ivory' (warm cream, default) or 'midnight' (dark archive). */
  theme: process.env.NEXT_PUBLIC_THEME ?? 'ivory',
  tagline: 'Fabrics from our partner mills — find one by photo, code or colour, and request swatches or prices.',
  /**
   * TMS contact details — the footer, the fabric page's WhatsApp link and
   * swatch/price requests all read them from here. Leave a field empty to
   * hide it (except email, which requests are sent to).
   */
  contact: {
    email: 'pashantikku@gmail.com',
    phone: '' as string,
    /** International format, digits only (e.g. 94771234567) — used for wa.me links. */
    whatsapp: '' as string,
    address: '' as string,
  },
  /** Records below this AI confidence (0–100) are flagged for human review. */
  aiConfidenceThreshold: Number(process.env.AI_CONFIDENCE_THRESHOLD ?? 75),
  storage: {
    bucket: process.env.STORAGE_BUCKET_NAME ?? 'textile-library',
  },
  /**
   * "Request swatches / price" (components/fabrics/RequestSwatches.tsx):
   * the buyer's email app opens a pre-filled draft to contact.email, and the
   * request is also saved as a lead (analytics page).
   */
  leads: {
    /** Requests one visitor can save per rolling 24 hours (spam guard). */
    perVisitorPerDay: 10,
  },
  pagination: {
    defaultPageSize: 24,
    maxPageSize: 100,
  },
} as const;

/**
 * Home page picks (FabricRepository.findShowcaseCandidates): complete,
 * approved fabrics that also have every field below and an AI reading at
 * least this confident, shared out across the mills.
 */
export const showcase = {
  minConfidence: 85,
  requiredFields: ['fabric_name', 'fabric_type', 'color'],
  /** How many top candidates to choose from — enough that every mill's best are in the pool. */
  candidates: 200,
  featured: 8,
  recent: 4,
} as const;
