/**
 * App-wide constants. Subscription is stored as `User.tier` (`free` | `premium`)
 * for compatibility with existing code; role is `user` | `admin`.
 */
module.exports = {
  SUPER_ADMIN_EMAIL: 'admin@gmail.com',
  CHECKOUT_PRICE_USD: 19.99,
  CHECKOUT_PRICE_LABEL: '$19.99',
  CHECKOUT_INTERVAL: 'month'
};
