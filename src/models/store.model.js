const db = require("../config/db");

// Get all stores with their average ratings
const getAllStores = async () => {
  const query = `
    SELECT 
      s.id, 
      s.name, 
      s.email, 
      s.address,
      s.owner_id,
      u.name as owner_name,
      COALESCE(AVG(r.rating), 0) as average_rating,
      COUNT(r.id) as rating_count,
      s.created_at,
      s.updated_at
    FROM 
      stores s
    LEFT JOIN 
      users u ON s.owner_id = u.id
    LEFT JOIN 
      ratings r ON s.id = r.store_id
    GROUP BY 
      s.id, u.name
    ORDER BY 
      s.name
  `;

  const result = await db.query(query);
  return result.rows.map((row) => ({
    ...row,
    averageRating: Number(row.average_rating),
    totalRatings: Number(row.rating_count),
    average_rating: undefined,
    rating_count: undefined,
  }));
};

// Get a single store by ID with its ratings
const getStoreById = async (storeId) => {
  const query = `
    SELECT 
      s.id, 
      s.name, 
      s.email, 
      s.address,
      s.owner_id,
      u.name as owner_name,
      COALESCE(AVG(r.rating), 0) as average_rating,
      COUNT(r.id) as rating_count,
      s.created_at,
      s.updated_at
    FROM 
      stores s
    LEFT JOIN 
      users u ON s.owner_id = u.id
    LEFT JOIN 
      ratings r ON s.id = r.store_id
    WHERE 
      s.id = $1
    GROUP BY 
      s.id, u.name
  `;

  const result = await db.query(query, [storeId]);
  if (!result.rows[0]) return null;
  const row = result.rows[0];
  return {
    ...row,
    averageRating: Number(row.average_rating),
    totalRatings: Number(row.rating_count),
    average_rating: undefined,
    rating_count: undefined,
  };
};

// Get all ratings for a store
const getStoreRatings = async (storeId) => {
  const query = `
    SELECT 
      r.id, 
      r.rating, 
      r.created_at,
      r.updated_at,
      u.id as user_id,
      u.name as user_name
    FROM 
      ratings r
    JOIN 
      users u ON r.user_id = u.id
    WHERE 
      r.store_id = $1
    ORDER BY 
      r.created_at DESC
  `;

  const result = await db.query(query, [storeId]);
  return result.rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    userName: r.user_name,
    rating: r.rating,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
};

// Create a new store
const createStore = async (storeData) => {
  const { name, email, address, ownerId } = storeData;

  const query = `
    INSERT INTO stores (name, email, address, owner_id)
    VALUES ($1, $2, $3, $4)
    RETURNING id, name, email, address, owner_id, created_at, updated_at
  `;

  const values = [name, email, address, ownerId || null];
  const result = await db.query(query, values);

  return result.rows[0];
};

// Update a store
const updateStore = async (storeId, storeData) => {
  const { name, email, address, ownerId } = storeData;

  // Build update query dynamically
  let updateFields = [];
  let values = [];
  let valueIndex = 1;

  if (name !== undefined) {
    updateFields.push(`name = $${valueIndex}`);
    values.push(name);
    valueIndex++;
  }

  if (email !== undefined) {
    updateFields.push(`email = $${valueIndex}`);
    values.push(email);
    valueIndex++;
  }

  if (address !== undefined) {
    updateFields.push(`address = $${valueIndex}`);
    values.push(address);
    valueIndex++;
  }

  if (ownerId !== undefined) {
    updateFields.push(`owner_id = $${valueIndex}`);
    values.push(ownerId);
    valueIndex++;
  }

  // Add store ID to values
  values.push(storeId);

  const query = `
    UPDATE stores
    SET ${updateFields.join(", ")}
    WHERE id = $${valueIndex}
    RETURNING id, name, email, address, owner_id, created_at, updated_at
  `;

  const result = await db.query(query, values);
  return result.rows[0];
};

// Delete a store
const deleteStore = async (storeId) => {
  const query = "DELETE FROM stores WHERE id = $1 RETURNING id";
  const result = await db.query(query, [storeId]);
  return result.rows[0];
};

// Get stores by owner ID
const getStoresByOwnerId = async (ownerId) => {
  const query = `
    SELECT 
      s.id, 
      s.name, 
      s.email, 
      s.address,
      COALESCE(AVG(r.rating), 0) as average_rating,
      COUNT(r.id) as rating_count,
      s.created_at,
      s.updated_at
    FROM 
      stores s
    LEFT JOIN 
      ratings r ON s.id = r.store_id
    WHERE 
      s.owner_id = $1
    GROUP BY 
      s.id
  `;

  const result = await db.query(query, [ownerId]);
  return result.rows.map((row) => ({
    ...row,
    averageRating: Number(row.average_rating),
    totalRatings: Number(row.rating_count),
    average_rating: undefined,
    rating_count: undefined,
  }));
};

// Check if email is already in use
const isEmailInUse = async (email, excludeStoreId = null) => {
  let query = "SELECT id FROM stores WHERE email = $1";
  let params = [email];

  if (excludeStoreId) {
    query += " AND id != $2";
    params.push(excludeStoreId);
  }

  const result = await db.query(query, params);
  return result.rows.length > 0;
};

module.exports = {
  getAllStores,
  getStoreById,
  getStoreRatings,
  createStore,
  updateStore,
  deleteStore,
  getStoresByOwnerId,
  isEmailInUse,
};
