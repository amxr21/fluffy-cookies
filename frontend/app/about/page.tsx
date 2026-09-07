import { AboutStory } from "@/components/sections";

export const metadata = {
  title: "About Us",
  description:
    "How Fluffy started, and why every cookie carries the warmth of home.",
};

export default function AboutPage() {
  return (
    <main className="flex-1">
      <AboutStory />
    </main>
  );
}
