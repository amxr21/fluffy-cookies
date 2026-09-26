/** Likes / wishlist controllers — user from JWT. */
const repo = require("../repo");
const { forbidden } = require("../errors/AppError");
const { readPageParams, paginated, slice } = require("../lib/pagination");

const getLikes = async (req, res) => {
  // 403 rather than an empty list — see the note in controllers/orders.js.
  if (String(req.user.id) !== String(req.params.userId)) {
    throw forbidden("You can only view your own liked items");
  }
  const { limit, offset } = readPageParams(req.query);
  const all = await repo.getLikes(req.user.id);
  res.json(paginated(slice(all, { limit, offset }), { limit, offset, total: all.length }));
};

const toggleLike = async (req, res) => {
  const result = await repo.toggleLike(req.user.id, req.body.product_id);
  res.json({ success: true, ...result });
};

module.exports = { getLikes, toggleLike };
