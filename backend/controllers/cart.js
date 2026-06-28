/** Cart controllers — user derived from JWT (req.user.id), never the body. */
const repo = require("../repo");

const getCart = async (req, res) => {
  res.json(await repo.getCart(req.user.id));
};

const addToCart = async (req, res) => {
  const { product_id, quantity } = req.body;
  const result = await repo.addToCart(req.user.id, product_id, quantity);
  res.status(201).json({ success: true, ...result });
};

const setQuantity = async (req, res) => {
  const { product_id, quantity } = req.body;
  await repo.setCartQuantity(req.user.id, product_id, quantity);
  res.json({ success: true });
};

const removeFromCart = async (req, res) => {
  await repo.removeFromCart(req.user.id, req.body.product_id);
  res.json({ success: true });
};

module.exports = { getCart, addToCart, setQuantity, removeFromCart };
