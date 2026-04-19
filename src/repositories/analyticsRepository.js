/**
 * Analytics queries — replace with Supabase RPC or SQL against Postgres when migrating.
 */
const { sequelize, AnalysisHistory } = require('../models');
const { QueryTypes } = require('sequelize');
const userRepository = require('./userRepository');

const getMalwareFamilyDistribution = async () => {
  const rows = await sequelize.query(
    `SELECT malware_family AS family, COUNT(*) AS count
     FROM analysis_history
     GROUP BY malware_family
     ORDER BY count DESC`,
    { type: QueryTypes.SELECT }
  );
  return rows.map((row) => ({
    family: row.family || 'unknown',
    count: Number(row.count) || 0
  }));
};

const countTotalScans = async () => AnalysisHistory.count();

const getDashboardSummary = async () => {
  const [totalUsers, premiumSubscriptions, totalFilesScanned, malwareFamilies] = await Promise.all([
    userRepository.countTotal(),
    userRepository.countPremium(),
    countTotalScans(),
    getMalwareFamilyDistribution()
  ]);

  return {
    totalUsers,
    premiumSubscriptions,
    totalFilesScanned,
    malwareFamilies
  };
};

module.exports = {
  getMalwareFamilyDistribution,
  countTotalScans,
  getDashboardSummary
};
