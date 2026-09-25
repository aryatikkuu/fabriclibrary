import Link from 'next/link';
import type { NavItem } from '@/lib/config/nav.config';

/**
 * One navigation destination, in the two shapes the masthead needs.
 * Both variants share href/label/accent handling so the bar and the drawer
 * stay in sync — style differences live here, not in two parallel components.
 *
 *  · `bar`    — inline, tracked mono, underline-on-hover (desktop masthead)
 *  · `drawer` — full-width row with a comfortable touch target (mobile menu)
 */
export function NavLink({
  item,
  variant,
  onNavigate,
}: {
  item: NavItem;
  variant: 'bar' | 'drawer';
  onNavigate?: () => void;
}) {
  const tone = item.accent ? 'text-review' : undefined;

  const className =
    variant === 'bar'
      ? `border-b border-transparent pb-0.5 transition-colors hover:border-thread hover:text-ink ${tone ?? ''}`
      : `tap-target flex items-center border-b border-seam text-base transition-colors hover:text-ink ${tone ?? 'text-graphite'}`;

  return (
    <Link href={item.href} onClick={onNavigate} className={className.trim()}>
      {item.label}
    </Link>
  );
}
