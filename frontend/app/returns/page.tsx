import { LegalPage, LegalSection, legalMetadata } from "@/components/sections/LegalPage";
import { CONTACT } from "@/lib/site";

export const metadata = legalMetadata(
  "Returns & Refunds",
  "When Fluffy can refund or replace an order, and how to ask."
);

export default function ReturnsPage() {
  return (
    <LegalPage
      title="Returns & Refunds"
      updated="8 September 2026"
      intro="Everything we make is fresh food, so the rules are a little different from a normal shop. Here is exactly where we stand."
    >
      <LegalSection heading="Food we cannot take back">
        <p>
          For food safety reasons we cannot accept returns of food that has left
          our hands. This does not affect your rights if something was wrong
          with the order.
        </p>
      </LegalSection>

      <LegalSection heading="When we will refund or replace">
        <p>We will refund or remake your order if:</p>
        <ul className="list-disc space-y-1 ps-5">
          <li>You received the wrong items</li>
          <li>Something was missing</li>
          <li>The food arrived damaged or in poor condition</li>
          <li>We could not fulfil your order</li>
        </ul>
        <p>
          Tell us within <strong>24 hours</strong> of collection or delivery. A
          photo helps us sort it out quickly.
        </p>
      </LegalSection>

      <LegalSection heading="Cancelling an order">
        <p>
          You can cancel free of charge any time before we start preparing your
          order. Once baking has started we may not be able to cancel, because
          the food has already been made.
        </p>
        <p>Contact us with your order number as soon as you can.</p>
      </LegalSection>

      <LegalSection heading="How refunds are paid">
        <p>
          Refunds go back the way you paid. Cash orders are refunded in cash or
          by bank transfer, whichever suits you.
        </p>
      </LegalSection>

      <LegalSection heading="How to ask">
        <p>
          Email {CONTACT.email} or call {CONTACT.phone} with your order number.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
