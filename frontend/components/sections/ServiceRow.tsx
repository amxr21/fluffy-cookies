import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { cn } from "@/lib/utils";
import type { Service } from "@/lib/services";

export function ServiceRow({ service }: { service: Service }) {
  const Photo = (
    <Reveal from={service.imageLeft ? "left" : "right"} className="h-full">
      <div className="relative h-full w-full overflow-hidden rounded-2xl">
        <Image src={service.image} alt={service.title} fill className="object-cover" />
      </div>
    </Reveal>
  );

  const Text = (
    <Reveal
      from={service.imageLeft ? "right" : "left"}
      className="flex h-full flex-col justify-center"
    >
      <h3 className="text-h3 font-bold text-navy">{service.title}</h3>
      <p className="mt-3 text-body text-navy/80">{service.paragraph}</p>
      <ul className="mt-4 space-y-1.5">
        {service.bullets.map((b) => (
          <li key={b} className="flex gap-2 text-body text-navy/80">
            <span aria-hidden className="text-navy">·</span>
            {b}
          </li>
        ))}
      </ul>
      <Link href={service.ctaHref} className="mt-6 inline-block">
        <Button>{service.cta}</Button>
      </Link>
    </Reveal>
  );

  return (
    <section className="px-4 py-8 md:px-8 md:py-12">
      <div className="grid items-stretch gap-8 md:grid-cols-2 md:gap-14 h-80">
        {service.imageLeft ? (
          <>
            {Photo}
            {Text}
          </>
        ) : (
          <>
            {/* keep DOM order for a11y; reorder visually on md+ */}
            <div className={cn("h-full md:order-2")}>{Photo}</div>
            <div className={cn("h-full md:order-1")}>{Text}</div>
          </>
        )}
      </div>
    </section>
  );
}
