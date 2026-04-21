const express = require('express');
const router = express.Router();
const { getDb } = require('../database/db');

// Home page
router.get('/', async (req, res) => {
  const db = await getDb();
  const featured = await db.all('SELECT * FROM products WHERE featured = 1 ORDER BY created_at DESC LIMIT 8');
  const categoriesRaw = await db.all('SELECT DISTINCT category FROM products');
  const categories = categoriesRaw.map(r => r.category);
  res.render('home', { featured, categories, page: 'home' });
});

// Products listing
router.get('/products', async (req, res) => {
  const db = await getDb();
  const { category, search, sort } = req.query;
  let query = 'SELECT * FROM products WHERE 1=1';
  const params = [];

  if (category && category !== 'all') {
    query += ' AND category = ?';
    params.push(category);
  }

  if (search) {
    query += ' AND (name LIKE ? OR description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  switch (sort) {
    case 'price-low':
      query += ' ORDER BY price ASC';
      break;
    case 'price-high':
      query += ' ORDER BY price DESC';
      break;
    case 'newest':
      query += ' ORDER BY created_at DESC';
      break;
    default:
      query += ' ORDER BY featured DESC, created_at DESC';
  }

  const products = await db.all(query, params);
  const categoriesRaw = await db.all('SELECT DISTINCT category FROM products');
  const categories = categoriesRaw.map(r => r.category);

  res.render('products', { 
    products, 
    categories, 
    currentCategory: category || 'all',
    currentSort: sort || 'default',
    search: search || '',
    page: 'products'
  });
});

// Product detail
router.get('/products/:id', async (req, res) => {
  const db = await getDb();
  const product = await db.get('SELECT * FROM products WHERE id = ?', [req.params.id]);
  if (!product) return res.status(404).render('404', { page: '404' });

  const related = await db.all('SELECT * FROM products WHERE category = ? AND id != ? LIMIT 4', [product.category, product.id]);

  res.render('product-detail', { product, related, page: 'products' });
});

// Cart page
router.get('/cart', (req, res) => {
  res.render('cart', { page: 'cart' });
});

// Checkout page
router.get('/checkout', (req, res) => {
  res.render('checkout', { 
    razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    page: 'checkout'
  });
});

// Create Razorpay order
router.post('/create-order', async (req, res) => {
  try {
    const Razorpay = require('razorpay');
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    const { amount, customerInfo, items } = req.body;

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // Convert to paise
      currency: 'INR',
      receipt: `order_${Date.now()}`
    });

    // Store temporary order info in session
    req.session.pendingOrder = {
      customerInfo,
      items,
      amount,
      razorpay_order_id: order.id
    };

    res.json({ 
      id: order.id, 
      amount: order.amount,
      currency: order.currency
    });
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Verify payment
router.post('/verify-payment', async (req, res) => {
  try {
    const db = await getDb();
    const crypto = require('crypto');
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
    hmac.update(razorpay_order_id + '|' + razorpay_payment_id);
    const generated_signature = hmac.digest('hex');

    if (generated_signature === razorpay_signature) {
      // Payment verified — save order
      const pending = req.session.pendingOrder;
      if (pending) {
        await db.run(`
          INSERT INTO orders (customer_name, email, phone, address, city, pincode, total, razorpay_order_id, razorpay_payment_id, razorpay_signature, status, items_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', ?)
        `, [
          pending.customerInfo.name,
          pending.customerInfo.email,
          pending.customerInfo.phone,
          pending.customerInfo.address,
          pending.customerInfo.city,
          pending.customerInfo.pincode,
          pending.amount,
          razorpay_order_id,
          razorpay_payment_id,
          razorpay_signature,
          JSON.stringify(pending.items)
        ]);

        delete req.session.pendingOrder;
      }

      res.json({ status: 'success', payment_id: razorpay_payment_id });
    } else {
      res.status(400).json({ status: 'failure', message: 'Invalid signature' });
    }
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ error: 'Payment verification failed' });
  }
});

// Create WhatsApp order log
router.post('/create-order-whatsapp', async (req, res) => {
  try {
    const db = await getDb();
    const { customerInfo, items, total } = req.body;

    await db.run(`
      INSERT INTO orders (customer_name, phone, address, city, pincode, total, status, items_json)
      VALUES (?, ?, ?, ?, ?, ?, 'whatsapp_pending', ?)
    `, [
      customerInfo.name,
      customerInfo.phone,
      customerInfo.address,
      customerInfo.city,
      customerInfo.pincode,
      parseFloat(total.replace(/[₹,]/g, '')),
      JSON.stringify(items)
    ]);

    res.json({ status: 'success' });
  } catch (error) {
    console.error('WhatsApp order log error:', error);
    res.status(500).json({ error: 'Failed to log order' });
  }
});

// Order success
router.get('/order-success', (req, res) => {
  res.render('order-success', { 
    paymentId: req.query.payment_id,
    page: 'order-success'
  });
});

// About page
router.get('/about', (req, res) => {
  res.render('about', { page: 'about' });
});

// Contact page
router.get('/contact', (req, res) => {
  res.render('contact', { page: 'contact' });
});

// API: Get product data for cart
router.get('/api/products/:id', async (req, res) => {
  const db = await getDb();
  const product = await db.get('SELECT id, name, price, image FROM products WHERE id = ?', [req.params.id]);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

// API: Get multiple products
router.post('/api/products/batch', async (req, res) => {
  const db = await getDb();
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) return res.json([]);
  const placeholders = ids.map(() => '?').join(',');
  const products = await db.all(`SELECT id, name, price, image FROM products WHERE id IN (${placeholders})`, ids);
  res.json(products);
});

module.exports = router;
