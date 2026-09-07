/** Likes / wishlist controllers — user from JWT. */
const repo = require("../repo");
const { forbidden } = require("../errors/AppError");

const getLikes = async (req, res) => {
  // 403 rather than an empty list — see the note in controllers/orders.js.
  if (String(req.user.id) !== String(req.params.userId)) {
    throw forbidden("You can only view your own liked items");
  }
  res.json(await repo.getLikes(req.user.id));
};

const toggleLike = async (req, res) => {
  const result = await repo.toggleLike(req.user.id, req.body.product_id);
  res.json({ success: true, ...result });
};

module.exports = { getLikes, toggleLike };
