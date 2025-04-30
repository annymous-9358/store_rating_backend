const jwt = require("jsonwebtoken");
const db = require("../config/db");

// Secret key for JWT signing - in production, use an environment variable
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key";

// Middleware to authenticate JWT token
const authenticateToken = (req, res, next) => {
  // Get the token from the Authorization header
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN format

  console.log(
    `Auth middleware - Path: ${req.originalUrl}, Method: ${req.method}`
  );
  console.log(
    `Auth header present: ${!!authHeader}, Token present: ${!!token}`
  );

  if (!token) {
    console.log("No token provided for authentication");
    return res.status(401).json({ message: "Authentication required" });
  }

  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) {
      console.log("JWT verification error:", err.message);
      return res.status(403).json({ message: "Invalid or expired token" });
    }

    try {
      // Check if user still exists in the database
      const query = `
        SELECT 
          u.id, 
          u.name, 
          u.email, 
          u.role,
          s.id as store_id
        FROM 
          users u
        LEFT JOIN 
          stores s ON u.id = s.owner_id
        WHERE 
          u.id = $1
      `;

      const result = await db.query(query, [decoded.userId]);

      if (result.rows.length === 0) {
        console.log(`User with ID ${decoded.userId} no longer exists`);
        return res.status(403).json({ message: "User no longer exists" });
      }

      // Add user info to request object
      req.user = {
        id: result.rows[0].id,
        name: result.rows[0].name,
        email: result.rows[0].email,
        role: result.rows[0].role,
        storeId: result.rows[0].store_id,
      };

      console.log(`User authenticated: ${req.user.id}, role: ${req.user.role}`);
      next();
    } catch (error) {
      console.error("Token verification DB error:", error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  });
};

// Middleware to authorize admin users
const authorizeAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }

  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin privileges required" });
  }

  next();
};

// Middleware to authorize store owners
const authorizeStoreOwner = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }

  if (req.user.role !== "store_owner" && req.user.role !== "admin") {
    return res.status(403).json({ message: "Store owner privileges required" });
  }

  next();
};

// Middleware to authorize store owners for their own store
const authorizeStoreAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }

  // Admin can access any store
  if (req.user.role === "admin") {
    return next();
  }

  // Store owners can only access their own store
  if (req.user.role === "store_owner") {
    const requestedStoreId = parseInt(req.params.id);

    if (req.user.storeId !== requestedStoreId) {
      return res
        .status(403)
        .json({ message: "You can only access your own store" });
    }
  }

  next();
};

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "24h" });
};

module.exports = {
  authenticateToken,
  authorizeAdmin,
  authorizeStoreOwner,
  authorizeStoreAccess,
  generateToken,
};
