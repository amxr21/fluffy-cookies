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
};
