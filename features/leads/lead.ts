import { z } from 'zod';
import { appConfig } from '@/lib/config/app.config';

/**
 * "Request swatches / price" for the fabrics in the cart: what a buyer
 * submits (validated by app/api/leads) and the email draft their mail app
 * opens with.
 */

export const LEAD_REQUESTS = { swatch: 'Swatch', price: 'Price', both: 'Swatch and price' } as const;
export type LeadRequest = keyof typeof LEAD_REQUESTS;

const optional = (max: number) =>
  z.string().trim().max(max).optional().transform((v) => (v ? v : undefined));

export const leadSchema = z.object({
  fabricIds: z.array(z.string().uuid()).min(1).max(appConfig.leads.maxCart),
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

export interface LeadFabric {
  code: string | null;
  name: string | null;
  mill: string | null;
  url: string;
}

/** mailto: link that opens the buyer's email app with the request written out. */
export function leadMailto(
  to: readonly string[],
  lead: Omit<LeadInput, 'fabricIds' | 'website'>,
  fabrics: LeadFabric[],
): string {
  const wants = { swatch: 'a swatch', price: 'pricing', both: 'a swatch and pricing' }[lead.request];
  const listed = fabrics.flatMap((fabric, i) => [
    `${i + 1}. ${[fabric.code ?? 'No code', fabric.name, fabric.mill].filter(Boolean).join(' — ')}`,
    `   ${fabric.url}`,
  ]);
  const body = [
    'Hello,',
    '',
    `I'd like ${wants} for ${fabrics.length === 1 ? 'this fabric' : `these ${fabrics.length} fabrics`}:`,
    ...listed,
    '',
    `Name: ${lead.name}`,
    lead.company && `Company: ${lead.company}`,
    lead.whatsapp && `WhatsApp: ${lead.whatsapp}`,
    `Email: ${lead.email}`,
    lead.message && ['', lead.message].join('\n'),
    '',
    'Thank you',
  ].filter((line): line is string => typeof line === 'string').join('\n');
  const what = fabrics.length === 1 ? fabrics[0].code ?? fabrics[0].name ?? 'fabric' : `${fabrics.length} fabrics`;
  const subject = `${LEAD_REQUESTS[lead.request]} request – ${what}`;
  return `mailto:${to.join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
