import { peso } from '@/lib/format';

export function priceLabel(amount: number): string {
  return `Price: ${peso(amount)}`;
}
