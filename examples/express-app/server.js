import express from 'express';
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
