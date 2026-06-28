/** Order shapes returned by the backend (to be connected later). */

export type OrderItem = {
  product_id: string;
  name: string;
  quantity: number;
  price: number;
};

export type Order = {
  orderNumber: string;
  status: string;
  total: number;
  createdAt: string;
  fulfillment: string;
  items: OrderItem[];
};
