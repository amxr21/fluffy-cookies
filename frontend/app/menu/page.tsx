import { MenuSection, PageHeader } from "@/components/sections";
import { Container } from "@/components/ui/Container";
import { MENU } from "@/lib/menu";

export default function MenuPage() {
  return (
    <main className="flex-1">
      {/* Bounding wrapper: the sticky header releases when this scrolls out,
          so it can never overlap the footer or sections below. */}
      <div className="relative">
        <PageHeader
          sticky
          title="Our Menu"
          subtitle="Baked with Love"
          blurb="At Fluffy, we're more than just cookies and coffees — we're in the business of creating smiles. Whether you're ordering a sweet treat for yourself, planning a gathering, or surprising someone special, we've got a service for that."
        />

        <Container className="relative z-10 pb-16 md:pb-24">
          <div className="overflow-hidden rounded-3xl border border-navy/15 bg-white/60 shadow-2xl shadow-navy/10 backdrop-blur-md">
            {MENU.map((category) => (
              <MenuSection key={category.id} category={category} />
            ))}
          </div>
        </Container>
      </div>
    </main>
  );
}
