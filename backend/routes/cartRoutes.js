const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const validate = require("../middleware/validate");
const { requireAuth } = require("../middleware/auth");
const {
  userIdParam,
  cartAddSchema,
  cartSetSchema,
  cartRemoveSchema,
} = require("../validation/schemas");
const cart = require("../controllers/cart");

const router = express.Router();

router.get("/:userId", requireAuth, validate({ params: userIdParam }), asyncHandler(cart.getCart));
router.post("/", requireAuth, validate({ body: cartAddSchema }), asyncHandler(cart.addToCart));
router.patch("/", requireAuth, validate({ body: cartSetSchema }), asyncHandler(cart.setQuantity));
router.delete("/", requireAuth, validate({ body: cartRemoveSchema }), asyncHandler(cart.removeFromCart));

module.exports = router;
