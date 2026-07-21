import { appConfig } from '@/lib/config/app.config';
import { TechnicalLabel } from '@/components/ui/TechnicalLabel';

/** Colophon footer — set like the last line of a testing report. */
export function SiteFooter() {
  return (
    <footer className="mt-28 border-t border-seam">
      <div className="mx-auto grid w-full max-w-site gap-6 px-6 py-12 md:grid-cols-3 md:px-12">
        <p className="font-display text-base text-ink">{appConfig.name}</p>
        <TechnicalLabel crosshair>Mill archive · indexed &amp; searchable</TechnicalLabel>
        <TechnicalLabel className="md:text-right">© {new Date().getFullYear()} · internal use</TechnicalLabel>
      </div>
    </footer>
  );
}
