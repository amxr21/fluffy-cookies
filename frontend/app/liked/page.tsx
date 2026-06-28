"use client";

import { useEffect, useState } from "react";

import { Container } from "@/components/ui/Container";
import { MenuCard } from "@/components/ui/MenuCard";
import { StatusState } from "@/components/ui/StatusState";
import { useAuth } from "@/context/AuthContext";
import { getJSON } from "@/lib/safeFetch";
import type { MenuItem } from "@/lib/menu";

export default function LikedPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (!user) {
      setState("ready");
      return;
    }
    let active = true;
    (async () => {
      const res = await getJSON<MenuItem[]>(`/likes/${user.userId}`);
      if (!active) return;
      if (res.ok && Array.isArray(res.data)) {
        setItems(res.data);
        setState("ready");
      } else {
        setState("error");
      }
    })();
    return () => {
      active = false;
    };
  }, [user]);

  return (
    <main className="flex-1">
      <Container className="py-16 md:py-24">
        <h1 className="mb-8 text-center text-h2 uppercase text-navy">Liked Items</h1>

        {!user ? (
          <StatusState
            variant="empty"
            title="Sign in to see your liked items"
            message="Save your favorite treats and find them all here."
          />
        ) : state === "loading" ? (
          <StatusState variant="loading" title="Loading your favorites…" />
        ) : state === "error" ? (
          <StatusState
            variant="error"
            title="Couldn't load your liked items"
            message="Please try again in a moment."
          />
        ) : items.length === 0 ? (
          <StatusState
            variant="empty"
            title="No liked items yet"
            message="Tap the heart on a treat to save it here."
            cta={{ label: "Browse the Menu", href: "/menu" }}
          />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {items.map((item) => (
              <MenuCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </Container>
    </main>
  );
}
