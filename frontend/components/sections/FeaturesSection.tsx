import Image from "next/image";

import { Container } from "@/components/ui/Container";

type Feature = {
  title: string;
  description: string;
  icon: string;
  /** faded photo behind the row */
  bg: string;
  /** icon side — comp alternates left / right / left */
  align: "left" | "right";
};

const FEATURES: Feature[] = [
  {
    title: "Coffees",
    description:
      "Order your favorite drinks, ready for quick pickup. Freshly brewed, sweet, and made to match your moment.",
    icon: "/icons/cup.svg",
    bg: "/images/banner/Frame 15.jpg",
    align: "left",
  },
  {
    title: "Booths",
    description:
      "Add a sweet touch to your events with Fluffy booths. Weddings, celebrations, or private gatherings — we bring the flavor and the charm.",
    icon: "/icons/booth.svg",
    bg: "/images/services/Rectangle 25.jpg",
    align: "right",
  },
  {
    title: "Cookies",
    description:
      "From our kitchen to yours — experience the joy of Fluffy cookie dough. Perfectly crafted for baking at home or enjoying straight from the tub.",
    icon: "/icons/cookie.svg",
    bg: "/images/cookies/image 12.jpg",
    align: "left",
  },
];

function FeatureRow({ title, description, icon, bg, align }: Feature) {
  const Icon = (
    <div className="flex shrink-0 items-center gap-6">
      <Image src={icon} alt="" width={72} height={72} className="size-16" />
      <span className="h-16 w-px bg-navy/40" />
    </div>
  );

  const Text = (
    <div className={align === "right" ? "text-right" : "text-left"}>
      <h3 className="text-h3 font-bold text-navy">{title}</h3>
      <p className="mt-1 max-w-2xl text-body text-navy/80">{description}</p>
    </div>
  );

  return (
    <div className="relative overflow-hidden h-fit">
      {/* faded photo background */}
      <Image src={bg} alt="" fill className="object-cover" />
      <div className="absolute inset-0 bg-beige/85" />

      <Container className="relative flex items-center gap-8 py-10 md:py-12">
        {align === "left" ? (
          <>
            {Icon}
            {Text}
          </>
        ) : (
          <>
            <div className="ml-auto" />
            {Text}
            <div className="flex shrink-0 items-center gap-6">
              <span className="h-16 w-px bg-navy/40" />
              <Image src={icon} alt="" width={72} height={72} className="size-16" />
            </div>
          </>
        )}
      </Container>
    </div>
  );
}

export function FeaturesSection() {
  return (
    <section>
      {FEATURES.map((f) => (
        <FeatureRow key={f.title} {...f} />
      ))}
    </section>
  );
}
