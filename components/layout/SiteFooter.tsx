import { appConfig } from '@/lib/config/app.config';
import { whatsappLink } from '@/lib/contact';
import { TechnicalLabel } from '@/components/ui/TechnicalLabel';

/**
 * Colophon footer: the brand, how to reach TMS, and the copyright line.
 * Contact lines come from appConfig.contact; empty ones are left out.
 */
export function SiteFooter() {
  const { email, phone, address } = appConfig.contact;
  const whatsapp = whatsappLink();
  const link = 'text-sm text-ink underline decoration-seam underline-offset-4 hover:decoration-ink';

  return (
    <footer className="mt-28 border-t border-seam">
      <div className="mx-auto grid w-full max-w-site gap-8 px-6 py-12 md:grid-cols-3 md:px-12">
        <div>
          <p className="font-display text-base text-ink">{appConfig.name}</p>
          <p className="mt-2 max-w-xs text-xs leading-relaxed text-graphite">{appConfig.tagline}</p>
        </div>

        <address className="flex flex-col items-start gap-1.5 not-italic">
          <TechnicalLabel crosshair>Contact</TechnicalLabel>
          <a href={`mailto:${email}`} className={`mt-1 ${link}`}>{email}</a>
          {phone && <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className={link}>{phone}</a>}
          {whatsapp && <a href={whatsapp} target="_blank" rel="noreferrer" className={link}>WhatsApp</a>}
          {address && <p className="text-xs leading-relaxed text-graphite">{address}</p>}
        </address>

        <TechnicalLabel className="md:text-right">
          © {new Date().getFullYear()} {appConfig.brand.mark}
        </TechnicalLabel>
      </div>
    </footer>
  );
}
