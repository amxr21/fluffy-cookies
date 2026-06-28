const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const validate = require("../middleware/validate");
const { authSchema } = require("../validation/schemas");
const { googleLogin } = require("../controllers/auth");

const router = express.Router();

router.post("/api/auth", validate({ body: authSchema }), asyncHandler(googleLogin));

module.exports = router;
