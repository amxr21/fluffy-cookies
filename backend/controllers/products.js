/** Product/menu controllers. */
const repo = require("../repo");

const listProducts = async (_req, res) => {
  res.json(await repo.listProducts());
};

module.exports = { listProducts };
