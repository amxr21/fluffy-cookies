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
    bg: "/images/banner/1.jpg",
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
      <Image src={icon} alt="" aria-hidden width={72} height={72} className="size-16" />
      <span aria-hidden className="hidden h-16 w-px bg-navy/40 sm:block" />
    </div>
  );

  const Text = (
    <div className={align === "right" ? "sm:text-right" : "text-left"}>
      <h3 className="text-h3 font-bold text-navy">{title}</h3>
      <p className="mt-1 max-w-2xl text-body text-navy/80">{description}</p>
    </div>
  );

  return (
    <div className="relative h-fit overflow-hidden">
      {/* faded photo background */}
      <Image src={bg} alt="" aria-hidden fill sizes="100vw" className="object-cover" />
      <div aria-hidden className="absolute inset-0 bg-beige/85" />

      {/* `justify-between` on the right-aligned rows replaces the old empty
          spacer div; below `sm` both variants stack icon-over-text. */}
      <Container
        className={`relative flex flex-col items-start gap-6 py-10 sm:flex-row sm:items-center sm:gap-8 md:py-12 ${
          align === "right" ? "sm:justify-between" : ""
        }`}
      >
        {align === "left" ? (
          <>
            {Icon}
            {Text}
          </>
        ) : (
          <>
            {Text}
            <div className="flex shrink-0 items-center gap-6">
              <span aria-hidden className="hidden h-16 w-px bg-navy/40 sm:block" />
              <Image src={icon} alt="" aria-hidden width={72} height={72} className="size-16" />
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
