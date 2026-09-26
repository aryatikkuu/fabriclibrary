import { describe, it, expect } from 'vitest';
import { leadMailto, leadSchema } from '@/features/leads/lead';
import { isBot } from '@/lib/visitor';

const fabric = { code: 'PRXS42488WJ41300', name: 'Rubeus Super', mill: 'Orbit Exports', url: 'https://example.com/fabrics/abc' };
const valid = { fabricId: '0e6362aa-284f-4fa7-932a-1906b35b6363', request: 'both', name: 'Ana', email: 'ana@shop.com' };

describe('leadMailto', () => {
  const decode = (link: string) => {
    const url = new URL(link);
    return { to: url.pathname, subject: url.searchParams.get('subject'), body: url.searchParams.get('body') ?? '' };
  };

  it('addresses the draft and puts the fabric code in the subject and body', () => {
    const { to, subject, body } = decode(leadMailto('pashantikku@gmail.com', { request: 'both', name: 'Ana', email: 'ana@shop.com' }, fabric));
    expect(to).toBe('pashantikku@gmail.com');
    expect(subject).toBe('Swatch and price request – PRXS42488WJ41300');
    expect(body).toContain('Code: PRXS42488WJ41300');
    expect(body).toContain('Mill: Orbit Exports');
    expect(body).toContain(fabric.url);
  });

  it('includes only the details given, and survives awkward characters', () => {
    const { body } = decode(leadMailto('x@y.com', {
      request: 'swatch', name: 'José & Co', email: 'j@co.com', whatsapp: '+94 77 123 4567', message: 'Need 3m?\nThanks',
    }, fabric));
    expect(body).toContain('Name: José & Co');
    expect(body).toContain('WhatsApp: +94 77 123 4567');
    expect(body).toContain('Need 3m?\nThanks');
    expect(body).not.toContain('Company:');
  });
});

describe('leadSchema', () => {
  it('accepts a minimal request and trims', () => {
    expect(leadSchema.parse({ ...valid, name: '  Ana  ', company: '' })).toMatchObject({ name: 'Ana', company: undefined });
  });

  it('rejects a bad email, phone or request type', () => {
    expect(() => leadSchema.parse({ ...valid, email: 'not-an-email' })).toThrow();
    expect(() => leadSchema.parse({ ...valid, whatsapp: 'call me' })).toThrow();
    expect(() => leadSchema.parse({ ...valid, request: 'free' })).toThrow();
  });

  it('passes the honeypot through so the API can drop it quietly', () => {
    expect(leadSchema.parse({ ...valid, website: 'spam.example' }).website).toBe('spam.example');
  });
});

describe('isBot', () => {
  it('skips crawlers and link previews, counts browsers', () => {
    expect(isBot('WhatsApp/2.23')).toBe(true);
    expect(isBot('Googlebot/2.1')).toBe(true);
    expect(isBot(null)).toBe(true);
    expect(isBot('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1')).toBe(false);
  });
});
