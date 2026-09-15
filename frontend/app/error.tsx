"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { reportClientError } from "@/lib/clientLogger";

/**
 * Route-level error boundary.
 *
 * Without one, a thrown error in any page unmounts the tree and leaves a white
 * screen — no message, no way back, and nothing reported. The standard treats
 * "error" as one of five states every route must design, not as an edge case.
 *
 * `reset` re-renders the segment, which is genuinely useful: most failures here
 * are a fetch that failed, and trying again is the right first move.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError({
      source: "error-boundary",
      message: error.message,
      stack: error.stack,
      // Next's server-side digest, which is what ties this to a server log
      // when the error came from a server component.
      component: error.digest ? `digest:${error.digest}` : "route",
    });
  }, [error]);

  return (
    <main className="flex flex-1 items-center">
      <Container className="flex flex-col items-center py-24 text-center">
        <h1 className="text-h2 font-bold text-navy">Something went wrong</h1>
        <p className="mx-auto mt-4 max-w-md text-body text-navy/70">
          That&apos;s on us, not you. Try again — and if it keeps happening, the
          reference below will help us find it.
        </p>

        {error.digest && (
          <p className="mt-4 font-mono text-caption text-navy/50">
            Reference: {error.digest}
          </p>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button onClick={reset}>Try again</Button>
          <Link href="/">
            <Button variant="outline">Back home</Button>
          </Link>
        </div>
      </Container>
    </main>
  );
}
