import { describe, it, expect } from 'vitest';
import { storagePaths, sanitize } from '@/lib/config/storage.config';

describe('sanitize', () => {
  it('keeps safe characters', () => {
    expect(sanitize('BWR01.jpg')).toBe('BWR01.jpg');
  });

  it('replaces spaces and unsafe characters with hyphens', () => {
    expect(sanitize('hanger photo (front)#2.jpg')).toBe('hanger-photo-front-2.jpg');
  });

  it('collapses repeated separators and trims edge punctuation', () => {
    expect(sanitize('--my..file--')).toBe('my..file');
    expect(sanitize('a   b')).toBe('a-b');
  });

  it('prevents path traversal segments', () => {
    expect(sanitize('../../etc/passwd')).not.toContain('/');
    expect(sanitize('../../etc/passwd')).not.toContain('..');
  });
});

describe('storagePaths', () => {
  it('builds the documented image layout', () => {
    expect(storagePaths.fabricImage('orbit-exports', 'BWR01', 'front.jpg')).toBe(
      'mills/orbit-exports/fabrics/BWR01/images/front.jpg',
    );
  });

  it('builds the documented document layout', () => {
    expect(storagePaths.fabricDocument('masood-textile-mills', 'MTM-SJ-180', 'testing report.pdf')).toBe(
      'mills/masood-textile-mills/fabrics/MTM-SJ-180/documents/testing-report.pdf',
    );
  });

  it('sanitises fabric codes containing unsafe characters', () => {
    const path = storagePaths.fabricImage('mill', 'AB/CD 01', 'a.jpg');
    expect(path).toBe('mills/mill/fabrics/AB-CD-01/images/a.jpg');
  });
});
