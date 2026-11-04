export const products = [
  { id: 1, name: 'Notebook', price: 12 },
  { id: 2, name: 'Pen set', price: 8 },
  { id: 3, name: 'Desk lamp', price: 39 },
];

export function findProduct(id) {
  return products.find((p) => p.id === Number(id)) ?? null;
}
