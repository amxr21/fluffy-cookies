import {
  CollageSection,
  DiscoverSection,
  FeaturesSection,
  HeroSection,
  PromoSection,
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
    </main>
  );
}
