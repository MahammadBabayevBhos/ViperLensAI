const { DataTypes } = require('sequelize');
const sequelize = require('./sequelize');

const User = sequelize.define(
  'User',
  {
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: { isEmail: true }
    },
    password_hash: {
      type: DataTypes.STRING,
      allowNull: false
    },
    tier: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'free'
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'user'
    }
  },
  {
    tableName: 'users'
  }
);

module.exports = User;
