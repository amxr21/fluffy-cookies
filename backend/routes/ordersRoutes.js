const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const validate = require("../middleware/validate");
const { requireAuth, optionalAuth } = require("../middleware/auth");
const {
  orderSchema,
  userIdParam,
  orderNumberParam,
  discountCheckSchema,
} = require("../validation/schemas");
const orders = require("../controllers/orders");

const router = express.Router();

// Checkout works for guests and signed-in users.
router.post("/", optionalAuth, validate({ body: orderSchema }), asyncHandler(orders.createOrder));

// History requires auth.
router.get("/user/:userId", requireAuth, validate({ params: userIdParam }), asyncHandler(orders.myOrders));

// Track by number — no login needed.
router.get("/track/:orderNumber", validate({ params: orderNumberParam }), asyncHandler(orders.trackOrder));

// Check a code before submitting. optionalAuth so a guest can use it too, and
// so per-user limits apply when the caller is signed in.
router.post(
  "/discount/check",
  optionalAuth,
  validate({ body: discountCheckSchema }),
  asyncHandler(orders.checkDiscount)
);

module.exports = router;
