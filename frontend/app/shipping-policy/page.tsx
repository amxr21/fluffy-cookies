import { LegalPage, LegalSection, legalMetadata } from "@/components/sections/LegalPage";
import { CONTACT } from "@/lib/site";

export const metadata = legalMetadata(
  "Delivery & Pickup",
  "Where Fluffy delivers, what it costs, and how collection works."
);

export default function ShippingPolicyPage() {
  return (
    <LegalPage
      title="Delivery & Pickup"
      updated="29 September 2026"
      intro="Where we deliver, what it costs, and how to collect."
    >
      <LegalSection heading="Where we deliver">
        <p>
          We deliver across the UAE. Delivery is charged by emirate, and the
          exact fee is shown at checkout before you pay:
        </p>
        <ul className="list-disc space-y-1 ps-5">
          <li>Al Ain — AED 15</li>
          <li>Abu Dhabi — AED 25</li>
          <li>Dubai &amp; Sharjah — AED 30</li>
          <li>Ajman, Umm Al Quwain, Ras Al Khaimah, Fujairah — AED 40</li>
        </ul>
        <p>
          <strong>Delivery is free when your order comes to AED 150 or more after any discount.</strong>
        </p>
      </LegalSection>

      <LegalSection heading="How long it takes">
        <p>
          Everything is baked to order. Most orders are ready the same day;
          larger orders and event bookings need more notice. You can track your
          order any time with your order number and phone number — no account
          needed.
        </p>
      </LegalSection>

      <LegalSection heading="Collection">
        <p>
          Collection is free. Track your order to see when it is ready, and
          bring your order number with you.
        </p>
        <p>
          {CONTACT.address} · {CONTACT.hours}
        </p>
      </LegalSection>

      <LegalSection heading="If we cannot reach you">
        <p>
          Our driver will call the number on your order. If we cannot reach you,
          we will bring the order back and contact you to rearrange. Because
          this is fresh food, we may not be able to redeliver the same items.
        </p>
      </LegalSection>

      <LegalSection heading="Questions">
        <p>
          {CONTACT.email} or {CONTACT.phone}.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
