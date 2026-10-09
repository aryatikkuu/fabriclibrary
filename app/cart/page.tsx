import { EditorialLayout } from '@/components/layout/EditorialLayout';
import { PremiumPageHeader } from '@/components/ui/PremiumPageHeader';
import { CartView } from '@/components/cart/CartView';

export const metadata = { title: 'Cart' };

/** The visitor's cart (kept in their browser, see features/cart/cart.ts). */
export default function CartPage() {
  return (
    <EditorialLayout>
      <PremiumPageHeader
        eyebrow="Your selection"
        title="Cart"
        description="The fabrics you'd like swatches or prices for. Send one request for all of them."
      />
      <CartView />
    </EditorialLayout>
  );
}
