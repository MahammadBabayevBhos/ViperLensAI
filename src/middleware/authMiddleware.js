const { User } = require('../models');
const { SUPER_ADMIN_EMAIL } = require('../config/constants');
const { toSessionUser } = require('../utils/sessionUser');

const sessionIsSuperAdmin = (sessionUser) => {
  if (!sessionUser || !sessionUser.email) {
    return false;
  }
  return sessionUser.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
};

const requireAuth = async (req, res, next) => {
  if (!req.session || !req.session.user) {
    return res.redirect('/login');
  }
  try {
    const user = await User.findByPk(req.session.user.id);
    if (!user) {
      req.session.destroy(() => res.redirect('/login'));
      return;
    }
    req.session.user = toSessionUser(user);
    return next();
  } catch (error) {
    console.error(`[AUTH] Session refresh failed: ${error.message}`);
    return res.redirect('/login');
  }
};

const requirePremium = (req, res, next) => {
  const sessionTier = ((req.session && req.session.user && req.session.user.tier) || 'free').toLowerCase();
  if (sessionTier !== 'premium') {
    console.warn('[AUTH] Blocked premium endpoint access for free tier.');
    return res.status(403).json({ status: 'premium_required' });
  }
  return next();
};

/** JSON admin APIs — only the configured super-admin email may call these routes. */
const requireAdmin = (req, res, next) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ status: 'unauthorized' });
  }
  if (!sessionIsSuperAdmin(req.session.user)) {
    return res.status(403).json({ status: 'forbidden' });
  }
  return next();
};

/** HTML admin pages: redirect guests; only super-admin email may view. */
const requireAdminPage = (req, res, next) => {
  if (!req.session || !req.session.user) {
    return res.redirect('/login');
  }
  if (!sessionIsSuperAdmin(req.session.user)) {
    return res.status(403).render('forbidden', {
      pageTitle: 'Access denied',
      message: 'This area is restricted to the platform administrator.'
    });
  }
  return next();
};

module.exports = {
  requireAuth,
  requirePremium,
  requireAdmin,
  requireAdminPage,
  sessionIsSuperAdmin
};
