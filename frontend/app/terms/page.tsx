import { LegalPage, LegalSection, legalMetadata } from "@/components/sections/LegalPage";
import { CONTACT, SITE } from "@/lib/site";

export const metadata = legalMetadata(
  "Terms & Conditions",
  "The terms you agree to when ordering from Fluffy, including event bookings."
);

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms & Conditions"
      updated="8 September 2026"
      intro={`These are the terms you agree to when you order from ${SITE.name}.`}
    >
      <LegalSection heading="Ordering">
        <p>
          Placing an order is an offer to buy. Your order is confirmed once we
          accept it and send you an order number. We may decline an order — for
          example if an item has sold out or we cannot deliver to your area — and
          if you have already paid, we refund you in full.
        </p>
      </LegalSection>

      <LegalSection heading="Prices">
        <p>
          All prices are in UAE dirhams and <strong>include 5% VAT</strong>. The
          price you see is the price you pay. Delivery, where it applies, is
          shown separately at checkout before you confirm.
        </p>
      </LegalSection>

      <LegalSection heading="Payment">
        <p>
          We currently accept cash and card on collection or delivery. Online
          card payment is coming.
        </p>
      </LegalSection>

      <LegalSection heading="Discount codes">
        <p>
          Codes are valid for the period and on the terms stated when they are
          issued. Unless we say otherwise, one code per order and one use per
          customer. We may withdraw a code at any time, but not from an order
          already placed.
        </p>
      </LegalSection>

      <LegalSection heading="Event bookings and booths">
        <p>
          Event bookings are confirmed in writing and may require a deposit. The
          full terms — including notice periods and what happens if an event is
          postponed — are agreed with you at the time of booking, because they
          depend on the size and date of the event.
        </p>
        <p>Contact us at {CONTACT.email} to discuss a booking.</p>
      </LegalSection>

      <LegalSection heading="Allergies">
        <p>
          Our kitchen handles common allergens and we cannot guarantee any
          product is free from them. Please read our allergen information before
          ordering.
        </p>
      </LegalSection>

      <LegalSection heading="Cancellations and refunds">
        <p>
          Set out in our returns and refunds policy, which forms part of these
          terms.
        </p>
      </LegalSection>

      <LegalSection heading="Governing law">
        <p>
          These terms are governed by the laws of the United Arab Emirates, and
          the courts of the UAE have jurisdiction over any dispute.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
