// CJS config for sequelize-cli
require('dotenv').config();

module.exports = {
  development: {
    url: process.env.DATABASE_URL || 'postgres://pa_user:pa_password@localhost:5432/personal_accountant',
    dialect: 'postgres',
    logging: false,
  },
  test: {
    url: process.env.DATABASE_URL,
    dialect: 'postgres',
    logging: false,
  },
  production: {
    url: process.env.DATABASE_URL,
    dialect: 'postgres',
    dialectOptions: {
      ssl: { require: true, rejectUnauthorized: false },
    },
    logging: false,
  },
};
