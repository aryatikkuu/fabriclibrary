import { z } from 'zod';

/**
 * "Request swatches / price": what a buyer submits (validated by
 * app/api/leads) and the email draft their mail app opens with.
 */

export const LEAD_REQUESTS = { swatch: 'Swatch', price: 'Price', both: 'Swatch and price' } as const;
export type LeadRequest = keyof typeof LEAD_REQUESTS;

const optional = (max: number) =>
  z.string().trim().max(max).optional().transform((v) => (v ? v : undefined));

export const leadSchema = z.object({
  fabricId: z.string().uuid(),
  request: z.enum(['swatch', 'price', 'both']),
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(200),
  company: optional(120),
  whatsapp: optional(24).refine((v) => !v || /^\+?[\d\s()-]{6,24}$/.test(v), 'Enter a phone number'),
  message: optional(1000),
  /** Honeypot: hidden from people, filled in by bots. The API quietly drops these. */
  website: z.string().max(200).optional(),
});
export type LeadInput = z.infer<typeof leadSchema>;

/** mailto: link that opens the buyer's email app with the request written out. */
export function leadMailto(to: string, lead: Omit<LeadInput, 'fabricId' | 'website'>, fabric: {
  code: string | null; name: string | null; mill: string | null; url: string;
}): string {
  const label = fabric.code ?? fabric.name ?? 'fabric';
  const wants = { swatch: 'a swatch', price: 'pricing', both: 'a swatch and pricing' }[lead.request];
  const body = [
    'Hello,',
    '',
    `I'd like ${wants} for this fabric:`,
    `Code: ${fabric.code ?? '—'}`,
    fabric.name && `Name: ${fabric.name}`,
    fabric.mill && `Mill: ${fabric.mill}`,
    `Link: ${fabric.url}`,
    '',
    `Name: ${lead.name}`,
    lead.company && `Company: ${lead.company}`,
    lead.whatsapp && `WhatsApp: ${lead.whatsapp}`,
    `Email: ${lead.email}`,
    lead.message && ['', lead.message].join('\n'),
    '',
    'Thank you',
  ].filter((line): line is string => typeof line === 'string').join('\n');
  const subject = `${LEAD_REQUESTS[lead.request]} request – ${label}`;
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
