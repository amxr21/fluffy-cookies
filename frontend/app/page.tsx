import {
  CollageSection,
  DiscoverSection,
  FeaturesSection,
  HeroSection,
  PromoSection,
  SpecialCTABanner,
  StorySection,
} from "@/components/sections";

export default function Home() {
  return (
    <main className="flex-1">
      <HeroSection />
      <StorySection />
      <DiscoverSection />
      <CollageSection />
      <FeaturesSection />
      <PromoSection />
      <SpecialCTABanner />
    </main>
  );
}
