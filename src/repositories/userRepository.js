/**
 * User persistence boundary — swap Sequelize for Supabase/Postgres clients here later.
 */
const { User } = require('../models');

const listUsersForAdmin = async () =>
  User.findAll({
    attributes: ['id', 'username', 'email', 'tier', 'role'],
    order: [['id', 'ASC']]
  });

const findById = async (id) => User.findByPk(id);

const setTier = async (userId, tier) => {
  const user = await User.findByPk(userId);
  if (!user) {
    return null;
  }
  user.tier = tier;
  await user.save();
  return user;
};

const setRole = async (userId, role) => {
  const user = await User.findByPk(userId);
  if (!user) {
    return null;
  }
  user.role = role;
  await user.save();
  return user;
};

const setPremiumSubscription = async (userId) => {
  const user = await User.findByPk(userId);
  if (!user) {
    return null;
  }
  user.tier = 'premium';
  await user.save();
  return user;
};

const countTotal = async () => User.count();

const countPremium = async () =>
  User.count({
    where: { tier: 'premium' }
  });

const deleteById = async (userId) => {
  const user = await User.findByPk(userId);
  if (!user) {
    return null;
  }
  await user.destroy();
  return true;
};

module.exports = {
  listUsersForAdmin,
  findById,
  setTier,
  setRole,
  setPremiumSubscription,
  countTotal,
  countPremium,
  deleteById
};
