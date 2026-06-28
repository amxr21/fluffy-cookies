import Image from "next/image";
import Link from "next/link";
import { FiMail, FiMapPin, FiPhone, FiClock } from "react-icons/fi";

import { Container } from "@/components/ui/Container";
import { SectionDivider } from "@/components/ui/SectionDivider";
import {
  CONTACT,
  POLICY_LINKS,
  QUICK_LINKS,
  SITE,
  SOCIAL_LINKS,
} from "@/lib/site";

function LinkColumn({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <h4 className="text-h4  font-bold text-navy">{title}</h4>
      <ul className="mt-4 space-y-2">
        {links.map((link) => (
          <li key={link.label} className="flex gap-2 text-small text-navy/70">
            <span aria-hidden>·</span>
            <Link href={link.href} className="transition-colors hover:text-navy">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer() {
  return (
    <footer>
      <Container className="py-16">
        <SectionDivider className="mx-auto mb-14 w-2/3 max-w-3xl" />

        <div className="flex gap-12 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand + socials */}
          <div className="grow">
            <Image src="/icons/logo.svg" alt={SITE.name} width={130} height={47} className="h-11 w-auto" />
            <p className="mt-5 max-w-xs text-small text-navy/80">{SITE.footerBlurb}</p>

            <h4 className="mt-8 text-h4 font-bold text-navy">Follow Us</h4>
            <ul className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-small text-navy/70">
              {SOCIAL_LINKS.map((s) => (
                <li key={s.label}>
                  <Link href={s.href} className="transition-colors hover:text-navy">
                    {s.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex gap-2 grow">
            <LinkColumn title="Quick Links" links={QUICK_LINKS} />
            <LinkColumn title="Policies" links={POLICY_LINKS} />

          </div>

          {/* Contact */}
          <div className=" grow">
            <h4 className="text-h4 font-bold text-navy">Contact Us</h4>
            <p className="mt-4 max-w-xs text-small text-navy/70">{CONTACT.blurb}</p>
            <ul className="mt-4 space-y-2 text-small text-navy/80">
              <li className="flex items-center gap-2">
                <FiMapPin className="shrink-0 text-navy" /> {CONTACT.address}
              </li>
              <li className="flex items-center gap-2">
                <FiPhone className="shrink-0 text-navy" /> {CONTACT.phone}
              </li>
              <li className="flex items-center gap-2">
                <FiMail className="shrink-0 text-navy" /> {CONTACT.email}
              </li>
              <li className="flex items-center gap-2">
                <FiClock className="shrink-0 text-navy" /> {CONTACT.hours}
              </li>
            </ul>
          </div>
        </div>

        <SectionDivider className="mx-auto my-10 w-1/2 max-w-md" />
        <p className="text-center text-small text-navy/70">{SITE.copyright}</p>
      </Container>
    </footer>
  );
}
