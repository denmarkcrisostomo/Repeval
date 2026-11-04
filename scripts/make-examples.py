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
    'express-app/.env.example': 'PORT=4310\nSHOP_NAME=Larkspur Paper\n',
    'express-app/lib/pricing.js': '''export function applyTax(amount, rate) {
  return Math.round(amount * (1 + rate) * 100) / 100;
}

export function isFreeShipping(total) {
  return total >= 50;
}
''',
    'express-app/lib/products.js': '''export const products = [
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
''',
    'express-app/public/shop.css': ''':root {
  --bg: #f7f3ec;
  --card: #fffdf9;
  --ink: #1f1b16;
  --muted: #6b6258;
  --line: #e6dfd3;
  --accent: #2f5d50;
  --accent-ink: #ffffff;
  --sage: #e1e9dc; --sky: #dde7f0; --sand: #f2e5cc; --rose: #f5dfdb; --clay: #f0dccb; --lilac: #e7e1f0;
  --serif: 'Iowan Old Style', Charter, 'Bitstream Charter', Georgia, serif;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #15130f;
    --card: #1d1a16;
    --ink: #efe9df;
    --muted: #a99f92;
    --line: #2e2a24;
    --accent: #8cc4ad;
    --accent-ink: #10221b;
    --glow: .2;
    --sage: #233029; --sky: #212a35; --sand: #322a1c; --rose: #352523; --clay: #33261d; --lilac: #2a2535;
  }
}
* { box-sizing: border-box; }
body { display: flex; flex-direction: column; min-height: 100vh; margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.55 Inter, system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
a { color: inherit; }
h1, h2, h3 { font-family: var(--serif); font-weight: 600; letter-spacing: -0.01em; text-wrap: balance; margin: 0; }
main { flex: 1; }
.wrap { max-width: 1160px; margin: 0 auto; padding: 0 32px; }

.top { border-bottom: 1px solid var(--line); }
.top-in { display: flex; align-items: center; justify-content: space-between; height: 68px; }
.logo { display: inline-flex; align-items: center; gap: 8px; font-family: var(--serif); font-size: 21px; font-weight: 600; text-decoration: none; }
.logo svg { width: 20px; height: 20px; fill: var(--accent); }
nav { display: flex; align-items: center; gap: 26px; font-size: 15px; }
nav a { text-decoration: none; color: var(--muted); }
nav a:hover { color: var(--ink); }
.cart-link { color: var(--ink) !important; font-weight: 500; }
.count { display: inline-grid; place-items: center; min-width: 22px; height: 22px; margin-left: 4px; border-radius: 11px; background: var(--accent); color: var(--accent-ink); font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums; }

.hero { display: grid; grid-template-columns: 1fr 1.05fr; gap: 56px; align-items: center; padding-top: 52px; padding-bottom: 40px; }
.eyebrow { margin: 0 0 14px; font-size: 13px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--accent); }
.hero h1 { font-size: 52px; line-height: 1.06; }
.lede { margin: 18px 0 0; max-width: 46ch; font-size: 18px; color: var(--muted); }
.actions { display: flex; gap: 12px; margin-top: 28px; }
.btn { display: inline-flex; align-items: center; justify-content: center; height: 46px; padding: 0 22px; border-radius: 999px; background: var(--accent); color: var(--accent-ink); font-weight: 600; text-decoration: none; }
.btn-quiet { background: transparent; color: var(--ink); box-shadow: inset 0 0 0 1px var(--line); }
.btn-block { display: flex; width: 100%; margin-top: 20px; }
.perks { display: flex; gap: 22px; margin: 26px 0 0; padding: 0; list-style: none; font-size: 14px; color: var(--muted); }
.perks li::before { content: '✓'; margin-right: 6px; color: var(--accent); }

.tile { position: relative; display: grid; place-items: center; border-radius: 18px; background: var(--sage); overflow: hidden; }
.tile svg { width: 78%; height: auto; }
.glow { opacity: var(--glow, .45); }
.tile[data-tone='sage'] { background: var(--sage); }
.tile[data-tone='sky'] { background: var(--sky); }
.tile[data-tone='sand'] { background: var(--sand); }
.tile[data-tone='rose'] { background: var(--rose); }
.tile[data-tone='clay'] { background: var(--clay); }
.tile[data-tone='lilac'] { background: var(--lilac); }
.mosaic { display: grid; grid-template-columns: 1.15fr 1fr; grid-template-rows: 200px 200px; gap: 14px; }
.mosaic .tall { grid-row: span 2; }
.mosaic .tile svg { width: 82%; }
.tag { position: absolute; left: 14px; bottom: 14px; padding: 6px 12px; border-radius: 999px; background: var(--card); font-size: 13px; font-weight: 500; }
.feature { aspect-ratio: 4 / 3; }

.section { padding-top: 32px; padding-bottom: 64px; }
.section-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 20px; }
.section-head h2 { font-size: 30px; }
.section-head span { color: var(--muted); font-size: 14px; }
.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
.product { text-decoration: none; }
.product .tile { aspect-ratio: 4 / 3; }
.product-meta { display: flex; justify-content: space-between; gap: 12px; margin-top: 12px; }
.product-meta span { font-variant-numeric: tabular-nums; }
.product p { margin: 2px 0 0; font-size: 14px; color: var(--muted); }

.values { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
.values div { padding: 24px; border-radius: 18px; background: var(--card); box-shadow: 0 0 0 1px var(--line); }
.values h3 { font-size: 21px; }
.values p { margin: 8px 0 0; color: var(--muted); }

.page-title { font-size: 40px; margin-bottom: 20px; }
.cart { display: grid; grid-template-columns: 1fr 360px; gap: 40px; align-items: start; padding-top: 44px; padding-bottom: 64px; }
.lines { margin: 0; padding: 0; list-style: none; border-top: 1px solid var(--line); }
.lines li { display: grid; grid-template-columns: 120px 1fr auto; gap: 20px; align-items: center; padding: 18px 0; border-bottom: 1px solid var(--line); }
.thumb { aspect-ratio: 4 / 3; border-radius: 12px; }
.line-info { display: flex; flex-direction: column; }
.line-info span { font-size: 14px; color: var(--muted); }
.qty { margin-top: 6px; }
.line-price { font-weight: 600; font-variant-numeric: tabular-nums; }
.summary { padding: 26px; border-radius: 18px; background: var(--card); box-shadow: 0 0 0 1px var(--line); }
.summary h2 { font-size: 23px; }
.free { margin-top: 16px; font-size: 14px; color: var(--muted); }
.bar { height: 6px; margin-top: 8px; border-radius: 3px; background: var(--line); overflow: hidden; }
.bar i { display: block; height: 100%; background: var(--accent); }
dl { margin: 20px 0 0; }
dl div { display: flex; justify-content: space-between; padding: 8px 0; }
dt { color: var(--muted); }
dd { margin: 0; font-variant-numeric: tabular-nums; }
.total { margin-top: 6px; padding-top: 14px !important; border-top: 1px solid var(--line); font-size: 19px; font-weight: 600; }
.total dt { color: var(--ink); }

.help { display: grid; grid-template-columns: 1fr 340px; gap: 40px; align-items: start; }
.faq { display: grid; gap: 14px; }
.ask { padding: 26px; border-radius: 18px; background: var(--card); box-shadow: 0 0 0 1px var(--line); }
.ask .tile { aspect-ratio: 4 / 3; margin-bottom: 18px; }
.ask h2 { font-size: 23px; }
.ask p { margin: 8px 0 0; color: var(--muted); }
.faq div { padding: 20px 24px; border-radius: 16px; background: var(--card); box-shadow: 0 0 0 1px var(--line); }
.faq h3 { font-size: 20px; }
.faq p { margin: 6px 0 0; color: var(--muted); }

.foot { border-top: 1px solid var(--line); padding: 22px 0; font-size: 14px; color: var(--muted); }
.foot .wrap { display: flex; justify-content: space-between; gap: 16px; }

@media (max-width: 860px) {
  .wrap { padding: 0 20px; }
  nav { gap: 16px; }
  nav a:not(.cart-link):not([href='/']) { display: none; }
  .hero { grid-template-columns: 1fr; gap: 28px; padding-top: 32px; }
  .hero h1 { font-size: 36px; }
  .lede { font-size: 17px; }
  .mosaic { grid-template-rows: 150px 150px; }
  .grid, .values { grid-template-columns: 1fr 1fr; gap: 16px; }
  .help { grid-template-columns: 1fr; }
  .cart { grid-template-columns: 1fr; gap: 24px; padding-top: 28px; }
  .page-title { font-size: 32px; margin-bottom: 14px; }
  .lines li { grid-template-columns: 84px 1fr auto; gap: 14px; padding: 14px 0; }
  .foot .wrap { flex-direction: column; }
}
@media (max-width: 520px) {
  .grid, .values { grid-template-columns: 1fr; }
}
''',
    'express-app/public/help.html': '''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <title>Help - Larkspur Paper</title>
  <link rel="stylesheet" href="/shop.css">
</head>
<body>
  <header class="top">
    <div class="wrap top-in">
      <a class="logo" href="/"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c4 4 5 9 0 18-5-9-4-14 0-18z"/></svg>Larkspur Paper</a>
      <nav><a href="/">Shop</a><a href="/about">About</a><a href="/help.html">Help</a><a class="cart-link" href="/cart">Cart <span class="count">3</span></a></nav>
    </div>
  </header>
  <main>
    <section class="wrap section" style="padding-top:44px">
      <p class="eyebrow">Help</p>
      <h1 class="page-title">Questions people ask us</h1>
      <div class="help">
      <div class="faq">
        <div><h3>When will my order ship?</h3><p>Orders placed before noon ship the same day. Most arrive in two to four days.</p></div>
        <div><h3>Is shipping free?</h3><p>Shipping is free on orders over $50. Below that it is a flat $4.50.</p></div>
        <div><h3>Can I return something?</h3><p>Yes, within 30 days, as long as it is unused. Write to us and we will send a label.</p></div>
        <div><h3>How do I reach you?</h3><p>Email hello@larkspur.example and one of us will answer within a day.</p></div>
      </div>
      <aside class="ask">
        <div class="tile" data-tone="lilac"><svg viewBox="0 0 200 150" role="img" aria-label="Letter writing set"><ellipse cx="100" cy="132" rx="62" ry="5" fill="#000" opacity=".1"/><rect x="58" y="22" width="84" height="64" rx="3" fill="#fbf8f2" transform="rotate(-8 100 54)"/><path d="M70 40h46M70 50h56M70 60h38" stroke="#b9b0c9" stroke-width="3" stroke-linecap="round" transform="rotate(-8 100 54)"/><rect x="42" y="62" width="116" height="66" rx="4" fill="#8f7fb3"/><path d="M42 66l58 36 58-36" fill="none" stroke="#6f5f95" stroke-width="4" stroke-linejoin="round"/><rect x="132" y="70" width="18" height="22" rx="2" fill="#e39b97"/></svg></div>
        <h2>Still stuck?</h2>
        <p>Write to us. A real person reads every message, usually the same day.</p>
        <a class="btn btn-block" href="mailto:hello@larkspur.example">Email us</a>
      </aside>
      </div>
    </section>
  </main>
  <footer class="foot"><div class="wrap"><span>Larkspur Paper, paper goods for slow mornings.</span><span>Free shipping over $50</span></div></footer>
</body>
</html>
''',
    'express-app/server.js': '''import express from 'express';
import { products, findProduct } from './lib/products.js';

const app = express();
app.use(express.json());
app.use(express.static('public'));

const SHOP = process.env.SHOP_NAME || 'Larkspur Paper';
const money = (n) => `$${n.toFixed(2)}`;

/* Flat product drawings, so the shop needs no image files or outside requests. */
const art = {
  notebook: `<ellipse cx="100" cy="134" rx="50" ry="5" fill="#000" opacity=".1"/>
    <rect x="64" y="20" width="74" height="110" rx="6" fill="#2f5d50"/>
    <rect x="64" y="20" width="9" height="110" rx="3" fill="#264b41"/>
    <rect x="124" y="20" width="5" height="110" fill="#e2bd5c"/>
    <rect x="84" y="46" width="30" height="17" rx="2" fill="#f4efe4"/>
    <path d="M92 52h14M92 57h9" stroke="#2f5d50" stroke-width="2" stroke-linecap="round"/>
    <path d="M110 130v12l-4-4-4 4v-12" fill="#c2562f"/>`,
  pens: `<ellipse cx="100" cy="132" rx="62" ry="5" fill="#000" opacity=".1"/>
    <g transform="rotate(-24 100 76)">
      <rect x="34" y="48" width="118" height="11" rx="5.5" fill="#1f3a5f"/><rect x="34" y="48" width="40" height="11" rx="5.5" fill="#16294a"/><path d="M152 49.5l14 4-14 4z" fill="#d9dee5"/>
      <rect x="34" y="71" width="118" height="11" rx="5.5" fill="#c2562f"/><rect x="34" y="71" width="40" height="11" rx="5.5" fill="#a3461f"/><path d="M152 72.5l14 4-14 4z" fill="#d9dee5"/>
      <rect x="34" y="94" width="118" height="11" rx="5.5" fill="#2f5d50"/><rect x="34" y="94" width="40" height="11" rx="5.5" fill="#264b41"/><path d="M152 95.5l14 4-14 4z" fill="#d9dee5"/>
    </g>`,
  lamp: `<path class="glow" d="M150 70L186 142H114z" fill="#f6d77a"/>
    <ellipse cx="74" cy="134" rx="34" ry="7" fill="#000" opacity=".1"/>
    <ellipse cx="74" cy="130" rx="30" ry="6" fill="#b8893a"/>
    <path d="M74 128L94 78L132 52" stroke="#b8893a" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="94" cy="78" r="5.5" fill="#94692a"/>
    <path d="M124 40l32 12-4 26-36-18z" fill="#2f5d50"/>
    <ellipse cx="146" cy="70" rx="6" ry="4" fill="#fbe7a6"/>`,
  tape: `<ellipse cx="100" cy="132" rx="60" ry="5" fill="#000" opacity=".1"/>
    <circle cx="70" cy="92" r="26" fill="none" stroke="#e39b97" stroke-width="16"/>
    <circle cx="124" cy="96" r="22" fill="none" stroke="#7fa8c9" stroke-width="14"/>
    <circle cx="104" cy="52" r="20" fill="none" stroke="#e2bd5c" stroke-width="13"/>`,
  pouch: `<ellipse cx="100" cy="128" rx="64" ry="6" fill="#000" opacity=".1"/>
    <rect x="38" y="48" width="124" height="76" rx="18" fill="#b7684a"/>
    <path d="M46 58h108" stroke="#8f4c33" stroke-width="4" stroke-dasharray="4 3"/>
    <rect x="146" y="52" width="10" height="20" rx="3" fill="#e2bd5c"/>
    <rect x="58" y="74" width="32" height="20" rx="3" fill="#f4efe4" opacity=".85"/>`,
  letters: `<ellipse cx="100" cy="132" rx="62" ry="5" fill="#000" opacity=".1"/>
    <rect x="58" y="22" width="84" height="64" rx="3" fill="#fbf8f2" transform="rotate(-8 100 54)"/>
    <path d="M70 40h46M70 50h56M70 60h38" stroke="#b9b0c9" stroke-width="3" stroke-linecap="round" transform="rotate(-8 100 54)"/>
    <rect x="42" y="62" width="116" height="66" rx="4" fill="#8f7fb3"/>
    <path d="M42 66l58 36 58-36" fill="none" stroke="#6f5f95" stroke-width="4" stroke-linejoin="round"/>
    <rect x="132" y="70" width="18" height="22" rx="2" fill="#e39b97"/>`,
};
const drawing = (key, label) =>
  `<svg viewBox="0 0 200 150" role="img" aria-label="${label}">${art[key]}</svg>`;

const layout = (title, body) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <title>${title} - ${SHOP}</title>
  <link rel="stylesheet" href="/shop.css">
</head>
<body>
  <header class="top">
    <div class="wrap top-in">
      <a class="logo" href="/"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c4 4 5 9 0 18-5-9-4-14 0-18z"/></svg>${SHOP}</a>
      <nav><a href="/">Shop</a><a href="/about">About</a><a href="/help.html">Help</a><a class="cart-link" href="/cart">Cart <span class="count">3</span></a></nav>
    </div>
  </header>
  <main>${body}</main>
  <footer class="foot"><div class="wrap"><span>${SHOP}, paper goods for slow mornings.</span><span>Free shipping over $50</span></div></footer>
</body>
</html>`;

const card = (p) => `<a class="product" href="/products/${p.id}">
  <div class="tile" data-tone="${p.tone}">${drawing(p.art, p.name)}</div>
  <div class="product-meta"><strong>${p.name}</strong><span>${money(p.price)}</span></div>
  <p>${p.note}</p>
</a>`;

app.get('/', (req, res) => {
  const [notebook, pens, lamp] = products;
  res.send(layout('Shop', `
  <section class="hero wrap">
    <div class="hero-copy">
      <p class="eyebrow">The autumn desk edit</p>
      <h1>Good paper for people who still write things down.</h1>
      <p class="lede">Notebooks, pens and small desk things, made in small batches and shipped without plastic.</p>
      <div class="actions"><a class="btn" href="#picks">Shop the edit</a><a class="btn btn-quiet" href="/about">Our story</a></div>
      <ul class="perks"><li>Free shipping over $50</li><li>30-day returns</li></ul>
    </div>
    <div class="mosaic">
      <a class="tile tall" data-tone="${lamp.tone}" href="/products/${lamp.id}">${drawing(lamp.art, lamp.name)}<span class="tag">New · ${lamp.name}</span></a>
      <a class="tile" data-tone="${notebook.tone}" href="/products/${notebook.id}">${drawing(notebook.art, notebook.name)}</a>
      <a class="tile" data-tone="${pens.tone}" href="/products/${pens.id}">${drawing(pens.art, pens.name)}</a>
    </div>
  </section>
  <section class="wrap section" id="picks">
    <div class="section-head"><h2>This week's picks</h2><span>${products.length} items</span></div>
    <div class="grid">${products.map(card).join('')}</div>
  </section>`));
});

app.get('/about', (req, res) => {
  const letters = products[5];
  res.send(layout('About', `
  <section class="hero wrap">
    <div class="hero-copy">
      <p class="eyebrow">Our story</p>
      <h1>It started with one notebook that lay flat.</h1>
      <p class="lede">We are two people and a small workshop. We test every paper with fountain pens, pencils and markers before it goes in the shop.</p>
      <p class="lede">If something we sell lets you down, write to us and we will make it right.</p>
    </div>
    <div class="tile feature" data-tone="${letters.tone}">${drawing(letters.art, letters.name)}</div>
  </section>
  <section class="wrap section">
    <div class="values">
      <div><h3>Made to last</h3><p>Stitched bindings, brass parts and paper that takes ink without bleeding.</p></div>
      <div><h3>Plastic-free shipping</h3><p>Every order ships in recycled card with paper tape.</p></div>
      <div><h3>Small batches</h3><p>We make a little at a time, so things sell out and come back.</p></div>
    </div>
  </section>`));
});

app.get('/cart', (req, res) => {
  const lines = [
    { product: products[0], qty: 1 },
    { product: products[1], qty: 2 },
  ];
  const subtotal = lines.reduce((sum, l) => sum + l.product.price * l.qty, 0);
  const shipping = 4.5;
  const toFree = 50 - subtotal;
  res.send(layout('Cart', `
  <section class="wrap cart">
    <div>
      <h1 class="page-title">Your cart</h1>
      <ul class="lines">${lines
        .map(
          (l) => `<li>
          <div class="tile thumb" data-tone="${l.product.tone}">${drawing(l.product.art, l.product.name)}</div>
          <div class="line-info"><strong>${l.product.name}</strong><span>${l.product.note}</span><span class="qty">Qty ${l.qty}</span></div>
          <span class="line-price">${money(l.product.price * l.qty)}</span>
        </li>`,
        )
        .join('')}</ul>
    </div>
    <aside class="summary">
      <h2>Order summary</h2>
      <div class="free"><span>Add ${money(toFree)} more for free shipping</span><div class="bar"><i style="width:${Math.round((subtotal / 50) * 100)}%"></i></div></div>
      <dl>
        <div><dt>Subtotal</dt><dd>${money(subtotal)}</dd></div>
        <div><dt>Shipping</dt><dd>${money(shipping)}</dd></div>
        <div class="total"><dt>Total</dt><dd id="total">$0.00</dd></div>
      </dl>
      <a class="btn btn-block" href="#checkout">Check out</a>
    </aside>
  </section>
  <script>
    // Bug on purpose: the script uses a variable that does not exist.
    document.getElementById("total").textContent = "$" + cartTotal.toFixed(2);
  </script>`));
});

app.get('/products/:id', (req, res) => {
  const product = findProduct(req.params.id);
  if (!product) return res.status(404).send(layout('Not found', '<section class="wrap section"><h1 class="page-title">Not found</h1></section>'));
  res.send(layout(product.name, `
  <section class="hero wrap">
    <div class="tile feature" data-tone="${product.tone}">${drawing(product.art, product.name)}</div>
    <div class="hero-copy">
      <p class="eyebrow">${money(product.price)}</p>
      <h1>${product.name}</h1>
      <p class="lede">${product.note}.</p>
      <div class="actions"><a class="btn" href="/cart">Add to cart</a></div>
    </div>
  </section>`));
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
app.listen(PORT, () => console.log(`${SHOP} on http://localhost:${PORT}`));
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
