/** Collection items shown in the "Discover the Collection" section.
 *  Kept as data so the cards stay presentational and this can later
 *  be swapped for an API source. */

export type CollectionItem = {
  id: string;
  name: string;
  description: string;
  image: string;
};

export const COLLECTION: CollectionItem[] = [
  {
    id: "matcha-cloud",
    name: "Matcha Cloud",
    description:
      "Premium Japanese matcha with milk, shaken over ice and topped with soft matcha foam.",
    image: "/images/drinks/matcha-removebg-preview 1.png",
  },
  {
    id: "vanilla-cream-cold-brew",
    name: "Vanilla Cream Cold Brew",
    description:
      "Slow-steeped cold brew topped with vanilla cold foam for a silky finish.",
    image: "/images/drinks/coffee-removebg-preview 2.png",
  },
  {
    id: "fluffy-og-cookie",
    name: "Fluffy OG Cookie",
    description: "Our signature chocolate chip cookie — crispy edges, gooey center.",
    image: "/images/cookie.png",
  },
  {
    id: "caramel-brownie",
    name: "Caramel Brownie",
    description:
      "Fudgy dark chocolate brownie drizzled with golden caramel and a hint of sea salt.",
    image: "/images/drinks/matcha-removebg-preview 1.png",
  },
];
