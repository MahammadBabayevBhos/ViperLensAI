const { DataTypes } = require('sequelize');
const sequelize = require('./sequelize');

const AnalysisHistory = sequelize.define(
  'AnalysisHistory',
  {
    file_name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    verdict: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'unknown'
    },
    confidence: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'completed'
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    report_json: {
      type: DataTypes.TEXT,
      allowNull: false
    }
  },
  {
    tableName: 'analysis_history'
  }
);

module.exports = AnalysisHistory;
