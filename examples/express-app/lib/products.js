export const products = [
  { id: 1, name: 'Dot grid notebook', price: 12, note: 'A5, 160 pages, lays flat', tone: 'sage', art: 'notebook' },
  { id: 2, name: 'Fineliner pen set', price: 8, note: 'Three colours, 0.4 mm tips', tone: 'sky', art: 'pens' },
  { id: 3, name: 'Brass desk lamp', price: 39, note: 'Warm light, three brightness levels', tone: 'sand', art: 'lamp' },
  { id: 4, name: 'Washi tape trio', price: 6, note: 'Soft colours, tears by hand', tone: 'rose', art: 'tape' },
  { id: 5, name: 'Canvas pencil case', price: 14, note: 'Waxed cotton, brass zip', tone: 'clay', art: 'pouch' },
  { id: 6, name: 'Letter writing set', price: 18, note: '20 sheets and 10 envelopes', tone: 'lilac', art: 'letters' },
];

export function findProduct(id) {
  return products.find((p) => p.id === Number(id)) ?? null;
}
