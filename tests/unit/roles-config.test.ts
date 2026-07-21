import { describe, it, expect } from 'vitest';
import { roleCan, rolePermissions } from '@/lib/config/roles.config';

describe('roleCan', () => {
  it('lets every role read fabrics', () => {
    expect(roleCan('admin', 'fabrics.read')).toBe(true);
    expect(roleCan('editor', 'fabrics.read')).toBe(true);
    expect(roleCan('viewer', 'fabrics.read')).toBe(true);
  });

  it('restricts deletion to admins', () => {
    expect(roleCan('admin', 'fabrics.delete')).toBe(true);
    expect(roleCan('editor', 'fabrics.delete')).toBe(false);
    expect(roleCan('viewer', 'fabrics.delete')).toBe(false);
  });

  it('gives editors review powers but not user management', () => {
    expect(roleCan('editor', 'review.approve')).toBe(true);
    expect(roleCan('editor', 'review.rerun')).toBe(true);
    expect(roleCan('editor', 'users.manage')).toBe(false);
  });

  it('keeps viewers out of the review queue', () => {
    expect(roleCan('viewer', 'review.read')).toBe(false);
  });

  it('returns false for missing roles', () => {
    expect(roleCan(null, 'fabrics.read')).toBe(false);
    expect(roleCan(undefined, 'fabrics.read')).toBe(false);
  });

  it('covers every declared permission with at least admin', () => {
    for (const permission of Object.keys(rolePermissions) as (keyof typeof rolePermissions)[]) {
      expect(roleCan('admin', permission)).toBe(true);
    }
  });
});
