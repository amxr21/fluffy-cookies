const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const validate = require("../middleware/validate");
const { productIdParam } = require("../validation/schemas");
const { listProducts, getProduct } = require("../controllers/products");

const router = express.Router();

router.get("/", asyncHandler(listProducts));

router.get(
  "/:productId",
  validate({ params: productIdParam }),
  asyncHandler(getProduct)
);

module.exports = router;
