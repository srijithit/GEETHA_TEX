require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const { getDb } = require('./database/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure uploads directory exists
const dataDir = process.env.DATA_DIR || __dirname;
const uploadsDir = path.join(dataDir, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));

// Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'geetha-tex-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1 * 60 * 60 * 1000 } // 1 hour
}));

// Initialize DB then start server
getDb().then(() => {
  // Routes
  const shopRoutes = require('./routes/shop');
  const adminRoutes = require('./routes/admin');

  app.use('/', shopRoutes);
  app.use('/admin', adminRoutes);

  // 404 handler
  app.use((req, res) => {
    res.status(404).render('404', { page: '404' });
  });

  // Error handler
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something went wrong!');
  });

  app.listen(PORT, () => {
    console.log(`\n🎉 Geetha Tex is running at http://localhost:${PORT}`);
    console.log(`🔐 Admin panel: http://localhost:${PORT}/admin\n`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
