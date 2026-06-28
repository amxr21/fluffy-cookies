import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center">
      <Container className="flex flex-col items-center py-24 text-center">
        <Image
          src="/icons/kirby.svg"
          alt=""
          width={140}
          height={160}
          className="h-32 w-auto opacity-90"
        />
        <p className="mt-6 text-[clamp(4rem,12vw,8rem)] font-black leading-none text-navy">
          404
        </p>
        <h1 className="mt-2 text-h2 font-bold text-navy">
          This page ran out of the oven
        </h1>
        <p className="mx-auto mt-4 max-w-md text-body text-navy/70">
          The page you&apos;re looking for doesn&apos;t exist or has moved. Let&apos;s
          get you back to the good stuff.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/">
            <Button>Back home</Button>
          </Link>
          <Link href="/menu">
            <Button variant="outline">Browse the menu</Button>
          </Link>
        </div>
      </Container>
    </main>
  );
}
