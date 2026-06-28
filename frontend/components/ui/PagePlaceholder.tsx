import { Container } from "@/components/ui/Container";

/** Temporary placeholder for routes whose sections aren't built yet. */
export function PagePlaceholder({ title }: { title: string }) {
  return (
    <Container as="main" className="flex flex-1 flex-col items-center justify-center py-32 text-center">
      <h1 className="text-h1 text-navy">{title}</h1>
      <p className="mt-4 text-body text-navy/60">Coming soon.</p>
    </Container>
  );
}
