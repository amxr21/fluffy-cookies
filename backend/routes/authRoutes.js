const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const validate = require("../middleware/validate");
const { authSchema } = require("../validation/schemas");
const { googleLogin } = require("../controllers/auth");

const router = express.Router();

// Mounted under /api/v1 by app.js, so the full path is POST /api/v1/auth.
router.post("/auth", validate({ body: authSchema }), asyncHandler(googleLogin));

module.exports = router;
