export interface Item {
  price: number;
  qty: number;
}

export type Coupon = 'SAVE10' | 'SAVE20';

const DISCOUNTS: Record<Coupon, number> = { SAVE10: 0.1, SAVE20: 0.2 };

export function calcTotal(items: Item[], coupon?: Coupon): number {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const discount = coupon ? DISCOUNTS[coupon] : 0;
  return Math.round(subtotal * (1 - discount) * 100) / 100;
}

export function formatPrice(amount: number, currency: 'USD' | 'EUR' = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}
