const { User } = require('../models');

const ADMIN_EMAIL = 'admin@viperlens.ai';

const toggleUserTier = async (req, res) => {
  try {
    const actor = req.session.user;
    if (!actor || actor.email.toLowerCase() !== ADMIN_EMAIL) {
      return res.status(403).json({ status: 'forbidden' });
    }

    const { userId } = req.params;
    const targetUser = await User.findByPk(userId);
    if (!targetUser) {
      return res.status(404).json({ status: 'not_found' });
    }

    if (targetUser.email.toLowerCase() === ADMIN_EMAIL) {
      return res.status(400).json({ status: 'cannot_modify_admin' });
    }

    targetUser.tier = targetUser.tier === 'premium' ? 'free' : 'premium';
    await targetUser.save();

    return res.status(200).json({
      status: 'ok',
      user: {
        id: targetUser.id,
        tier: targetUser.tier
      }
    });
  } catch (error) {
    console.error(`[ADMIN] Failed to toggle tier: ${error.message}`);
    return res.status(500).json({ status: 'error' });
  }
};

module.exports = {
  toggleUserTier
};
