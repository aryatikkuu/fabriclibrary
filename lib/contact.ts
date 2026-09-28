import { appConfig } from '@/lib/config/app.config';

/**
 * WhatsApp chat link to TMS (wa.me), optionally with a message typed in.
 * null when no WhatsApp number is configured, so callers can hide the link.
 */
export function whatsappLink(text?: string): string | null {
  const number = appConfig.contact.whatsapp.replace(/\D/g, '');
  if (!number) return null;
  return `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}
