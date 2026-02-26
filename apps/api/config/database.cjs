// CJS config for sequelize-cli only (not used at runtime).
// Only loads .env if DATABASE_URL isn't already in the environment
// (Docker and PM2 set it before this runs; local dev needs dotenv).
if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });
}

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
