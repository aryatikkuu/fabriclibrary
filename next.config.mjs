/**
 * Security headers for every page and API response.
 *
 * Content-Security-Policy allows only what the site uses: its own scripts,
 * styles and fonts (next/font serves Google fonts from this origin), images
 * from Supabase Storage plus local previews (blob:/data:), and API calls to
 * Supabase. 'unsafe-inline' scripts are needed by Next.js's inline bootstrap;
 * 'unsafe-eval' only in development (React refresh).
 */
const supabase = 'https://*.supabase.co';
const isDev = process.env.NODE_ENV !== 'production';

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabase}`,
  "font-src 'self'",
  `connect-src 'self' ${supabase}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Photo upload uses the file picker, not the live camera, so these stay off.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      // Supabase Storage public URLs.
      { protocol: 'https', hostname: '**.supabase.co', pathname: '/storage/v1/object/**' },
    ],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
