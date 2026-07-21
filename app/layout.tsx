import type { Metadata } from 'next';
import { Newsreader, Archivo, IBM_Plex_Mono } from 'next/font/google';
import { appConfig } from '@/lib/config/app.config';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import './globals.css';

const display = Newsreader({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-display',
});

const body = Archivo({
  subsets: ['latin'],
  variable: '--font-body',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: {
    default: appConfig.name,
    template: `%s — ${appConfig.name}`,
  },
  description: appConfig.tagline,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme={appConfig.theme} className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
