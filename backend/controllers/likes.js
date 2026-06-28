/** Likes / wishlist controllers — user from JWT. */
const repo = require("../repo");

const getLikes = async (req, res) => {
  if (String(req.user.id) !== String(req.params.userId)) return res.json([]);
  res.json(await repo.getLikes(req.user.id));
};

const toggleLike = async (req, res) => {
  const result = await repo.toggleLike(req.user.id, req.body.product_id);
  res.json({ success: true, ...result });
};

module.exports = { getLikes, toggleLike };
