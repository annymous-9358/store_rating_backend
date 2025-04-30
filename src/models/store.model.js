const db = require("../config/db");

// Get all stores with their average ratings and all ratings
const getAllStores = async () => {
  // First, get the basic store information with average ratings
  const storesQuery = `
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

  const storesResult = await db.query(storesQuery);
  const stores = storesResult.rows.map((row) => ({
    ...row,
    averageRating: Number(row.average_rating),
    totalRatings: Number(row.rating_count),
    average_rating: undefined,
    rating_count: undefined,
    ratings: [], // Initialize empty ratings array to be filled below
  }));

  // Now get all ratings for all stores
  if (stores.length > 0) {
    const ratingsQuery = `
      SELECT 
        r.id, 
        r.store_id,
        r.user_id,
        r.rating, 
        r.comment,
        r.created_at,
        r.updated_at,
        u.name as user_name
      FROM 
        ratings r
      JOIN 
        users u ON r.user_id = u.id
      WHERE 
        r.store_id = ANY($1)
      ORDER BY 
        r.updated_at DESC
    `;

    const storeIds = stores.map((store) => store.id);
    const ratingsResult = await db.query(ratingsQuery, [storeIds]);

    // Group ratings by store_id and add them to the corresponding store
    ratingsResult.rows.forEach((rating) => {
      const storeIndex = stores.findIndex((s) => s.id === rating.store_id);
      if (storeIndex !== -1) {
        stores[storeIndex].ratings.push({
          id: rating.id,
          storeId: rating.store_id,
          userId: rating.user_id,
          userName: rating.user_name,
          rating: rating.rating,
          comment: rating.comment,
          createdAt: rating.created_at,
          updatedAt: rating.updated_at,
        });
      }
    });
  }

  return stores;
};

// Get a single store by ID with its ratings
const getStoreById = async (storeId) => {
  // First get store basic info with average rating
  const storeQuery = `
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

  const storeResult = await db.query(storeQuery, [storeId]);
  if (!storeResult.rows[0]) return null;

  const store = {
    ...storeResult.rows[0],
    averageRating: Number(storeResult.rows[0].average_rating),
    totalRatings: Number(storeResult.rows[0].rating_count),
    average_rating: undefined,
    rating_count: undefined,
    ratings: [],
  };

  // Get all ratings for this store
  const ratingsQuery = `
    SELECT 
      r.id, 
      r.store_id,
      r.user_id,
      r.rating, 
      r.comment,
      r.created_at,
      r.updated_at,
      u.name as user_name
    FROM 
      ratings r
    JOIN 
      users u ON r.user_id = u.id
    WHERE 
      r.store_id = $1
    ORDER BY 
      r.updated_at DESC
  `;

  const ratingsResult = await db.query(ratingsQuery, [storeId]);

  // Add ratings to the store object
  store.ratings = ratingsResult.rows.map((rating) => ({
    id: rating.id,
    storeId: rating.store_id,
    userId: rating.user_id,
    userName: rating.user_name,
    rating: rating.rating,
    comment: rating.comment,
    createdAt: rating.created_at,
    updatedAt: rating.updated_at,
  }));

  return store;
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
