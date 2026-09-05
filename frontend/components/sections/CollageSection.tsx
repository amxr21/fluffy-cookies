import Image from "next/image";

/** Overlapping, staggered photo collage with a centered headline overlay.
 *  Each photo has its own width / height / vertical offset, mirroring the comp. */
const PHOTOS = [
  // src, width, height, margin-top (vertical stagger), z, rotation, overlap
  { src: "/images/banner/1.jpg", w: "w-[19%]", h: "h-[58%]", top: "mt-[18%]", z: "z-10", rot: "rotate-[-1deg]" },
  { src: "/images/banner/2.jpg", w: "w-[20%]", h: "h-[72%]", top: "mt-[2%]", z: "z-0", rot: "rotate-[1deg]" },
  { src: "/images/banner/3.jpg", w: "w-[19%]", h: "h-[82%]", top: "mt-[8%]", z: "z-20", rot: "rotate-[-1deg]" },
  { src: "/images/banner/4.jpg", w: "w-[20%]", h: "h-[74%]", top: "mt-0", z: "z-0", rot: "rotate-[1deg]" },
  { src: "/images/banner/5.jpg", w: "w-[19%]", h: "h-[64%]", top: "mt-[20%]", z: "z-10", rot: "rotate-[-1deg]" },
];

export function CollageSection() {
  return (
    <section className="relative overflow-hidden px-6 py-16 md:px-20 md:py-24">
      {/* staggered photo row — fixed-height stage so vertical offsets read.
          Shorter on phones, where 55vw of height leaves slivers of photo. */}
      <div className="relative mx-auto flex h-[clamp(16rem,55vw,46rem)] items-start justify-center">
        {PHOTOS.map((photo, i) => (
          <div
            key={i}
            className={`relative -mx-2 shrink-0 overflow-hidden rounded-sm shadow-xl ${photo.w} ${photo.h} ${photo.top} ${photo.z} ${photo.rot}`}
          >
            <Image
              src={photo.src}
              alt=""
              aria-hidden
              fill
              sizes="20vw"
              className="object-cover"
            />
          </div>
        ))}
      </div>

      {/* Scrim behind the headline: the photos underneath are arbitrary, so
          beige text over them cannot be relied on to stay legible. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 z-30 h-40 -translate-y-1/2 bg-black/35 blur-2xl"
      />

      {/* overlay headline */}
      <h2 className="pointer-events-none absolute inset-x-0 top-1/2 z-30 -translate-y-1/2 px-4 text-center text-[clamp(2rem,7vw,5.5rem)] font-bold text-beige drop-shadow-[0_2px_14px_rgba(0,0,0,0.6)]">
        Cookie, Coffee, And Love
      </h2>
    </section>
  );
}
