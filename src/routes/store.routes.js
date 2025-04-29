const express = require("express");
const { validationResult, check } = require("express-validator");
const storeModel = require("../models/store.model");
const ratingModel = require("../models/rating.model");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");

const router = express.Router();

// Validation rules
const storeValidation = [
  check("name").notEmpty().withMessage("Store name is required"),
  check("email").optional().isEmail().withMessage("Valid email is required"),
  check("address").optional(),
];

// Get all stores (accessible by all authenticated users)
router.get("/", authenticateToken, async (req, res) => {
  try {
    const stores = await storeModel.getAllStores();
    res.json({ stores });
  } catch (error) {
    console.error("Get stores error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get store by ID
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const store = await storeModel.getStoreById(id);

    if (!store) {
      return res.status(404).json({ message: "Store not found" });
    }

    // Get store ratings
    const ratings = await ratingModel.getRatingsByStoreId(id);

    // Get user's rating for this store if it exists
    let userRating = null;
    if (req.user) {
      userRating = await ratingModel.getRatingByUserAndStore(req.user.id, id);
    }

    res.json({
      store,
      ratings,
      userRating,
    });
  } catch (error) {
    console.error("Get store error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Create store (admin and store_owner only)
router.post(
  "/",
  authenticateToken,
  authorizeRoles(["admin", "store_owner"]),
  storeValidation,
  async (req, res) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, email, address } = req.body;

      // Set owner ID based on the authenticated user
      const ownerId = req.user.id;

      const store = await storeModel.createStore({
        name,
        email,
        address,
        ownerId,
      });

      res.status(201).json({
        message: "Store created successfully",
        store,
      });
    } catch (error) {
      console.error("Create store error:", error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

// Update store (admin and store_owner)
router.put("/:id", authenticateToken, storeValidation, async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { name, email, address } = req.body;

    // Check if store exists
    const existingStore = await storeModel.getStoreById(id);
    if (!existingStore) {
      return res.status(404).json({ message: "Store not found" });
    }

    // Check if user has permission (admin or owner of the store)
    const isAdmin = req.user.role === "admin";
    const isOwner = existingStore.owner_id === req.user.id;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        message: "You do not have permission to update this store",
      });
    }

    const updatedStore = await storeModel.updateStore(id, {
      name,
      email,
      address,
    });

    res.json({
      message: "Store updated successfully",
      store: updatedStore,
    });
  } catch (error) {
    console.error("Update store error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Delete store (admin only)
router.delete(
  "/:id",
  authenticateToken,
  authorizeRoles(["admin"]),
  async (req, res) => {
    try {
      const { id } = req.params;

      // Check if store exists
      const existingStore = await storeModel.getStoreById(id);
      if (!existingStore) {
        return res.status(404).json({ message: "Store not found" });
      }

      await storeModel.deleteStore(id);

      res.json({ message: "Store deleted successfully" });
    } catch (error) {
      console.error("Delete store error:", error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

// Rate a store
router.post(
  "/:id/rate",
  authenticateToken,
  [
    check("rating")
      .isInt({ min: 1, max: 5 })
      .withMessage("Rating must be a number between 1 and 5"),
  ],
  async (req, res) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { rating, comment } = req.body;
      const userId = req.user.id;

      // Check if store exists
      const store = await storeModel.getStoreById(id);
      if (!store) {
        return res.status(404).json({ message: "Store not found" });
      }

      // Check if user already rated this store
      let existingRating = null;
      if (ratingModel.getRatingByUserAndStore) {
        existingRating = await ratingModel.getRatingByUserAndStore(userId, id);
      } else {
        // Fallback: get all ratings for store and filter
        const ratings = await ratingModel.getRatingsByStoreId(id);
        existingRating = ratings.find((r) => r.userId === userId);
      }

      let result;
      if (existingRating) {
        result = await ratingModel.updateRating(existingRating.id, {
          rating,
          comment,
        });
      } else {
        result = await ratingModel.createRating({
          store_id: id,
          user_id: userId,
          rating,
          comment,
        });
      }

      res.json({
        message: existingRating
          ? "Rating updated successfully"
          : "Rating added successfully",
        rating: result,
      });
    } catch (error) {
      console.error("Rate store error:", error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

// Get store statistics
router.get("/stats/overview", authenticateToken, async (req, res) => {
  try {
    const stats = await storeModel.getStoreStatistics();
    res.json({ stats });
  } catch (error) {
    console.error("Get store stats error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
