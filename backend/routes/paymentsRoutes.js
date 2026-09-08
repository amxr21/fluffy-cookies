const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const validate = require("../middleware/validate");
const { optionalAuth } = require("../middleware/auth");
const { createIntentSchema } = require("../validation/schemas");
const payments = require("../controllers/payments");

const router = express.Router();

// optionalAuth: a guest can pay for the order they just placed. Ownership is
// checked in the controller when the order HAS an owner.
router.post(
  "/intent",
  optionalAuth,
  validate({ body: createIntentSchema }),
  asyncHandler(payments.createIntent)
);

module.exports = router;
