const { CHECKOUT_PRICE_LABEL, CHECKOUT_PRICE_USD, CHECKOUT_INTERVAL } = require('../config/constants');
const userRepository = require('../repositories/userRepository');
const { toSessionUser } = require('../utils/sessionUser');

const safeReturnPath = (value) => {
  const raw = (value || '/').toString().trim();
  if (!raw.startsWith('/') || raw.startsWith('//')) {
    return '/';
  }
  return raw.slice(0, 512);
};

const renderCheckout = async (req, res) => {
  try {
    const returnTo = safeReturnPath(req.query.returnTo);
    req.session.checkoutReturnTo = returnTo;

    const user = await userRepository.findById(req.session.user.id);
    if (!user) {
      return res.redirect('/login');
    }
    if (user.tier === 'premium') {
      return res.redirect(returnTo);
    }

    return res.render('checkout', {
      pageTitle: 'Checkout - ViperLens Premium',
      priceLabel: CHECKOUT_PRICE_LABEL,
      priceAmount: CHECKOUT_PRICE_USD,
      intervalLabel: CHECKOUT_INTERVAL,
      returnTo,
      user: req.session.user
    });
  } catch (error) {
    console.error(`[CHECKOUT] ${error.message}`);
    return res.status(500).redirect('/');
  }
};

const completeCheckout = async (req, res) => {
  try {
    const user = await userRepository.findById(req.session.user.id);
    if (!user) {
      return res.status(401).json({ ok: false, error: 'Unauthorized.' });
    }

    const updated = await userRepository.setPremiumSubscription(user.id);
    if (!updated) {
      return res.status(500).json({ ok: false, error: 'Unable to update subscription.' });
    }

    req.session.user = toSessionUser(updated);

    const returnTo = safeReturnPath(req.body.returnTo || req.session.checkoutReturnTo);
    delete req.session.checkoutReturnTo;

    return res.status(200).json({ ok: true, redirect: returnTo });
  } catch (error) {
    console.error(`[CHECKOUT] Complete failed: ${error.message}`);
    return res.status(500).json({ ok: false, error: 'Checkout failed.' });
  }
};

module.exports = {
  renderCheckout,
  completeCheckout
};
