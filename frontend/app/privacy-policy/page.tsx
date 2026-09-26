import { LegalPage, LegalSection, legalMetadata } from "@/components/sections/LegalPage";
import { CONTACT } from "@/lib/site";

export const metadata = legalMetadata(
  "Privacy Policy",
  "What personal data Fluffy collects when you order, why, how long it is kept, and how to have it removed."
);

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="8 September 2026"
      intro="This explains what we collect when you order from Fluffy, why we need it, and what you can ask us to do with it."
    >
      <LegalSection heading="What we collect">
        <p>
          When you place an order we collect your name, phone number, and — if
          you give one — your email address. For delivery orders we also collect
          your emirate, area, and address.
        </p>
        <p>
          If you sign in with Google, we receive your name, email address, and
          profile picture from Google. We never see your Google password.
        </p>
      </LegalSection>

      <LegalSection heading="Why we need it">
        <p>
          To bake and hand over your order, to contact you about it, and to keep
          a record of the sale as UAE tax law requires. We do not use your
          details for marketing unless you ask us to.
        </p>
      </LegalSection>

      <LegalSection heading="What we never collect">
        <p>
          We do not store card numbers. We do not track you across other
          websites, and we do not sell or share your details with anyone for
          their own marketing.
        </p>
      </LegalSection>

      <LegalSection heading="How long we keep it">
        <p>
          Order records are kept for the period UAE tax law requires. You can
          ask us to delete your account at any time — we will remove your
          personal details, though the order record itself has to stay, with
          your information removed from it.
        </p>
      </LegalSection>

      <LegalSection heading="Your choices">
        <p>
          You can ask for a copy of what we hold about you, ask us to correct
          it, or ask us to delete it. Email {CONTACT.email} and we will respond
          within 30 days.
        </p>
      </LegalSection>

      <LegalSection heading="Getting in touch">
        <p>
          Questions about any of this: {CONTACT.email} or {CONTACT.phone}.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
