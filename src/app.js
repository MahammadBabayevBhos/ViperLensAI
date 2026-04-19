const express = require('express');
const path = require('path');
const session = require('express-session');
const analysisRoutes = require('./routes/analysisRoutes');
const authRoutes = require('./routes/authRoutes');
const historyRoutes = require('./routes/historyRoutes');
const adminRoutes = require('./routes/adminRoutes');
const checkoutRoutes = require('./routes/checkoutRoutes');
const { SUPER_ADMIN_EMAIL } = require('./config/constants');
const { sessionIsSuperAdmin } = require('./middleware/authMiddleware');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(express.json({ limit: '2mb' }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'viperlens-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 8
    }
  })
);
app.use('/public', express.static(path.join(__dirname, '../public')));

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.superAdminEmail = SUPER_ADMIN_EMAIL;
  res.locals.isSuperAdmin = sessionIsSuperAdmin(req.session && req.session.user);
  next();
});

app.use('/', authRoutes);
app.use('/', checkoutRoutes);
app.use('/', analysisRoutes);
app.use('/', historyRoutes);
app.use('/', adminRoutes);

app.use((error, _req, res, _next) => {
  console.error(`[ERROR] ${error.message}`);

  return res.status(400).render('index', {
    pageTitle: 'Malware Analysis Platform',
    result: null,
    error: error.message || 'Unexpected error occurred.',
    aiReport: null,
    isFreeTier: true,
    user: null
  });
});

module.exports = app;
