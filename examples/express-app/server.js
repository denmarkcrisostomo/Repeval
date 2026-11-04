import express from 'express';
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
