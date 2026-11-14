import { cents } from '@api/money';

export function totalCents(prices: number[]): number {
  return prices.reduce((sum, p) => sum + cents(p), 0);
}
