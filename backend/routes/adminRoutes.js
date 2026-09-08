const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const validate = require("../middleware/validate");
const { requireAdmin } = require("../middleware/auth");
const {
  orderNumberParam,
  orderStatusSchema,
  productIdParam,
  stockSchema,
  refundSchema,
} = require("../validation/schemas");
const admin = require("../controllers/admin");

const router = express.Router();

// Every route below is admin-only. requireAdmin re-checks the role against the
// database on each request, so a demoted account loses access immediately
// rather than when its token expires.
router.use(requireAdmin);

router.get(
  "/orders/:orderNumber",
  validate({ params: orderNumberParam }),
  asyncHandler(admin.getOrder)
);

router.patch(
  "/orders/:orderNumber/status",
  validate({ params: orderNumberParam, body: orderStatusSchema }),
  asyncHandler(admin.setOrderStatus)
);

router.get("/stock", asyncHandler(admin.listStock));

router.patch(
  "/stock/:productId",
  validate({ params: productIdParam, body: stockSchema }),
  asyncHandler(admin.setStock)
);

// Refunds are an admin action, and a destructive one — the actor is recorded.
router.post(
  "/orders/:orderNumber/refund",
  validate({ params: orderNumberParam, body: refundSchema }),
  asyncHandler(require("../controllers/payments").refundPayment)
);

module.exports = router;
