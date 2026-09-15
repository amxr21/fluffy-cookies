/** Product/menu controllers. */
const repo = require("../repo");
const { readPageParams, paginated } = require("../lib/pagination");
const { notFound } = require("../errors/AppError");

const listProducts = async (req, res) => {
  const { limit, offset } = readPageParams(req.query);
  const term = String(req.query.q || "").trim();

  const [rows, total] = term
    ? await Promise.all([
        repo.searchProducts(term, { limit, offset }),
        repo.countSearchProducts(term),
      ])
    : await Promise.all([
        repo.listProducts({ limit, offset }),
        repo.countProducts(),
      ]);

  res.json(paginated(rows, { limit, offset, total }));
};

/** One product, for a detail page. */
const getProduct = async (req, res) => {
  const product = await repo.findProductById(req.params.productId);
  if (!product) throw notFound("Product not found");
  res.json(product);
};

module.exports = { listProducts, getProduct };
