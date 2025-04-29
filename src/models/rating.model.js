const db = require("../config/db");

/**
 * Create a new rating
 * @param {Object} ratingData - Rating data
 * @returns {Promise<Object>} Created rating
 */
const createRating = async (ratingData) => {
  const { store_id, user_id, rating, comment } = ratingData;

  // Begin transaction
  const client = await db.getClient();

  try {
    await client.query("BEGIN");

    // Check if user already rated this store
    const existingRating = await client.query(
      "SELECT id FROM ratings WHERE store_id = $1 AND user_id = $2",
      [store_id, user_id]
    );

    let result;

    if (existingRating.rows.length > 0) {
      // Update existing rating
      result = await client.query(
        `UPDATE ratings 
         SET rating = $1, comment = $2, updated_at = NOW() 
         WHERE store_id = $3 AND user_id = $4
         RETURNING id, store_id, user_id, rating, comment, created_at, updated_at`,
        [rating, comment, store_id, user_id]
      );
    } else {
      // Create new rating
      result = await client.query(
        `INSERT INTO ratings (store_id, user_id, rating, comment)
         VALUES ($1, $2, $3, $4)
         RETURNING id, store_id, user_id, rating, comment, created_at, updated_at`,
        [store_id, user_id, rating, comment]
      );
    }

    // Update store's average rating and rating count
    await client.query(
      `UPDATE stores 
       SET average_rating = (
           SELECT AVG(rating) FROM ratings WHERE store_id = $1
       ),
       rating_count = (
           SELECT COUNT(*) FROM ratings WHERE store_id = $1
       ),
       updated_at = NOW()
       WHERE id = $1`,
      [store_id]
    );

    await client.query("COMMIT");
    return result.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Get rating by ID
 * @param {number} id - Rating ID
 * @returns {Promise<Object|null>} Rating object or null if not found
 */
const getRatingById = async (id) => {
  const result = await db.query(
    `SELECT r.id, r.store_id, r.user_id, r.rating, r.comment, r.created_at, r.updated_at,
            u.name as user_name, s.name as store_name
     FROM ratings r
     JOIN users u ON r.user_id = u.id
     JOIN stores s ON r.store_id = s.id
     WHERE r.id = $1`,
    [id]
  );

  return result.rows.length ? result.rows[0] : null;
};

/**
 * Get ratings by store ID
 * @param {number} storeId - Store ID
 * @returns {Promise<Array>} Array of ratings
 */
const getRatingsByStoreId = async (storeId) => {
  const result = await db.query(
    `SELECT r.id, r.store_id, r.user_id, r.rating, r.comment, r.created_at, r.updated_at,
            u.name as user_name
     FROM ratings r
     JOIN users u ON r.user_id = u.id
     WHERE r.store_id = $1
     ORDER BY r.updated_at DESC`,
    [storeId]
  );

  return result.rows.map((r) => ({
    id: r.id,
    storeId: r.store_id,
    userId: r.user_id,
    userName: r.user_name,
    rating: r.rating,
    comment: r.comment,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
};

/**
 * Get ratings by user ID
 * @param {number} userId - User ID
 * @returns {Promise<Array>} Array of ratings
 */
const getRatingsByUserId = async (userId) => {
  const result = await db.query(
    `SELECT r.id, r.store_id, r.user_id, r.rating, r.comment, r.created_at, r.updated_at,
            s.name as store_name
     FROM ratings r
     JOIN stores s ON r.store_id = s.id
     WHERE r.user_id = $1
     ORDER BY r.updated_at DESC`,
    [userId]
  );

  return result.rows.map((r) => ({
    id: r.id,
    storeId: r.store_id,
    userId: r.user_id,
    storeName: r.store_name,
    rating: r.rating,
    comment: r.comment,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
};

/**
 * Update a rating
 * @param {number} id - Rating ID
 * @param {Object} ratingData - Rating data to update
 * @returns {Promise<Object|null>} Updated rating or null if not found
 */
const updateRating = async (id, ratingData) => {
  const { rating, comment } = ratingData;

  // Begin transaction
  const client = await db.getClient();

  try {
    await client.query("BEGIN");

    // Get the current rating for store ID
    const currentRating = await client.query(
      "SELECT store_id FROM ratings WHERE id = $1",
      [id]
    );

    if (currentRating.rows.length === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    const storeId = currentRating.rows[0].store_id;

    // Update the rating
    const result = await client.query(
      `UPDATE ratings
       SET rating = $1, comment = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING id, store_id, user_id, rating, comment, created_at, updated_at`,
      [rating, comment, id]
    );

    // Update store's average rating
    await client.query(
      `UPDATE stores 
       SET average_rating = (
           SELECT AVG(rating) FROM ratings WHERE store_id = $1
       ),
       updated_at = NOW()
       WHERE id = $1`,
      [storeId]
    );

    await client.query("COMMIT");
    return result.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Delete a rating
 * @param {number} id - Rating ID
 * @returns {Promise<Object|null>} Deleted rating or null if not found
 */
const deleteRating = async (id) => {
  // Begin transaction
  const client = await db.getClient();

  try {
    await client.query("BEGIN");

    // Get the current rating for store ID
    const currentRating = await client.query(
      "SELECT id, store_id, user_id, rating, comment, created_at, updated_at FROM ratings WHERE id = $1",
      [id]
    );

    if (currentRating.rows.length === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    const rating = currentRating.rows[0];
    const storeId = rating.store_id;

    // Delete the rating
    await client.query("DELETE FROM ratings WHERE id = $1", [id]);

    // Update store's average rating and count
    await client.query(
      `UPDATE stores 
       SET average_rating = COALESCE((
           SELECT AVG(rating) FROM ratings WHERE store_id = $1
       ), 0),
       rating_count = (
           SELECT COUNT(*) FROM ratings WHERE store_id = $1
       ),
       updated_at = NOW()
       WHERE id = $1`,
      [storeId]
    );

    await client.query("COMMIT");
    return rating;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  createRating,
  getRatingById,
  getRatingsByStoreId,
  getRatingsByUserId,
  updateRating,
  deleteRating,
};
