/** Services page data — 3 alternating rows. */

export type Service = {
  id: string;
  title: string;
  paragraph: string;
  bullets: string[];
  cta: string;
  ctaHref: string;
  image: string;
  /** image on the left (true) or right (false) — comp alternates */
  imageLeft: boolean;
};

export const SERVICES: Service[] = [
  {
    id: "cookie-coffee-delivery",
    title: "Cookie & Coffee Delivery",
    paragraph:
      "Freshly baked and delivered to your doorstep. Can't make it to us? No problem! We deliver a curated selection of our best cookies, sweets, and drinks straight to your home, office, or wherever you need a sugar boost.",
    bullets: [
      "Same-day delivery (cut-off applies)",
      "Custom boxes available",
      "Delivered chilled, sealed & safe",
    ],
    cta: "Order Now",
    ctaHref: "/menu",
    image: "/images/services/Rectangle 25.jpg",
    imageLeft: true,
  },
  {
    id: "events-booths",
    title: "Events & Booths",
    paragraph:
      "Make your event unforgettable — the Fluffy way. Whether it's a wedding, birthday, baby shower, or a company gathering, our custom booths bring all the warmth, smell, and magic of Fluffy to your venue.",
    bullets: [
      "Live cookie warming & coffee pouring",
      "Custom packaging and display",
      "Fluffy team included — sweet smiles guaranteed",
    ],
    cta: "Book a Booth now",
    ctaHref: "/about",
    image: "/images/services/Rectangle 25-2.jpg",
    imageLeft: false,
  },
  {
    id: "pickup-orders",
    title: "Pickup Orders",
    paragraph:
      "Skip the wait — your treats, ready when you are. Order online and collect at your convenience. Perfect for surprise boxes, gifting, or a personal cookie fix.",
    bullets: [
      "Quick preparation time",
      "Packed fresh upon order",
      "Pay online or on pickup",
    ],
    cta: "Order to Pickup",
    ctaHref: "/menu",
    image: "/images/services/Rectangle 25-1.jpg",
    imageLeft: true,
  },
];
