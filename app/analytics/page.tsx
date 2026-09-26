import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentProfile } from '@/lib/api-helpers';
import { roleCan } from '@/lib/config/roles.config';
import { formatDate } from '@/utils/format';
import { LEAD_REQUESTS, type LeadRequest } from '@/features/leads/lead';
import { EditorialLayout } from '@/components/layout/EditorialLayout';
import { PremiumPageHeader } from '@/components/ui/PremiumPageHeader';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { TechnicalLabel } from '@/components/ui/TechnicalLabel';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Analytics' };

const PERIODS = { '7': '7 days', '30': '30 days', all: 'All time' } as const;
type Period = keyof typeof PERIODS;

interface FabricStat {
  mill_slug: string; mill_name: string; fabric_id: string;
  fabric_code: string | null; fabric_name: string | null; views: number; requests: number;
}
interface Lead {
  id: string; created_at: string; fabric_id: string | null; fabric_code: string | null; request: LeadRequest;
  name: string; company: string | null; whatsapp: string | null; email: string; message: string | null;
  mills: { name: string } | null;
}

/**
 * Admin-only: fabric page views and swatch/price requests per mill, the
 * leads themselves, and photo-search use. Views and leads are readable only
 * by admins in the database too (migration 0011).
 */
export default async function AnalyticsPage({ searchParams }: { searchParams: { days?: string } }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  if (!roleCan(profile.role, 'analytics.read')) redirect('/');

  const period: Period = searchParams.days && searchParams.days in PERIODS ? (searchParams.days as Period) : '30';
  const since = period === 'all' ? null : new Date(Date.now() - Number(period) * 86_400_000).toISOString();

  const db = await createClient();
  let leadsQuery = db.from('leads')
    .select('id, created_at, fabric_id, fabric_code, request, name, company, whatsapp, email, message, mills(name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(200);
  if (since) leadsQuery = leadsQuery.gte('created_at', since);
  // look_searches has no RLS policies (server only), so its count is read with the service role.
  let searchesQuery = createAdminClient().from('look_searches').select('id', { count: 'exact', head: true });
  if (since) searchesQuery = searchesQuery.gte('created_at', since);

  const [stats, { rows: leads, total: totalLeads }, searches] = await Promise.all([
    db.rpc('fabric_analytics', { p_since: since }).then(({ data, error }) => { if (error) throw error; return (data ?? []) as FabricStat[]; }),
    leadsQuery.then(({ data, count, error }) => { if (error) throw error; return { rows: (data ?? []) as unknown as Lead[], total: count ?? 0 }; }),
    searchesQuery.then(({ count }) => count ?? 0),
  ]);

  const byMill = new Map<string, FabricStat[]>();
  for (const row of stats) byMill.set(row.mill_name, [...(byMill.get(row.mill_name) ?? []), row]);
  const totalViews = stats.reduce((n, r) => n + Number(r.views), 0);

  return (
    <EditorialLayout>
      <PremiumPageHeader
        eyebrow="Admin"
        title="Analytics"
        description="Which fabrics buyers look at and ask about. Views count each visitor once a day per fabric; staff and bots aren't counted."
        aside={
          <nav className="flex gap-4 font-mono text-[11px] uppercase tracking-label">
            {(Object.keys(PERIODS) as Period[]).map((key) => (
              <Link key={key} href={`/analytics?days=${key}`} className={key === period ? 'text-ink underline underline-offset-4' : 'text-stone hover:text-ink'}>
                {PERIODS[key]}
              </Link>
            ))}
          </nav>
        }
      />

      <dl className="mt-10 grid grid-cols-2 gap-6 border-b border-seam pb-10 md:grid-cols-4">
        <Figure label="Fabric views" value={totalViews} />
        <Figure label="Swatch / price requests" value={totalLeads} />
        <Figure label="Request rate" value={totalViews ? `${((totalLeads / totalViews) * 100).toFixed(1)}%` : '—'} />
        <Figure label="Photo searches" value={searches} />
      </dl>

      <section className="mt-16">
        <SectionHeading title="Requests" aside={<TechnicalLabel>{totalLeads} in {PERIODS[period].toLowerCase()}{totalLeads > leads.length ? ` · latest ${leads.length} shown` : ''}</TechnicalLabel>} />
        {leads.length === 0 ? (
          <p className="mt-6 text-sm text-graphite">No requests yet in this period.</p>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="field-label">
                <tr className="border-b border-ink">
                  {['Date', 'Fabric', 'Wants', 'Name', 'Company', 'WhatsApp', 'Email'].map((h) => <th key={h} className="py-2 pr-4 font-normal">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="border-b border-seam align-top">
                    <td className="py-3 pr-4 font-mono text-[11px] text-stone">{formatDate(lead.created_at)}</td>
                    <td className="py-3 pr-4">
                      {lead.fabric_id ? <Link href={`/fabrics/${lead.fabric_id}`} className="font-mono text-xs text-ink underline decoration-seam underline-offset-4 hover:decoration-ink">{lead.fabric_code ?? 'No code'}</Link> : <span className="font-mono text-xs text-stone">{lead.fabric_code ?? '—'}</span>}
                      {lead.mills && <div className="text-xs text-stone">{lead.mills.name}</div>}
                    </td>
                    <td className="py-3 pr-4 text-graphite">{LEAD_REQUESTS[lead.request]}</td>
                    <td className="py-3 pr-4 text-ink">
                      {lead.name}
                      {lead.message && <div className="mt-1 max-w-xs text-xs text-stone">{lead.message}</div>}
                    </td>
                    <td className="py-3 pr-4 text-graphite">{lead.company ?? '—'}</td>
                    <td className="py-3 pr-4">
                      {lead.whatsapp
                        ? <a href={`https://wa.me/${lead.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="text-ink underline decoration-seam underline-offset-4 hover:decoration-ink">{lead.whatsapp}</a>
                        : '—'}
                    </td>
                    <td className="py-3 pr-4"><a href={`mailto:${lead.email}`} className="text-ink underline decoration-seam underline-offset-4 hover:decoration-ink">{lead.email}</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {[...byMill].map(([mill, rows]) => (
        <section key={mill} className="mt-16">
          <SectionHeading
            title={mill}
            aside={<TechnicalLabel>{count(rows.reduce((n, r) => n + Number(r.views), 0), 'view')} · {count(rows.reduce((n, r) => n + Number(r.requests), 0), 'request')}</TechnicalLabel>}
          />
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="field-label">
                <tr className="border-b border-ink">
                  <th className="py-2 pr-4 font-normal">Fabric</th>
                  <th className="py-2 pr-4 text-right font-normal">Views</th>
                  <th className="py-2 text-right font-normal">Requests</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((row) => (
                  <tr key={row.fabric_id} className="border-b border-seam">
                    <td className="py-2.5 pr-4">
                      <Link href={`/fabrics/${row.fabric_id}`} className="font-mono text-xs text-ink underline decoration-seam underline-offset-4 hover:decoration-ink">{row.fabric_code ?? 'No code'}</Link>
                      {row.fabric_name && <span className="ml-3 text-graphite">{row.fabric_name}</span>}
                    </td>
                    <td className="py-2.5 pr-4 text-right font-mono text-xs text-ink">{row.views}</td>
                    <td className={`py-2.5 text-right font-mono text-xs ${Number(row.requests) > 0 ? 'text-thread' : 'text-stone'}`}>{row.requests}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 50 && <p className="mt-3 text-xs text-stone">Top 50 of {rows.length} fabrics with activity.</p>}
          </div>
        </section>
      ))}
      {byMill.size === 0 && <p className="mt-16 text-sm text-graphite">No fabric views yet in this period.</p>}
    </EditorialLayout>
  );
}

const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;

function Figure({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <dt className="t-label">{label}</dt>
      <dd className="mt-2 font-display text-4xl tracking-display text-ink">{value}</dd>
    </div>
  );
}
