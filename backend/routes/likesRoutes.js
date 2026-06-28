const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const validate = require("../middleware/validate");
const { requireAuth } = require("../middleware/auth");
const { userIdParam, likeSchema } = require("../validation/schemas");
const likes = require("../controllers/likes");

const router = express.Router();

router.get("/:userId", requireAuth, validate({ params: userIdParam }), asyncHandler(likes.getLikes));
router.post("/", requireAuth, validate({ body: likeSchema }), asyncHandler(likes.toggleLike));
router.delete("/", requireAuth, validate({ body: likeSchema }), asyncHandler(likes.toggleLike));

module.exports = router;
