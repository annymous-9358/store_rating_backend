const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

// Import routes
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const storeRoutes = require("./routes/store.routes");
const ratingsRoutes = require("./routes/ratings.routes");

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  console.log("Request Headers:", JSON.stringify(req.headers));

  // Log request body for POST/PUT/PATCH methods
  if (["POST", "PUT", "PATCH"].includes(req.method)) {
    console.log("Request Body:", JSON.stringify(req.body));
  }

  // Track response
  const oldSend = res.send;
  res.send = function (data) {
    console.log(`Response Status: ${res.statusCode}`);
    return oldSend.apply(res, arguments);
  };

  next();
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/stores", storeRoutes);
app.use("/api/ratings", ratingsRoutes);

// Root route
app.get("/", (req, res) => {
  res.json({
    message: "Welcome to Store Rating API",
    version: "1.0.0",
    docs: "/api/docs",
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Resource not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(statusCode).json({ error: message });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API available at http://localhost:${PORT}/`);
});

module.exports = app;
