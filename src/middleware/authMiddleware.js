const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.user) {
    return res.redirect('/login');
  }
  return next();
};

const requirePremium = (req, res, next) => {
  const sessionTier = ((req.session && req.session.user && req.session.user.tier) || 'free').toLowerCase();
  if (sessionTier !== 'premium') {
    console.warn('[AUTH] Blocked premium endpoint access for free tier.');
    return res.status(403).json({ status: 'premium_required' });
  }
  return next();
};

module.exports = {
  requireAuth,
  requirePremium
};
