import { PageHeader, ServiceRow, SpecialCTABanner } from "@/components/sections";
import { Container } from "@/components/ui/Container";
import { SERVICES } from "@/lib/services";

export default function ServicesPage() {
  return (
    <main className="flex-1">
      {/* Bounding wrapper: the sticky header releases when this scrolls out,
          so it can never overlap the CTA banner or the footer below. */}
      <div className="relative">
        <PageHeader
          sticky
          title="Our Services"
          subtitle="Delight Delivered. Sweet Moments Created."
          blurb="At Fluffy, we're more than just cookies and coffees — we're in the business of creating smiles. Whether you're ordering a sweet treat for yourself, planning a gathering, or surprising someone special, we've got a service for that."
        />

        <Container className="relative z-10 pb-16 md:pb-24">
          <div className="overflow-hidden rounded-3xl border border-navy/15 bg-white/60 shadow-2xl shadow-navy/10 backdrop-blur-md">
            {SERVICES.map((service) => (
              <ServiceRow key={service.id} service={service} />
            ))}
          </div>
        </Container>
      </div>

      <div className="relative z-20">
        <SpecialCTABanner />
      </div>
    </main>
  );
}
