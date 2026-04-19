const { QueryTypes } = require('sequelize');
const sequelize = require('./sequelize');
const User = require('./User');
const AnalysisHistory = require('./AnalysisHistory');

User.hasMany(AnalysisHistory, { foreignKey: 'user_id', onDelete: 'CASCADE' });
AnalysisHistory.belongsTo(User, { foreignKey: 'user_id' });

const backfillMalwareFamilies = async () => {
  try {
    await sequelize.query(
      `UPDATE analysis_history
       SET malware_family = COALESCE(
         NULLIF(TRIM(json_extract(report_json, '$.result.analysis.malware_family')), ''),
         json_extract(report_json, '$.result.analysis.prediction.label'),
         json_extract(report_json, '$.result.analysis.verdict'),
         'unknown'
       )
       WHERE json_extract(report_json, '$.result.analysis') IS NOT NULL
         AND (malware_family = 'unknown' OR malware_family IS NULL OR malware_family = '')`,
      { type: QueryTypes.UPDATE }
    );
  } catch (error) {
    console.warn(`[DB] Malware family backfill skipped: ${error.message}`);
  }
};

const dropSqliteSequelizeAlterBackups = async () => {
  if (sequelize.getDialect() !== 'sqlite') {
    return;
  }
  const rows = await sequelize.query(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name GLOB '*_backup'`,
    { type: QueryTypes.SELECT }
  );
  for (const row of rows) {
    const tableName = row.name;
    await sequelize.query(`DROP TABLE IF EXISTS "${String(tableName).replace(/"/g, '""')}"`);
  }
};

const initDatabase = async () => {
  await sequelize.authenticate();
  await dropSqliteSequelizeAlterBackups();
  const isSqlite = sequelize.getDialect() === 'sqlite';
  if (isSqlite) {
    await sequelize.query('PRAGMA foreign_keys = OFF');
  }
  try {
    await sequelize.sync({ alter: true });
  } finally {
    if (isSqlite) {
      await sequelize.query('PRAGMA foreign_keys = ON');
    }
  }
  await backfillMalwareFamilies();
  console.log('[DB] SQLite initialized and models synchronized.');
};

module.exports = {
  sequelize,
  User,
  AnalysisHistory,
  initDatabase
};
