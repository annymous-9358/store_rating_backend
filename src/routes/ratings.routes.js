const express = require("express");
const { validationResult, check } = require("express-validator");
const storeModel = require("../models/store.model");
const ratingModel = require("../models/rating.model");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// Create a new rating (fallback endpoint for store rating)
router.post(
  "/",
  authenticateToken,
  [
    check("storeId").not().isEmpty().withMessage("Store ID is required"),
    check("rating")
      .isInt({ min: 1, max: 5 })
      .withMessage("Rating must be a number between 1 and 5"),
  ],
  async (req, res) => {
    try {
      console.log("Fallback rating endpoint hit:", {
        body: req.body,
        user: req.user ? req.user.id : "Unknown",
      });

      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log("Rating validation errors:", errors.array());
        return res.status(400).json({ errors: errors.array() });
      }

      const { storeId, rating, comment } = req.body;
      const userId = req.user.id;

      // Check if store exists
      const store = await storeModel.getStoreById(storeId);
      if (!store) {
        console.log(`Store with ID ${storeId} not found`);
        return res.status(404).json({ message: "Store not found" });
      }

      // Check if user already rated this store
      let existingRating = null;
      if (ratingModel.getRatingByUserAndStore) {
        existingRating = await ratingModel.getRatingByUserAndStore(
          userId,
          storeId
        );
        console.log("Existing rating:", existingRating);
      } else {
        // Fallback: get all ratings for store and filter
        const ratings = await ratingModel.getRatingsByStoreId(storeId);
        existingRating = ratings.find((r) => r.userId === userId);
        console.log("Fallback - Existing rating:", existingRating);
      }

      let result;
      if (existingRating) {
        console.log(
          `Updating existing rating ${existingRating.id} with value ${rating}`
        );
        result = await ratingModel.updateRating(existingRating.id, {
          rating,
          comment,
        });
      } else {
        console.log(
          `Creating new rating for store ${storeId} from user ${userId} with value ${rating}`
        );
        result = await ratingModel.createRating({
          store_id: storeId,
          user_id: userId,
          rating,
          comment,
        });
      }

      console.log("Rating result:", result);
      res.json({
        message: "Rating submitted successfully",
        rating: result,
      });
    } catch (error) {
      console.error("Rating creation error:", error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

// Get all ratings
router.get("/", authenticateToken, async (req, res) => {
  try {
    const { storeId, userId } = req.query;

    let ratings = [];

    if (storeId) {
      ratings = await ratingModel.getRatingsByStoreId(storeId);
    } else if (userId) {
      ratings = await ratingModel.getRatingsByUserId(userId);
    } else {
      // This would require a new method in the rating model
      return res
        .status(400)
        .json({ message: "Please provide storeId or userId" });
    }

    res.json(ratings);
  } catch (error) {
    console.error("Get ratings error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
