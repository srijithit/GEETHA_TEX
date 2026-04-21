const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDb } = require('../database/db');
const { requireAdmin } = require('../middleware/auth');

// Multer config for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dataDir = process.env.DATA_DIR || path.join(__dirname, '..');
    const uploadDir = path.join(dataDir, 'public', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  }
});

// Admin login page
router.get('/', (req, res) => {
  if (req.session && req.session.isAdmin) {
    return res.redirect('/admin/dashboard');
  }
  res.render('admin/login', { error: null, page: 'admin' });
});

// Admin login POST
router.post('/login', async (req, res) => {
  const db = await getDb();
  const { password } = req.body;
  
  const admin = await db.get('SELECT * FROM admin WHERE username = ?', ['admin']);
  if (!admin) {
    return res.render('admin/login', { error: 'Admin account not found', page: 'admin' });
  }

  const valid = bcrypt.compareSync(password, admin.password_hash);
  if (valid) {
    req.session.isAdmin = true;
    return res.redirect('/admin/dashboard');
  }
  
  res.render('admin/login', { error: 'Invalid password', page: 'admin' });
});

// Admin dashboard
router.get('/dashboard', requireAdmin, async (req, res) => {
  const db = await getDb();
  const products = await db.all('SELECT * FROM products ORDER BY created_at DESC');
  const orders = await db.all('SELECT * FROM orders ORDER BY created_at DESC LIMIT 20');
  
  const totalProducts = await db.get('SELECT COUNT(*) as count FROM products');
  const totalOrders = await db.get('SELECT COUNT(*) as count FROM orders');
  const totalRevenue = await db.get('SELECT COALESCE(SUM(total), 0) as total FROM orders WHERE status = ?', ['paid']);
  const pendingOrders = await db.get('SELECT COUNT(*) as count FROM orders WHERE status = ?', ['pending']);

  const stats = {
    totalProducts: totalProducts.count,
    totalOrders: totalOrders.count,
    totalRevenue: totalRevenue.total,
    pendingOrders: pendingOrders.count
  };
  
  res.render('admin/dashboard', { products, orders, stats, page: 'admin' });
});

// Add product page
router.get('/add-product', requireAdmin, (req, res) => {
  res.render('admin/add-product', { error: null, page: 'admin' });
});

// Add product POST
router.post('/add-product', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const db = await getDb();
    const { name, description, price, original_price, category, stock, featured } = req.body;
    const image = req.file ? req.file.filename : 'default-saree.jpg';

    await db.run(`
      INSERT INTO products (name, description, price, original_price, category, image, stock, featured) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      name, 
      description, 
      parseFloat(price), 
      original_price ? parseFloat(original_price) : null,
      category, 
      image, 
      parseInt(stock) || 10,
      featured ? 1 : 0
    ]);

    res.redirect('/admin/dashboard');
  } catch (error) {
    console.error('Add product error:', error);
    res.render('admin/add-product', { error: 'Failed to add product', page: 'admin' });
  }
});

// Edit product page
router.get('/edit-product/:id', requireAdmin, async (req, res) => {
  const db = await getDb();
  const product = await db.get('SELECT * FROM products WHERE id = ?', [req.params.id]);
  if (!product) return res.redirect('/admin/dashboard');
  res.render('admin/edit-product', { product, error: null, page: 'admin' });
});

// Edit product POST
router.post('/edit-product/:id', requireAdmin, upload.single('image'), async (req, res) => {
  const db = await getDb();
  try {
    const { name, description, price, original_price, category, stock, featured } = req.body;
    const product = await db.get('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!product) return res.redirect('/admin/dashboard');

    const image = req.file ? req.file.filename : product.image;

    // Delete old image if new one uploaded
    if (req.file && product.image && product.image !== 'default-saree.jpg') {
      const oldPath = path.join(__dirname, '..', 'public', 'uploads', product.image);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    await db.run(`
      UPDATE products SET name=?, description=?, price=?, original_price=?, category=?, image=?, stock=?, featured=? WHERE id=?
    `, [
      name,
      description,
      parseFloat(price),
      original_price ? parseFloat(original_price) : null,
      category,
      image,
      parseInt(stock) || 10,
      featured ? 1 : 0,
      req.params.id
    ]);

    res.redirect('/admin/dashboard');
  } catch (error) {
    console.error('Edit product error:', error);
    const product = await db.get('SELECT * FROM products WHERE id = ?', [req.params.id]);
    res.render('admin/edit-product', { product, error: 'Failed to update product', page: 'admin' });
  }
});

// Delete product
router.post('/delete-product/:id', requireAdmin, async (req, res) => {
  const db = await getDb();
  const product = await db.get('SELECT * FROM products WHERE id = ?', [req.params.id]);
  if (product && product.image && product.image !== 'default-saree.jpg') {
    const imgPath = path.join(__dirname, '..', 'public', 'uploads', product.image);
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
  }
  await db.run('DELETE FROM products WHERE id = ?', [req.params.id]);
  res.redirect('/admin/dashboard');
});

// Update order status
router.post('/update-order/:id', requireAdmin, async (req, res) => {
  const db = await getDb();
  const { status } = req.body;
  await db.run('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
  res.redirect('/admin/dashboard');
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin');
});

module.exports = router;
