import { appConfig } from '@/lib/config/app.config';
import { TechnicalLabel } from '@/components/ui/TechnicalLabel';

/** Colophon footer: the brand, TMS's contact emails, and the copyright line. */
export function SiteFooter() {
  return (
    <footer className="mt-28 border-t border-seam">
      <div className="mx-auto grid w-full max-w-site gap-8 px-6 py-12 md:grid-cols-3 md:px-12">
        <div>
          <p className="font-display text-base text-ink">{appConfig.name}</p>
          <p className="mt-2 max-w-xs text-xs leading-relaxed text-graphite">{appConfig.tagline}</p>
        </div>

        <address className="flex flex-col items-start gap-1.5 not-italic">
          <TechnicalLabel crosshair>Contact</TechnicalLabel>
          {appConfig.contact.emails.map((email, i) => (
            <a
              key={email}
              href={`mailto:${email}`}
              className={`text-sm text-ink underline decoration-seam underline-offset-4 hover:decoration-ink ${i === 0 ? 'mt-1' : ''}`}
            >
              {email}
            </a>
          ))}
        </address>

        <TechnicalLabel className="md:text-right">
          © {new Date().getFullYear()} {appConfig.brand.mark}
        </TechnicalLabel>
      </div>
    </footer>
  );
}
