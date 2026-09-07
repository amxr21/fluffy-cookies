/** Product/menu controllers. */
const repo = require("../repo");
const { readPageParams, paginated } = require("../lib/pagination");

const listProducts = async (req, res) => {
  const { limit, offset } = readPageParams(req.query);
  const [rows, total] = await Promise.all([
    repo.listProducts({ limit, offset }),
    repo.countProducts(),
  ]);
  res.json(paginated(rows, { limit, offset, total }));
};

module.exports = { listProducts };
