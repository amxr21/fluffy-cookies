const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const validate = require("../middleware/validate");
const { requireAuth, optionalAuth } = require("../middleware/auth");
const { orderSchema, userIdParam, orderNumberParam } = require("../validation/schemas");
const orders = require("../controllers/orders");

const router = express.Router();

// Checkout works for guests and signed-in users.
router.post("/", optionalAuth, validate({ body: orderSchema }), asyncHandler(orders.createOrder));

// History requires auth.
router.get("/user/:userId", requireAuth, validate({ params: userIdParam }), asyncHandler(orders.myOrders));

// Track by number — no login needed.
router.get("/track/:orderNumber", validate({ params: orderNumberParam }), asyncHandler(orders.trackOrder));

module.exports = router;
