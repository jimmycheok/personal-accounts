'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('recurring_templates', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: Sequelize.STRING(200), allowNull: false },
      template_type: { type: Sequelize.ENUM('invoice', 'expense'), allowNull: false },
      frequency: { type: Sequelize.ENUM('daily', 'weekly', 'monthly', 'quarterly', 'annually'), allowNull: false },
      next_run_date: { type: Sequelize.DATEONLY, allowNull: false },
      end_date: { type: Sequelize.DATEONLY },
      template_data: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      is_active: { type: Sequelize.BOOLEAN, defaultValue: true },
      last_run_date: { type: Sequelize.DATEONLY },
      run_count: { type: Sequelize.INTEGER, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('recurring_templates');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_recurring_templates_template_type";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_recurring_templates_frequency";');
  },
};
