import type { UserRole } from '@/types/user';

/** Central permission map. Route guards and API handlers read from here. */
export const rolePermissions: Record<string, UserRole[]> = {
  'fabrics.read': ['admin', 'editor', 'viewer'],
  'fabrics.create': ['admin', 'editor'],
  'fabrics.update': ['admin', 'editor'],
  'fabrics.delete': ['admin'],
  'review.read': ['admin', 'editor'],
  'review.approve': ['admin', 'editor'],
  'review.reject': ['admin', 'editor'],
  'review.rerun': ['admin', 'editor'],
  'mills.manage': ['admin'],
  'users.manage': ['admin'],
  'audit.read': ['admin'],
};

export function roleCan(role: UserRole | null | undefined, permission: keyof typeof rolePermissions): boolean {
  if (!role) return false;
  return rolePermissions[permission]?.includes(role) ?? false;
}
