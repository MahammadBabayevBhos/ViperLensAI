const { SUPER_ADMIN_EMAIL } = require('../config/constants');
const userRepository = require('../repositories/userRepository');
const analyticsRepository = require('../repositories/analyticsRepository');
const { toSessionUser } = require('../utils/sessionUser');

const renderDashboard = async (req, res) => {
  try {
    const [summary, users] = await Promise.all([
      analyticsRepository.getDashboardSummary(),
      userRepository.listUsersForAdmin()
    ]);

    return res.render('admin/dashboard', {
      pageTitle: 'Admin Dashboard - ViperLens',
      user: req.session.user,
      superAdminEmail: SUPER_ADMIN_EMAIL,
      stats: summary,
      users
    });
  } catch (error) {
    console.error(`[ADMIN] Dashboard failed: ${error.message}`);
    return res.status(500).render('forbidden', {
      pageTitle: 'Error',
      message: 'Unable to load the admin dashboard.'
    });
  }
};

const toggleUserTier = async (req, res) => {
  try {
    const { userId } = req.params;
    const targetUser = await userRepository.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ status: 'not_found' });
    }

    if (targetUser.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
      return res.status(400).json({ status: 'cannot_modify_admin' });
    }

    const nextTier = targetUser.tier === 'premium' ? 'free' : 'premium';
    const updated = await userRepository.setTier(userId, nextTier);
    if (!updated) {
      return res.status(500).json({ status: 'error' });
    }

    return res.status(200).json({
      status: 'ok',
      user: {
        id: updated.id,
        tier: updated.tier
      }
    });
  } catch (error) {
    console.error(`[ADMIN] Failed to toggle tier: ${error.message}`);
    return res.status(500).json({ status: 'error' });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const actorId = Number(req.session.user.id);
    const targetId = Number(userId);

    if (Number.isNaN(targetId)) {
      return res.status(400).json({ status: 'invalid_id' });
    }

    if (targetId === actorId) {
      return res.status(400).json({ status: 'cannot_delete_self' });
    }

    const targetUser = await userRepository.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ status: 'not_found' });
    }

    if (targetUser.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
      return res.status(400).json({ status: 'cannot_delete_admin' });
    }

    const deleted = await userRepository.deleteById(userId);
    if (!deleted) {
      return res.status(500).json({ status: 'error' });
    }

    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error(`[ADMIN] Failed to delete user: ${error.message}`);
    return res.status(500).json({ status: 'error' });
  }
};

const updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const nextRole = (req.body && req.body.role) || '';

    if (nextRole !== 'user' && nextRole !== 'admin') {
      return res.status(400).json({ status: 'invalid_role' });
    }

    const targetUser = await userRepository.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ status: 'not_found' });
    }

    if (targetUser.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase() && nextRole !== 'admin') {
      return res.status(400).json({ status: 'cannot_demote_super_admin' });
    }

    const updated = await userRepository.setRole(userId, nextRole);
    if (!updated) {
      return res.status(500).json({ status: 'error' });
    }

    if (req.session.user && Number(req.session.user.id) === Number(userId)) {
      req.session.user = toSessionUser(updated);
    }

    return res.status(200).json({
      status: 'ok',
      user: {
        id: updated.id,
        role: updated.role
      }
    });
  } catch (error) {
    console.error(`[ADMIN] Failed to update role: ${error.message}`);
    return res.status(500).json({ status: 'error' });
  }
};

module.exports = {
  renderDashboard,
  toggleUserTier,
  updateUserRole,
  deleteUser
};
