/**
 * Normalizes a Sequelize User row into the session payload shape.
 * Keep in sync with future auth providers (e.g. Supabase) by changing only callers or a shared mapper.
 */
const toSessionUser = (user) => ({
  id: user.id,
  username: user.username,
  email: user.email,
  tier: user.tier,
  role: user.role || 'user'
});

module.exports = { toSessionUser };
