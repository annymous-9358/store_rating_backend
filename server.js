const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Configure PostgreSQL connection pool
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

// Middleware
app.use(
  cors({
    origin: true, // Allow all origins
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token)
    return res
      .status(401)
      .json({ message: "Access denied. No token provided." });

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid token" });
  }
};

// Check role middleware
const checkRole = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ message: "Access denied. Insufficient permissions." });
    }
    next();
  };
};

// ============== AUTH ROUTES ==============

// Register route (for normal users only)
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password, address } = req.body;

    // Validate input
    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email, and password are required" });
    }

    // Validate name length
    if (name.length < 20 || name.length > 60) {
      return res
        .status(400)
        .json({ message: "Name must be between 20 and 60 characters" });
    }

    // Validate address length
    if (address && address.length > 400) {
      return res
        .status(400)
        .json({ message: "Address cannot exceed 400 characters" });
    }

    // Validate password
    if (password.length < 8 || password.length > 16) {
      return res
        .status(400)
        .json({ message: "Password must be between 8 and 16 characters" });
    }

    if (!/[A-Z]/.test(password)) {
      return res.status(400).json({
        message: "Password must contain at least one uppercase letter",
      });
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      return res.status(400).json({
        message: "Password must contain at least one special character",
      });
    }

    // Check if email exists
    const emailExists = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );
    if (emailExists.rows.length > 0) {
      return res.status(400).json({ message: "Email already exists" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const result = await pool.query(
      "INSERT INTO users (name, email, password, address, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role",
      [name, email, hashedPassword, address, "user"]
    );

    res.status(201).json({
      message: "User registered successfully",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Login route
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    // Check if user exists
    const userResult = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );
    if (userResult.rows.length === 0) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const user = userResult.rows[0];

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // Create and sign JWT token
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    // Remove password before sending user data
    const { password: _, ...userWithoutPassword } = user;

    res.status(200).json({
      message: "Login successful",
      token,
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Check auth status
app.get("/api/auth/status", authenticateToken, async (req, res) => {
  try {
    const userResult = await pool.query(
      "SELECT id, name, email, address, role FROM users WHERE id = $1",
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ user: userResult.rows[0] });
  } catch (error) {
    console.error("Auth status error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Update password
app.put("/api/auth/password", authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: "Current and new passwords are required" });
    }

    // Validate new password
    if (newPassword.length < 8 || newPassword.length > 16) {
      return res
        .status(400)
        .json({ message: "Password must be between 8 and 16 characters" });
    }

    if (!/[A-Z]/.test(newPassword)) {
      return res.status(400).json({
        message: "Password must contain at least one uppercase letter",
      });
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) {
      return res.status(400).json({
        message: "Password must contain at least one special character",
      });
    }

    // Get user from database
    const userResult = await pool.query("SELECT * FROM users WHERE id = $1", [
      req.user.id,
    ]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = userResult.rows[0];

    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    await pool.query(
      "UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2",
      [hashedPassword, req.user.id]
    );

    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Password update error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ============== USER ROUTES ==============

// Get all users (admin only)
app.get(
  "/api/users",
  authenticateToken,
  checkRole(["admin"]),
  async (req, res) => {
    try {
      // Get query parameters for filtering
      const { name, email, address, role } = req.query;

      let query = "SELECT id, name, email, address, role FROM users WHERE 1=1";
      const params = [];
      let paramIndex = 1;

      // Add filters if provided
      if (name) {
        query += ` AND name ILIKE $${paramIndex}`;
        params.push(`%${name}%`);
        paramIndex++;
      }

      if (email) {
        query += ` AND email ILIKE $${paramIndex}`;
        params.push(`%${email}%`);
        paramIndex++;
      }

      if (address) {
        query += ` AND address ILIKE $${paramIndex}`;
        params.push(`%${address}%`);
        paramIndex++;
      }

      if (role) {
        query += ` AND role = $${paramIndex}`;
        params.push(role);
        paramIndex++;
      }

      // Add sorting
      const sortField = req.query.sortField || "name";
      const sortOrder = req.query.sortOrder === "desc" ? "DESC" : "ASC";
      query += ` ORDER BY ${sortField} ${sortOrder}`;

      const result = await pool.query(query, params);

      res.status(200).json(result.rows);
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// ============== STORE ROUTES ==============

// Get all stores
app.get("/api/stores", async (req, res) => {
  try {
    // Get query parameters for filtering
    const { name, address } = req.query;

    // Base query to get stores with their average ratings
    let query = `
      SELECT 
        s.id, 
        s.name, 
        s.email, 
        s.address, 
        s.owner_id,
        COALESCE(AVG(r.rating), 0) as average_rating,
        COUNT(r.id) as rating_count
      FROM 
        stores s
      LEFT JOIN 
        ratings r ON s.id = r.store_id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    // Add filters if provided
    if (name) {
      query += ` AND s.name ILIKE $${paramIndex}`;
      params.push(`%${name}%`);
      paramIndex++;
    }

    if (address) {
      query += ` AND s.address ILIKE $${paramIndex}`;
      params.push(`%${address}%`);
      paramIndex++;
    }

    // Group by store fields
    query += ` GROUP BY s.id, s.name, s.email, s.address, s.owner_id`;

    // Add sorting
    const sortField = req.query.sortField || "s.name";
    const sortOrder = req.query.sortOrder === "desc" ? "DESC" : "ASC";
    query += ` ORDER BY ${sortField} ${sortOrder}`;

    const result = await pool.query(query, params);

    // If user is authenticated, get their ratings for these stores
    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Get user's ratings for all stores
        const userRatings = await pool.query(
          "SELECT store_id, rating FROM ratings WHERE user_id = $1",
          [decoded.id]
        );

        // Create a map of store_id to rating
        const ratingsMap = {};
        userRatings.rows.forEach((rating) => {
          ratingsMap[rating.store_id] = rating.rating;
        });

        // Add user's rating to each store
        result.rows.forEach((store) => {
          store.user_rating = ratingsMap[store.id] || null;
        });
      } catch (error) {
        // If token verification fails, continue without adding user ratings
        console.error("Token verification error:", error);
      }
    }

    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Get stores error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ============== RATING ROUTES ==============

// Submit a rating
app.post(
  "/api/ratings",
  authenticateToken,
  checkRole(["user"]),
  async (req, res) => {
    try {
      const { storeId, rating } = req.body;
      const userId = req.user.id;

      // Validate input
      if (!storeId || !rating) {
        return res
          .status(400)
          .json({ message: "Store ID and rating are required" });
      }

      // Validate rating value
      if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
        return res
          .status(400)
          .json({ message: "Rating must be an integer between 1 and 5" });
      }

      // Check if store exists
      const storeResult = await pool.query(
        "SELECT * FROM stores WHERE id = $1",
        [storeId]
      );
      if (storeResult.rows.length === 0) {
        return res.status(404).json({ message: "Store not found" });
      }

      // Check if user already rated this store
      const existingRating = await pool.query(
        "SELECT * FROM ratings WHERE user_id = $1 AND store_id = $2",
        [userId, storeId]
      );

      if (existingRating.rows.length > 0) {
        // Update existing rating
        await pool.query(
          "UPDATE ratings SET rating = $1, updated_at = NOW() WHERE user_id = $2 AND store_id = $3",
          [rating, userId, storeId]
        );

        res.status(200).json({ message: "Rating updated successfully" });
      } else {
        // Create new rating
        await pool.query(
          "INSERT INTO ratings (user_id, store_id, rating) VALUES ($1, $2, $3)",
          [userId, storeId, rating]
        );

        res.status(201).json({ message: "Rating submitted successfully" });
      }
    } catch (error) {
      console.error("Submit rating error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// ============== DASHBOARD ROUTES ==============

// Admin dashboard data
app.get(
  "/api/dashboard/admin",
  authenticateToken,
  checkRole(["admin"]),
  async (req, res) => {
    try {
      // Get total counts
      const userCount = await pool.query("SELECT COUNT(*) FROM users");
      const storeCount = await pool.query("SELECT COUNT(*) FROM stores");
      const ratingCount = await pool.query("SELECT COUNT(*) FROM ratings");

      res.status(200).json({
        totalUsers: parseInt(userCount.rows[0].count),
        totalStores: parseInt(storeCount.rows[0].count),
        totalRatings: parseInt(ratingCount.rows[0].count),
      });
    } catch (error) {
      console.error("Admin dashboard error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Store owner dashboard data
app.get(
  "/api/dashboard/store-owner",
  authenticateToken,
  checkRole(["store_owner"]),
  async (req, res) => {
    try {
      // Get store owned by user
      const storeResult = await pool.query(
        "SELECT * FROM stores WHERE owner_id = $1",
        [req.user.id]
      );

      if (storeResult.rows.length === 0) {
        return res
          .status(404)
          .json({ message: "No store found for this owner" });
      }

      const store = storeResult.rows[0];

      // Get store ratings
      const ratingsResult = await pool.query(
        `
      SELECT 
        r.id,
        r.rating,
        r.created_at,
        u.id as user_id,
        u.name as user_name,
        u.email as user_email
      FROM 
        ratings r
      JOIN 
        users u ON r.user_id = u.id
      WHERE 
        r.store_id = $1
      ORDER BY 
        r.created_at DESC
    `,
        [store.id]
      );

      // Get average rating
      const avgRatingResult = await pool.query(
        "SELECT AVG(rating) FROM ratings WHERE store_id = $1",
        [store.id]
      );

      res.status(200).json({
        store,
        ratings: ratingsResult.rows,
        averageRating: parseFloat(avgRatingResult.rows[0].avg) || 0,
        totalRatings: ratingsResult.rows.length,
      });
    } catch (error) {
      console.error("Store owner dashboard error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Handle shutdown gracefully
process.on("SIGINT", () => {
  pool.end();
  console.log("Application shut down");
  process.exit(0);
});
