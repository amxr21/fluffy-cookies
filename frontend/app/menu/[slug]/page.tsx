import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AddToCartPanel } from "@/components/product/AddToCartPanel";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { getMenu } from "@/lib/catalogue";
import { formatMinor } from "@/lib/money";
import { SITE_URL } from "@/lib/site";

/** Find one item across every category. */
async function findItem(slug: string) {
  const { categories } = await getMenu();
  for (const category of categories) {
    const item = category.items.find((i) => i.id === slug);
    if (item) return { item, category };
  }
  return null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const found = await findItem(slug);
  if (!found) return { title: "Not found" };

  const { item } = found;
  return {
    title: item.name,
    description: item.description,
    alternates: { canonical: `/menu/${item.id}` },
    openGraph: {
      title: item.name,
      description: item.description,
      url: `${SITE_URL}/menu/${item.id}`,
      images: [{ url: item.image, alt: item.name }],
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const found = await findItem(slug);
  if (!found) notFound();

  const { item, category } = found;

  return (
    <main className="flex-1">
      <Container className="py-16 md:py-24">
        <nav aria-label="Breadcrumb" className="mb-8 text-small text-navy/60">
          <Link href="/menu" className="hover:underline">
            Menu
          </Link>
          <span aria-hidden> / </span>
          <span>{category.title}</span>
        </nav>

        <div className="grid gap-10 md:grid-cols-2">
          <div className="relative aspect-square overflow-hidden rounded-3xl border border-navy/15">
            <Image
              src={item.image}
              alt={item.name}
              fill
              priority
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
            />
          </div>

          <div className="flex flex-col justify-center">
            <h1 className="text-h2 text-navy">{item.name}</h1>
            <p className="mt-3 text-body-lg text-navy/70">{item.description}</p>
            <p className="mt-6 text-h3 font-bold text-navy">
              {formatMinor(item.priceMinor)}
            </p>

            {/* Interactive part only — the rest of the page stays server-rendered
                so it is indexable and ships as HTML. */}
            <AddToCartPanel item={item} />

            <Link href="/menu" className="mt-8">
              <Button variant="outline">Back to the menu</Button>
            </Link>
          </div>
        </div>
      </Container>
    </main>
  );
}
