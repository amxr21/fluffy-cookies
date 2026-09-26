import type { Metadata } from "next";

/**
 * The page itself is a client component (it holds form state), and a client
 * component cannot export metadata. A layout wrapping the single route is the
 * standard way to attach it without making the page a server component.
 */
export const metadata: Metadata = {
  title: "Track Your Order",
  description:
    "Follow your Fluffy order with your order number — no account needed.",
};

export default function TrackOrderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
