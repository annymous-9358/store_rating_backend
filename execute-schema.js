const fs = require("fs");
const { Pool } = require("pg");
require("dotenv").config();

console.log("Starting schema execution...");

// Read the schema file
try {
  const schemaSQL = fs.readFileSync("./db/schema.sql", "utf8");
  console.log("Schema file read successfully");

  // Configure PostgreSQL connection
  const pool = new Pool({
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    port: process.env.PGPORT,
    ssl: {
      require: process.env.PGSSLMODE === "require",
    },
  });

  // Execute the schema
  async function executeSchema() {
    console.log("Trying to connect to the database...");
    const client = await pool.connect();
    try {
      console.log("Connected to database. Executing schema...");
      await client.query(schemaSQL);
      console.log("Schema executed successfully!");
    } catch (err) {
      console.error("Error executing schema:", err);
    } finally {
      client.release();
      await pool.end();
      console.log("Database connection closed");
    }
  }

  executeSchema();
} catch (err) {
  console.error("Failed to read schema file:", err);
}
