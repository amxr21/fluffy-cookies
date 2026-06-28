import { Container } from "@/components/ui/Container";
import { SectionDivider } from "@/components/ui/SectionDivider";
import { cn } from "@/lib/utils";

/** Centered page intro: title, subtitle, blurb, divider.
 *  Reused by Menu, Services, and other top-level pages.
 *  When `sticky`, the header pins below the navbar while content scrolls past. */
export function PageHeader({
  title,
  subtitle,
  blurb,
  showDivider = true,
  sticky = false,
}: {
  title: string;
  subtitle?: string;
  blurb?: string;
  showDivider?: boolean;
  sticky?: boolean;
}) {
  return (
    <Container
      className={cn(
        "pt-16 text-center md:pt-4",
        sticky && "sticky top-28 z-0 pb-10 md:top-32"
      )}
    >
      <h1 className="text-h1 uppercase text-navy">{title}</h1>
      {subtitle && <p className="mt-2 text-h3 text-navy/80">{subtitle}</p>}
      {blurb && (
        <p className="mx-auto mt-6 max-w-6xl text-body text-navy/70">{blurb}</p>
      )}
      {showDivider && <SectionDivider className="mx-auto mt-10" />}
    </Container>
  );
}
