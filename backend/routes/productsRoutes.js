const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const { listProducts } = require("../controllers/products");

const router = express.Router();

router.get("/", asyncHandler(listProducts));

module.exports = router;
