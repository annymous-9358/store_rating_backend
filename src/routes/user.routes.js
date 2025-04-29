const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const db = require("../config/db");
const { authenticateToken, authorizeAdmin } = require("../middleware/auth");

// Get all users (admin only)
router.get("/", authenticateToken, authorizeAdmin, async (req, res) => {
  try {
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

    // Format the response
    const users = result.rows.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      address: user.address,
      role: user.role,
      storeId: user.store_id,
      storeName: user.store_name,
      createdAt: user.created_at,
    }));

    res.status(200).json({ users });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get a specific user (admin only)
router.get("/:id", authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const userId = req.params.id;

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

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = result.rows[0];

    // Get user ratings
    const ratingsQuery = `
      SELECT 
        r.id, 
        r.value, 
        r.created_at,
        s.id as store_id,
        s.name as store_name
      FROM 
        ratings r
      JOIN 
        stores s ON r.store_id = s.id
      WHERE 
        r.user_id = $1
      ORDER BY 
        r.created_at DESC
    `;

    const ratingsResult = await db.query(ratingsQuery, [userId]);

    // Format the response
    res.status(200).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        address: user.address,
        role: user.role,
        storeId: user.store_id,
        storeName: user.store_name,
        createdAt: user.created_at,
        ratings: ratingsResult.rows.map((rating) => ({
          id: rating.id,
          value: rating.value,
          storeId: rating.store_id,
          storeName: rating.store_name,
          createdAt: rating.created_at,
        })),
      },
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Create a new user (admin only)
router.post("/", authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const { name, email, password, address, role } = req.body;

    // Validate inputs
    if (!name || !email || !password || !role) {
      return res
        .status(400)
        .json({ message: "Name, email, password, and role are required" });
    }

    // Check if email already exists
    const emailCheck = await db.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ message: "Email already in use" });
    }

    // Validate name length (20-60 characters)
    if (name.length < 20 || name.length > 60) {
      return res
        .status(400)
        .json({ message: "Name must be between 20 and 60 characters" });
    }

    // Validate password (8-16 chars, 1 uppercase, 1 special char)
    const passwordRegex =
      /^(?=.*[A-Z])(?=.*[!@#$%^&*])[a-zA-Z0-9!@#$%^&*]{8,16}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        message:
          "Password must be 8-16 characters and include at least one uppercase letter and one special character",
      });
    }

    // Validate address length (max 400 characters)
    if (address && address.length > 400) {
      return res
        .status(400)
        .json({ message: "Address must be less than 400 characters" });
    }

    // Validate role
    const validRoles = ["user", "admin", "store_owner"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insert user into database
    const query = `
      INSERT INTO users (name, email, password, address, role)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, name, email, address, role, created_at
    `;

    const values = [name, email, hashedPassword, address, role];
    const result = await db.query(query, values);

    res.status(201).json({
      user: result.rows[0],
      message: "User created successfully",
    });
  } catch (error) {
    console.error("Create user error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Update a user (admin only)
router.put("/:id", authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const { name, email, password, address, role } = req.body;

    // Check if user exists
    const userCheck = await db.query("SELECT * FROM users WHERE id = $1", [
      userId,
    ]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    // Validate inputs if provided
    if (name && (name.length < 20 || name.length > 60)) {
      return res
        .status(400)
        .json({ message: "Name must be between 20 and 60 characters" });
    }

    if (password) {
      const passwordRegex =
        /^(?=.*[A-Z])(?=.*[!@#$%^&*])[a-zA-Z0-9!@#$%^&*]{8,16}$/;
      if (!passwordRegex.test(password)) {
        return res.status(400).json({
          message:
            "Password must be 8-16 characters and include at least one uppercase letter and one special character",
        });
      }
    }

    if (address && address.length > 400) {
      return res
        .status(400)
        .json({ message: "Address must be less than 400 characters" });
    }

    if (role) {
      const validRoles = ["user", "admin", "store_owner"];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }
    }

    // Check email uniqueness if provided
    if (email) {
      const emailCheck = await db.query(
        "SELECT * FROM users WHERE email = $1 AND id != $2",
        [email, userId]
      );
      if (emailCheck.rows.length > 0) {
        return res.status(400).json({ message: "Email already in use" });
      }
    }

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

    if (updateFields.length === 0) {
      return res.status(400).json({ message: "No valid fields to update" });
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

    res.status(200).json({
      user: result.rows[0],
      message: "User updated successfully",
    });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Delete a user (admin only)
router.delete("/:id", authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const userId = req.params.id;

    // Check if user exists
    const userCheck = await db.query("SELECT * FROM users WHERE id = $1", [
      userId,
    ]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    // Delete user
    await db.query("DELETE FROM users WHERE id = $1", [userId]);

    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
