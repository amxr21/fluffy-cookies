/** Single source of truth for site-wide nav, footer + brand metadata. */

export type NavLink = {
  label: string;
  href: string;
};

export const NAV_LINKS: NavLink[] = [
  { label: "Home", href: "/" },
  { label: "Menu", href: "/menu" },
  { label: "Services", href: "/services" },
  { label: "About Us", href: "/about" },
];

export const QUICK_LINKS: NavLink[] = [
  { label: "Home", href: "/" },
  { label: "Menu", href: "/menu" },
  { label: "Order Now", href: "/menu" },
  { label: "Events & Booths", href: "/services" },
  { label: "Contact", href: "/about" },
];

export const POLICY_LINKS: NavLink[] = [
  { label: "Privacy Policy", href: "#" },
  { label: "Pickup & Order Policy", href: "#" },
  { label: "Event Booking Terms", href: "#" },
  { label: "Cookie Disclaimer (for allergens etc.)", href: "#" },
];

export const SOCIAL_LINKS: NavLink[] = [
  { label: "WhatsApp", href: "#" },
  { label: "Instagram", href: "#" },
  { label: "TikTok", href: "#" },
  { label: "Location", href: "#" },
];

export const CONTACT = {
  blurb:
    "We'd love to hear from you — whether it's a custom order, event inquiry, or just to say hi!",
  address: "Al Ain Zoo Parking",
  phone: "+971-XXX-XXXX",
  email: "hello@fluffy.ae",
  hours: "Mon–Sat, 10AM – 11PM",
} as const;

export const SITE = {
  name: "Fluffy",
  tagline: "Handcrafted cookies & sweet specialty coffees.",
  footerBlurb:
    "Handcrafted cookies and sweet specialty coffees. Freshly made every day for pickup or events.",
  copyright: "© 2025 Fluffy. All treats reserved.",
} as const;
