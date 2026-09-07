/** All zod request schemas in one place. */
const { z } = require("zod");

const id = z.coerce.number().int().positive();

const authSchema = z.object({
  id_token: z.string().min(10),
});

const userIdParam = z.object({ userId: id });

const cartAddSchema = z.object({
  product_id: id,
  quantity: z.coerce.number().int().min(1).max(99).default(1),
});

const cartSetSchema = z.object({
  product_id: id,
  quantity: z.coerce.number().int().min(0).max(99),
});

const cartRemoveSchema = z.object({ product_id: id });

const likeSchema = z.object({ product_id: id });

const orderSchema = z.object({
  fulfillment: z.enum(["Pickup", "Delivery"]).default("Pickup"),
  payment: z.enum(["cash", "card-on-delivery"]),
  discount_code: z.string().optional(),
  contact: z
    .object({
      name: z.string().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      note: z.string().optional(),
    })
    .optional(),
  items: z
    .array(z.object({ product_id: id, quantity: z.coerce.number().int().min(1) }))
    .min(1),
});

const orderStatusSchema = z.object({
  // Validated as a plain string here; lib/orderStatus.js owns which values are
  // legal AND which transitions are, so the vocabulary lives in one place.
  status: z.string().min(1).max(32),
  note: z.string().max(500).optional(),
});

const productIdParam = z.object({ productId: id });

const discountCheckSchema = z.object({
  code: z.string().min(1).max(32),
  subtotal_minor: z.coerce.number().int().min(0),
});

const stockSchema = z
  .object({
    onHand: z.coerce.number().int().min(0).max(1000000).optional(),
    trackStock: z.coerce.boolean().optional(),
    lowStockThreshold: z.coerce.number().int().min(0).max(10000).optional(),
  })
  // An empty body would silently do nothing and report success.
  .refine((v) => Object.keys(v).length > 0, {
    message: "Provide at least one of onHand, trackStock or lowStockThreshold",
  });

const orderNumberParam = z.object({
  orderNumber: z.string().min(2).max(40),
});

module.exports = {
  authSchema,
  userIdParam,
  cartAddSchema,
  cartSetSchema,
  cartRemoveSchema,
  likeSchema,
  orderSchema,
  orderNumberParam,
  orderStatusSchema,
  productIdParam,
  stockSchema,
  discountCheckSchema,
};
