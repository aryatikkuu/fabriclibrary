'use client';

import { useState } from 'react';
import { appConfig } from '@/lib/config/app.config';
import { leadMailto, type LeadRequest } from '@/features/leads/lead';
import { Reveal } from '@/components/ui/Reveal';

/** Short labels for the selector (the email says "Swatch and price" in full). */
const CHOICES: Record<LeadRequest, string> = { swatch: 'Swatch', price: 'Price', both: 'Both' };

interface FabricSummary {
  id: string;
  code: string | null;
  name: string | null;
  mill: string | null;
}

/**
 * "Request swatches / price" on a fabric page. The buyer fills in who they
 * are; the request is saved as a lead (POST /api/leads), then their email
 * app opens a pre-filled draft to appConfig.leads.email with the fabric code,
 * so they only have to press send. The draft opens even if saving fails.
 */
export function RequestSwatches({ fabric }: { fabric: FabricSummary }) {
  const [open, setOpen] = useState(false);
  const [request, setRequest] = useState<LeadRequest>('both');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mailto, setMailto] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? '').trim();
    const lead = {
      request,
      name: text('name'),
      email: text('email'),
      company: text('company') || undefined,
      whatsapp: text('whatsapp') || undefined,
      message: text('message') || undefined,
    };
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fabricId: fabric.id, website: text('website'), ...lead }),
      });
      // Invalid details: let them fix it. Anything else (limit, outage): still open the email.
      if (res.status === 400) throw new Error('Please check your name, email and WhatsApp number.');
      const link = leadMailto(appConfig.leads.email, lead, { ...fabric, url: window.location.href.split('?')[0] });
      setMailto(link);
      window.location.href = link;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-10">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="btn-technical w-full justify-center bg-ink py-3.5 text-paper hover:bg-paper hover:text-ink"
      >
        Request swatches / price
      </button>

      <Reveal show={open}>
        {mailto ? (
          <div className="mt-6 text-sm leading-relaxed text-graphite">
            <p className="font-display text-lg text-ink">Your email is ready — just press send.</p>
            <p className="mt-2">
              Nothing opened? <a href={mailto} className="text-ink underline underline-offset-4">Open the email again</a>,
              or write to <a href={`mailto:${appConfig.leads.email}`} className="text-ink underline underline-offset-4">{appConfig.leads.email}</a> quoting{' '}
              <span className="font-mono text-ink">{fabric.code ?? fabric.name}</span>.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
            <fieldset className="sm:col-span-2">
              <legend className="field-label">What do you need?</legend>
              <div className="mt-1 grid grid-cols-3 border border-seam">
                {(Object.keys(CHOICES) as LeadRequest[]).map((key) => (
                  <label
                    key={key}
                    className={`cursor-pointer border-seam py-2 text-center font-mono text-[10.5px] uppercase tracking-label transition-colors [&:not(:first-child)]:border-l ${
                      request === key ? 'bg-ink text-paper' : 'text-graphite hover:text-ink'
                    }`}
                  >
                    <input type="radio" name="request" value={key} checked={request === key} onChange={() => setRequest(key)} className="sr-only" />
                    {CHOICES[key]}
                  </label>
                ))}
              </div>
            </fieldset>
            <Field name="name" label="Name" required autoComplete="name" />
            <Field name="company" label="Company" autoComplete="organization" />
            <Field name="whatsapp" label="WhatsApp" type="tel" autoComplete="tel" placeholder="+94 77 123 4567" />
            <Field name="email" label="Email" type="email" required autoComplete="email" />
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="field-label">Message (optional)</span>
              <textarea name="message" rows={3} maxLength={1000} className="field h-auto py-2" />
            </label>
            {/* Honeypot: hidden from people; bots that fill it are ignored. */}
            <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0" />
            <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
              <button type="submit" disabled={busy} className="btn-technical bg-ink text-paper hover:opacity-85 disabled:opacity-50">
                {busy ? 'Saving…' : 'Write the email'}
              </button>
              <span className="text-xs text-stone">Opens your email app with the request ready to send.</span>
              {error && <span role="alert" className="basis-full text-sm text-thread">{error}</span>}
            </div>
          </form>
        )}
      </Reveal>
    </section>
  );
}

function Field({ label, ...input }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1">
      <span className="field-label">
        {label}
        {input.required && <span className="text-thread"> *</span>}
      </span>
      <input maxLength={input.type === 'email' ? 200 : 120} {...input} className="field" />
    </label>
  );
}
