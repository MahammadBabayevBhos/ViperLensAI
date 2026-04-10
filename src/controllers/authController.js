const bcrypt = require('bcrypt');
const { User } = require('../models');

const ADMIN_EMAIL = 'admin@viperlens.ai';

const toProfileViewModel = async (req, overrides = {}) => {
  const currentUser = await User.findByPk(req.session.user.id);
  const isAdmin = currentUser.email.toLowerCase() === ADMIN_EMAIL;
  const users = isAdmin
    ? await User.findAll({
        attributes: ['id', 'username', 'email', 'tier'],
        order: [['id', 'ASC']]
      })
    : [];

  return {
    pageTitle: 'Profile - ViperLens',
    user: req.session.user,
    profileUser: currentUser,
    isAdmin,
    users,
    error: null,
    success: null,
    ...overrides
  };
};

const renderLogin = (_req, res) => {
  if (_req.session && _req.session.user) {
    return res.redirect('/');
  }
  return res.render('login', {
    pageTitle: 'Login - ViperLens',
    error: null
  });
};

const renderRegister = (_req, res) => {
  if (_req.session && _req.session.user) {
    return res.redirect('/');
  }
  return res.render('register', {
    pageTitle: 'Register - ViperLens',
    error: null
  });
};

const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).render('register', {
        pageTitle: 'Register - ViperLens',
        error: 'All fields are required.'
      });
    }

    const existing = await User.findOne({
      where: {
        email
      }
    });
    if (existing) {
      return res.status(409).render('register', {
        pageTitle: 'Register - ViperLens',
        error: 'Email is already registered.'
      });
    }

    const password_hash = await bcrypt.hash(password, 12);
    const user = await User.create({ username, email, password_hash, tier: 'free' });

    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      tier: user.tier
    };

    return res.redirect('/');
  } catch (error) {
    console.error(`[AUTH] Register failed: ${error.message}`);
    return res.status(500).render('register', {
      pageTitle: 'Register - ViperLens',
      error: 'Registration failed. Please try again.'
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).render('login', {
        pageTitle: 'Login - ViperLens',
        error: 'Email and password are required.'
      });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).render('login', {
        pageTitle: 'Login - ViperLens',
        error: 'Invalid credentials.'
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).render('login', {
        pageTitle: 'Login - ViperLens',
        error: 'Invalid credentials.'
      });
    }

    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      tier: user.tier
    };

    return res.redirect('/');
  } catch (error) {
    console.error(`[AUTH] Login failed: ${error.message}`);
    return res.status(500).render('login', {
      pageTitle: 'Login - ViperLens',
      error: 'Login failed. Please try again.'
    });
  }
};

const logout = (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
};

const renderProfile = async (req, res) => {
  try {
    const success = req.query.success || null;
    return res.render('profile', await toProfileViewModel(req, { success }));
  } catch (error) {
    console.error(`[AUTH] Failed to load profile: ${error.message}`);
    return res.status(500).render('profile', await toProfileViewModel(req, { error: 'Failed to load profile page.' }));
  }
};

const updateProfile = async (req, res) => {
  try {
    const { username, email } = req.body;
    if (!username || !email) {
      return res.status(400).render('profile', await toProfileViewModel(req, { error: 'Username and email are required.' }));
    }

    const profileUser = await User.findByPk(req.session.user.id);
    if (!profileUser) {
      return res.status(404).render('profile', await toProfileViewModel(req, { error: 'User account not found.' }));
    }

    const conflictUser = await User.findOne({
      where: { email }
    });
    if (conflictUser && conflictUser.id !== profileUser.id) {
      return res.status(409).render('profile', await toProfileViewModel(req, { error: 'Email is already in use.' }));
    }

    profileUser.username = username;
    profileUser.email = email;
    await profileUser.save();

    req.session.user = {
      id: profileUser.id,
      username: profileUser.username,
      email: profileUser.email,
      tier: profileUser.tier
    };

    return res.redirect('/profile?success=Profile updated successfully!');
  } catch (error) {
    console.error(`[AUTH] Failed to update profile: ${error.message}`);
    return res.status(500).render('profile', await toProfileViewModel(req, { error: 'Profile update failed.' }));
  }
};

const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword, confirmPassword } = req.body;
    if (!oldPassword || !newPassword || !confirmPassword) {
      return res.status(400).render('profile', await toProfileViewModel(req, { error: 'All password fields are required.' }));
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).render('profile', await toProfileViewModel(req, { error: 'New password and confirmation do not match.' }));
    }
    if (newPassword.length < 8) {
      return res.status(400).render('profile', await toProfileViewModel(req, { error: 'New password must be at least 8 characters.' }));
    }

    const profileUser = await User.findByPk(req.session.user.id);
    if (!profileUser) {
      return res.status(404).render('profile', await toProfileViewModel(req, { error: 'User account not found.' }));
    }

    const isValid = await bcrypt.compare(oldPassword, profileUser.password_hash);
    if (!isValid) {
      return res.status(401).render('profile', await toProfileViewModel(req, { error: 'Current password is incorrect.' }));
    }

    profileUser.password_hash = await bcrypt.hash(newPassword, 12);
    await profileUser.save();
    return res.redirect('/profile?success=Password updated successfully!');
  } catch (error) {
    console.error(`[AUTH] Failed to change password: ${error.message}`);
    return res.status(500).render('profile', await toProfileViewModel(req, { error: 'Password update failed.' }));
  }
};

module.exports = {
  renderLogin,
  renderRegister,
  register,
  login,
  logout,
  renderProfile,
  updateProfile,
  changePassword
};
