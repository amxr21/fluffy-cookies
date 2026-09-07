const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const validate = require("../middleware/validate");
const { authSchema } = require("../validation/schemas");
const { requireAuth } = require("../middleware/auth");
const { googleLogin, refresh, logout, logoutAll } = require("../controllers/auth");

const router = express.Router();

// Mounted under /api/v1 by app.js, so the full path is POST /api/v1/auth.
router.post("/auth", validate({ body: authSchema }), asyncHandler(googleLogin));

// Exchange the refresh cookie for a new pair. No body and no auth middleware:
// the access token is expected to be expired by the time this is called.
router.post("/auth/refresh", asyncHandler(refresh));

// Sign out this device. Tolerates a missing/expired cookie so a stuck client
// can always clear itself.
router.post("/auth/logout", asyncHandler(logout));

// Sign out everywhere — needs a valid access token to know whose sessions.
router.post("/auth/logout-all", requireAuth, asyncHandler(logoutAll));

module.exports = router;
