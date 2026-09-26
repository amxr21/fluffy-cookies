import {
  CollageSection,
  DiscoverSection,
  FeaturesSection,
  HeroSection,
  PromoSection,
  SpecialCTABanner,
  StorySection,
} from "@/components/sections";
import { DASHBOARD_MODE } from "@/lib/config";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main className="flex-1">
      <HeroSection />
      <StorySection />
      <DiscoverSection />
      <CollageSection />
      <FeaturesSection />
      {!DASHBOARD_MODE && <PromoSection />}
      <SpecialCTABanner />
    </main>
  );
}
