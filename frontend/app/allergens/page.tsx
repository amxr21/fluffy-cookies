import { LegalPage, LegalSection, legalMetadata } from "@/components/sections/LegalPage";
import { CONTACT } from "@/lib/site";

export const metadata = legalMetadata(
  "Allergen Information",
  "What allergens are present in Fluffy's kitchen and how to ask about a specific product."
);

export default function AllergensPage() {
  return (
    <LegalPage
      title="Allergen Information"
      updated="8 September 2026"
      intro="Please read this before ordering if you or anyone eating has a food allergy."
    >
      <LegalSection heading="Our kitchen is not allergen-free">
        <p>
          Everything we make is baked in one kitchen that handles{" "}
          <strong>
            wheat (gluten), eggs, dairy, nuts, peanuts, soy, and sesame
          </strong>
          .
        </p>
        <p>
          Because the same equipment and surfaces are used for all our products,{" "}
          <strong>
            we cannot guarantee any item is free from any allergen
          </strong>
          , even when it is not an ingredient.
        </p>
      </LegalSection>

      <LegalSection heading="If you have a severe allergy">
        <p>
          If you or anyone eating has a severe allergy or anaphylaxis, we
          strongly recommend you do not order from us. We would rather lose the
          sale than risk your health.
        </p>
      </LegalSection>

      <LegalSection heading="Asking about a specific product">
        <p>
          We are happy to tell you exactly what goes into anything we make.
          Contact us before ordering at {CONTACT.email} or {CONTACT.phone} and
          we will go through the ingredients with you.
        </p>
      </LegalSection>

      <LegalSection heading="Recipes change">
        <p>
          We adjust recipes and rotate flavours. Please check with us each time
          rather than relying on a previous answer.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
