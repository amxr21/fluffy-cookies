import {
  CollageSection,
  DiscoverSection,
  FeaturesSection,
  HeroSection,
  SpecialCTABanner,
  StorySection,
} from "@/components/sections";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main className="flex-1">
      <HeroSection />
      <StorySection />
      <DiscoverSection />
      <CollageSection />
      <FeaturesSection />
      <SpecialCTABanner />
    </main>
  );
}
