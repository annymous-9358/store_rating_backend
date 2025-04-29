const { Pool } = require("pg");
require("dotenv").config();

// Database connection configuration for Neon PostgreSQL
// Create a connection pool using the Neon connection string
const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/store_tracking",
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

// Test database connection
pool.query("SELECT NOW()", (err, res) => {
  if (err) {
    console.error("Database connection error:", err);
  } else {
    console.log("Database connected successfully at:", res.rows[0].now);
  }
});

// Query wrapper with promise
const query = (text, params) => pool.query(text, params);

module.exports = {
  query,
  pool,
};
