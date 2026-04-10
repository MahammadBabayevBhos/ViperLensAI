const sequelize = require('./sequelize');
const User = require('./User');
const AnalysisHistory = require('./AnalysisHistory');

User.hasMany(AnalysisHistory, { foreignKey: 'user_id', onDelete: 'CASCADE' });
AnalysisHistory.belongsTo(User, { foreignKey: 'user_id' });

const initDatabase = async () => {
  await sequelize.authenticate();
  await sequelize.sync();
  console.log('[DB] SQLite initialized and models synchronized.');
};

module.exports = {
  sequelize,
  User,
  AnalysisHistory,
  initDatabase
};
