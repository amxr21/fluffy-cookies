import Image from "next/image";

import { Container } from "@/components/ui/Container";

/** Decorative promo grid: "One Coffee => Free Cookie" with kirby chef art.
 *  6 columns x 2 rows of colored tiles, mirroring the comp. */

type Tile =
  | { kind: "color"; color: string }
  | { kind: "text"; text: string; color: string; textColor: string }
  | { kind: "icon"; src: string; color: string }
  | { kind: "art"; src: string; color: string }
  /** spans 2 columns; kirby photo fills the rectangle */
  | { kind: "wide"; src: string; color: string };

const TILES: Tile[] = [
  // row 1
  { kind: "color", color: "bg-navy" },
  { kind: "text", text: "One\nCoffee", color: "bg-beige", textColor: "text-black" },
  { kind: "art", src: "/images/kirby/Group 5.svg", color: "bg-navy" },
  // { kind: "icon", src: "/images/kirby/Group 2.svg", color: "bg-navy" },
  { kind: "text", text: "=>", color: "bg-brown", textColor: "text-beige" },
  { kind: "text", text: "Free\nCookie", color: "bg-beige", textColor: "text-black" },
  { kind: "color", color: "bg-navy" },
  // row 2
  { kind: "color", color: "bg-brown" },
  { kind: "color", color: "bg-navy" },
  { kind: "art", src: "/images/kirby/Group 3.svg", color: "bg-beige" },
  { kind: "color", color: "bg-navy" },
  // last two bottom-right tiles merged into one wide rectangle w/ kirby photo
  { kind: "wide", src: "/images/kirby/Group 3.svg", color: "bg-beige" },
];

function TileCell({ tile }: { tile: Tile }) {
  const base = "flex aspect-square items-center justify-center rounded-2xl p-4";
  switch (tile.kind) {
    case "color":
      return <div className={`${base} ${tile.color}`} />;
    case "text":
      return (
        <div className={`${base} ${tile.color}`}>
          <span className={`whitespace-pre-line text-center text-5xl font-medium ${tile.textColor}`}>
            {tile.text}
          </span>
        </div>
      );
    case "icon":
    case "art":
      return (
        <div className={`${base} ${tile.color}`}>
          <Image src={tile.src} alt="" width={120} height={120} className="size-3/4 object-contain" />
        </div>
      );
    case "wide":
      return (
        <div
          className={`relative col-span-2 flex items-center justify-end overflow-hidden rounded-2xl ${tile.color}`}
        >
          <Image
            src={tile.src}
            alt=""
            width={320}
            height={160}
            className="h-[78%] scale-260 w-auto -translate-x-20 object-contain"
          />
        </div>
      );
  }
}

export function PromoSection() {
  return (
    <section>
      <Container className="py-16 md:py-24">
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
          {TILES.map((tile, i) => (
            <TileCell key={i} tile={tile} />
          ))}
        </div>
      </Container>
    </section>
  );
}
