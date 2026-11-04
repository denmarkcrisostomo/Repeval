"""Writes the example repos used by Repeval's own tests. Run once: python3 scripts/make-examples.py"""
import json
import os

ROOT = os.path.join(os.path.dirname(__file__), '..', 'examples')

FILES = {
    # ---------------- ts-lib: plain TypeScript library ----------------
    'ts-lib/package.json': json.dumps({
        'name': 'example-ts-lib',
        'private': True,
        'type': 'module',
        'description': "A small TypeScript library used to test Repeval's unit test generation.",
    }, indent=2) + '\n',
    'ts-lib/tsconfig.json': json.dumps({
        'compilerOptions': {'target': 'ES2022', 'module': 'ESNext', 'moduleResolution': 'Bundler', 'strict': True, 'noEmit': True},
        'include': ['src'],
    }, indent=2) + '\n',
    'ts-lib/src/math.ts': '''export function add(a: number, b: number): number {
  return a + b;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export const average = (values: number[]): number => {
  if (values.length === 0) throw new Error('average of an empty list');
  return values.reduce((sum, v) => sum + v, 0) / values.length;
};
''',
    'ts-lib/src/strings.ts': '''export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function truncate(text: string, max = 20, suffix = '…'): string {
  return text.length <= max ? text : text.slice(0, max - suffix.length) + suffix;
}

export default function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
''',
    'ts-lib/src/cart.ts': '''export interface Item {
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
''',
    'ts-lib/src/api.ts': '''export async function fetchUser(id: string): Promise<{ id: string; name: string }> {
  const res = await fetch(`https://api.example.com/users/${id}`);
  return res.json();
}

export function createId(): string {
  return Math.random().toString(36).slice(2);
}
''',

    # ---------------- express-app: server-rendered pages + JSON API ----------------
    'express-app/package.json': json.dumps({
        'name': 'example-express-app',
        'private': True,
        'type': 'module',
        'scripts': {'start': 'node server.js'},
        'dependencies': {'express': '5.1.0'},
    }, indent=2) + '\n',
    'express-app/.env.example': 'PORT=4310\nSHOP_NAME=Repeval Demo Shop\n',
    'express-app/lib/pricing.js': '''export function applyTax(amount, rate) {
  return Math.round(amount * (1 + rate) * 100) / 100;
}

export function isFreeShipping(total) {
  return total >= 50;
}
''',
    'express-app/lib/products.js': '''export const products = [
  { id: 1, name: 'Notebook', price: 12 },
  { id: 2, name: 'Pen set', price: 8 },
  { id: 3, name: 'Desk lamp', price: 39 },
];

export function findProduct(id) {
  return products.find((p) => p.id === Number(id)) ?? null;
}
''',
    'express-app/public/help.html': '''<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Help - Demo Shop</title></head>
<body><h1>Help</h1><p>Static page served by express.static.</p></body>
</html>
''',
    'express-app/server.js': '''import express from 'express';
import { products, findProduct } from './lib/products.js';

const app = express();
app.use(express.json());
app.use(express.static('public'));

const layout = (title, body) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} - Demo Shop</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; color: #1c2130; }
    header { background: #2c47c9; color: white; padding: 16px 24px; }
    nav a { color: white; margin-right: 16px; }
    main { padding: 24px; max-width: 720px; }
    .card { border: 1px solid #dde; border-radius: 8px; padding: 12px 16px; margin: 8px 0; }
  </style>
</head>
<body>
  <header><strong>Demo Shop</strong> <nav><a href="/">Home</a><a href="/about">About</a><a href="/cart">Cart</a></nav></header>
  <main>${body}</main>
</body>
</html>`;

app.get('/', (req, res) => {
  res.send(layout('Home', `<h1>Welcome</h1>${products.map((p) => `<div class="card">${p.name} - $${p.price}</div>`).join('')}`));
});

app.get('/about', (req, res) => {
  res.send(layout('About', '<h1>About us</h1><p>We sell stationery.</p>'));
});

app.get('/cart', (req, res) => {
  // Bug on purpose: the script uses a variable that does not exist.
  res.send(layout('Cart', '<h1>Your cart</h1><p id="total">Total: $0</p><script>document.getElementById("total").textContent = "Total: $" + cartTotal;</script>'));
});

app.get('/products/:id', (req, res) => {
  const product = findProduct(req.params.id);
  if (!product) return res.status(404).send(layout('Not found', '<h1>Not found</h1>'));
  res.send(layout(product.name, `<h1>${product.name}</h1><p>$${product.price}</p>`));
});

app.get('/api/products', (req, res) => {
  res.json(products);
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.post('/api/orders', (req, res) => {
  res.status(201).json({ id: Date.now(), items: req.body.items ?? [] });
});

const PORT = process.env.PORT || 4310;
app.listen(PORT, () => console.log(`Demo shop on http://localhost:${PORT}`));
''',

    # ---------------- next-app: structure only (not installed), for analyzer tests ----------------
    'next-app/package.json': json.dumps({
        'name': 'example-next-app',
        'private': True,
        'scripts': {'dev': 'next dev', 'build': 'next build', 'start': 'next start'},
        'dependencies': {'next': '15.5.2', 'react': '19.1.1', 'react-dom': '19.1.1'},
        'devDependencies': {'typescript': '5.9.2'},
    }, indent=2) + '\n',
    'next-app/tsconfig.json': '{ "compilerOptions": { "strict": true, "jsx": "preserve" } }\n',
    'next-app/.env.example': 'DATABASE_URL=postgres://localhost:5432/shop\nNEXT_PUBLIC_SITE_NAME=Shop\n',
    'next-app/app/layout.tsx': '''export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
''',
    'next-app/app/page.tsx': 'export default function Home() { return <h1>Home</h1>; }\n',
    'next-app/app/about/page.tsx': 'export default function About() { return <h1>About</h1>; }\n',
    'next-app/app/(shop)/cart/page.tsx': 'export default function Cart() { return <h1>Cart</h1>; }\n',
    'next-app/app/products/[id]/page.tsx': 'export default function Product({ params }: { params: { id: string } }) { return <h1>{params.id}</h1>; }\n',
    'next-app/app/api/products/route.ts': '''export async function GET() {
  return Response.json([{ id: 1, name: 'Notebook' }]);
}

export async function POST(request: Request) {
  const body = await request.json();
  return Response.json(body, { status: 201 });
}
''',
    'next-app/lib/format.tsx': '''export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function ProductBadge({ label }: { label: string }) {
  return <span>{label.toUpperCase()}</span>;
}
''',
}

for path, content in FILES.items():
    full = os.path.join(ROOT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, 'w') as f:
        f.write(content)
print(f'wrote {len(FILES)} files')
