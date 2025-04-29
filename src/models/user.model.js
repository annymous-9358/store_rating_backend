const db = require("../config/db");
const bcrypt = require("bcrypt");

// Get all users with their store information if applicable
const getAllUsers = async () => {
  const query = `
    SELECT 
      u.id, 
      u.name, 
      u.email, 
      u.address, 
      u.role, 
      u.created_at,
      s.id as store_id,
      s.name as store_name
    FROM 
      users u
    LEFT JOIN 
      stores s ON u.id = s.owner_id
    ORDER BY 
      u.name
  `;

  const result = await db.query(query);
  return result.rows;
};

// Get a user by ID with their store information if applicable
const getUserById = async (userId) => {
  const query = `
    SELECT 
      u.id, 
      u.name, 
      u.email, 
      u.address, 
      u.role, 
      u.created_at,
      s.id as store_id,
      s.name as store_name
    FROM 
      users u
    LEFT JOIN 
      stores s ON u.id = s.owner_id
    WHERE 
      u.id = $1
  `;

  const result = await db.query(query, [userId]);
  return result.rows[0];
};

// Get a user by email (for authentication)
const getUserByEmail = async (email) => {
  const query = `
    SELECT 
      u.*, 
      s.id as store_id, 
      s.name as store_name
    FROM 
      users u
    LEFT JOIN 
      stores s ON u.id = s.owner_id
    WHERE 
      u.email = $1
  `;

  const result = await db.query(query, [email]);
  return result.rows[0];
};

// Create a new user
const createUser = async (userData) => {
  const { name, email, password, address, role } = userData;

  // Hash password
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  const query = `
    INSERT INTO users (name, email, password, address, role)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, name, email, address, role, created_at
  `;

  const values = [name, email, hashedPassword, address, role];
  const result = await db.query(query, values);

  return result.rows[0];
};

// Update a user
const updateUser = async (userId, userData) => {
  const { name, email, password, address, role } = userData;

  // Build update query dynamically
  let updateFields = [];
  let values = [];
  let valueIndex = 1;

  if (name) {
    updateFields.push(`name = $${valueIndex}`);
    values.push(name);
    valueIndex++;
  }

  if (email) {
    updateFields.push(`email = $${valueIndex}`);
    values.push(email);
    valueIndex++;
  }

  if (password) {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    updateFields.push(`password = $${valueIndex}`);
    values.push(hashedPassword);
    valueIndex++;
  }

  if (address !== undefined) {
    updateFields.push(`address = $${valueIndex}`);
    values.push(address);
    valueIndex++;
  }

  if (role) {
    updateFields.push(`role = $${valueIndex}`);
    values.push(role);
    valueIndex++;
  }

  // Add user ID to values
  values.push(userId);

  const query = `
    UPDATE users
    SET ${updateFields.join(", ")}
    WHERE id = $${valueIndex}
    RETURNING id, name, email, address, role, created_at
  `;

  const result = await db.query(query, values);
  return result.rows[0];
};

// Delete a user
const deleteUser = async (userId) => {
  const query = "DELETE FROM users WHERE id = $1 RETURNING id";
  const result = await db.query(query, [userId]);
  return result.rows[0];
};

// Change user password
const updatePassword = async (userId, newPassword) => {
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

  const query = `
    UPDATE users
    SET password = $1
    WHERE id = $2
    RETURNING id
  `;

  const result = await db.query(query, [hashedPassword, userId]);
  return result.rows[0];
};

// Get store owners without stores assigned
const getAvailableStoreOwners = async () => {
  const query = `
    SELECT 
      u.id, 
      u.name, 
      u.email
    FROM 
      users u
    LEFT JOIN 
      stores s ON u.id = s.owner_id
    WHERE 
      u.role = 'store_owner' AND s.id IS NULL
    ORDER BY 
      u.name
  `;

  const result = await db.query(query);
  return result.rows;
};

// Check if email is already in use
const isEmailInUse = async (email, excludeUserId = null) => {
  let query = "SELECT id FROM users WHERE email = $1";
  let params = [email];

  if (excludeUserId) {
    query += " AND id != $2";
    params.push(excludeUserId);
  }

  const result = await db.query(query, params);
  return result.rows.length > 0;
};

// Verify user password
const verifyPassword = async (userId, password) => {
  const query = "SELECT password FROM users WHERE id = $1";
  const result = await db.query(query, [userId]);

  if (result.rows.length === 0) {
    return false;
  }

  const hashedPassword = result.rows[0].password;
  return bcrypt.compare(password, hashedPassword);
};

module.exports = {
  getAllUsers,
  getUserById,
  getUserByEmail,
  createUser,
  updateUser,
  deleteUser,
  updatePassword,
  getAvailableStoreOwners,
  isEmailInUse,
  verifyPassword,
};
