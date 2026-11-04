export function applyTax(amount, rate) {
  return Math.round(amount * (1 + rate) * 100) / 100;
}

export function isFreeShipping(total) {
  return total >= 50;
}
