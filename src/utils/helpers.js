const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();

// JWT secret key
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "24h";

/**
 * Wrapper for async route handlers to avoid try/catch blocks in each route
 * @param {Function} fn - Async route handler function
 * @returns {Function} Express middleware function
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Hash a password
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
const hashPassword = async (password) => {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
};

/**
 * Compare a password with a hashed password
 * @param {string} password - Plain text password
 * @param {string} hashedPassword - Hashed password
 * @returns {Promise<boolean>} True if passwords match
 */
const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

/**
 * Generate a JWT token
 * @param {Object} payload - Token payload
 * @returns {string} JWT token
 */
const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid email format
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {boolean} True if password meets strength requirements
 */
const isStrongPassword = (password) => {
  // Password requirements:
  // - 8-16 characters
  // - At least one uppercase letter
  // - At least one special character
  const passwordRegex =
    /^(?=.*[A-Z])(?=.*[!@#$%^&*])[a-zA-Z0-9!@#$%^&*]{8,16}$/;
  return passwordRegex.test(password);
};

/**
 * Format date to a readable string
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date string
 */
const formatDate = (date) => {
  return new Date(date).toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * Calculate average rating
 * @param {Array} ratings - Array of rating objects
 * @returns {number} Average rating value
 */
const calculateAverageRating = (ratings) => {
  if (!ratings || ratings.length === 0) return 0;

  const sum = ratings.reduce((total, rating) => total + rating.value, 0);
  return parseFloat((sum / ratings.length).toFixed(1));
};

/**
 * Strip sensitive data from user object
 * @param {Object} user - User object
 * @returns {Object} User object without sensitive data
 */
const sanitizeUser = (user) => {
  if (!user) return null;

  const { password, ...sanitizedUser } = user;
  return sanitizedUser;
};

module.exports = {
  asyncHandler,
  hashPassword,
  comparePassword,
  generateToken,
  isValidEmail,
  isStrongPassword,
  formatDate,
  calculateAverageRating,
  sanitizeUser,
};
