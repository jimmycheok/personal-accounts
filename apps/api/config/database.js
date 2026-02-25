import { Sequelize } from 'sequelize';

export const sequelize = new Sequelize(
  process.env.DATABASE_URL || 'postgres://pa_user:pa_password@localhost:5432/personal_accountant',
  {
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    dialectOptions: process.env.NODE_ENV === 'production' ? {
      ssl: { require: true, rejectUnauthorized: false },
    } : {},
  }
);

// For sequelize-cli (CommonJS format via .sequelizerc)
export default {
  development: {
    url: process.env.DATABASE_URL || 'postgres://pa_user:pa_password@localhost:5432/personal_accountant',
    dialect: 'postgres',
    logging: false,
  },
  production: {
    url: process.env.DATABASE_URL,
    dialect: 'postgres',
    dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
    logging: false,
  },
};
