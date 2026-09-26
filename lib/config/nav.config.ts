/**
 * Primary navigation. Add or reorder links here — the desktop bar and the
 * mobile drawer both render from this one list, so they can never drift apart.
 *
 * `permission` (optional) gates the link behind the role map in roles.config.
 * Links without a permission are public.
 */
import type { rolePermissions } from './roles.config';

export interface NavItem {
  href: string;
  label: string;
  /** Only shown when the current role satisfies this permission. */
  permission?: keyof typeof rolePermissions;
  /** Renders in the accent colour — reserved for staff-only destinations. */
  accent?: boolean;
  /** 'post' renders a form button instead of a link, for actions such as signing out. */
  method?: 'post';
}

export const primaryNav: readonly NavItem[] = [
  { href: '/fabrics', label: 'Fabrics' },
  { href: '/search', label: 'Search' },
  { href: '/review', label: 'Review', permission: 'review.read', accent: true },
  { href: '/analytics', label: 'Analytics', permission: 'analytics.read', accent: true },
] as const;

/** Shown only when nobody is signed in. */
export const signInNav: NavItem = { href: '/login', label: 'Sign in' };

/** Shown only when someone is signed in. */
export const signOutNav: NavItem = { href: '/api/auth/sign-out', label: 'Sign out', method: 'post' };
