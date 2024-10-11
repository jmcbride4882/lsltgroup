// ~/lslt-portal/employee-service/config/db.js

const { Pool } = require('pg'); // Import the Pool class from the pg module

// Configure the PostgreSQL connection pool using environment variables
const pool = new Pool({
  user: process.env.DB_USER || 'john',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'employee_db',
  password: process.env.DB_PASSWORD || 'Summer15',
  port: process.env.DB_PORT || 5432,
});

// Export a function to execute SQL queries using the connection pool
module.exports = {
  query: (text, params) => pool.query(text, params),
};
